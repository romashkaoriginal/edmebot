const express = require("express");
const db = require("../db");
const store = require("../store");

const router = express.Router();

const XP_BY_DIFFICULTY = { easy: 10, medium: 15, hard: 25 };

// Build a practice series from the DB for the (demo) student's grade + subject.
// Answers are stripped from the payload sent before grading.
router.get("/series", async (req, res, next) => {
  try {
    const length = req.query.length ? Math.min(20, Number(req.query.length)) : 5;
    const student = await db.getDemoStudent();
    if (!student) return res.json({ tasks: [] });

    const { rows } = await db.query(
      `SELECT id, topic, prompt, options, difficulty, hints
         FROM tasks WHERE grade = $1 AND subject = $2
         ORDER BY id ASC`,
      [student.grade, student.subject]
    );
    if (!rows.length) return res.json({ tasks: [] });

    const series = [];
    for (let i = 0; series.length < length; i++) {
      const t = rows[i % rows.length];
      series.push({
        id: String(t.id),
        topic: t.topic,
        prompt: t.prompt,
        options: t.options,
        difficulty: t.difficulty,
        hints: t.hints ?? [],
      });
    }
    res.json({ tasks: series });
  } catch (e) {
    next(e);
  }
});

// Grade an answer against the DB task, record the attempt, award XP.
router.post("/answer", async (req, res, next) => {
  try {
    const { taskId, selected, hintsUsed = 0, attempts = 0 } = req.body ?? {};
    if (!taskId || typeof selected !== "number") {
      return res.status(400).json({ error: "taskId_and_selected_required" });
    }
    const { rows } = await db.query("SELECT * FROM tasks WHERE id = $1", [taskId]);
    if (!rows.length) return res.status(404).json({ error: "task_not_found" });
    const task = rows[0];
    const correct = selected === task.correct;

    const student = await db.getDemoStudent();
    if (student) {
      await db.query(
        `INSERT INTO attempts (student_id, task_id, selected, correct) VALUES ($1,$2,$3,$4)`,
        [student.id, task.id, selected, correct]
      );
    }

    let award = { leveledUp: false, gained: 0, coins: 0 };
    if (correct) {
      const base = XP_BY_DIFFICULTY[task.difficulty] ?? 10;
      const gained = Math.max(3, base - hintsUsed * 3 - attempts * 2);
      const coins = Math.round(gained / 2);
      const res2 = store.awardXp(gained, coins);
      award = { ...res2, gained, coins };
      store.state.profile.solvedTotal += 1;
    }

    res.json({
      correct,
      correctIndex: task.correct,
      explanation: task.explanation,
      commonMistake: correct ? null : "Проверь решение ещё раз — здесь легко ошибиться.",
      award,
      profile: store.publicProfile(),
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
