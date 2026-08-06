const crypto = require("crypto");
const db = require("../db");

function verifyTelegramInitData(initData) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken || typeof initData !== "string" || initData.length > 8192) return null;

    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash || !/^[a-f0-9]{64}$/i.test(hash)) return null;

    const authDate = params.get("auth_date");
    if (!authDate || !/^\d{10}$/.test(authDate)) return null;
    const ageSec = Math.floor(Date.now() / 1000) - Number(authDate);
    // 24h, not 1h: initData is minted once when the Mini App opens and never
    // refreshes while it stays open. A student who spends over an hour on the
    // diagnostic would otherwise get 401 on submit with no way to recover
    // except fully reopening the app — and most just give up instead.
    const maxAge = Number(process.env.TELEGRAM_INIT_MAX_AGE_SEC || "86400");
    if (!Number.isFinite(ageSec) || !Number.isFinite(maxAge) || ageSec < 0 || ageSec > maxAge) return null;

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

    const expected = Buffer.from(calculatedHash, "hex");
    const received = Buffer.from(hash, "hex");
    if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) return null;

    const userStr = params.get("user");
    if (!userStr) return null;
    const user = JSON.parse(userStr);
    if (!user || !Number.isSafeInteger(Number(user.id))) return null;
    return user;
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

    const tgId = String(telegramUser.id);
    const { rows: staffRows } = await db.query("SELECT * FROM users WHERE tg_id = $1", [tgId]);
    if (staffRows.length) {
      const demoStudentId = req.header("x-demo-student-id");
      if (!demoStudentId) return res.status(403).json({ error: "staff_account" });
      const { rows: demoRows } = await db.query(
        `SELECT * FROM students
          WHERE id = $1
            AND status = 'active'
            AND (tg_id = 'demo' OR tg_id LIKE 'demo:%')`,
        [demoStudentId]
      );
      if (!demoRows.length) return res.status(403).json({ error: "demo_student_required" });
      req.telegramUser = telegramUser;
      req.user = staffRows[0];
      req.student = demoRows[0];
      return next();
    }
    await db.query(
      "UPDATE students SET status = 'pending' WHERE tg_id = $1 AND access_until IS NOT NULL AND access_until <= now()",
      [tgId]
    );
    let { rows } = await db.query("SELECT * FROM students WHERE tg_id = $1", [tgId]);
    if (!rows.length) {
      // First-ever open with no admin-created record: auto-provision a
      // minimal "pending" student instead of rejecting them. They pick a
      // subject/grade via the self-serve onboarding flow right after this,
      // and stay diagnostic-only until staff grants full access.
      const name = [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(" ") || "Ученик";
      const inserted = await db.query(
        `INSERT INTO students (tg_id, name, first_name, last_name, status)
         VALUES ($1, $2, $3, $4, 'pending')
         ON CONFLICT (tg_id) DO NOTHING RETURNING *`,
        [tgId, name, telegramUser.first_name || name, telegramUser.last_name || null]
      );
      rows = inserted.rows.length
        ? inserted.rows
        : (await db.query("SELECT * FROM students WHERE tg_id = $1", [tgId])).rows;
    }
    req.telegramUser = telegramUser;
    req.student = rows[0];
    next();
  } catch (e) {
    next(e);
  }
}

// Chain after requireStudent on routes that a "pending" (self-serve,
// not-yet-assigned) student must not reach — practice and homework.
async function requireActiveStudent(req, res, next) {
  if (req.student.status !== "active" || (req.student.access_until && new Date(req.student.access_until) <= new Date())) {
    return res.status(403).json({ error: "onboarding_incomplete" });
  }
  try {
    const { rows } = await db.query("SELECT onboarding_step FROM student_profiles WHERE student_id = $1", [req.student.id]);
    if (rows[0]?.onboarding_step !== "complete") return res.status(403).json({ error: "onboarding_incomplete" });
    next();
  } catch (e) { next(e); }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "forbidden" });
    }
    next();
  };
}

module.exports = { verifyTelegramInitData, requireAuth, requireRole, requireStudent, requireActiveStudent };
