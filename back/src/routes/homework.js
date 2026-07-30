const express = require("express");
const db = require("../db");
const { requireStudent, requireActiveStudent } = require("../middleware/auth");
const { assembleHomeworkTasks, gradeHomeworkAnswers } = require("../homeworkQuestions");
const { deadlineNotice } = require("../utils/deadline");

const router = express.Router();
router.use(requireStudent, requireActiveStudent);

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
              COALESCE(
                (SELECT jsonb_agg(ht.task_id ORDER BY ht.position)
                   FROM homework_tasks ht WHERE ht.homework_id = hw.id),
                '[]'::jsonb
              ) AS normalized_task_ids,
              (
                (SELECT COUNT(*)::int FROM homework_tasks ht WHERE ht.homework_id = hw.id) +
                (SELECT COUNT(*)::int FROM homework_questions hq WHERE hq.homework_id = hw.id)
              )::int AS question_count
         FROM homework hw
        WHERE student_id = $1 ${subject ? "AND subject = $2" : ""}
        ORDER BY hw.id DESC`,
      subject ? [req.student.id, subject] : [req.student.id]
    );

    const normalizedRows = rows.map(({ normalized_task_ids: taskIds, ...row }) => ({ ...row, task_ids: taskIds }));
    let list = normalizedRows;
    if (status && status !== "all") list = normalizedRows.filter((h) => h.status === status);

    res.json({
      homework: list.map((h) => ({ ...h, notice: deadlineNotice(h) })),
      counts: {
        active: normalizedRows.filter((h) => h.status === "active").length,
        overdue: normalizedRows.filter((h) => h.due && new Date(h.due) < new Date() && h.status !== "done").length,
      },
    });
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
    const { rows: membership } = await db.query(
      "SELECT task_id FROM homework_tasks WHERE homework_id = $1 ORDER BY position, task_id",
      [hw.id]
    );
    const taskIds = membership.map((item) => item.task_id);
    hw.task_ids = taskIds;

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
    const { answers, attemptId } = req.body ?? {};
    if (!Array.isArray(answers) || !answers.length || answers.length > 200) {
      return res.status(400).json({ error: "answers_required" });
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(attemptId || ""))) {
      return res.status(400).json({ error: "attempt_id_required" });
    }

    const result = await db.transaction(async (client) => {
      const { rows: hwRows } = await client.query(
        "SELECT * FROM homework WHERE id = $1 AND student_id = $2 FOR UPDATE",
        [req.params.id, req.student.id]
      );
      if (!hwRows.length) return { error: "not_found", status: 404 };
      const hw = hwRows[0];
      const { rows: existing } = await client.query(
        `SELECT answers, correct, total FROM homework_attempts
          WHERE homework_id = $1 AND student_id = $2 AND idempotency_key = $3`,
        [hw.id, req.student.id, attemptId]
      );
      if (existing.length) {
        const saved = existing[0];
        return {
          ok: true,
          homework: hw,
          results: saved.answers,
          correct: saved.correct,
          total: saved.total,
          attemptsUsed: hw.attempts_used,
          attemptsLeft: Math.max(0, hw.max_attempts - hw.attempts_used),
          solved: saved.correct === saved.total,
          replayed: true,
        };
      }
      if (hw.status === "done") return { error: "already_done", status: 409 };
      if (hw.attempts_used >= hw.max_attempts) return { error: "no_attempts_left", status: 409 };

      const { rows: membership } = await client.query(
        "SELECT task_id FROM homework_tasks WHERE homework_id = $1 ORDER BY position, task_id",
        [hw.id]
      );
      const taskIds = membership.map((item) => item.task_id);
      hw.task_ids = taskIds;
      const { rows: taskRows } = taskIds.length
        ? await client.query(
          `SELECT id, prompt, options, correct AS "correctIndex", explanation, topic,
                  subject, difficulty, hints
             FROM tasks WHERE id = ANY($1::bigint[])`,
          [taskIds]
        )
        : { rows: [] };
      const { rows: ownRows } = await client.query(
        `SELECT id, prompt, options, correct AS "correctIndex", explanation
           FROM homework_questions WHERE homework_id = $1 ORDER BY position ASC, id ASC`,
        [hw.id]
      );
      const tasks = assembleHomeworkTasks(hw, taskRows, ownRows);
      const { graded, error } = gradeHomeworkAnswers(tasks, answers);
      if (error) return { error, status: 400 };
      const correctCount = graded.filter((item) => item.correct).length;
      const attemptsUsed = hw.attempts_used + 1;
      const solved = correctCount === graded.length;
      const doneNow = solved || attemptsUsed >= hw.max_attempts;
      const { rows: updatedRows } = await client.query(
        `UPDATE homework
            SET attempts_used = attempts_used + 1,
                status = CASE WHEN $2 THEN 'done' ELSE status END
          WHERE id = $1 RETURNING *`,
        [hw.id, doneNow]
      );
      await client.query(
        `INSERT INTO homework_attempts
           (homework_id, student_id, answers, correct, total, idempotency_key)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [hw.id, req.student.id, JSON.stringify(graded), correctCount, graded.length, attemptId]
      );
      return {
        ok: true,
        homework: updatedRows[0],
        results: graded,
        correct: correctCount,
        total: graded.length,
        attemptsUsed,
        attemptsLeft: Math.max(0, hw.max_attempts - attemptsUsed),
        solved,
      };
    });
    if (result.error) return res.status(result.status || 400).json({ error: result.error });
    return res.json(result);
  } catch (e) {
    return next(e);
  }
});

module.exports = router;
