const express = require("express");
const db = require("../db");
const state = require("../studentState");
const { requireStudent } = require("../middleware/auth");

const router = express.Router();
router.use(requireStudent);

// Achievements are computed from REAL signals — never pre-granted. Each has a
// predicate over the student's actual profile/stats, so a new student sees an
// honest (possibly empty) list that fills in as they earn things.
const ACHIEVEMENTS = [
  { id: "diagnostic", name: "Первый шаг", desc: "Пройден входной тест", icon: "🎯", when: (p) => p.profile.diagnosticDone },
  { id: "first_task", name: "Разминка", desc: "Первое решённое задание", icon: "✏️", when: (p) => p.stats.solvedTotal >= 1 },
  { id: "ten_tasks", name: "Десятка", desc: "10 решённых заданий", icon: "🔟", when: (p) => p.stats.solvedTotal >= 10 },
  { id: "fifty_tasks", name: "Полусотка", desc: "50 решённых заданий", icon: "💯", when: (p) => p.stats.solvedTotal >= 50 },
  { id: "streak_7", name: "Неделя в строю", desc: "Стрик 7 дней", icon: "🔥", when: (p) => p.profile.streak >= 7 },
  { id: "level_5", name: "Пятый уровень", desc: "Достигнут 5 уровень", icon: "⬆️", when: (p) => p.profile.level >= 5 },
  { id: "green_topic", name: "Знаток", desc: "Тема освоена на зелёный", icon: "🧩", when: (p) => p.topics.some((t) => t.status === "green") },
];

router.get("/", async (req, res, next) => {
  try {
    res.json(await state.getState(req.student));
  } catch (e) { next(e); }
});

const ONBOARD_SUBJECTS = ["Математика"];

// Self-serve onboarding: a brand-new (auto-provisioned "pending") student
// picks a subject + grade so they can take that subject's diagnostic. This
// does NOT grant full access — status stays "pending" until staff assigns
// them a subject via the admin panel, which is the actual promotion step.
router.post("/onboard", async (req, res, next) => {
  try {
    const current = await state.getState(req.student);
    if (!["subject", "diagnostic"].includes(current.profile.onboardingStep)) {
      return res.status(409).json({ error: "onboarding_step_invalid" });
    }
    const { subject, grade } = req.body ?? {};
    if (!ONBOARD_SUBJECTS.includes(subject)) return res.status(400).json({ error: "invalid_subject" });
    const g = Number(grade);
    if (!Number.isInteger(g) || g < 6 || g > 11) return res.status(400).json({ error: "invalid_grade" });

    await db.query(
      `INSERT INTO student_subjects (student_id, subject, grade) VALUES ($1,$2,$3)
       ON CONFLICT (student_id, subject) DO UPDATE SET grade = EXCLUDED.grade`,
      [req.student.id, subject, g]
    );
    await state.ensure(req.student);
    await db.query(
      "UPDATE student_profiles SET onboarding_step = 'diagnostic', updated_at = now() WHERE student_id = $1",
      [req.student.id]
    );
    // Keep the legacy single subject/grade columns as "primary" = first chosen.
    await db.query(
      `UPDATE students SET subject = $2, grade = $3 WHERE id = $1`,
      [req.student.id, subject, g]
    );
    const refreshed = await db.query("SELECT * FROM students WHERE id = $1", [req.student.id]);
    const { profile } = await state.getState(refreshed.rows[0], subject);
    res.json({ ok: true, profile });
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
    const stats = {
      solvedTotal: total.solved_total,
      accuracy: total.solved_total ? Math.round((total.correct_total / total.solved_total) * 100) : 0,
      avgTimeSec: 0,
    };
    const forPredicate = { ...current, stats };
    const achievements = ACHIEVEMENTS
      .filter((a) => a.when(forPredicate))
      .map(({ when, ...a }) => ({ ...a, earned: true }));
    res.json({
      ...current,
      stats,
      weekActivity: activity.map((item) => ({ day: item.day.trim(), tasks: item.tasks })),
      achievements,
      recommendations: { review: weak.map((topic) => topic.name), strong: strong.map((topic) => topic.name) },
    });
  } catch (e) { next(e); }
});

module.exports = router;
