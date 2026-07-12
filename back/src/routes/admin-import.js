// Bulk-import tasks from an Excel spreadsheet (admin panel "Импорт из
// Excel"). Mirrors the manual POST /api/admin/tasks validation per row so a
// bad row is skipped, not fatal to the whole batch.
const express = require("express");
const multer = require("multer");
const ExcelJS = require("exceljs");
const db = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const COLUMNS = [
  "grade", "subject", "topic", "prompt",
  "option_a", "option_b", "option_c", "option_d", "option_e", "option_f",
  "correct", "difficulty", "explanation", "hint_1", "hint_2",
];
const LETTER_TO_INDEX = { a: 0, b: 1, c: 2, d: 3, e: 4, f: 5 };
const OPTION_KEYS = ["option_a", "option_b", "option_c", "option_d", "option_e", "option_f"];

router.get("/tasks/import-template", requireRole("admin", "tutor"), async (_req, res, next) => {
  try {
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet("Задания");
    sheet.addRow(COLUMNS);
    sheet.addRow([
      7, "Математика", "fractions", "Сложи дроби: 1/4 + 1/4",
      "1/2", "2/8", "1/8", "2/4", "", "",
      "a", "easy", "Знаменатели одинаковые, складываем числители.", "", "",
    ]);

    const instructions = wb.addWorksheet("Инструкция");
    instructions.addRows([
      ["Колонка", "Описание"],
      ["grade", "Класс, число 5-11"],
      ["subject", "Русский или Математика"],
      ["topic", "Ключ темы (латиницей, напр. fractions)"],
      ["prompt", "Текст задания"],
      ["option_a..option_f", "Варианты ответа (минимум 2: a и b)"],
      ["correct", "Буква правильного варианта (a-f)"],
      ["difficulty", "easy / medium / hard"],
      ["explanation", "Необязательно: почему ответ верный"],
      ["hint_1, hint_2", "Необязательно: подсказки"],
    ]);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", "attachment; filename=tasks_template.xlsx");
    await wb.xlsx.write(res);
    res.end();
  } catch (e) {
    next(e);
  }
});

router.post("/tasks/import", requireRole("admin", "tutor"), upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: "file_required" });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(req.file.buffer);
    const sheet = wb.worksheets[0];
    if (!sheet) return res.status(400).json({ error: "empty_workbook" });

    const header = sheet.getRow(1).values.slice(1).map((h) => String(h || "").trim().toLowerCase());
    const results = { imported: 0, skipped: 0, errors: [] };

    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
      const row = sheet.getRow(rowNumber);
      const cells = row.values.slice(1);
      if (!cells.some((v) => String(v ?? "").trim())) continue; // blank row

      const obj = {};
      header.forEach((key, i) => {
        obj[key] = cells[i];
      });

      const options = OPTION_KEYS.map((k) => String(obj[k] ?? "").trim()).filter(Boolean);
      const correctLetter = String(obj.correct ?? "").trim().toLowerCase();
      const correct = LETTER_TO_INDEX[correctLetter];

      if (!obj.grade || !obj.subject || !obj.topic || !obj.prompt) {
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
      if (options.length < 2) {
        results.errors.push({ row: rowNumber, reason: "at_least_two_options" });
        results.skipped++;
        continue;
      }
      if (correct === undefined || correct >= options.length) {
        results.errors.push({ row: rowNumber, reason: "invalid_correct_letter" });
        results.skipped++;
        continue;
      }

      const hints = [obj.hint_1, obj.hint_2].map((h) => String(h ?? "").trim()).filter(Boolean);
      await db.query(
        `INSERT INTO tasks (grade, subject, topic, prompt, options, correct, explanation, difficulty, hints)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          grade,
          String(obj.subject).trim(),
          String(obj.topic).trim(),
          String(obj.prompt).trim(),
          JSON.stringify(options),
          correct,
          String(obj.explanation ?? "").trim() || null,
          String(obj.difficulty ?? "medium").trim() || "medium",
          JSON.stringify(hints),
        ]
      );
      results.imported++;
    }

    res.json(results);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
