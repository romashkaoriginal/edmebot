// Role-gating for /api/admin/*. Identity comes from the x-telegram-id header,
// looked up against the users table. NOTE: the header is client-supplied and
// unsigned — this blocks casual/UI access but does not stop a forged request
// with someone else's tg_id. Real protection needs HMAC verification of the
// Telegram WebApp initData against TELEGRAM_BOT_TOKEN.
const db = require("../db");

async function requireAuth(req, res, next) {
  try {
    const tgId = req.header("x-telegram-id");
    if (!tgId) return res.status(401).json({ error: "unauthorized" });
    const { rows } = await db.query("SELECT * FROM users WHERE tg_id = $1", [tgId]);
    if (!rows.length) return res.status(401).json({ error: "unauthorized" });
    req.user = rows[0];
    next();
  } catch (e) {
    next(e);
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "forbidden" });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
