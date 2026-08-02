const express = require("express");
const db = require("../db");
const state = require("../studentState");
const { requireStudent } = require("../middleware/auth");
const { trialStartError } = require("../utils/trial");

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
// does not grant access yet: the student explicitly starts the one-time trial
// after the diagnostic and pet choice, or staff assigns permanent access.
router.post("/onboard", async (req, res, next) => {
  try {
    const current = await state.getState(req.student);
    if (!["subject", "diagnostic"].includes(current.profile.onboardingStep)) {
      return res.status(409).json({ error: "onboarding_step_invalid" });
    }
    // A student may enrol in several subjects at once. `subject` (singular) is
    // still accepted so an older client keeps working.
    const { subject, subjects, grade } = req.body ?? {};
    const requested = Array.isArray(subjects) ? subjects : [subject];
    const chosen = [...new Set(requested.filter((item) => ONBOARD_SUBJECTS.includes(item)))];
    if (!chosen.length || chosen.length !== new Set(requested).size) {
      return res.status(400).json({ error: "invalid_subject" });
    }
    const g = Number(grade);
    if (!Number.isInteger(g) || g < 6 || g > 11) return res.status(400).json({ error: "invalid_grade" });
    const primary = chosen[0];

    await db.transaction(async (client) => {
      for (const item of chosen) {
        await client.query(
          `INSERT INTO student_subjects (student_id, subject, grade) VALUES ($1,$2,$3)
           ON CONFLICT (student_id, subject) DO UPDATE SET grade = EXCLUDED.grade`,
          [req.student.id, item, g]
        );
      }
      await state.ensure(req.student, client);
      await client.query(
        "UPDATE student_profiles SET onboarding_step = 'diagnostic', updated_at = now() WHERE student_id = $1",
        [req.student.id]
      );
      // Keep the legacy single subject/grade columns as "primary" = first chosen.
      await client.query(
        `UPDATE students SET subject = $2, grade = $3 WHERE id = $1`,
        [req.student.id, primary, g]
      );
    });
    const refreshed = await db.query("SELECT * FROM students WHERE id = $1", [req.student.id]);
    const { profile } = await state.getState(refreshed.rows[0], primary);
    res.json({ ok: true, profile });
  } catch (e) { next(e); }
});

// A self-serve student explicitly starts one 30-day trial after completing
// the diagnostic and choosing a pet. The guarded update makes it impossible
// to restart or extend the trial by replaying the request.
router.post("/trial/start", async (req, res, next) => {
  try {
    const started = await db.transaction(async (client) => {
      const { rows: students } = await client.query(
        "SELECT * FROM students WHERE id = $1 FOR UPDATE",
        [req.student.id]
      );
      if (!students.length) return { error: "student_not_found", status: 404 };
      const student = students[0];
      const { rows: profiles } = await client.query(
        "SELECT * FROM student_profiles WHERE student_id = $1 FOR UPDATE",
        [req.student.id]
      );
      const profile = profiles[0];
      const eligibilityError = trialStartError(student, profile);
      if (eligibilityError) return { error: eligibilityError, status: 409 };
      const { rows } = await client.query(
        `UPDATE students
            SET status = 'active',
                access_kind = 'trial',
                trial_used = TRUE,
                trial_started_at = now(),
                access_until = now() + interval '30 days'
          WHERE id = $1
            AND status = 'pending'
            AND access_kind IS NULL
            AND trial_used = FALSE
          RETURNING *`,
        [req.student.id]
      );
      if (!rows.length) return { error: "trial_already_used", status: 409 };
      await client.query(
        "UPDATE student_profiles SET onboarding_step = 'complete', updated_at = now() WHERE student_id = $1",
        [req.student.id]
      );
      return { student: rows[0] };
    });
    if (started.error) return res.status(started.status).json({ error: started.error });
    return res.json(await state.getState(started.student));
  } catch (e) { return next(e); }
});

router.get("/analytics", async (req, res, next) => {
  try {
    const current = await state.getState(req.student);
    const { rows: totals } = await db.query(
      `SELECT COUNT(*)::int AS attempted_total,
              COUNT(*) FILTER (WHERE correct)::int AS solved_total,
              COUNT(*) FILTER (WHERE correct)::int AS correct_total
         FROM attempts WHERE student_id = $1`,
      [req.student.id]
    );
    const { rows: activity } = await db.query(
      `WITH days AS (
         SELECT generate_series(
           (now() AT TIME ZONE $2)::date - 6,
           (now() AT TIME ZONE $2)::date,
           interval '1 day'
         )::date AS day
       )
       SELECT EXTRACT(ISODOW FROM days.day)::int AS weekday,
              COUNT(a.id) FILTER (WHERE a.correct)::int AS tasks
         FROM days
         LEFT JOIN attempts a
           ON a.student_id = $1
          AND (a.created_at AT TIME ZONE $2)::date = days.day
        GROUP BY days.day
        ORDER BY days.day`,
      [req.student.id, process.env.APP_TIME_ZONE || "Europe/Moscow"]
    );
    const weak = current.topics.filter((topic) => topic.status === "red");
    const strong = current.topics.filter((topic) => topic.status === "green");
    const total = totals[0];
    const stats = {
      solvedTotal: total.solved_total,
      accuracy: total.attempted_total ? Math.round((total.correct_total / total.attempted_total) * 100) : 0,
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
