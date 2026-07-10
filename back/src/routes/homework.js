const express = require("express");
const db = require("../db");

const router = express.Router();

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

// Homework for the demo student, read from the DB (assigned via admin panel).
router.get("/", async (req, res, next) => {
  try {
    const { status } = req.query;
    const student = await db.getDemoStudent();
    if (!student) return res.json({ homework: [], counts: { active: 0, overdue: 0 } });

    const { rows } = await db.query(
      "SELECT * FROM homework WHERE student_id = $1 ORDER BY id DESC",
      [student.id]
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
      "UPDATE homework SET status = 'done' WHERE id = $1 RETURNING *",
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "not_found" });
    res.json({ ok: true, homework: rows[0] });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
