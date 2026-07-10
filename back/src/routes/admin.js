// Admin panel API. Backed by Postgres (Supabase). No auth yet — access is open
// to everyone (per product decision). The x-telegram-id header is read for
// forward-compat, but not enforced. Role gating by tg_id lands later.
const express = require("express");
const db = require("../db");

const router = express.Router();

function bad(res, msg, code = 400) {
  return res.status(code).json({ error: msg });
}

// ---------- Students ----------

router.get("/students", async (_req, res, next) => {
  try {
    const { rows } = await db.query("SELECT * FROM students ORDER BY id ASC");
    res.json({ students: rows });
  } catch (e) {
    next(e);
  }
});

router.post("/students", async (req, res, next) => {
  try {
    const { name, grade, subject, tgId } = req.body ?? {};
    if (!name || !grade || !subject) return bad(res, "name_grade_subject_required");
    const { rows } = await db.query(
      `INSERT INTO students (tg_id, name, grade, subject) VALUES ($1,$2,$3,$4) RETURNING *`,
      [tgId || null, name, Number(grade), subject]
    );
    res.status(201).json({ student: rows[0] });
  } catch (e) {
    if (e.code === "23505") return bad(res, "tg_id_already_exists", 409);
    next(e);
  }
});

router.put("/students/:id", async (req, res, next) => {
  try {
    const { name, grade, subject, tgId } = req.body ?? {};
    const { rows } = await db.query(
      `UPDATE students
         SET name = COALESCE($2, name),
             grade = COALESCE($3, grade),
             subject = COALESCE($4, subject),
             tg_id = COALESCE($5, tg_id)
       WHERE id = $1 RETURNING *`,
      [req.params.id, name ?? null, grade ? Number(grade) : null, subject ?? null, tgId ?? null]
    );
    if (!rows.length) return bad(res, "not_found", 404);
    res.json({ student: rows[0] });
  } catch (e) {
    if (e.code === "23505") return bad(res, "tg_id_already_exists", 409);
    next(e);
  }
});

router.delete("/students/:id", async (req, res, next) => {
  try {
    const { rowCount } = await db.query("DELETE FROM students WHERE id = $1", [req.params.id]);
    if (!rowCount) return bad(res, "not_found", 404);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ---------- Tasks ----------

router.get("/tasks", async (req, res, next) => {
  try {
    const { grade, subject } = req.query;
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

router.post("/tasks", async (req, res, next) => {
  try {
    const { grade, subject, topic, prompt, options, correct, explanation, difficulty } =
      req.body ?? {};
    if (!grade || !subject || !topic || !prompt) return bad(res, "grade_subject_topic_prompt_required");
    if (!Array.isArray(options) || options.length < 2) return bad(res, "at_least_two_options");
    if (typeof correct !== "number" || correct < 0 || correct >= options.length)
      return bad(res, "correct_index_out_of_range");
    const { rows } = await db.query(
      `INSERT INTO tasks (grade, subject, topic, prompt, options, correct, explanation, difficulty)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        Number(grade),
        subject,
        topic,
        prompt,
        JSON.stringify(options),
        correct,
        explanation || null,
        difficulty || "medium",
      ]
    );
    res.status(201).json({ task: rows[0] });
  } catch (e) {
    next(e);
  }
});

router.delete("/tasks/:id", async (req, res, next) => {
  try {
    const { rowCount } = await db.query("DELETE FROM tasks WHERE id = $1", [req.params.id]);
    if (!rowCount) return bad(res, "not_found", 404);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ---------- Homework ----------

router.get("/homework", async (req, res, next) => {
  try {
    const { studentId } = req.query;
    const params = [];
    let where = "";
    if (studentId) {
      params.push(studentId);
      where = `WHERE hw.student_id = $1`;
    }
    const { rows } = await db.query(
      `SELECT hw.*, s.name AS student_name
         FROM homework hw JOIN students s ON s.id = hw.student_id
         ${where}
         ORDER BY hw.id DESC`,
      params
    );
    res.json({ homework: rows });
  } catch (e) {
    next(e);
  }
});

router.post("/homework", async (req, res, next) => {
  try {
    const { studentId, title, description, due, taskIds } = req.body ?? {};
    if (!studentId || !title) return bad(res, "studentId_and_title_required");
    const { rows } = await db.query(
      `INSERT INTO homework (student_id, title, description, due, task_ids)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [studentId, title, description || null, due || null, JSON.stringify(taskIds ?? [])]
    );
    res.status(201).json({ homework: rows[0] });
  } catch (e) {
    if (e.code === "23503") return bad(res, "student_not_found", 404);
    next(e);
  }
});

router.delete("/homework/:id", async (req, res, next) => {
  try {
    const { rowCount } = await db.query("DELETE FROM homework WHERE id = $1", [req.params.id]);
    if (!rowCount) return bad(res, "not_found", 404);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ---------- Stats ----------

// Summary across all students.
router.get("/stats", async (_req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT s.id, s.name, s.grade, s.subject,
              COUNT(a.id)::int AS attempts,
              COUNT(a.id) FILTER (WHERE a.correct)::int AS correct
         FROM students s
         LEFT JOIN attempts a ON a.student_id = s.id
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
router.get("/stats/:studentId", async (req, res, next) => {
  try {
    const id = req.params.studentId;
    const { rows: srows } = await db.query("SELECT * FROM students WHERE id = $1", [id]);
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
    const total = totals[0];
    res.json({
      student: srows[0],
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
