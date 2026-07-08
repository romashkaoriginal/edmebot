const express = require("express");
const store = require("../store");

const router = express.Router();

// Rule-based deadline notice (module 8): 24h / today / overdue.
function deadlineNotice(hw) {
  if (hw.status === "done") return { tone: "done", text: "сдано" };
  const hours = (new Date(hw.due) - new Date()) / 36e5;
  if (hours < 0) return { tone: "danger", text: "просрочено" };
  if (hours <= 24) return { tone: "danger", text: "сдать сегодня" };
  if (hours <= 48) return { tone: "warning", text: "завтра дедлайн" };
  return { tone: "muted", text: "предстоит" };
}

router.get("/", (req, res) => {
  const { status } = req.query;
  let list = store.state.homework;
  if (status && status !== "all") list = list.filter((h) => h.status === status);
  res.json({
    homework: list.map((h) => ({ ...h, notice: deadlineNotice(h) })),
    counts: {
      active: store.state.homework.filter((h) => h.status === "active").length,
      overdue: store.state.homework.filter((h) => h.status === "overdue").length,
    },
  });
});

router.post("/:id/complete", (req, res) => {
  const result = store.completeHomework(req.params.id);
  if (result.error) return res.status(404).json(result);
  res.json(result);
});

module.exports = router;
