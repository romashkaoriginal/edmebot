const DEFAULT_TIMEOUT_MS = 30_000;

export async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const parentSignal = options.signal;
  let timedOut = false;

  const abortFromParent = () => controller.abort(parentSignal.reason);
  if (parentSignal?.aborted) abortFromParent();
  else parentSignal?.addEventListener("abort", abortFromParent, { once: true });

  const timeout = globalThis.setTimeout(() => {
    timedOut = true;
    controller.abort(new DOMException("Request timed out", "TimeoutError"));
  }, timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    // Older WebViews may replace AbortController's custom reason with a plain
    // AbortError. Keep timeout failures distinguishable from caller-initiated
    // cancellation so retry/error handling can make the right decision.
    if (timedOut && error?.name === "AbortError") {
      throw new DOMException("Request timed out", "TimeoutError");
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeout);
    parentSignal?.removeEventListener("abort", abortFromParent);
  }
}
