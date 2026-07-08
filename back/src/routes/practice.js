const express = require("express");
const store = require("../store");

const router = express.Router();

// Build a practice series (modules 2). Rule-based selection, answers stripped.
router.get("/series", (req, res) => {
  const { mode, topic, length } = req.query;
  const series = store.buildSeries({
    mode,
    topic,
    length: length ? Math.min(20, Number(length)) : 5,
  });
  res.json({ tasks: series });
});

// Grade an answer (modules 3 + 5). Returns feedback + XP.
router.post("/answer", (req, res) => {
  const { taskId, selected, hintsUsed, attempts } = req.body ?? {};
  if (!taskId || typeof selected !== "number") {
    return res.status(400).json({ error: "taskId_and_selected_required" });
  }
  const result = store.gradeAnswer({ taskId, selected, hintsUsed, attempts });
  if (result.error) return res.status(404).json(result);
  res.json(result);
});

module.exports = router;
