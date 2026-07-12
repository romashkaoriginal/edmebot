import { initData } from "./admin";
import { apiUrl } from "./base";

export async function studentFetch(path, options = {}) {
  const headers = new Headers(options.headers);
  headers.set("x-telegram-init-data", initData());
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(apiUrl(path), { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

export const studentApi = {
  profile: () => studentFetch("/api/profile"),
  analytics: () => studentFetch("/api/profile/analytics"),
  homework: () => studentFetch("/api/homework"),
  completeHomework: (id) => studentFetch(`/api/homework/${id}/complete`, { method: "POST" }),
  practiceSeries: () => studentFetch("/api/practice/series?length=5"),
  answer: (payload) => studentFetch("/api/practice/answer", { method: "POST", body: JSON.stringify(payload) }),
  diagnostic: () => studentFetch("/api/diagnostic"),
  submitDiagnostic: (answers) => studentFetch("/api/diagnostic/submit", { method: "POST", body: JSON.stringify({ answers }) }),
  pet: () => studentFetch("/api/pet"),
  buyPetItem: (itemId) => studentFetch("/api/pet/buy", { method: "POST", body: JSON.stringify({ itemId }) }),
  renamePet: (name) => studentFetch("/api/pet/rename", { method: "POST", body: JSON.stringify({ name }) }),
  onboard: (body) => studentFetch("/api/profile/onboard", { method: "POST", body: JSON.stringify(body) }),
};
