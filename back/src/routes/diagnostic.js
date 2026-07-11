const express = require("express");
const seed = require("../data/seed");
const state = require("../studentState");
const { requireStudent } = require("../middleware/auth");

const router = express.Router();
router.use(requireStudent);

router.get("/", (req, res) => {
  res.json({ subject: req.student.subject, questions: seed.diagnostic.map(({ correct, ...question }) => question) });
});

router.post("/submit", async (req, res, next) => {
  try {
    const answers = Array.isArray(req.body?.answers) ? req.body.answers : [];
    if (!answers.length) return res.status(400).json({ error: "answers_required" });
    const result = await state.submitDiagnostic(req.student, answers);
    res.json({ knowledgeMap: result.topics, profile: result.profile });
  } catch (e) { next(e); }
});

module.exports = router;
