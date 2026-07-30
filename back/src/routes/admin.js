// Admin panel API. Gated by tg_id -> role lookup (see ../middleware/auth.js).
// Admin: students, users, tasks, homework, stats, bonuses.
// Tutor: tasks, homework, stats only.
const express = require("express");
const crypto = require("crypto");
const db = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const { SUBJECT_VARIANTS, normalizeSubject } = require("../subjects");

const router = express.Router();

function bad(res, msg, code = 400) {
  return res.status(code).json({ error: msg });
}

const ALLOWED_SUBJECTS = new Set(SUBJECT_VARIANTS.map((item) => item.canonical));
const DIFFICULTIES = new Set(["easy", "medium", "hard"]);

function cleanText(value, maxLength, { required = false } = {}) {
  const text = String(value ?? "").trim().replace(/\u0000/g, "");
  if ((required && !text) || text.length > maxLength) return null;
  return text;
}

function cleanSubject(value) {
  const subject = normalizeSubject(value);
  return ALLOWED_SUBJECTS.has(subject) ? subject : null;
}

function cleanTelegramId(value, { demo = false } = {}) {
  const text = String(value ?? "").trim();
  if (demo && /^(demo|демо)(:|$)/iu.test(text)) return text;
  return /^\d{5,20}$/.test(text) ? text : null;
}

router.use(requireAuth);

// ---------- Me ----------

router.get("/me", (req, res) => {
  res.json({ user: { id: req.user.id, tgId: req.user.tg_id, name: req.user.name, role: req.user.role } });
});

router.get("/telegram-contacts", requireRole("admin"), async (req, res, next) => {
  try {
    const kind = req.query.kind === "user" ? "user" : "student";
    const targetTable = kind === "user" ? "users" : "students";
    const excludeStaff = kind === "student"
      ? "AND NOT EXISTS (SELECT 1 FROM users u WHERE u.tg_id = c.tg_id)"
      : "";
    const { rows } = await db.query(
      `SELECT c.tg_id, c.name, c.username, c.last_seen_at
         FROM telegram_contacts c
        WHERE NOT EXISTS (SELECT 1 FROM ${targetTable} t WHERE t.tg_id = c.tg_id)
          ${excludeStaff}
        ORDER BY c.last_seen_at DESC`,
    );
    res.json({ contacts: rows });
  } catch (e) {
    next(e);
  }
});

// ---------- Users (admin only) ----------

router.get("/users", requireRole("admin"), async (_req, res, next) => {
  try {
    const { rows } = await db.query("SELECT * FROM users ORDER BY id ASC");
    res.json({ users: rows });
  } catch (e) {
    next(e);
  }
});

router.post("/users", requireRole("admin"), async (req, res, next) => {
  try {
    const { tgId, name, role } = req.body ?? {};
    const cleanTgId = cleanTelegramId(tgId);
    const cleanName = cleanText(name, 100, { required: true });
    if (!cleanTgId) return bad(res, "invalid_tg_id");
    if (!cleanName || !role) return bad(res, "name_and_role_required");
    if (!["admin", "tutor"].includes(role)) return bad(res, "invalid_role");
    const { rows } = await db.query(
      `INSERT INTO users (tg_id, name, role) VALUES ($1,$2,$3) RETURNING *`,
      [cleanTgId, cleanName, role]
    );
    res.status(201).json({ user: rows[0] });
  } catch (e) {
    if (e.code === "23505") return bad(res, "tg_id_already_exists", 409);
    next(e);
  }
});

router.put("/users/:id", requireRole("admin"), async (req, res, next) => {
  try {
    const { name, role } = req.body ?? {};
    if (role && !["admin", "tutor"].includes(role)) return bad(res, "invalid_role");
    const cleanName = name == null ? null : cleanText(name, 100, { required: true });
    if (name != null && !cleanName) return bad(res, "invalid_name");
    if (role && String(req.user.id) === String(req.params.id) && role !== req.user.role) {
      return bad(res, "cannot_change_own_role", 409);
    }
    const rows = await db.transaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(918273)");
      const { rows: targetRows } = await client.query(
        "SELECT * FROM users WHERE id = $1 FOR UPDATE",
        [req.params.id]
      );
      if (!targetRows.length) return [];
      if (targetRows[0].role === "admin" && role === "tutor") {
        const { rows: counts } = await client.query("SELECT COUNT(*)::int AS count FROM users WHERE role = 'admin'");
        if (counts[0].count <= 1) return { error: "last_admin_required" };
      }
      const updated = await client.query(
        `UPDATE users
           SET name = COALESCE($2, name),
               role = COALESCE($3, role)
         WHERE id = $1 RETURNING *`,
        [req.params.id, cleanName, role ?? null]
      );
      return updated.rows;
    });
    if (rows.error) return bad(res, rows.error, 409);
    if (!rows.length) return bad(res, "not_found", 404);
    res.json({ user: rows[0] });
  } catch (e) {
    next(e);
  }
});

router.delete("/users/:id", requireRole("admin"), async (req, res, next) => {
  try {
    if (String(req.user.id) === String(req.params.id)) {
      return bad(res, "cannot_delete_self");
    }
    const rowCount = await db.transaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(918273)");
      const { rows } = await client.query("SELECT role FROM users WHERE id = $1 FOR UPDATE", [req.params.id]);
      if (!rows.length) return 0;
      if (rows[0].role === "admin") {
        const { rows: counts } = await client.query("SELECT COUNT(*)::int AS count FROM users WHERE role = 'admin'");
        if (counts[0].count <= 1) return -1;
      }
      const deleted = await client.query("DELETE FROM users WHERE id = $1", [req.params.id]);
      return deleted.rowCount;
    });
    if (rowCount === -1) return bad(res, "last_admin_required", 409);
    if (!rowCount) return bad(res, "not_found", 404);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ---------- Students (admin only: add/remove) ----------

router.get("/students", requireRole("admin", "tutor"), async (_req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT s.*,
              (s.tg_id = 'demo' OR s.tg_id LIKE 'demo:%') AS is_demo,
              COALESCE((
                SELECT jsonb_agg(
                  jsonb_build_object('subject', ss.subject, 'grade', ss.grade)
                  ORDER BY ss.created_at ASC
                )
                  FROM student_subjects ss
                 WHERE ss.student_id = s.id
              ), '[]'::jsonb) AS subjects
         FROM students s
       WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.tg_id = s.tg_id)
       ORDER BY s.id ASC`
    );
    res.json({ students: rows });
  } catch (e) {
    next(e);
  }
});

router.get("/demo-students", requireRole("admin", "tutor"), async (_req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT id, name, grade, subject
         FROM students
        WHERE status = 'active'
          AND (tg_id = 'demo' OR tg_id LIKE 'demo:%')
        ORDER BY id ASC`
    );
    res.json({ students: rows });
  } catch (e) {
    next(e);
  }
});

// Normalise the subject list a form can submit. Accepts either the new
// `subjects: [{subject, grade}]` array or the legacy single `subject`/`grade`.
function readSubjects(body) {
  const out = [];
  const seen = new Set();
  const push = (subject, grade) => {
    const s = cleanSubject(subject);
    const g = Number(grade);
    if (!s || !Number.isInteger(g) || g < 6 || g > 11 || seen.has(s)) return;
    seen.add(s);
    out.push({ subject: s, grade: g });
  };
  if (Array.isArray(body?.subjects)) {
    for (const item of body.subjects) push(item?.subject, item?.grade);
  } else if (body?.subject) {
    push(body.subject, body.grade);
  }
  return out;
}

function fullName(firstName, lastName) {
  return [cleanText(firstName, 60) ?? "", cleanText(lastName, 60) ?? ""]
    .filter(Boolean)
    .join(" ");
}

function isDemoTelegramId(value) {
  return /^(demo|демо)(:|$)/iu.test(String(value ?? "").trim());
}

function studentTelegramId(value, currentValue = null) {
  const input = String(value ?? "").trim();
  if (/^(demo|демо)$/iu.test(input)) {
    return isDemoTelegramId(currentValue) ? currentValue : `demo:${crypto.randomUUID()}`;
  }
  return input;
}

router.post("/students", requireRole("admin"), async (req, res, next) => {
  try {
    const { firstName, lastName } = req.body ?? {};
    const tgId = studentTelegramId(req.body?.tgId);
    if (!cleanTelegramId(tgId, { demo: true })) return bad(res, "invalid_tg_id");
    const name = fullName(firstName, lastName);
    if (!name) return bad(res, "name_required");
    const subjects = readSubjects(req.body);
    const demo = isDemoTelegramId(tgId);
    if (!demo && !subjects.length) return bad(res, "at_least_one_subject_required");
    const { rows: staffRows } = await db.query("SELECT 1 FROM users WHERE tg_id = $1", [tgId]);
    if (staffRows.length) return bad(res, "staff_account_cannot_be_student", 409);
    // The first subject is the "primary" one (kept on students for display/
    // back-compat); the rest go into student_subjects. status defaults to
    // 'active' — a student created here already has a subject.
    const primary = subjects[0] ?? { grade: null, subject: null };
    const student = await db.transaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO students
           (tg_id, name, first_name, last_name, grade, subject, access_kind)
         VALUES ($1,$2,$3,$4,$5,$6,'assigned') RETURNING *`,
        [tgId, name, cleanText(firstName, 60) || null, cleanText(lastName, 60) || null, primary.grade, primary.subject]
      );
      for (const s of subjects) {
        await client.query(
          `INSERT INTO student_subjects (student_id, subject, grade) VALUES ($1,$2,$3)
           ON CONFLICT (student_id, subject) DO UPDATE SET grade = EXCLUDED.grade`,
          [rows[0].id, s.subject, s.grade]
        );
      }
      return rows[0];
    });
    res.status(201).json({ student });
  } catch (e) {
    if (e.code === "23505") return bad(res, "tg_id_already_exists", 409);
    next(e);
  }
});

router.put("/students/:id", requireRole("admin"), async (req, res, next) => {
  try {
    const { firstName, lastName, grade, subject } = req.body ?? {};
    let { tgId } = req.body ?? {};
    if (tgId === "") return bad(res, "tg_id_required");
    if (/^(demo|демо)$/iu.test(String(tgId ?? "").trim())) {
      const { rows: currentRows } = await db.query("SELECT tg_id FROM students WHERE id = $1", [req.params.id]);
      if (!currentRows.length) return bad(res, "not_found", 404);
      tgId = studentTelegramId(tgId, currentRows[0].tg_id);
    }
    const hasName = firstName != null || lastName != null;
    const name = hasName ? fullName(firstName, lastName) : null;
    if (hasName && !name) return bad(res, "name_required");
    const cleanTgId = tgId == null ? null : cleanTelegramId(tgId, { demo: true });
    if (tgId != null && !cleanTgId) return bad(res, "invalid_tg_id");
    const hasPrimaryChange = grade != null || subject != null;
    const cleanGrade = hasPrimaryChange ? Number(grade) : null;
    const cleanPrimarySubject = hasPrimaryChange ? cleanSubject(subject) : null;
    if (hasPrimaryChange && (
      !Number.isInteger(cleanGrade) || cleanGrade < 6 || cleanGrade > 11 || !cleanPrimarySubject
    )) return bad(res, "invalid_subject_or_grade");
    const rows = await db.transaction(async (client) => {
      const { rows: currentRows } = await client.query(
        "SELECT * FROM students WHERE id = $1 FOR UPDATE",
        [req.params.id]
      );
      if (!currentRows.length) return [];
      const current = currentRows[0];
      if (hasPrimaryChange) {
        await client.query(
          `INSERT INTO student_subjects (student_id, subject, grade) VALUES ($1,$2,$3)
           ON CONFLICT (student_id, subject) DO UPDATE SET grade = EXCLUDED.grade`,
          [req.params.id, cleanPrimarySubject, cleanGrade]
        );
      }
      const updated = await client.query(
        `UPDATE students
           SET name = COALESCE($2, name),
               first_name = CASE WHEN $6 THEN $7 ELSE first_name END,
               last_name = CASE WHEN $8 THEN $9 ELSE last_name END,
               grade = COALESCE($3, grade),
               subject = COALESCE($4, subject),
               tg_id = COALESCE($5, tg_id)
         WHERE id = $1 RETURNING *`,
        [
          req.params.id, name, cleanGrade, cleanPrimarySubject, cleanTgId,
          firstName != null, cleanText(firstName, 60) || null,
          lastName != null, cleanText(lastName, 60) || null,
        ]
      );
      return updated.rows;
    });
    if (!rows.length) return bad(res, "not_found", 404);
    res.json({ student: rows[0] });
  } catch (e) {
    if (e.code === "23505") return bad(res, "tg_id_already_exists", 409);
    next(e);
  }
});

router.delete("/students/:id", requireRole("admin"), async (req, res, next) => {
  try {
    const { rowCount } = await db.query("DELETE FROM students WHERE id = $1", [req.params.id]);
    if (!rowCount) return bad(res, "not_found", 404);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ---------- Subject enrollments (how a self-serve "pending" student gets
// promoted to full access, and how any student gains a second subject) ----------

router.get("/students/:id/subjects", requireRole("admin", "tutor"), async (req, res, next) => {
  try {
    const { rows } = await db.query(
      "SELECT subject, grade FROM student_subjects WHERE student_id = $1 ORDER BY created_at ASC",
      [req.params.id]
    );
    res.json({ subjects: rows });
  } catch (e) {
    next(e);
  }
});

router.post("/students/:id/subjects", requireRole("admin", "tutor"), async (req, res, next) => {
  try {
    const { subject, grade } = req.body ?? {};
    const cleanEnrollmentSubject = cleanSubject(subject);
    const cleanGrade = Number(grade);
    if (!cleanEnrollmentSubject || !Number.isInteger(cleanGrade) || cleanGrade < 6 || cleanGrade > 11) {
      return bad(res, "invalid_subject_or_grade");
    }
    const rows = await db.transaction(async (client) => {
      const { rows: studentRows } = await client.query(
        "SELECT id FROM students WHERE id = $1 FOR UPDATE",
        [req.params.id]
      );
      if (!studentRows.length) return [];
      await client.query(
        `INSERT INTO student_subjects (student_id, subject, grade) VALUES ($1,$2,$3)
         ON CONFLICT (student_id, subject) DO UPDATE SET grade = EXCLUDED.grade`,
        [req.params.id, cleanEnrollmentSubject, cleanGrade]
      );
      const updated = await client.query(
        `UPDATE students
            SET status = 'active',
                access_kind = 'assigned',
                access_until = NULL,
                subject = COALESCE(subject, $2),
                grade = COALESCE(grade, $3)
          WHERE id = $1 RETURNING *`,
        [req.params.id, cleanEnrollmentSubject, cleanGrade]
      );
      return updated.rows;
    });
    if (!rows.length) return bad(res, "not_found", 404);
    res.json({ student: rows[0] });
  } catch (e) {
    if (e.code === "23503") return bad(res, "student_not_found", 404);
    next(e);
  }
});

// ---------- Coins (admin adjustments, admin+tutor can view history) ----------

router.get("/students/:id/bonus", requireRole("admin", "tutor"), async (req, res, next) => {
  try {
    const { rows: srows } = await db.query("SELECT id FROM students WHERE id = $1", [req.params.id]);
    if (!srows.length) return bad(res, "not_found", 404);
    const [{ rows: transactions }, { rows: profiles }] = await Promise.all([
      db.query(
        "SELECT * FROM bonus_transactions WHERE student_id = $1 ORDER BY id DESC",
        [req.params.id]
      ),
      db.query(
        `SELECT COALESCE(
           (SELECT coins FROM student_profiles WHERE student_id = $1),
           0
         )::int AS coins`,
        [req.params.id]
      ),
    ]);
    res.json({ balance: profiles[0]?.coins ?? 0, transactions });
  } catch (e) {
    next(e);
  }
});

router.post("/students/:id/bonus", requireRole("admin"), async (req, res, next) => {
  try {
    const { amount, reason } = req.body ?? {};
    const amt = Number(amount);
    const cleanReason = cleanText(reason, 240);
    if (!Number.isInteger(amt) || amt === 0 || Math.abs(amt) > 100000) return bad(res, "invalid_amount");
    if (reason != null && cleanReason == null) return bad(res, "invalid_reason");
    const result = await db.transaction(async (client) => {
      const { rows: students } = await client.query(
        "SELECT id FROM students WHERE id = $1 FOR UPDATE",
        [req.params.id]
      );
      if (!students.length) return { error: "not_found" };
      const { rows: profiles } = await client.query(
        "SELECT coins FROM student_profiles WHERE student_id = $1 FOR UPDATE",
        [req.params.id]
      );
      if (!profiles.length && amt < 0) return { error: "insufficient_coin_balance" };
      if (!profiles.length) {
        await client.query(
          "INSERT INTO student_profiles (student_id) VALUES ($1)",
          [req.params.id]
        );
      }
      const updated = await client.query(
        `UPDATE student_profiles
            SET coins = coins + $2, updated_at = now()
          WHERE student_id = $1 AND coins + $2 >= 0
          RETURNING coins`,
        [req.params.id, amt]
      );
      if (!updated.rows.length) return { error: "insufficient_coin_balance" };
      const { rows } = await client.query(
        `INSERT INTO bonus_transactions (student_id, amount, reason, created_by)
         VALUES ($1,$2,$3,$4) RETURNING *`,
        [req.params.id, amt, cleanReason || null, req.user.tg_id]
      );
      return { transaction: rows[0], balance: updated.rows[0].coins };
    });
    if (result.error) return bad(res, result.error, result.error === "not_found" ? 404 : 409);
    res.status(201).json(result);
  } catch (e) {
    next(e);
  }
});

// ---------- Tasks (admin + tutor) ----------

function cleanTask(body) {
  const grade = Number(body?.grade);
  const subject = cleanSubject(body?.subject);
  const topic = cleanText(body?.topic, 120, { required: true });
  const prompt = cleanText(body?.prompt, 4000, { required: true });
  const options = Array.isArray(body?.options)
    ? body.options.map((option) => cleanText(option, 1000, { required: true }))
    : [];
  const correct = Number(body?.correct);
  const explanation = cleanText(body?.explanation, 8000);
  const difficulty = body?.difficulty || "medium";
  const hints = Array.isArray(body?.hints)
    ? body.hints.map((hint) => cleanText(hint, 2000, { required: true })).filter(Boolean)
    : [];
  if (!Number.isInteger(grade) || grade < 5 || grade > 11) return { error: "invalid_grade" };
  if (!subject) return { error: "invalid_subject" };
  if (!topic || !prompt) return { error: "topic_and_prompt_required" };
  if (options.length < 2 || options.length > 6 || options.some((option) => !option)) {
    return { error: "invalid_options" };
  }
  if (!Number.isInteger(correct) || correct < 0 || correct >= options.length) {
    return { error: "correct_index_out_of_range" };
  }
  if (!DIFFICULTIES.has(difficulty)) return { error: "invalid_difficulty" };
  if (body?.explanation != null && explanation == null) return { error: "invalid_explanation" };
  if (hints.length > 5 || (Array.isArray(body?.hints) && hints.length !== body.hints.filter(Boolean).length)) {
    return { error: "invalid_hints" };
  }
  return { value: { grade, subject, topic, prompt, options, correct, explanation, difficulty, hints } };
}

router.get("/tasks/overview", requireRole("admin", "tutor"), async (req, res, next) => {
  try {
    const { subject } = req.query;
    if (!subject) return bad(res, "subject_required");
    const { rows } = await db.query(
      `SELECT grade,
              COUNT(DISTINCT topic)::int AS topics,
              COUNT(*)::int AS questions
         FROM tasks
        WHERE subject = $1
        GROUP BY grade
        ORDER BY grade ASC`,
      [subject]
    );
    res.json({ grades: rows });
  } catch (e) {
    next(e);
  }
});

// Distinct topics for a grade+subject, each with how many questions it holds.
// Powers the topic step of the tasks wizard (subject → class → topic → questions).
router.get("/tasks/topics", requireRole("admin", "tutor"), async (req, res, next) => {
  try {
    const { grade, subject } = req.query;
    if (!grade || !subject) return bad(res, "grade_and_subject_required");
    const { rows } = await db.query(
      `SELECT topic, COUNT(*)::int AS count
         FROM tasks WHERE grade = $1 AND subject = $2
        GROUP BY topic ORDER BY topic ASC`,
      [Number(grade), subject]
    );
    res.json({ topics: rows });
  } catch (e) {
    next(e);
  }
});

router.get("/tasks", requireRole("admin", "tutor"), async (req, res, next) => {
  try {
    const { grade, subject, topic } = req.query;
    const clauses = [];
    const params = [];
    if (grade) {
      params.push(Number(grade));
      clauses.push(`grade = $${params.length}`);
    }
    if (subject) {
      params.push(subject);
      clauses.push(`subject = $${params.length}`);
    }
    if (topic) {
      params.push(topic);
      clauses.push(`topic = $${params.length}`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const { rows } = await db.query(
      `SELECT * FROM tasks ${where} ORDER BY id DESC`,
      params
    );
    res.json({ tasks: rows });
  } catch (e) {
    next(e);
  }
});

router.post("/tasks", requireRole("admin", "tutor"), async (req, res, next) => {
  try {
    const { value, error } = cleanTask(req.body);
    if (error) return bad(res, error);
    const { grade, subject, topic, prompt, options, correct, explanation, difficulty, hints } = value;
    const { rows } = await db.query(
      `INSERT INTO tasks (grade, subject, topic, prompt, options, correct, explanation, difficulty, hints)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [
        Number(grade),
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
    res.status(201).json({ task: rows[0] });
  } catch (e) {
    next(e);
  }
});

router.put("/tasks/:id", requireRole("admin", "tutor"), async (req, res, next) => {
  try {
    const { value, error } = cleanTask(req.body);
    if (error) return bad(res, error);
    const { grade, subject, topic, prompt, options, correct, explanation, difficulty, hints } = value;
    const { rows } = await db.query(
      `UPDATE tasks
          SET grade = $2, subject = $3, topic = $4, prompt = $5, options = $6,
              correct = $7, explanation = $8, difficulty = $9, hints = $10
        WHERE id = $1 RETURNING *`,
      [
        req.params.id,
        Number(grade),
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
    if (!rows.length) return bad(res, "not_found", 404);
    res.json({ task: rows[0] });
  } catch (e) {
    next(e);
  }
});

router.delete("/tasks/:id", requireRole("admin", "tutor"), async (req, res, next) => {
  try {
    const { rowCount } = await db.query("DELETE FROM tasks WHERE id = $1", [req.params.id]);
    if (!rowCount) return bad(res, "not_found", 404);
    res.json({ ok: true });
  } catch (e) {
    if (e.code === "23503") return bad(res, "task_is_used_in_homework", 409);
    next(e);
  }
});

// Topics are derived from tasks, therefore deleting the task bank for a
// grade+subject also clears every topic in that scope.
router.delete("/tasks", requireRole("admin", "tutor"), async (req, res, next) => {
  try {
    const { grade, subject } = req.query;
    if (!grade || !subject) return bad(res, "grade_and_subject_required");
    const parsedGrade = Number(grade);
    if (!Number.isInteger(parsedGrade) || parsedGrade < 5 || parsedGrade > 11)
      return bad(res, "invalid_grade");
    const cleanTaskSubject = cleanSubject(subject);
    if (!cleanTaskSubject) return bad(res, "invalid_subject");
    const { rows: referenced } = await db.query(
      `SELECT COUNT(*)::int AS count
         FROM homework_tasks ht
         JOIN tasks t ON t.id = ht.task_id
        WHERE t.grade = $1 AND t.subject = $2`,
      [parsedGrade, cleanTaskSubject]
    );
    if (referenced[0].count > 0) return bad(res, "tasks_are_used_in_homework", 409);
    const { rowCount } = await db.query(
      "DELETE FROM tasks WHERE grade = $1 AND subject = $2",
      [parsedGrade, cleanTaskSubject]
    );
    res.json({ deleted: rowCount });
  } catch (e) {
    next(e);
  }
});

// ---------- Homework (admin + tutor) ----------

router.get("/homework", requireRole("admin", "tutor"), async (req, res, next) => {
  try {
    const { studentId } = req.query;
    const params = [];
    let where = "";
    if (studentId) {
      params.push(studentId);
      where = `WHERE hw.student_id = $1`;
    }
    const { rows } = await db.query(
      `SELECT hw.*, s.name AS student_name,
              COALESCE(
                (SELECT jsonb_agg(ht.task_id ORDER BY ht.position)
                   FROM homework_tasks ht WHERE ht.homework_id = hw.id),
                '[]'::jsonb
              ) AS normalized_task_ids,
              (SELECT COUNT(*)::int FROM homework_questions hq WHERE hq.homework_id = hw.id) AS own_question_count,
              (
                (SELECT COUNT(*)::int FROM homework_tasks ht WHERE ht.homework_id = hw.id) +
                (SELECT COUNT(*)::int FROM homework_questions hq WHERE hq.homework_id = hw.id)
              )::int AS question_count
         FROM homework hw JOIN students s ON s.id = hw.student_id
         ${where}
         ORDER BY hw.id DESC`,
      params
    );
    res.json({
      homework: rows.map(({ normalized_task_ids: taskIds, ...row }) => ({ ...row, task_ids: taskIds })),
    });
  } catch (e) {
    next(e);
  }
});

// Validate the shape of a homework-only question (no topic/subject — those
// only exist on shared task-bank rows).
function cleanQuestions(questions) {
  if (!Array.isArray(questions)) return { error: "invalid_questions" };
  if (questions.length > 100) return { error: "too_many_questions" };
  const clean = [];
  for (const q of questions) {
    const prompt = cleanText(q?.prompt, 4000, { required: true });
    const options = Array.isArray(q?.options)
      ? q.options.map((option) => cleanText(option, 1000, { required: true }))
      : [];
    const correct = Number(q?.correct);
    if (!prompt || options.length < 2 || options.length > 6 || options.some((o) => !o)) return { error: "invalid_questions" };
    if (!Number.isInteger(correct) || correct < 0 || correct >= options.length) return { error: "invalid_questions" };
    const explanation = cleanText(q?.explanation, 8000);
    if (q?.explanation != null && explanation == null) return { error: "invalid_questions" };
    clean.push({ prompt, options, correct, explanation: explanation || null });
  }
  return { clean };
}

router.post("/homework", requireRole("admin", "tutor"), async (req, res, next) => {
  try {
    const { studentId, title, description, due, taskIds, questions, subject: requestedSubject, maxAttempts } = req.body ?? {};
    if (!studentId || !title) return bad(res, "studentId_and_title_required");
    const cleanTitle = String(title).trim();
    const cleanDescription = cleanText(description, 4000);
    if (!cleanTitle || cleanTitle.length > 200) return bad(res, "invalid_title");
    if (description != null && cleanDescription == null) return bad(res, "invalid_description");
    if (due && Number.isNaN(new Date(due).getTime())) return bad(res, "invalid_due_date");

    const cleanMaxAttempts = maxAttempts == null || maxAttempts === "" ? 1 : Number(maxAttempts);
    if (!Number.isInteger(cleanMaxAttempts) || cleanMaxAttempts < 1 || cleanMaxAttempts > 20) {
      return bad(res, "invalid_max_attempts");
    }

    const submittedTaskIds = Array.isArray(taskIds) ? taskIds : [];
    const cleanTaskIds = [...new Set(submittedTaskIds.map(Number))];
    if (cleanTaskIds.some((id) => !Number.isInteger(id) || id <= 0)) {
      return bad(res, "invalid_task_ids");
    }

    const { clean: cleanQuestionList, error: questionsError } = cleanQuestions(questions ?? []);
    if (questionsError) return bad(res, questionsError);

    if (!cleanTaskIds.length && !cleanQuestionList.length) return bad(res, "at_least_one_question_required");

    const { rows: studentRows } = await db.query(
      "SELECT id, grade, subject FROM students WHERE id = $1 AND status = 'active'",
      [studentId]
    );
    if (!studentRows.length) return bad(res, "student_not_found", 404);
    const student = studentRows[0];
    const subject = cleanSubject(requestedSubject || student.subject);
    if (!subject) return bad(res, "invalid_subject");
    const { rows: enrollmentRows } = await db.query(
      "SELECT grade FROM student_subjects WHERE student_id = $1 AND subject = $2",
      [studentId, subject]
    );
    if (!enrollmentRows.length) return bad(res, "student_not_enrolled_in_subject");
    const grade = enrollmentRows[0].grade;

    if (cleanTaskIds.length) {
      const { rows: taskRows } = await db.query(
        `SELECT id FROM tasks
          WHERE id = ANY($1::bigint[])
            AND grade = $2
            AND subject = $3`,
        [cleanTaskIds, grade, subject]
      );
      if (taskRows.length !== cleanTaskIds.length) return bad(res, "tasks_do_not_match_student");
    }

    const client = await db.pool.connect();
    let homework;
    try {
      await client.query("BEGIN");
      const { rows } = await client.query(
        `INSERT INTO homework (student_id, subject, title, description, due, task_ids, max_attempts)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [studentId, subject, cleanTitle, cleanDescription || null, due || null, JSON.stringify(cleanTaskIds), cleanMaxAttempts]
      );
      homework = rows[0];

      for (let i = 0; i < cleanTaskIds.length; i++) {
        await client.query(
          "INSERT INTO homework_tasks (homework_id, task_id, position) VALUES ($1,$2,$3)",
          [homework.id, cleanTaskIds[i], i]
        );
      }

      for (let i = 0; i < cleanQuestionList.length; i++) {
        const q = cleanQuestionList[i];
        await client.query(
          `INSERT INTO homework_questions (homework_id, prompt, options, correct, explanation, position)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [homework.id, q.prompt, JSON.stringify(q.options), q.correct, q.explanation, i]
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    res.status(201).json({ homework });
  } catch (e) {
    if (e.code === "23503") return bad(res, "student_not_found", 404);
    next(e);
  }
});

router.delete("/homework/:id", requireRole("admin", "tutor"), async (req, res, next) => {
  try {
    const { rowCount } = await db.query("DELETE FROM homework WHERE id = $1", [req.params.id]);
    if (!rowCount) return bad(res, "not_found", 404);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ---------- Stats (admin + tutor) ----------

// Summary across all students. Staff members (who may also have a student
// row bound to the same tg_id) are excluded — statistics is about learners.
router.get("/stats", requireRole("admin", "tutor"), async (_req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT s.id, s.name, s.grade, s.subject,
              COUNT(a.id)::int AS attempts,
              COUNT(a.id) FILTER (WHERE a.correct)::int AS correct
         FROM students s
         LEFT JOIN attempts a ON a.student_id = s.id
        WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.tg_id = s.tg_id)
         GROUP BY s.id
         ORDER BY s.id ASC`
    );
    const students = rows.map((r) => ({
      ...r,
      accuracy: r.attempts ? Math.round((r.correct / r.attempts) * 100) : 0,
    }));
    res.json({ students });
  } catch (e) {
    next(e);
  }
});

// Detailed stats for one student, broken down by topic.
router.get("/stats/:studentId", requireRole("admin", "tutor"), async (req, res, next) => {
  try {
    const id = req.params.studentId;
    const { rows: srows } = await db.query(
      `SELECT s.* FROM students s
        WHERE s.id = $1
          AND NOT EXISTS (SELECT 1 FROM users u WHERE u.tg_id = s.tg_id)`,
      [id]
    );
    if (!srows.length) return bad(res, "not_found", 404);

    const { rows: totals } = await db.query(
      `SELECT COUNT(*)::int AS attempts,
              COUNT(*) FILTER (WHERE correct)::int AS correct
         FROM attempts WHERE student_id = $1`,
      [id]
    );
    const { rows: byTopic } = await db.query(
      `SELECT t.topic,
              COUNT(a.id)::int AS attempts,
              COUNT(a.id) FILTER (WHERE a.correct)::int AS correct
         FROM attempts a JOIN tasks t ON t.id = a.task_id
        WHERE a.student_id = $1
        GROUP BY t.topic
        ORDER BY t.topic`,
      [id]
    );
    // Gamification profile (level, xp, streak, pet), if the student has ever
    // opened the app. Absent for a just-created student — the frontend copes.
    const { rows: profileRows } = await db.query(
      `SELECT level, xp, xp_from_level, xp_for_next, coins, streak,
              streak_freeze_used, pet_species, pet_name, diagnostic_done
         FROM student_profiles WHERE student_id = $1`,
      [id]
    );

    // Homework rollup: how many issued / done / overdue right now.
    const { rows: hwRows } = await db.query(
      `SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'done')::int AS done,
          COUNT(*) FILTER (WHERE status <> 'done' AND due IS NOT NULL AND due < now())::int AS overdue
         FROM homework WHERE student_id = $1`,
      [id]
    );

    // Enrolled subjects (for the header).
    const { rows: subjectRows } = await db.query(
      "SELECT subject, grade FROM student_subjects WHERE student_id = $1 ORDER BY created_at ASC",
      [id]
    );

    const total = totals[0];
    const hw = hwRows[0];
    res.json({
      student: srows[0],
      subjects: subjectRows,
      profile: profileRows[0] || null,
      bonusBalance: profileRows[0]?.coins ?? 0,
      homework: { total: hw.total, done: hw.done, overdue: hw.overdue, active: hw.total - hw.done },
      stats: {
        attempts: total.attempts,
        correct: total.correct,
        accuracy: total.attempts ? Math.round((total.correct / total.attempts) * 100) : 0,
      },
      byTopic: byTopic.map((t) => ({
        topic: t.topic,
        attempts: t.attempts,
        correct: t.correct,
        mastery: t.attempts ? Math.round((t.correct / t.attempts) * 100) : 0,
      })),
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
