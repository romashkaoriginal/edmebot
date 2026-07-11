const express = require("express");
const db = require("../db");
const state = require("../studentState");
const { requireStudent } = require("../middleware/auth");

const router = express.Router();
router.use(requireStudent);

router.get("/series", async (req, res, next) => {
  try {
    const length = Math.min(20, Math.max(1, Number(req.query.length) || 5));
    const current = await state.getState(req.student);
    const weakTopics = current.topics.filter((topic) => topic.status !== "green").map((topic) => topic.id);
    const { rows } = await db.query(
      `SELECT id, topic, prompt, options, difficulty, hints
         FROM tasks WHERE grade = $1 AND subject = $2
         ORDER BY CASE WHEN topic = ANY($3::text[]) THEN 0 ELSE 1 END, id ASC`,
      [req.student.grade, req.student.subject, weakTopics]
    );
    const tasks = rows.length ? Array.from({ length }, (_, index) => ({ ...rows[index % rows.length], id: String(rows[index % rows.length].id) })) : [];
    res.json({ tasks });
  } catch (e) { next(e); }
});

router.post("/answer", async (req, res, next) => {
  try {
    const { taskId, selected, hintsUsed = 0, attempts = 0 } = req.body ?? {};
    if (!taskId || typeof selected !== "number") return res.status(400).json({ error: "taskId_and_selected_required" });
    const { rows } = await db.query("SELECT * FROM tasks WHERE id = $1", [taskId]);
    if (!rows.length) return res.status(404).json({ error: "task_not_found" });
    const task = rows[0];
    const result = await state.gradePractice(req.student, task, selected, Number(hintsUsed) || 0, Number(attempts) || 0);
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
