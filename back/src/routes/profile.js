const express = require("express");
const db = require("../db");
const state = require("../studentState");
const { requireStudent } = require("../middleware/auth");

const router = express.Router();
router.use(requireStudent);

const WEEKDAYS_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

// Achievements are computed from REAL signals — never pre-granted. Each has a
// predicate over the student's actual profile/stats, so a new student sees an
// honest list with locked conditions that fills in as they earn things.
const ACHIEVEMENTS = [
  { id: "diagnostic", name: "Первый шаг", desc: "Пройди входной тест", icon: "🎯", tier: "bronze", when: (p) => p.profile.diagnosticDone },
  { id: "first_task", name: "Разминка", desc: "Реши первое задание", icon: "✏️", tier: "bronze", when: (p) => p.stats.solvedTotal >= 1, progress: (p) => ({ cur: Math.min(p.stats.solvedTotal, 1), max: 1 }) },
  { id: "ten_tasks", name: "Десятка", desc: "Реши 10 заданий", icon: "🔟", tier: "silver", when: (p) => p.stats.solvedTotal >= 10, progress: (p) => ({ cur: Math.min(p.stats.solvedTotal, 10), max: 10 }) },
  { id: "fifty_tasks", name: "Полусотка", desc: "Реши 50 заданий", icon: "💯", tier: "gold", when: (p) => p.stats.solvedTotal >= 50, progress: (p) => ({ cur: Math.min(p.stats.solvedTotal, 50), max: 50 }) },
  { id: "streak_7", name: "Неделя в строю", desc: "Сохраняй стрик 7 дней", icon: "🔥", tier: "silver", when: (p) => p.profile.streak >= 7, progress: (p) => ({ cur: Math.min(p.profile.streak, 7), max: 7 }) },
  { id: "level_5", name: "Пятый уровень", desc: "Достигни 5 уровня", icon: "⬆️", tier: "gold", when: (p) => p.profile.level >= 5, progress: (p) => ({ cur: Math.min(p.profile.level, 5), max: 5 }) },
  { id: "green_topic", name: "Знаток", desc: "Тема освоена на зелёный", icon: "🧩", when: (p) => p.topics.some((t) => t.status === "green") },
];

router.get("/", async (req, res, next) => {
  try {
    const subject = typeof req.query.subject === "string" ? req.query.subject : null;
    if (subject) {
      const { rows } = await db.query(
        "SELECT 1 FROM student_subjects WHERE student_id = $1 AND subject = $2",
        [req.student.id, subject]
      );
      if (!rows.length) return res.status(403).json({ error: "not_enrolled_in_subject" });
    }
    res.json(await state.getState(req.student, subject));
  } catch (e) { next(e); }
});

const ONBOARD_SUBJECTS = ["Математика", "Русский"];

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
      `SELECT EXTRACT(ISODOW FROM created_at)::int AS weekday, COUNT(*)::int AS tasks
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
    const achievements = ACHIEVEMENTS.map(({ when, progress, ...achievement }) => {
      const earned = when(forPredicate);
      return { ...achievement, earned, ...(!earned && progress ? { progress: progress(forPredicate) } : {}) };
    });
    res.json({
      ...current,
      stats,
      weekActivity: activity.map((item) => ({ day: WEEKDAYS_RU[Number(item.weekday) - 1], tasks: item.tasks })),
      achievements,
      recommendations: { review: weak.map((topic) => topic.name), strong: strong.map((topic) => topic.name) },
    });
  } catch (e) { next(e); }
});

module.exports = router;
