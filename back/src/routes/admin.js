// Admin panel API. Gated by tg_id -> role lookup (see ../middleware/auth.js).
// Admin: students, users, tasks, homework, stats, bonuses.
// Tutor: tasks, homework, stats only.
const express = require("express");
const crypto = require("crypto");
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
    const { rows } = await db.query(
      `SELECT s.*,
              (s.tg_id = 'demo' OR s.tg_id LIKE 'demo:%') AS is_demo
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
    const s = String(subject ?? "").trim();
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
  return [String(firstName ?? "").trim(), String(lastName ?? "").trim()]
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
    if (!tgId) return bad(res, "tg_id_required");
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
    const { rows } = await db.query(
      `INSERT INTO students (tg_id, name, first_name, last_name, grade, subject)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [tgId, name, String(firstName ?? "").trim() || null, String(lastName ?? "").trim() || null, primary.grade, primary.subject]
    );
    for (const s of subjects) {
      await db.query(
        `INSERT INTO student_subjects (student_id, subject, grade) VALUES ($1,$2,$3)
         ON CONFLICT (student_id, subject) DO UPDATE SET grade = EXCLUDED.grade`,
        [rows[0].id, s.subject, s.grade]
      );
    }
    res.status(201).json({ student: rows[0] });
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
    const { rows } = await db.query(
      `UPDATE students
         SET name = COALESCE($2, name),
             first_name = COALESCE($6, first_name),
             last_name = COALESCE($7, last_name),
             grade = COALESCE($3, grade),
             subject = COALESCE($4, subject),
             tg_id = COALESCE($5, tg_id)
       WHERE id = $1 RETURNING *`,
      [
        req.params.id,
        name,
        grade ? Number(grade) : null,
        subject ?? null,
        tgId ?? null,
        firstName != null ? String(firstName).trim() || null : null,
        lastName != null ? String(lastName).trim() || null : null,
      ]
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
    if (!subject || !grade) return bad(res, "subject_and_grade_required");
    await db.query(
      `INSERT INTO student_subjects (student_id, subject, grade) VALUES ($1,$2,$3)
       ON CONFLICT (student_id, subject) DO UPDATE SET grade = EXCLUDED.grade`,
      [req.params.id, subject, Number(grade)]
    );
    // Assigning any subject promotes a pending (self-serve) student to active.
    const { rows } = await db.query(
      `UPDATE students SET status = 'active', subject = COALESCE(subject, $2), grade = COALESCE(grade, $3)
       WHERE id = $1 RETURNING *`,
      [req.params.id, subject, Number(grade)]
    );
    if (!rows.length) return bad(res, "not_found", 404);
    res.json({ student: rows[0] });
  } catch (e) {
    if (e.code === "23503") return bad(res, "student_not_found", 404);
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

router.put("/tasks/:id", requireRole("admin", "tutor"), async (req, res, next) => {
  try {
    const { grade, subject, topic, prompt, options, correct, explanation, difficulty, hints } =
      req.body ?? {};
    if (!grade || !subject || !topic || !prompt) return bad(res, "grade_subject_topic_prompt_required");
    if (!Array.isArray(options) || options.length < 2) return bad(res, "at_least_two_options");
    if (typeof correct !== "number" || correct < 0 || correct >= options.length)
      return bad(res, "correct_index_out_of_range");
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
        difficulty || "medium",
        JSON.stringify(Array.isArray(hints) ? hints.filter(Boolean) : []),
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
    const { rowCount } = await db.query(
      "DELETE FROM tasks WHERE grade = $1 AND subject = $2",
      [parsedGrade, subject]
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
    const { studentId, title, description, due, taskIds, subject: requestedSubject } = req.body ?? {};
    if (!studentId || !title) return bad(res, "studentId_and_title_required");
    const cleanTitle = String(title).trim();
    if (!cleanTitle) return bad(res, "studentId_and_title_required");
    if (due && Number.isNaN(new Date(due).getTime())) return bad(res, "invalid_due_date");

    const submittedTaskIds = Array.isArray(taskIds) ? taskIds : [];
    const cleanTaskIds = [...new Set(submittedTaskIds.map(Number))];
    if (cleanTaskIds.some((id) => !Number.isInteger(id) || id <= 0)) {
      return bad(res, "invalid_task_ids");
    }

    const { rows: studentRows } = await db.query(
      "SELECT id, grade, subject FROM students WHERE id = $1 AND status = 'active'",
      [studentId]
    );
    if (!studentRows.length) return bad(res, "student_not_found", 404);
    const student = studentRows[0];
    const subject = requestedSubject || student.subject;
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

    const { rows } = await db.query(
      `INSERT INTO homework (student_id, subject, title, description, due, task_ids)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [studentId, subject, cleanTitle, String(description ?? "").trim() || null, due || null, JSON.stringify(cleanTaskIds)]
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

    // Bonus balance.
    const { rows: bonusRows } = await db.query(
      `SELECT COALESCE(SUM(amount), 0)::int AS balance FROM bonus_transactions WHERE student_id = $1`,
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
      bonusBalance: bonusRows[0].balance,
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
