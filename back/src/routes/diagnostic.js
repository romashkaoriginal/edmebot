const express = require("express");
const db = require("../db");
const state = require("../studentState");
const { requireStudent } = require("../middleware/auth");

const router = express.Router();
router.use(requireStudent);

// Diagnostic-only students haven't picked a subject via onboarding yet if
// they land here directly; ?subject= lets the frontend request whichever
// subject the onboarding form or subject picker chose, without requiring
// req.student.subject to already be set.
router.get("/", async (req, res, next) => {
  try {
    const current = await state.getState(req.student);
    if (current.profile.onboardingStep !== "diagnostic" && current.profile.onboardingStep !== "complete") {
      return res.status(409).json({ error: "onboarding_step_invalid" });
    }
    const subject = req.query.subject || req.student.subject || "Математика";
    const { rows: enrollments } = await db.query(
      "SELECT grade FROM student_subjects WHERE student_id = $1 AND subject = $2",
      [req.student.id, subject]
    );
    const grade = enrollments[0]?.grade ?? req.student.grade;
    if (!grade) return res.json({ subject, questions: [] });
    const { rows } = await db.query(
      `SELECT id, topic, subject, prompt, options
       FROM tasks WHERE grade = $1 AND subject = $2
       ORDER BY random() LIMIT 10`,
      [grade, subject]
    );
    res.json({ subject, questions: rows });
  } catch (e) { next(e); }
});

router.post("/check", async (req, res, next) => {
  try {
    const taskId = Number(req.body?.taskId);
    const selected = req.body?.selected;
    if (!Number.isInteger(taskId) || (selected !== null && !Number.isInteger(selected))) {
      return res.status(400).json({ error: "taskId_and_selected_required" });
    }
    const { rows } = await db.query(
      "SELECT id, subject, correct, explanation FROM tasks WHERE id = $1",
      [taskId]
    );
    if (!rows.length) return res.status(404).json({ error: "task_not_found" });
    const task = rows[0];
    const { rows: enrolled } = await db.query(
      "SELECT 1 FROM student_subjects WHERE student_id = $1 AND subject = $2",
      [req.student.id, task.subject]
    );
    if (!enrolled.length) return res.status(403).json({ error: "not_enrolled_in_subject" });
    res.json({
      correct: selected === task.correct,
      correctIndex: task.correct,
      explanation: task.explanation,
    });
  } catch (e) { next(e); }
});

router.post("/submit", async (req, res, next) => {
  try {
    const current = await state.getState(req.student);
    if (current.profile.onboardingStep !== "diagnostic" && current.profile.onboardingStep !== "complete") {
      return res.status(409).json({ error: "onboarding_step_invalid" });
    }
    const answers = Array.isArray(req.body?.answers) ? req.body.answers : [];
    if (!answers.length) return res.status(400).json({ error: "answers_required" });
    const subject = req.body?.subject || req.student.subject || "Математика";
    const ids = answers.map((answer) => Number(answer.id)).filter(Number.isInteger);
    const { rows: questions } = ids.length
      ? await db.query(
        "SELECT id, topic, subject, correct FROM tasks WHERE id = ANY($1::bigint[]) AND subject = $2",
        [ids, subject]
      )
      : { rows: [] };
    if (!questions.length) return res.status(400).json({ error: "diagnostic_questions_not_found" });
    await state.submitDiagnostic(req.student, answers, subject, questions);
    // Completing the diagnostic starts one calendar month of student access.
    const { rows } = await db.query(
      `UPDATE students SET status = 'active', access_until = now() + interval '1 month'
       WHERE id = $1 RETURNING *`,
      [req.student.id]
    );
    const refreshed = await state.getState(rows[0], subject);
    res.json({ knowledgeMap: refreshed.topics, profile: refreshed.profile });
  } catch (e) { next(e); }
});

module.exports = router;
