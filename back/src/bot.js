// Telegram bot wiring (webhook mode). Responds to /start with a button that
// opens the frontend as a Telegram Mini App.
const { TelegramBot } = require("node-telegram-bot-api");

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const APP_URL = process.env.APP_URL; // frontend URL (Vercel), e.g. https://edmebot.vercel.app
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

  // No built-in transport: Express owns the HTTP server and forwards
  // updates to processUpdate() below. The library only makes outgoing
  // API calls (sendMessage, setWebHook, etc).
  bot = new TelegramBot(TOKEN, { webHook: false, polling: false });

  bot.on("message", (msg) => {
    rememberContact(msg.from).catch((e) => console.error("telegram contact save failed:", e.message));
  });

  app.post(WEBHOOK_PATH, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
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
  await bot.setWebHook(url);
  console.log(`Telegram webhook set to ${url}`);
}

module.exports = { init, setWebhook };
