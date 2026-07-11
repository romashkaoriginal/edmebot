// Admin panel API. Gated by tg_id -> role lookup (see ../middleware/auth.js).
// Admin: students, users, tasks, homework, stats, bonuses.
// Tutor: tasks, homework, stats only.
const express = require("express");
const db = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

function bad(res, msg, code = 400) {
  return res.status(code).json({ error: msg });
}

router.use(requireAuth);

// ---------- Me ----------

router.get("/me", (req, res) => {
  res.json({ user: { id: req.user.id, tgId: req.user.tg_id, name: req.user.name, role: req.user.role } });
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
    if (!tgId) return bad(res, "tg_id_required");
    if (!name || !role) return bad(res, "name_and_role_required");
    if (!["admin", "tutor"].includes(role)) return bad(res, "invalid_role");
    const { rows } = await db.query(
      `INSERT INTO users (tg_id, name, role) VALUES ($1,$2,$3) RETURNING *`,
      [tgId, name, role]
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
    const { rows } = await db.query(
      `UPDATE users
         SET name = COALESCE($2, name),
             role = COALESCE($3, role)
       WHERE id = $1 RETURNING *`,
      [req.params.id, name ?? null, role ?? null]
    );
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
    const { rowCount } = await db.query("DELETE FROM users WHERE id = $1", [req.params.id]);
    if (!rowCount) return bad(res, "not_found", 404);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ---------- Students (admin only: add/remove) ----------

router.get("/students", requireRole("admin", "tutor"), async (_req, res, next) => {
  try {
    const { rows } = await db.query("SELECT * FROM students ORDER BY id ASC");
    res.json({ students: rows });
  } catch (e) {
    next(e);
  }
});

router.post("/students", requireRole("admin"), async (req, res, next) => {
  try {
    const { name, grade, subject, tgId } = req.body ?? {};
    if (!tgId) return bad(res, "tg_id_required");
    if (!name || !grade || !subject) return bad(res, "name_grade_subject_required");
    const { rows } = await db.query(
      `INSERT INTO students (tg_id, name, grade, subject) VALUES ($1,$2,$3,$4) RETURNING *`,
      [tgId, name, Number(grade), subject]
    );
    res.status(201).json({ student: rows[0] });
  } catch (e) {
    if (e.code === "23505") return bad(res, "tg_id_already_exists", 409);
    next(e);
  }
});

router.put("/students/:id", requireRole("admin"), async (req, res, next) => {
  try {
    const { name, grade, subject, tgId } = req.body ?? {};
    if (tgId === "") return bad(res, "tg_id_required");
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

router.delete("/students/:id", requireRole("admin"), async (req, res, next) => {
  try {
    const { rowCount } = await db.query("DELETE FROM students WHERE id = $1", [req.params.id]);
    if (!rowCount) return bad(res, "not_found", 404);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ---------- Bonuses (admin awards, admin+tutor can view history) ----------

router.get("/students/:id/bonus", requireRole("admin", "tutor"), async (req, res, next) => {
  try {
    const { rows: srows } = await db.query("SELECT id FROM students WHERE id = $1", [req.params.id]);
    if (!srows.length) return bad(res, "not_found", 404);
    const { rows } = await db.query(
      `SELECT * FROM bonus_transactions WHERE student_id = $1 ORDER BY id DESC`,
      [req.params.id]
    );
    const balance = rows.reduce((sum, t) => sum + t.amount, 0);
    res.json({ balance, transactions: rows });
  } catch (e) {
    next(e);
  }
});

router.post("/students/:id/bonus", requireRole("admin"), async (req, res, next) => {
  try {
    const { amount, reason } = req.body ?? {};
    const amt = Number(amount);
    if (!amount || Number.isNaN(amt) || amt === 0) return bad(res, "amount_required");
    const { rows: srows } = await db.query("SELECT id FROM students WHERE id = $1", [req.params.id]);
    if (!srows.length) return bad(res, "not_found", 404);
    const { rows } = await db.query(
      `INSERT INTO bonus_transactions (student_id, amount, reason, created_by)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.params.id, amt, reason || null, req.user.tg_id]
    );
    res.status(201).json({ transaction: rows[0] });
  } catch (e) {
    next(e);
  }
});

// ---------- Tasks (admin + tutor) ----------

router.get("/tasks", requireRole("admin", "tutor"), async (req, res, next) => {
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

router.post("/tasks", requireRole("admin", "tutor"), async (req, res, next) => {
  try {
    const { grade, subject, topic, prompt, options, correct, explanation, difficulty, hints } =
      req.body ?? {};
    if (!grade || !subject || !topic || !prompt) return bad(res, "grade_subject_topic_prompt_required");
    if (!Array.isArray(options) || options.length < 2) return bad(res, "at_least_two_options");
    if (typeof correct !== "number" || correct < 0 || correct >= options.length)
      return bad(res, "correct_index_out_of_range");
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
        difficulty || "medium",
        JSON.stringify(Array.isArray(hints) ? hints.filter(Boolean) : []),
      ]
    );
    res.status(201).json({ task: rows[0] });
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

router.post("/homework", requireRole("admin", "tutor"), async (req, res, next) => {
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

// Summary across all students.
router.get("/stats", requireRole("admin", "tutor"), async (_req, res, next) => {
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
router.get("/stats/:studentId", requireRole("admin", "tutor"), async (req, res, next) => {
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
