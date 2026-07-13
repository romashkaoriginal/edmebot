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
  analytics: () => studentFetch("/api/profile/analytics"),
  homework: () => studentFetch("/api/homework"),
  completeHomework: (id) => studentFetch(`/api/homework/${id}/complete`, { method: "POST" }),
  reopenHomework: (id) => studentFetch(`/api/homework/${id}/reopen`, { method: "POST" }),
  practiceSeries: (settings = {}) => {
    const query = new URLSearchParams({ length: "5" });
    Object.entries(settings).forEach(([key, value]) => {
      if (value && value !== "auto") query.set(key, value);
    });
    return studentFetch(`/api/practice/series?${query}`);
  },
  answer: (payload) => studentFetch("/api/practice/answer", { method: "POST", body: JSON.stringify(payload) }),
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
};
