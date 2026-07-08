const express = require("express");
const store = require("../store");
const seed = require("../data/seed");

const router = express.Router();

// Full profile
router.get("/", (req, res) => {
  res.json(store.publicProfile());
});

// Analytics for the личный кабинет (module 9)
router.get("/analytics", (req, res) => {
  const p = store.state.profile;
  const topics = store.state.topics;
  const weak = topics.filter((t) => t.status === "red");
  const strong = topics.filter((t) => t.status === "green");
  res.json({
    stats: { solvedTotal: p.solvedTotal, accuracy: p.accuracy, avgTimeSec: p.avgTimeSec },
    weekActivity: seed.weekActivity,
    topics,
    achievements: seed.achievements,
    recommendations: {
      review: weak.map((t) => t.name),
      strong: strong.map((t) => t.name),
      forTutor: (weak[0] ?? topics[0]).name,
    },
    weeklyReport: {
      tasksDone: 46,
      timeSpent: "3 ч 20 мин",
      improved: "Проценты",
      nextWeek: ["Дроби", "Текстовые задачи"],
      trend: "+12%",
    },
  });
});

module.exports = router;
