const express = require("express");
const db = require("../db");
const { requireStudent } = require("../middleware/auth");

const router = express.Router();
router.use(requireStudent);

// Rule-based deadline notice (module 8): 24h / today / overdue.
function deadlineNotice(hw) {
  if (hw.status === "done") return { tone: "done", text: "сдано" };
  if (!hw.due) return { tone: "muted", text: "без срока" };
  const hours = (new Date(hw.due) - new Date()) / 36e5;
  if (hours < 0) return { tone: "danger", text: "просрочено" };
  if (hours <= 24) return { tone: "danger", text: "сдать сегодня" };
  if (hours <= 48) return { tone: "warning", text: "завтра дедлайн" };
  return { tone: "muted", text: "предстоит" };
}

router.get("/", async (req, res, next) => {
  try {
    const { status } = req.query;

    const { rows } = await db.query(
      "SELECT * FROM homework WHERE student_id = $1 ORDER BY id DESC",
      [req.student.id]
    );

    let list = rows;
    if (status && status !== "all") list = rows.filter((h) => h.status === status);

    res.json({
      homework: list.map((h) => ({ ...h, notice: deadlineNotice(h) })),
      counts: {
        active: rows.filter((h) => h.status === "active").length,
        overdue: rows.filter((h) => h.due && new Date(h.due) < new Date() && h.status !== "done").length,
      },
    });
  } catch (e) {
    next(e);
  }
});

router.post("/:id/complete", async (req, res, next) => {
  try {
    const { rows } = await db.query(
      "UPDATE homework SET status = 'done' WHERE id = $1 AND student_id = $2 RETURNING *",
      [req.params.id, req.student.id]
    );
    if (!rows.length) return res.status(404).json({ error: "not_found" });
    res.json({ ok: true, homework: rows[0] });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
