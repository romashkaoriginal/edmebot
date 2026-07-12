import { apiUrl } from "./base";

// Thin wrapper over the admin API. Sends x-telegram-id (from Telegram WebApp or
// a localStorage fallback) — not enforced server-side yet, but wired for later.
export function telegramWebApp() {
  return window.Telegram?.WebApp ?? null;
}

export function initData() {
  return telegramWebApp()?.initData || "";
}

export function initTelegramWebApp() {
  const webApp = telegramWebApp();
  if (!webApp) return null;
  webApp.ready();
  webApp.expand();
  // Prevent an in-app vertical scroll (e.g. a long list) from being read as a
  // swipe-down-to-close gesture by the Telegram client.
  webApp.disableVerticalSwipes?.();
  // Ask for a tap confirmation before the Mini App closes, so an accidental
  // tap on the client's close button doesn't lose in-progress work.
  webApp.enableClosingConfirmation?.();
  return webApp;
}

async function req(path, { method = "GET", body } = {}) {
  const res = await fetch(apiUrl(`/api/admin${path}`), {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-telegram-init-data": initData(),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// Multipart upload — no Content-Type/JSON.stringify, the browser sets the
// multipart boundary header itself from the FormData body.
async function reqForm(path, formData) {
  const res = await fetch(apiUrl(`/api/admin${path}`), {
    method: "POST",
    headers: { "x-telegram-init-data": initData() },
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// Fetch an .xlsx template as a blob and trigger a browser download. Used by
// every import flow so each one offers a downloadable, self-documenting sample.
async function downloadTemplate(fullPath, filename) {
  const response = await fetch(apiUrl(fullPath), {
    headers: { "x-telegram-init-data": initData() },
  });
  if (!response.ok) throw new Error("template_download_failed");
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export const adminApi = {
  // Current user (role check)
  me: () => req("/me"),
  telegramContacts: (kind) => req(`/telegram-contacts?kind=${kind}`),

  // Users
  listUsers: () => req("/users"),
  createUser: (u) => req("/users", { method: "POST", body: u }),
  updateUser: (id, u) => req(`/users/${id}`, { method: "PUT", body: u }),
  deleteUser: (id) => req(`/users/${id}`, { method: "DELETE" }),

  // Students
  listStudents: () => req("/students"),
  createStudent: (s) => req("/students", { method: "POST", body: s }),
  updateStudent: (id, s) => req(`/students/${id}`, { method: "PUT", body: s }),
  deleteStudent: (id) => req(`/students/${id}`, { method: "DELETE" }),

  // Bonuses
  bonusHistory: (studentId) => req(`/students/${studentId}/bonus`),
  awardBonus: (studentId, b) => req(`/students/${studentId}/bonus`, { method: "POST", body: b }),

  // Subject enrollments — how a self-serve "pending" student is promoted to
  // active, and how any student gains an additional subject.
  studentSubjects: (id) => req(`/students/${id}/subjects`),
  assignSubject: (id, body) => req(`/students/${id}/subjects`, { method: "POST", body }),

  // Tasks
  listTasks: (params = {}) => {
    const q = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v != null && v !== "")
    ).toString();
    return req(`/tasks${q ? `?${q}` : ""}`);
  },
  taskTopics: ({ grade, subject }) =>
    req(`/tasks/topics?grade=${encodeURIComponent(grade)}&subject=${encodeURIComponent(subject)}`),
  createTask: (t) => req("/tasks", { method: "POST", body: t }),
  updateTask: (id, t) => req(`/tasks/${id}`, { method: "PUT", body: t }),
  deleteTask: (id) => req(`/tasks/${id}`, { method: "DELETE" }),
  importTasks: (file) => {
    const form = new FormData();
    form.append("file", file);
    return reqForm("/tasks/import", form);
  },
  downloadTaskTemplate: () => downloadTemplate("/api/admin/tasks/import-template", "tasks_template.xlsx"),

  // Homework
  listHomework: (studentId) =>
    req(`/homework${studentId ? `?studentId=${studentId}` : ""}`),
  createHomework: (h) => req("/homework", { method: "POST", body: h }),
  deleteHomework: (id) => req(`/homework/${id}`, { method: "DELETE" }),
  importHomework: (file) => {
    const form = new FormData();
    form.append("file", file);
    return reqForm("/homework/import", form);
  },
  downloadHomeworkTemplate: () => downloadTemplate("/api/admin/homework/import-template", "homework_template.xlsx"),

  // Stats
  stats: () => req("/stats"),
  studentStats: (id) => req(`/stats/${id}`),
};
