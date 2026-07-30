// Base URL for the backend API.
// - In dev, Vite proxies /api → localhost:3001, so an empty base works.
// - In production (Vercel), set VITE_API_URL to your Render backend URL,
//   e.g. https://edmebot-api.onrender.com
export const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

// Build a full API URL from a path that starts with /api/...
export function apiUrl(path) {
  return `${API_BASE}${path}`;
}

export async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const parentSignal = options.signal;
  const abortFromParent = () => controller.abort(parentSignal.reason);
  if (parentSignal?.aborted) abortFromParent();
  else parentSignal?.addEventListener("abort", abortFromParent, { once: true });
  const timeout = window.setTimeout(() => controller.abort(new DOMException("Request timed out", "TimeoutError")), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
    parentSignal?.removeEventListener("abort", abortFromParent);
  }
}
