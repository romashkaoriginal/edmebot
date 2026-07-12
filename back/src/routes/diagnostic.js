const express = require("express");
const seed = require("../data/seed");
const state = require("../studentState");
const { requireStudent } = require("../middleware/auth");

const router = express.Router();
router.use(requireStudent);

// Diagnostic-only students haven't picked a subject via onboarding yet if
// they land here directly; ?subject= lets the frontend request whichever
// subject the onboarding form or subject picker chose, without requiring
// req.student.subject to already be set.
router.get("/", (req, res) => {
  const subject = req.query.subject || req.student.subject || "Математика";
  const questions = seed.diagnostic.filter((q) => q.subject === subject);
  res.json({ subject, questions: questions.map(({ correct, ...question }) => question) });
});

router.post("/submit", async (req, res, next) => {
  try {
    const answers = Array.isArray(req.body?.answers) ? req.body.answers : [];
    if (!answers.length) return res.status(400).json({ error: "answers_required" });
    const subject = req.body?.subject || req.student.subject || "Математика";
    const result = await state.submitDiagnostic(req.student, answers, subject);
    res.json({ knowledgeMap: result.topics, profile: result.profile });
  } catch (e) { next(e); }
});

module.exports = router;
