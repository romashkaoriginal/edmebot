const express = require("express");
const crypto = require("crypto");
const db = require("../db");
const state = require("../studentState");
const { requireStudent, requireActiveStudent } = require("../middleware/auth");

const router = express.Router();
router.use(requireStudent, requireActiveStudent);

router.get("/series", async (req, res, next) => {
  try {
    const length = Math.min(20, Math.max(1, Number(req.query.length) || 5));
    let subject = req.query.subject || req.student.subject;
    let grade = req.query.grade ? Number(req.query.grade) : req.student.grade;

    if (req.query.subject) {
      // Only allow practicing a subject the student is actually enrolled in.
      const { rows: enrolled } = await db.query(
        "SELECT grade FROM student_subjects WHERE student_id = $1 AND subject = $2",
        [req.student.id, subject]
      );
      if (!enrolled.length) return res.status(403).json({ error: "not_enrolled_in_subject" });
      grade = enrolled[0].grade;
    }

    const mode = ["endless", "weak", "topic"].includes(req.query.mode) ? req.query.mode : "endless";
    const current = await state.getState(req.student, subject);
    const { rows: mistakeRows } = mode === "weak"
      ? await db.query(
        `SELECT topic, SUM(GREATEST(wrong_count - correct_count, 0))::int AS weight,
                MAX(last_wrong_at) AS last_wrong_at
         FROM student_mistakes
         WHERE student_id = $1 AND subject = $2
         GROUP BY topic
         HAVING SUM(GREATEST(wrong_count - correct_count, 0)) > 0
         ORDER BY weight DESC, last_wrong_at DESC
         LIMIT 8`,
        [req.student.id, subject]
      )
      : { rows: [] };
    const weakTopics = mistakeRows.length
      ? mistakeRows.map((row) => row.topic)
      : mode === "weak"
        ? current.topics.filter((topic) => topic.status !== "green").map((topic) => topic.id)
        : [];
    const { rows } = await db.query(
      `SELECT id, topic, subject, prompt, options, difficulty, hints,
              correct AS "correctIndex", explanation
         FROM tasks WHERE grade = $1 AND subject = $2
         ORDER BY id ASC`,
      [grade, subject]
    );
    const requestedTopic = mode === "topic" ? String(req.query.topic || "") : "";
    const requestedLevel = ["easy", "medium", "hard"].includes(req.query.level) ? req.query.level : "";
    const filtered = rows.filter((task) =>
      (!requestedTopic || task.topic === requestedTopic) &&
      (!requestedLevel || task.difficulty === requestedLevel)
    );
    const priority = shuffle(filtered.filter((task) => weakTopics.includes(task.topic)));
    const regular = shuffle(filtered.filter((task) => !weakTopics.includes(task.topic)));
    const source = mode === "weak" && priority.length ? [...priority, ...regular] : shuffle(filtered);
    const tasks = source.length
      ? Array.from({ length }, (_, index) => {
        const task = source[index % source.length];
        return {
          ...task,
          id: String(task.id),
          instanceId: crypto.randomUUID(),
          hintCount: Array.isArray(task.hints) ? task.hints.length : 0,
          hints: undefined,
        };
      })
      : [];
    if (tasks.length) {
      await db.transaction(async (client) => {
        // Only sweep instances that are already answered or long past expiry.
        // An endless run keeps answering questions from earlier batches, so
        // deleting every expired row here would reject answers the student is
        // still legitimately working through.
        await client.query(
          `DELETE FROM practice_question_instances
            WHERE student_id = $1
              AND expires_at <= now() - interval '24 hours'`,
          [req.student.id]
        );
        for (const task of tasks) {
          await client.query(
            `INSERT INTO practice_question_instances (id, student_id, task_id)
             VALUES ($1,$2,$3)`,
            [task.instanceId, req.student.id, task.id]
          );
        }
      });
    }
    res.json({ tasks });
  } catch (e) { next(e); }
});

function shuffle(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

router.post("/hint", async (req, res, next) => {
  try {
    const instanceId = String(req.body?.instanceId || "");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(instanceId)) {
      return res.status(400).json({ error: "instance_id_required" });
    }
    const result = await db.transaction(async (client) => {
      const { rows } = await client.query(
        `SELECT pqi.hints_revealed, t.hints
           FROM practice_question_instances pqi
           JOIN tasks t ON t.id = pqi.task_id
          WHERE pqi.id = $1 AND pqi.student_id = $2
            AND pqi.answered_at IS NULL AND pqi.expires_at > now()
          FOR UPDATE OF pqi`,
        [instanceId, req.student.id]
      );
      if (!rows.length) return { error: "practice_instance_invalid" };
      const hints = Array.isArray(rows[0].hints) ? rows[0].hints : [];
      const nextIndex = rows[0].hints_revealed;
      if (nextIndex >= hints.length) return { error: "no_hints_left" };
      await client.query(
        "UPDATE practice_question_instances SET hints_revealed = hints_revealed + 1 WHERE id = $1",
        [instanceId]
      );
      return { hint: hints[nextIndex], hintsUsed: nextIndex + 1, hintsLeft: hints.length - nextIndex - 1 };
    });
    if (result.error) return res.status(409).json(result);
    return res.json(result);
  } catch (e) { return next(e); }
});

router.post("/answer", async (req, res, next) => {
  try {
    const { taskId, selected, instanceId } = req.body ?? {};
    if (!Number.isInteger(Number(taskId)) || !Number.isInteger(selected)) {
      return res.status(400).json({ error: "taskId_and_selected_required" });
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(instanceId || ""))) {
      return res.status(400).json({ error: "instance_id_required" });
    }
    const { rows } = await db.query("SELECT * FROM tasks WHERE id = $1", [taskId]);
    if (!rows.length) return res.status(404).json({ error: "task_not_found" });
    const task = rows[0];
    if (selected < 0 || !Array.isArray(task.options) || selected >= task.options.length) {
      return res.status(400).json({ error: "selected_out_of_range" });
    }
    const { rows: enrolled } = await db.query(
      "SELECT 1 FROM student_subjects WHERE student_id = $1 AND subject = $2",
      [req.student.id, task.subject]
    );
    if (!enrolled.length) return res.status(403).json({ error: "not_enrolled_in_subject" });
    const result = await state.gradePractice(req.student, task, selected, instanceId);
    if (result.error) return res.status(409).json(result);
    res.json({
      correct: result.correct,
      correctIndex: task.correct,
      explanation: task.explanation,
      commonMistake: result.correct ? null : "Проверь решение ещё раз и сравни с правилом в объяснении.",
      award: result.award,
      profile: result.state.profile,
      topics: result.state.topics,
    });
  } catch (e) { next(e); }
});

module.exports = router;
