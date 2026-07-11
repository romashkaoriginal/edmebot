const crypto = require("crypto");
const db = require("../db");

function verifyTelegramInitData(initData) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) return null;

    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return null;

    const authDate = params.get("auth_date");
    if (authDate) {
      const ageSec = Math.floor(Date.now() / 1000) - parseInt(authDate, 10);
      const maxAge = parseInt(process.env.TELEGRAM_INIT_MAX_AGE_SEC || "86400", 10);
      if (!Number.isFinite(ageSec) || ageSec < 0 || ageSec > maxAge) return null;
    }

    params.delete("hash");
    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");

    const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
    const calculatedHash = crypto
      .createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    if (calculatedHash !== hash) return null;

    const userStr = params.get("user");
    if (!userStr) return null;
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

async function requireAuth(req, res, next) {
  try {
    const initData = req.header("x-telegram-init-data");
    if (!initData) return res.status(401).json({ error: "unauthorized" });

    const telegramUser = verifyTelegramInitData(initData);
    if (!telegramUser) return res.status(401).json({ error: "unauthorized" });

    const { rows } = await db.query(
      "SELECT * FROM users WHERE tg_id = $1",
      [String(telegramUser.id)]
    );
    if (!rows.length) return res.status(401).json({ error: "unauthorized" });

    req.user = rows[0];
    next();
  } catch (e) {
    next(e);
  }
}

async function requireStudent(req, res, next) {
  try {
    const initData = req.header("x-telegram-init-data");
    if (!initData) return res.status(401).json({ error: "telegram_auth_required" });
    const telegramUser = verifyTelegramInitData(initData);
    if (!telegramUser) return res.status(401).json({ error: "telegram_auth_invalid" });

    const { rows } = await db.query("SELECT * FROM students WHERE tg_id = $1", [String(telegramUser.id)]);
    if (!rows.length) return res.status(403).json({ error: "student_not_linked" });
    req.telegramUser = telegramUser;
    req.student = rows[0];
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

module.exports = { requireAuth, requireRole, requireStudent };
