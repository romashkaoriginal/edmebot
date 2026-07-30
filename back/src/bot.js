// Telegram bot wiring (webhook mode). Responds to /start with a button that
// opens the frontend as a Telegram Mini App.
const { TelegramBot } = require("node-telegram-bot-api");
const crypto = require("crypto");
const { rateLimit } = require("express-rate-limit");

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const APP_URL = process.env.APP_URL; // frontend URL (Vercel), e.g. https://edmebot.vercel.app
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
const WEBHOOK_PATH = "/api/telegram/webhook";

let bot = null;

async function rememberContact(user) {
  if (!user?.id) return;
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ") || "Telegram пользователь";
  const db = require("./db");
  await db.query(
    `INSERT INTO telegram_contacts (tg_id, name, username)
     VALUES ($1,$2,$3)
     ON CONFLICT (tg_id) DO UPDATE SET name=EXCLUDED.name, username=EXCLUDED.username, last_seen_at=now()`,
    [String(user.id), name, user.username ?? null]
  );
}

function init(app) {
  if (!TOKEN) {
    console.log("TELEGRAM_BOT_TOKEN not set — Telegram bot disabled.");
    return;
  }
  if (!APP_URL) {
    console.log("APP_URL not set — Telegram bot disabled (need a frontend URL for the Mini App button).");
    return;
  }
  if (!WEBHOOK_SECRET || !/^[A-Za-z0-9_-]{32,256}$/.test(WEBHOOK_SECRET)) {
    console.error("TELEGRAM_WEBHOOK_SECRET must contain 32-256 URL-safe characters; Telegram bot disabled.");
    return;
  }

  // No built-in transport: Express owns the HTTP server and forwards
  // updates to processUpdate() below. The library only makes outgoing
  // API calls (sendMessage, setWebHook, etc).
  bot = new TelegramBot(TOKEN, { webHook: false, polling: false });

  bot.on("message", (msg) => {
    rememberContact(msg.from).catch((e) => console.error("telegram contact save failed:", e.message));
  });

  const webhookLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  });
  app.post(WEBHOOK_PATH, webhookLimiter, async (req, res) => {
    const supplied = req.header("x-telegram-bot-api-secret-token") || "";
    const expected = Buffer.from(WEBHOOK_SECRET);
    const received = Buffer.from(supplied);
    if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
      return res.status(401).json({ error: "invalid_webhook_secret" });
    }
    try {
      await bot.processUpdate(req.body);
      return res.sendStatus(200);
    } catch (error) {
      console.error("telegram update rejected:", error?.message);
      return res.status(400).json({ error: "invalid_telegram_update" });
    }
  });

  bot.onText(/^\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "Добро пожаловать в EDme! Открой приложение, чтобы начать 👇", {
      reply_markup: {
        inline_keyboard: [[{ text: "Открыть EDme", web_app: { url: APP_URL } }]],
      },
    });
  });

  console.log("Telegram bot ready (webhook mode).");
}

// Called once after the server is listening — registers the webhook URL
// with Telegram so it knows where to POST updates.
async function setWebhook(backendUrl) {
  if (!bot) return;
  const url = `${backendUrl}${WEBHOOK_PATH}`;
  await bot.setWebHook(url, { secret_token: WEBHOOK_SECRET });
  console.log(`Telegram webhook set to ${url}`);
}

module.exports = { init, setWebhook };
