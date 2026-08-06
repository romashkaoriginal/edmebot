// Render's free tier suspends a web service after ~15 minutes with no inbound
// traffic, and waking it again takes close to a minute. That cold start lands
// squarely on the student opening the Mini App for the first time, which is
// exactly when their account is being provisioned — the worst possible moment
// to show a spinner or an error.
//
// So the service pings its own health endpoint on a timer to stay awake. The
// request has to come over the public URL: a loopback call never reaches
// Render's proxy, which is what actually decides whether the service is idle.
const PING_INTERVAL_MS = 10 * 60 * 1000;
const PING_TIMEOUT_MS = 30 * 1000;

function publicUrl() {
  return process.env.RENDER_EXTERNAL_URL || process.env.BACKEND_URL || null;
}

function enabled() {
  // Off by default outside a deployed environment: a dev machine has no reason
  // to ping itself, and KEEP_ALIVE=off is the escape hatch for a paid instance
  // that never sleeps.
  const flag = String(process.env.KEEP_ALIVE ?? "").toLowerCase();
  if (flag === "off" || flag === "false" || flag === "0") return false;
  if (flag === "on" || flag === "true" || flag === "1") return true;
  return Boolean(process.env.RENDER_EXTERNAL_URL);
}

function start() {
  const base = publicUrl();
  if (!enabled() || !base) {
    console.log("Keep-alive ping disabled.");
    return null;
  }
  const url = `${base.replace(/\/$/, "")}/api/health`;
  const timer = setInterval(async () => {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(PING_TIMEOUT_MS),
        headers: { "user-agent": "edmebot-keepalive" },
      });
      if (!response.ok) console.error(`Keep-alive ping got HTTP ${response.status}`);
    } catch (error) {
      // A failed ping is not fatal — the next one is ten minutes away and the
      // service still serves real traffic meanwhile.
      console.error("Keep-alive ping failed:", error?.message);
    }
  }, PING_INTERVAL_MS);
  // Never hold the process open just for the ping timer.
  timer.unref?.();
  console.log(`Keep-alive ping every ${PING_INTERVAL_MS / 60000} min → ${url}`);
  return timer;
}

module.exports = { start };
