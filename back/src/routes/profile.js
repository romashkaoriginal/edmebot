const express = require("express");
const db = require("../db");
const seed = require("../data/seed");
const state = require("../studentState");
const { requireStudent } = require("../middleware/auth");

const router = express.Router();
router.use(requireStudent);

router.get("/", async (req, res, next) => {
  try {
    res.json(await state.getState(req.student));
  } catch (e) { next(e); }
});

router.get("/analytics", async (req, res, next) => {
  try {
    const current = await state.getState(req.student);
    const { rows: totals } = await db.query(
      `SELECT COUNT(*)::int AS solved_total,
              COUNT(*) FILTER (WHERE correct)::int AS correct_total
         FROM attempts WHERE student_id = $1`,
      [req.student.id]
    );
    const { rows: activity } = await db.query(
      `SELECT to_char(created_at, 'Dy') AS day, COUNT(*)::int AS tasks
         FROM attempts WHERE student_id = $1 AND created_at >= now() - interval '6 days'
         GROUP BY 1, date_trunc('day', created_at) ORDER BY date_trunc('day', created_at)`,
      [req.student.id]
    );
    const weak = current.topics.filter((topic) => topic.status === "red");
    const strong = current.topics.filter((topic) => topic.status === "green");
    const total = totals[0];
    res.json({
      ...current,
      stats: {
        solvedTotal: total.solved_total,
        accuracy: total.solved_total ? Math.round((total.correct_total / total.solved_total) * 100) : 0,
        avgTimeSec: 0,
      },
      weekActivity: activity.map((item) => ({ day: item.day.trim(), tasks: item.tasks })),
      achievements: seed.achievements,
      recommendations: { review: weak.map((topic) => topic.name), strong: strong.map((topic) => topic.name) },
    });
  } catch (e) { next(e); }
});

module.exports = router;
