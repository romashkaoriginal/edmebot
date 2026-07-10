// Telegram bot wiring (webhook mode). Responds to /start with a button that
// opens the frontend as a Telegram Mini App.
const TelegramBot = require("node-telegram-bot-api");

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const APP_URL = process.env.APP_URL; // frontend URL (Vercel), e.g. https://edmebot.vercel.app
const WEBHOOK_PATH = "/api/telegram/webhook";

let bot = null;

function init(app) {
  if (!TOKEN) {
    console.log("TELEGRAM_BOT_TOKEN not set — Telegram bot disabled.");
    return;
  }
  if (!APP_URL) {
    console.log("APP_URL not set — Telegram bot disabled (need a frontend URL for the Mini App button).");
    return;
  }

  bot = new TelegramBot(TOKEN, { webHook: true });

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
