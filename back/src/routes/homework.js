const express = require("express");
const db = require("../db");
const { requireStudent, requireActiveStudent } = require("../middleware/auth");
const { assembleHomeworkTasks, gradeHomeworkAnswers } = require("../homeworkQuestions");

const router = express.Router();
router.use(requireStudent, requireActiveStudent);

// Rule-based deadline notice (module 8): 24h / today / overdue.
function deadlineNotice(hw) {
  if (hw.status === "done") return { tone: "done", text: "сдано" };
  if (!hw.due) return { tone: "muted", text: "без срока" };
  const hours = (new Date(hw.due) - new Date()) / 36e5;
  if (hours < 0) return { tone: "danger", text: "просрочено" };
  if (hours <= 24) return { tone: "danger", text: "сдать сегодня" };
  if (hours <= 48) return { tone: "warning", text: "завтра дедлайн" };
  return { tone: "muted", text: "предстоит" };
}

router.get("/", async (req, res, next) => {
  try {
    const { status } = req.query;
    const subject = typeof req.query.subject === "string" ? req.query.subject : null;

    if (subject) {
      const { rows: enrolled } = await db.query(
        "SELECT 1 FROM student_subjects WHERE student_id = $1 AND subject = $2",
        [req.student.id, subject]
      );
      if (!enrolled.length) return res.status(403).json({ error: "not_enrolled_in_subject" });
    }

    const { rows } = await db.query(
      `SELECT hw.*,
              (
                jsonb_array_length(COALESCE(hw.task_ids, '[]'::jsonb)) +
                (SELECT COUNT(*)::int FROM homework_questions hq WHERE hq.homework_id = hw.id)
              )::int AS question_count
         FROM homework hw
        WHERE student_id = $1 ${subject ? "AND subject = $2" : ""}
        ORDER BY hw.id DESC`,
      subject ? [req.student.id, subject] : [req.student.id]
    );

    let list = rows;
    if (status && status !== "all") list = rows.filter((h) => h.status === status);

    res.json({
      homework: list.map((h) => ({ ...h, notice: deadlineNotice(h) })),
      counts: {
        active: rows.filter((h) => h.status === "active").length,
        overdue: rows.filter((h) => h.due && new Date(h.due) < new Date() && h.status !== "done").length,
      },
    });
  } catch (e) {
    next(e);
  }
});

router.post("/:id/complete", async (req, res, next) => {
  try {
    const { rows } = await db.query(
      "UPDATE homework SET status = 'done' WHERE id = $1 AND student_id = $2 RETURNING *",
      [req.params.id, req.student.id]
    );
    if (!rows.length) return res.status(404).json({ error: "not_found" });
    res.json({ ok: true, homework: rows[0] });
  } catch (e) {
    next(e);
  }
});

router.post("/:id/reopen", async (req, res, next) => {
  try {
    const { rows } = await db.query(
      "UPDATE homework SET status = 'active' WHERE id = $1 AND student_id = $2 RETURNING *",
      [req.params.id, req.student.id]
    );
    if (!rows.length) return res.status(404).json({ error: "not_found" });
    res.json({ ok: true, homework: rows[0] });
  } catch (e) {
    next(e);
  }
});

// Questions for a homework run: task-bank picks (same shape as
// practice/series, minus answers) followed by homework-only questions
// (written just for this assignment, no topic/subject/hints).
router.get("/:id/tasks", async (req, res, next) => {
  try {
    const { rows: hwRows } = await db.query(
      "SELECT * FROM homework WHERE id = $1 AND student_id = $2",
      [req.params.id, req.student.id]
    );
    if (!hwRows.length) return res.status(404).json({ error: "not_found" });
    const hw = hwRows[0];
    const taskIds = Array.isArray(hw.task_ids) ? hw.task_ids : [];

    let bankRows = [];
    if (taskIds.length) {
      const { rows } = await db.query(
        `SELECT id, topic, subject, prompt, options, difficulty, hints,
                correct AS "correctIndex", explanation
           FROM tasks WHERE id = ANY($1::bigint[])`,
        [taskIds]
      );
      bankRows = rows;
    }

    const { rows: ownRows } = await db.query(
      `SELECT id, prompt, options, correct AS "correctIndex", explanation
         FROM homework_questions WHERE homework_id = $1 ORDER BY position ASC, id ASC`,
      [hw.id]
    );
    res.json({ homework: hw, tasks: assembleHomeworkTasks(hw, bankRows, ownRows) });
  } catch (e) {
    next(e);
  }
});

// Submit a full run: grades every answer, records the attempt, and marks the
// homework done once it's solved (or attempts run out).
router.post("/:id/submit", async (req, res, next) => {
  try {
    const { answers } = req.body ?? {};
    if (!Array.isArray(answers) || !answers.length) return res.status(400).json({ error: "answers_required" });

    const { rows: hwRows } = await db.query(
      "SELECT * FROM homework WHERE id = $1 AND student_id = $2",
      [req.params.id, req.student.id]
    );
    if (!hwRows.length) return res.status(404).json({ error: "not_found" });
    const hw = hwRows[0];
    if (hw.status === "done") return res.status(409).json({ error: "already_done" });
    if (hw.attempts_used >= hw.max_attempts) return res.status(409).json({ error: "no_attempts_left" });

    const taskIds = Array.isArray(hw.task_ids) ? hw.task_ids : [];
    const { rows: taskRows } = await db.query(
      `SELECT id, prompt, options, correct AS "correctIndex", explanation, topic,
              subject, difficulty, hints
         FROM tasks WHERE id = ANY($1::bigint[])`,
      [taskIds]
    );

    const { rows: ownRows } = await db.query(
      `SELECT id, prompt, options, correct AS "correctIndex", explanation
         FROM homework_questions WHERE homework_id = $1 ORDER BY position ASC, id ASC`,
      [hw.id]
    );
    const tasks = assembleHomeworkTasks(hw, taskRows, ownRows);
    const { graded, error } = gradeHomeworkAnswers(tasks, answers);
    if (error) return res.status(400).json({ error });
    const correctCount = graded.filter((g) => g.correct).length;
    const attemptsUsed = hw.attempts_used + 1;
    const solved = correctCount === graded.length;
    const doneNow = solved || attemptsUsed >= hw.max_attempts;

    const { rows } = await db.query(
      `UPDATE homework
          SET attempts_used = $2,
              status = CASE WHEN $3 THEN 'done' ELSE status END
        WHERE id = $1 RETURNING *`,
      [hw.id, attemptsUsed, doneNow]
    );
    await db.query(
      `INSERT INTO homework_attempts (homework_id, student_id, answers, correct, total)
       VALUES ($1,$2,$3,$4,$5)`,
      [hw.id, req.student.id, JSON.stringify(graded), correctCount, graded.length]
    );

    res.json({
      ok: true,
      homework: rows[0],
      results: graded,
      correct: correctCount,
      total: graded.length,
      attemptsUsed,
      attemptsLeft: Math.max(0, hw.max_attempts - attemptsUsed),
      solved,
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
