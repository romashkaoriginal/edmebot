import { initData } from "./admin";
import { apiUrl } from "./base";

export async function studentFetch(path, options = {}) {
  const headers = new Headers(options.headers);
  headers.set("x-telegram-init-data", initData());
  const demoStudentId = localStorage.getItem("edme_student_id");
  if (demoStudentId) headers.set("x-demo-student-id", demoStudentId);
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(apiUrl(path), { ...options, headers });
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
  profile: () => studentFetch("/api/profile"),
  analytics: ({ fresh = false } = {}) => cachedStudentFetch("analytics", "/api/profile/analytics", { fresh }),
  homework: ({ fresh = false } = {}) => cachedStudentFetch("homework", "/api/homework", { fresh }),
  completeHomework: async (id) => {
    const result = await studentFetch(`/api/homework/${id}/complete`, { method: "POST" });
    invalidateResource("homework");
    invalidateResource("analytics");
    return result;
  },
  reopenHomework: async (id) => {
    const result = await studentFetch(`/api/homework/${id}/reopen`, { method: "POST" });
    invalidateResource("homework");
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
  diagnostic: ({ fresh = false } = {}) => loadDiagnostic(fresh),
  prefetchDiagnostic: () => loadDiagnostic(false),
  checkDiagnostic: (taskId, selected) => studentFetch("/api/diagnostic/check", { method: "POST", body: JSON.stringify({ taskId, selected }) }),
  submitDiagnostic: async (answers) => {
    const result = await studentFetch("/api/diagnostic/submit", { method: "POST", body: JSON.stringify({ answers }) });
    diagnosticRequest = null;
    return result;
  },
  pet: () => studentFetch("/api/pet"),
  buyPetItem: (itemId) => studentFetch("/api/pet/buy", { method: "POST", body: JSON.stringify({ itemId }) }),
  renamePet: (name) => studentFetch("/api/pet/rename", { method: "POST", body: JSON.stringify({ name }) }),
  updatePet: (payload) => studentFetch("/api/pet", { method: "PATCH", body: JSON.stringify(payload) }),
  onboard: (body) => studentFetch("/api/profile/onboard", { method: "POST", body: JSON.stringify(body) }),
  prefetchStudentSections: () => Promise.allSettled([
    cachedStudentFetch("analytics", "/api/profile/analytics"),
    cachedStudentFetch("homework", "/api/homework"),
  ]),
  peekAnalytics: () => resourceCache.get("analytics")?.data ?? null,
  peekHomework: () => resourceCache.get("homework")?.data ?? null,
};
