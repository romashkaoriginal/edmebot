const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const { verifyTelegramInitData } = require("../src/middleware/auth");

const TOKEN = "123456:test-token";

function signedInitData({ authDate = Math.floor(Date.now() / 1000), user = { id: 123456, first_name: "Test" } } = {}) {
  const params = new URLSearchParams({
    auth_date: String(authDate),
    query_id: "test-query",
    user: JSON.stringify(user),
  });
  const dataCheckString = [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(TOKEN).digest();
  const hash = crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex");
  params.set("hash", hash);
  return params.toString();
}

test.beforeEach(() => {
  process.env.TELEGRAM_BOT_TOKEN = TOKEN;
  process.env.TELEGRAM_INIT_MAX_AGE_SEC = "3600";
});

test("accepts a fresh Telegram-signed payload", () => {
  assert.equal(verifyTelegramInitData(signedInitData()).id, 123456);
});

test("rejects missing, expired and tampered Telegram auth data", () => {
  const missingDate = new URLSearchParams(signedInitData());
  missingDate.delete("auth_date");
  assert.equal(verifyTelegramInitData(missingDate.toString()), null);
  assert.equal(verifyTelegramInitData(signedInitData({ authDate: Math.floor(Date.now() / 1000) - 4000 })), null);
  const tampered = new URLSearchParams(signedInitData());
  tampered.set("user", JSON.stringify({ id: 999999 }));
  assert.equal(verifyTelegramInitData(tampered.toString()), null);
});

test("rejects malformed hashes without throwing", () => {
  const malformed = new URLSearchParams(signedInitData());
  malformed.set("hash", "not-a-hash");
  assert.equal(verifyTelegramInitData(malformed.toString()), null);
});
