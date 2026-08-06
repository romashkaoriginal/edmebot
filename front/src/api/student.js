import { initData } from "./admin";
import { apiUrl, fetchWithTimeout } from "./base";

// Telegram mints initData once when the Mini App opens; when the backend
// rejects it (expired or missing), no amount of retrying the same request
// can succeed — only fully reopening the app issues fresh credentials.
const AUTH_ERRORS = new Set(["telegram_auth_required", "telegram_auth_invalid", "unauthorized"]);

export function isAuthError(error) {
  return AUTH_ERRORS.has(error?.message);
}

export async function studentFetch(path, options = {}) {
  const headers = new Headers(options.headers);
  headers.set("x-telegram-init-data", initData());
  const demoStudentId = localStorage.getItem("edme_student_id");
  if (demoStudentId) headers.set("x-demo-student-id", demoStudentId);
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetchWithTimeout(apiUrl(path), { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

let diagnosticRequest = null;
const resourceCache = new Map();

function cachedStudentFetch(key, path, { fresh = false } = {}) {
  const cached = resourceCache.get(key);
  if (!fresh && cached) return cached.promise;
  const entry = { data: fresh ? cached?.data ?? null : null, promise: null };
  const request = studentFetch(path)
    .then((data) => {
      entry.data = data;
      return data;
    })
    .catch((error) => {
      if (resourceCache.get(key) === entry) resourceCache.delete(key);
      throw error;
    });
  entry.promise = request;
  resourceCache.set(key, entry);
  return request;
}

function invalidateResource(key) {
  resourceCache.delete(key);
}

function loadDiagnostic(fresh = false) {
  if (fresh || !diagnosticRequest) {
    diagnosticRequest = studentFetch("/api/diagnostic").catch((error) => {
      diagnosticRequest = null;
      throw error;
    });
  }
  return diagnosticRequest;
}

export const studentApi = {
  profile: ({ subject } = {}) => studentFetch(`/api/profile${subject ? `?${new URLSearchParams({ subject })}` : ""}`),
  analytics: ({ fresh = false } = {}) => cachedStudentFetch("analytics", "/api/profile/analytics", { fresh }),
  homework: ({ fresh = false, subject } = {}) => {
    const query = subject ? `?${new URLSearchParams({ subject })}` : "";
    return cachedStudentFetch(`homework:${subject ?? "all"}`, `/api/homework${query}`, { fresh });
  },
  homeworkTasks: (id) => studentFetch(`/api/homework/${id}/tasks`),
  submitHomework: async (id, attemptId, answers) => {
    const result = await studentFetch(`/api/homework/${id}/submit`, {
      method: "POST",
      body: JSON.stringify({ attemptId, answers }),
    });
    [...resourceCache.keys()].filter((key) => key.startsWith("homework:")).forEach(invalidateResource);
    invalidateResource("analytics");
    return result;
  },
  practiceSeries: (settings = {}) => {
    const query = new URLSearchParams({ length: "5" });
    Object.entries(settings).forEach(([key, value]) => {
      if (value && value !== "auto") query.set(key, value);
    });
    return studentFetch(`/api/practice/series?${query}`);
  },
  answer: async (payload) => {
    const result = await studentFetch("/api/practice/answer", { method: "POST", body: JSON.stringify(payload) });
    invalidateResource("analytics");
    return result;
  },
  revealPracticeHint: (instanceId) => studentFetch("/api/practice/hint", {
    method: "POST",
    body: JSON.stringify({ instanceId }),
  }),
  diagnostic: ({ fresh = false } = {}) => loadDiagnostic(fresh),
  prefetchDiagnostic: () => loadDiagnostic(false),
  checkDiagnostic: (sessionId, taskId, selected) => studentFetch("/api/diagnostic/check", { method: "POST", body: JSON.stringify({ sessionId, taskId, selected }) }),
  submitDiagnostic: async (sessionId, answers) => {
    const result = await studentFetch("/api/diagnostic/submit", { method: "POST", body: JSON.stringify({ sessionId, answers }) });
    diagnosticRequest = null;
    return result;
  },
  pet: ({ fresh = false } = {}) => cachedStudentFetch("pet", "/api/pet", { fresh }),
  peekPet: () => resourceCache.get("pet")?.data ?? null,
  buyPetItem: async (itemId) => {
    const result = await studentFetch("/api/pet/buy", { method: "POST", body: JSON.stringify({ itemId }) });
    invalidateResource("pet");
    return result;
  },
  feedPet: async (itemId) => {
    const result = await studentFetch("/api/pet/feed", { method: "POST", body: JSON.stringify({ itemId }) });
    invalidateResource("pet");
    return result;
  },
  renamePet: async (name) => {
    const result = await studentFetch("/api/pet/rename", { method: "POST", body: JSON.stringify({ name }) });
    invalidateResource("pet");
    return result;
  },
  updatePet: async (payload) => {
    const result = await studentFetch("/api/pet", { method: "PATCH", body: JSON.stringify(payload) });
    invalidateResource("pet");
    return result;
  },
  onboard: (body) => studentFetch("/api/profile/onboard", { method: "POST", body: JSON.stringify(body) }),
  startTrial: () => studentFetch("/api/profile/trial/start", { method: "POST" }),
  prefetchStudentSections: (subjects = []) => Promise.allSettled([
    cachedStudentFetch("analytics", "/api/profile/analytics"),
    cachedStudentFetch("homework:all", "/api/homework"),
    cachedStudentFetch("pet", "/api/pet"),
    ...subjects.map((subject) =>
      cachedStudentFetch(`homework:${subject}`, `/api/homework?${new URLSearchParams({ subject })}`)
    ),
  ]),
  peekAnalytics: () => resourceCache.get("analytics")?.data ?? null,
  peekHomework: (subject) => resourceCache.get(`homework:${subject ?? "all"}`)?.data ?? null,
};
