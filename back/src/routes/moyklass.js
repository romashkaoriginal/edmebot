const crypto = require("crypto");
const express = require("express");
const db = require("../db");
const integration = require("../integrations/moyklass");
const { logEvent } = require("../utils/eventLog");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

router.post("/webhook/:secret", (req, res) => {
  const expected = process.env.MOYKLASS_WEBHOOK_SECRET;
  const received = req.params.secret;
  if (!expected || expected.length < 32 || !received ||
      Buffer.byteLength(expected) !== Buffer.byteLength(received) ||
      !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received))) {
    return res.status(404).json({ error: "not_found" });
  }
  const userId = req.body?.object?.userId;
  if (!["user_changed", "user_changed_state", "user_new"].includes(req.body?.event) ||
      !Number.isSafeInteger(Number(userId))) return res.status(202).json({ ok: true });
  res.status(202).json({ ok: true });
  // The five-minute reconciliation loop covers process exits or dropped hooks.
  void db.query("SELECT id FROM students WHERE moyklass_user_id = $1", [userId])
    .then(({ rows }) => rows[0] && integration.syncStudent(rows[0].id))
    .catch((error) => logEvent("crm_webhook_processing_failed", req, {
      message: String(error.message || error).slice(0, 240),
    }));
});

router.post("/students/:id/link", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const studentId = Number(req.params.id);
    const crmUserId = Number(req.body?.crmUserId);
    if (!Number.isSafeInteger(studentId) || studentId <= 0 || !Number.isSafeInteger(crmUserId) || crmUserId <= 0) {
      return res.status(400).json({ error: "invalid_id" });
    }
    await integration.bindStudent(studentId, crmUserId);
    res.json({ ok: true });
  } catch (error) {
    if (error.code === "23505" || /conflict|already_linked/.test(error.message)) {
      return res.status(409).json({ error: error.message });
    }
    if (/not_found/.test(error.message)) return res.status(404).json({ error: error.message });
    next(error);
  }
});

module.exports = router;
