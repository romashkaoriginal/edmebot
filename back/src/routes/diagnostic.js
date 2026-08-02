const express = require("express");
const crypto = require("crypto");
const db = require("../db");
const state = require("../studentState");
const { requireStudent } = require("../middleware/auth");

const router = express.Router();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MIN_DIAGNOSTIC_QUESTIONS = 5;
router.use(requireStudent);

function shuffle(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

// Maps a position in the shuffled list back to the stored option index.
// Sessions created before shuffling have no stored order and are already
// in storage order.
function toStoredIndex(optionOrders, taskId, selected) {
  const order = optionOrders?.[String(taskId)];
  if (!Array.isArray(order) || selected === null) return selected;
  return Number.isInteger(order[selected]) ? order[selected] : null;
}

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
    // A student enrolled in several subjects takes one diagnostic covering all
    // of them (10 questions each), so they are not sent back to a subject
    // picker between tests. ?subject= still narrows it to a single subject for
    // a deliberate retake.
    const { rows: enrollments } = await db.query(
      `SELECT subject, grade FROM student_subjects
        WHERE student_id = $1 ${req.query.subject ? "AND subject = $2" : ""}
        ORDER BY created_at ASC`,
      req.query.subject ? [req.student.id, req.query.subject] : [req.student.id]
    );
    const enrolled = enrollments.length
      ? enrollments
      : [{ subject: req.query.subject || req.student.subject || "Математика", grade: req.student.grade }];
    const subject = enrolled[0].subject;
    if (enrolled.every((item) => !item.grade)) return res.json({ subject, questions: [] });

    const perSubject = await Promise.all(enrolled.map(async (item) => {
      const grade = item.grade ?? req.student.grade;
      if (!grade) return [];
      const { rows } = await db.query(
        `SELECT id, topic, subject, prompt, options, hints,
                correct AS "correctIndex", explanation
         FROM tasks WHERE grade = $1 AND subject = $2
         ORDER BY random() LIMIT 10`,
        [grade, item.subject]
      );
      return rows.length >= MIN_DIAGNOSTIC_QUESTIONS ? rows : [];
    }));
    const rows = perSubject.flat();
    if (!rows.length) {
      return res.json({ subject, sessionId: null, questions: [], minimumQuestions: MIN_DIAGNOSTIC_QUESTIONS });
    }
    const subjects = [...new Set(rows.map((question) => question.subject))];
    // Answers are stored with the correct option first, so serving them in
    // storage order would make the first choice always right. Shuffle per
    // question and keep the permutation to grade the positions shown.
    const optionOrders = {};
    const questions = rows.map((question) => {
      const optionCount = Array.isArray(question.options) ? question.options.length : 0;
      const order = shuffle(Array.from({ length: optionCount }, (_, index) => index));
      optionOrders[question.id] = order;
      return {
        ...question,
        options: order.map((storedIndex) => question.options[storedIndex]),
        correctIndex: order.indexOf(question.correctIndex),
      };
    });
    const sessionId = crypto.randomUUID();
    await db.query(
      `INSERT INTO diagnostic_sessions (id, student_id, subject, question_ids, option_orders)
       VALUES ($1,$2,$3,$4,$5)`,
      [sessionId, req.student.id, subject, JSON.stringify(rows.map((question) => question.id)),
        JSON.stringify(optionOrders)]
    );
    res.json({ subject, subjects, sessionId, questions });
  } catch (e) { next(e); }
});

router.post("/check", async (req, res, next) => {
  try {
    const taskId = Number(req.body?.taskId);
    const sessionId = String(req.body?.sessionId || "");
    const selected = req.body?.selected;
    if (!Number.isInteger(taskId) || (selected !== null && !Number.isInteger(selected))) {
      return res.status(400).json({ error: "taskId_and_selected_required" });
    }
    if (!UUID_RE.test(sessionId)) return res.status(400).json({ error: "diagnostic_session_required" });
    const { rows: sessions } = await db.query(
      `SELECT option_orders FROM diagnostic_sessions
        WHERE id = $1 AND student_id = $2 AND submitted_at IS NULL
          AND expires_at > now() AND question_ids @> $3::jsonb`,
      [sessionId, req.student.id, JSON.stringify([taskId])]
    );
    if (!sessions.length) return res.status(409).json({ error: "diagnostic_session_invalid" });
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
    const optionOrders = sessions[0].option_orders;
    const order = optionOrders?.[String(taskId)];
    res.json({
      correct: toStoredIndex(optionOrders, taskId, selected) === task.correct,
      // Report the answer as a position in the list the student was shown.
      correctIndex: Array.isArray(order) ? order.indexOf(task.correct) : task.correct,
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
    const sessionId = String(req.body?.sessionId || "");
    if (!answers.length) return res.status(400).json({ error: "answers_required" });
    if (!UUID_RE.test(sessionId)) return res.status(400).json({ error: "diagnostic_session_required" });
    const result = await db.transaction(async (client) => {
      const { rows: sessions } = await client.query(
        `SELECT * FROM diagnostic_sessions
          WHERE id = $1 AND student_id = $2 AND submitted_at IS NULL AND expires_at > now()
          FOR UPDATE`,
        [sessionId, req.student.id]
      );
      if (!sessions.length) return { error: "diagnostic_session_invalid" };
      const session = sessions[0];
      const expectedIds = session.question_ids.map(Number);
      const answerIds = answers.map((answer) => Number(answer.id));
      if (
        answerIds.some((id) => !Number.isInteger(id)) ||
        new Set(answerIds).size !== answerIds.length ||
        answerIds.length !== expectedIds.length ||
        expectedIds.some((id) => !answerIds.includes(id))
      ) return { error: "diagnostic_answers_incomplete" };
      // A session may span several subjects, so the questions are looked up by
      // id alone; session.question_ids is what scopes them to this student.
      const { rows: questions } = await client.query(
        `SELECT id, topic, subject, correct, options
           FROM tasks WHERE id = ANY($1::bigint[])`,
        [expectedIds]
      );
      if (questions.length !== expectedIds.length) return { error: "diagnostic_questions_not_found" };
      for (const answer of answers) {
        const question = questions.find((item) => Number(item.id) === Number(answer.id));
        if (answer.selected !== null && (
          !Number.isInteger(answer.selected) || answer.selected < 0 || answer.selected >= question.options.length
        )) {
          return { error: "diagnostic_answer_invalid" };
        }
      }
      // Answers arrive as positions in the shuffled list the student saw;
      // grading compares against tasks.correct, so map them back first.
      const storedAnswers = answers.map((answer) => ({
        ...answer,
        selected: toStoredIndex(session.option_orders, answer.id, answer.selected),
      }));
      await state.submitDiagnostic(req.student, storedAnswers, session.subject, questions, client);
      await client.query("UPDATE diagnostic_sessions SET submitted_at = now() WHERE id = $1", [sessionId]);
      return { subject: session.subject };
    });
    if (result.error) return res.status(409).json(result);
    const { rows: students } = await db.query("SELECT * FROM students WHERE id = $1", [req.student.id]);
    const refreshed = await state.getState(students[0], result.subject);
    res.json({ knowledgeMap: refreshed.topics, profile: refreshed.profile });
  } catch (e) { next(e); }
});

module.exports = router;
