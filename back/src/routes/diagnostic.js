const express = require("express");
const store = require("../store");
const seed = require("../data/seed");

const router = express.Router();

// Get the diagnostic questions (module 1). Answers stripped.
router.get("/", (req, res) => {
  const questions = seed.diagnostic.map(({ correct, ...q }) => q);
  res.json({ subject: seed.profile.subject, questions });
});

// Submit answers → knowledge map
router.post("/submit", (req, res) => {
  const answers = Array.isArray(req.body?.answers) ? req.body.answers : [];
  if (!answers.length) return res.status(400).json({ error: "answers_required" });
  const map = store.scoreDiagnostic(answers);
  res.json({ knowledgeMap: map });
});

module.exports = router;
