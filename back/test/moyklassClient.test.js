const test = require("node:test");
const assert = require("node:assert/strict");
const { MoyklassClient } = require("../src/integrations/moyklassClient");

test("CRM client authenticates, retries a temporary error, and keeps the token", async () => {
  const calls = [];
  const fakeFetch = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith("/auth/getToken")) return new Response(JSON.stringify({ accessToken: "secret", expiresAt: "2099-01-01T00:00:00Z" }), { status: 200 });
    if (calls.filter((call) => call.url.endsWith("/userTags")).length === 1) return new Response("busy", { status: 503 });
    return new Response(JSON.stringify([]), { status: 200 });
  };
  const client = new MoyklassClient({ apiKey: "test-key", fetchImpl: fakeFetch });
  assert.deepEqual(await client.getTags(), []);
  assert.deepEqual(await client.getTags(), []);
  assert.equal(calls.filter((call) => call.url.endsWith("/auth/getToken")).length, 1);
  assert.equal(calls.filter((call) => call.url.endsWith("/userTags")).length, 3);
  assert.ok(calls.filter((call) => call.url.endsWith("/userTags")).every((call) => call.options.headers["x-access-token"] === "secret"));
});
