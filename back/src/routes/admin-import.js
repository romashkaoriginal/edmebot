// Bulk-import tasks from an Excel spreadsheet (admin panel "Импорт из
// Excel"). Mirrors the manual POST /api/admin/tasks validation per row so a
// bad row is skipped, not fatal to the whole batch.
const express = require("express");
const { rateLimit } = require("express-rate-limit");
const crypto = require("crypto");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const readXlsxFile = require("read-excel-file/node");
const writeXlsxFile = require("write-excel-file/node");
const { parseMoscowDeadline } = require("../utils/deadline");
const db = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const { SUBJECT_VARIANTS, normalizeSubject } = require("../subjects");
const { upload, validateXlsxArchive, removeUpload } = require("../utils/excelUpload");

const router = express.Router();
router.use(requireAuth);
const importLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

const COLUMNS = [
  "grade", "subject", "topic", "prompt",
  "option_a", "option_b", "option_c", "option_d", "option_e", "option_f",
  "correct", "difficulty", "explanation", "hint_1", "hint_2",
];
const LETTER_TO_INDEX = { a: 0, b: 1, c: 2, d: 3, e: 4, f: 5 };
const OPTION_KEYS = ["option_a", "option_b", "option_c", "option_d", "option_e", "option_f"];
const DIFFICULTIES = new Set(["easy", "medium", "hard"]);
const ALLOWED_SUBJECTS = new Set(SUBJECT_VARIANTS.map((item) => item.canonical));
const bounded = (value, max) => {
  const text = String(value ?? "").trim().replace(/\u0000/g, "");
  return text && text.length <= max ? text : null;
};

function sheetData(rows) {
  return rows.map((row) => row.map((value) => ({
    value,
    type: typeof value === "number" ? Number : String,
  })));
}

async function sendWorkbook(res, sheets, names, filename) {
  const filePath = path.join(os.tmpdir(), `edme-template-${crypto.randomUUID()}.xlsx`);
  try {
    await writeXlsxFile(
      sheets.map((rows, index) => ({ data: sheetData(rows), sheet: names[index] }))
    ).toFile(filePath);
    const buffer = await fs.readFile(filePath);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
    res.send(buffer);
  } finally {
    await fs.unlink(filePath).catch(() => {});
  }
}

router.get("/tasks/import-template", requireRole("admin", "tutor"), async (_req, res, next) => {
  try {
    const taskRows = [COLUMNS, [
      7, "Математика", "Дроби", "Сложи дроби: 1/4 + 1/4",
      "1/2", "2/8", "1/8", "2/4", "", "",
      "a", "easy", "Знаменатели одинаковые, складываем числители.", "", "",
    ]];
    const instructions = [
      ["Колонка", "Описание"],
      ["grade", "Класс, число 5-11"],
      ["subject", "Русский или Математика"],
      ["topic", "Название темы (напр. Дроби)"],
      ["prompt", "Текст задания"],
      ["option_a..option_f", "Варианты ответа (минимум 2: a и b)"],
      ["correct", "Буква правильного варианта (a-f)"],
      ["difficulty", "easy / medium / hard"],
      ["explanation", "Необязательно: почему ответ верный"],
      ["hint_1, hint_2", "Необязательно: подсказки"],
    ];
    await sendWorkbook(res, [taskRows, instructions], ["Задания", "Инструкция"], "tasks_template.xlsx");
  } catch (e) {
    next(e);
  }
});

router.post("/tasks/import", requireRole("admin", "tutor"), importLimiter, upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: "file_required" });

    await validateXlsxArchive(req.file.path);
    const workbook = await readXlsxFile(req.file.path);
    const rows = workbook[0]?.data ?? [];
    if (!rows.length) return res.status(400).json({ error: "empty_workbook" });
    if (workbook.length > 10 || rows.length > 5000 || rows.some((row) => row.length > 50)) {
      return res.status(413).json({ error: "workbook_limits_exceeded" });
    }

    const header = rows[0].map((h) => String(h || "").trim().toLowerCase());
    const results = { imported: 0, skipped: 0, errors: [], importedBySubject: {} };

    for (let rowNumber = 2; rowNumber <= rows.length; rowNumber++) {
      const cells = rows[rowNumber - 1];
      if (!cells.some((v) => String(v ?? "").trim())) continue; // blank row

      const obj = {};
      header.forEach((key, i) => {
        obj[key] = cells[i];
      });

      const options = OPTION_KEYS.map((k) => String(obj[k] ?? "").trim()).filter(Boolean);
      const correctLetter = String(obj.correct ?? "").trim().toLowerCase();
      const correct = LETTER_TO_INDEX[correctLetter];

      const subject = normalizeSubject(obj.subject);
      const topic = bounded(obj.topic, 120);
      const prompt = bounded(obj.prompt, 4000);
      if (!obj.grade || !ALLOWED_SUBJECTS.has(subject) || !topic || !prompt) {
        results.errors.push({ row: rowNumber, reason: "grade_subject_topic_prompt_required" });
        results.skipped++;
        continue;
      }
      const grade = Number(obj.grade);
      if (!Number.isInteger(grade) || grade < 5 || grade > 11) {
        results.errors.push({ row: rowNumber, reason: "invalid_grade" });
        results.skipped++;
        continue;
      }
      if (options.length < 2 || options.length > 6 || options.some((option) => option.length > 1000)) {
        results.errors.push({ row: rowNumber, reason: "at_least_two_options" });
        results.skipped++;
        continue;
      }
      if (correct === undefined || correct >= options.length) {
        results.errors.push({ row: rowNumber, reason: "invalid_correct_letter" });
        results.skipped++;
        continue;
      }
      const difficulty = String(obj.difficulty ?? "medium").trim().toLowerCase() || "medium";
      if (!DIFFICULTIES.has(difficulty)) {
        results.errors.push({ row: rowNumber, reason: "invalid_difficulty" });
        results.skipped++;
        continue;
      }

      const hints = [obj.hint_1, obj.hint_2].map((h) => String(h ?? "").trim()).filter(Boolean);
      const explanation = String(obj.explanation ?? "").trim();
      if (hints.some((hint) => hint.length > 2000) || explanation.length > 8000) {
        results.errors.push({ row: rowNumber, reason: "text_too_long" });
        results.skipped++;
        continue;
      }
      await db.query(
        `INSERT INTO tasks (grade, subject, topic, prompt, options, correct, explanation, difficulty, hints)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          grade,
          subject,
          topic,
          prompt,
          JSON.stringify(options),
          correct,
          explanation || null,
          difficulty,
          JSON.stringify(hints),
        ]
      );
      results.imported++;
      results.importedBySubject[subject] = (results.importedBySubject[subject] ?? 0) + 1;
    }

    res.json(results);
  } catch (e) {
    if (["invalid_xlsx_archive", "xlsx_archive_limits_exceeded"].includes(e.message)) {
      return res.status(400).json({ error: e.message });
    }
    return next(e);
  } finally {
    await removeUpload(req.file?.path);
  }
});

// ---------- Homework import ----------

const HW_COLUMNS = ["student_tg_id", "subject", "title", "description", "due", "task_ids", "max_attempts"];

router.get("/homework/import-template", requireRole("admin", "tutor"), async (_req, res, next) => {
  try {
    const homeworkRows = [HW_COLUMNS, [
      "123456789", "Математика", "Сложение дробей", "Реши задания к следующему занятию",
      "2026-12-31 18:00", "12, 15, 18", 2,
    ]];
    const instructions = [
      ["Колонка", "Описание"],
      ["student_tg_id", "Telegram ID ученика, которому выдаётся домашка (обязательно)"],
      ["subject", "Предмет ученика: Математика или Русский (обязательно)"],
      ["title", "Заголовок домашки (обязательно)"],
      ["description", "Что нужно сделать (необязательно)"],
      ["due", "Срок сдачи: ГГГГ-ММ-ДД или ГГГГ-ММ-ДД ЧЧ:ММ (необязательно)"],
      ["task_ids", "ID заданий из базы через запятую, напр. 12, 15, 18 (минимум одно)"],
      ["max_attempts", "Число попыток от 1 до 20 (по умолчанию 1)"],
    ];
    await sendWorkbook(res, [homeworkRows, instructions], ["Домашка", "Инструкция"], "homework_template.xlsx");
  } catch (e) {
    next(e);
  }
});

router.post("/homework/import", requireRole("admin", "tutor"), importLimiter, upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: "file_required" });

    await validateXlsxArchive(req.file.path);
    const workbook = await readXlsxFile(req.file.path);
    const rows = workbook[0]?.data ?? [];
    if (!rows.length) return res.status(400).json({ error: "empty_workbook" });
    if (workbook.length > 10 || rows.length > 5000 || rows.some((row) => row.length > 50)) {
      return res.status(413).json({ error: "workbook_limits_exceeded" });
    }

    const header = rows[0].map((h) => String(h || "").trim().toLowerCase());
    const results = { imported: 0, skipped: 0, errors: [] };

    for (let rowNumber = 2; rowNumber <= rows.length; rowNumber++) {
      const cells = rows[rowNumber - 1];
      if (!cells.some((v) => String(v ?? "").trim())) continue; // blank row

      const obj = {};
      header.forEach((key, i) => {
        obj[key] = cells[i];
      });

      const tgId = String(obj.student_tg_id ?? "").trim();
      const title = String(obj.title ?? "").trim();
      const subject = normalizeSubject(obj.subject);
      const description = String(obj.description ?? "").trim();
      const maxAttempts = obj.max_attempts == null || obj.max_attempts === "" ? 1 : Number(obj.max_attempts);
      if (!/^\d{5,20}$/.test(tgId) || !title || title.length > 200 || !ALLOWED_SUBJECTS.has(subject)) {
        results.errors.push({ row: rowNumber, reason: "student_tg_id_and_title_required" });
        results.skipped++;
        continue;
      }
      if (description.length > 4000 || !Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 20) {
        results.errors.push({ row: rowNumber, reason: "invalid_description_or_max_attempts" });
        results.skipped++;
        continue;
      }

      const { rows: srows } = await db.query(
        `SELECT s.id, ss.grade
           FROM students s
           JOIN student_subjects ss ON ss.student_id = s.id AND ss.subject = $2
          WHERE s.tg_id = $1 AND s.status = 'active'`,
        [tgId, subject]
      );
      if (!srows.length) {
        results.errors.push({ row: rowNumber, reason: "student_not_found_or_not_enrolled" });
        results.skipped++;
        continue;
      }

      const rawDue = obj.due;
      const hasDue = rawDue instanceof Date || String(rawDue ?? "").trim();
      const due = hasDue ? parseMoscowDeadline(rawDue) : null;
      if (hasDue && !due) {
        results.errors.push({ row: rowNumber, reason: "invalid_due_date" });
        results.skipped++;
        continue;
      }

      const taskIds = String(obj.task_ids ?? "")
        .split(/[,;]/)
        .map((t) => Number(String(t).trim()))
        .filter((n) => Number.isInteger(n) && n > 0);
      const uniqueTaskIds = [...new Set(taskIds)];
      if (!uniqueTaskIds.length) {
        results.errors.push({ row: rowNumber, reason: "at_least_one_task_required" });
        results.skipped++;
        continue;
      }
      const { rows: taskRows } = await db.query(
        `SELECT id FROM tasks
          WHERE id = ANY($1::bigint[]) AND subject = $2 AND grade = $3`,
        [uniqueTaskIds, subject, srows[0].grade]
      );
      if (taskRows.length !== uniqueTaskIds.length) {
        results.errors.push({ row: rowNumber, reason: "tasks_do_not_match_student" });
        results.skipped++;
        continue;
      }

      await db.transaction(async (client) => {
        const { rows } = await client.query(
          `INSERT INTO homework
             (student_id, subject, title, description, due, task_ids, max_attempts)
           VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
          [srows[0].id, subject, title, description || null, due, JSON.stringify(uniqueTaskIds), maxAttempts]
        );
        for (let index = 0; index < uniqueTaskIds.length; index++) {
          await client.query(
            "INSERT INTO homework_tasks (homework_id, task_id, position) VALUES ($1,$2,$3)",
            [rows[0].id, uniqueTaskIds[index], index]
          );
        }
      });
      results.imported++;
    }

    res.json(results);
  } catch (e) {
    if (["invalid_xlsx_archive", "xlsx_archive_limits_exceeded"].includes(e.message)) {
      return res.status(400).json({ error: e.message });
    }
    return next(e);
  } finally {
    await removeUpload(req.file?.path);
  }
});

module.exports = router;
