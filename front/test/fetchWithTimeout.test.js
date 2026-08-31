import assert from "node:assert/strict";
import test from "node:test";
import { fetchWithTimeout } from "../src/api/fetchWithTimeout.js";

test("returns a response when fetch completes before the deadline", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const response = { ok: true };
  globalThis.fetch = async () => response;

  assert.equal(await fetchWithTimeout("https://example.test", {}, 50), response);
});

test("rejects a request that never completes with TimeoutError", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  });

  await assert.rejects(
    fetchWithTimeout("https://example.test", {}, 10),
    { name: "TimeoutError", message: "Request timed out" }
  );
});

test("propagates cancellation from the caller", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  });
  const controller = new AbortController();
  const request = fetchWithTimeout("https://example.test", { signal: controller.signal }, 1_000);
  controller.abort(new DOMException("Cancelled", "AbortError"));

  await assert.rejects(request, { name: "AbortError", message: "Cancelled" });
});
