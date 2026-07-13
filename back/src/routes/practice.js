const express = require("express");
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
      `SELECT id, topic, subject, prompt, options, difficulty, hints
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
      ? Array.from({ length }, (_, index) => ({ ...source[index % source.length], id: String(source[index % source.length].id) }))
      : [];
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

router.post("/answer", async (req, res, next) => {
  try {
    const { taskId, selected, hintsUsed = 0, attempts = 0 } = req.body ?? {};
    if (!taskId || typeof selected !== "number") return res.status(400).json({ error: "taskId_and_selected_required" });
    const { rows } = await db.query("SELECT * FROM tasks WHERE id = $1", [taskId]);
    if (!rows.length) return res.status(404).json({ error: "task_not_found" });
    const task = rows[0];
    const { rows: enrolled } = await db.query(
      "SELECT 1 FROM student_subjects WHERE student_id = $1 AND subject = $2",
      [req.student.id, task.subject]
    );
    if (!enrolled.length) return res.status(403).json({ error: "not_enrolled_in_subject" });
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
