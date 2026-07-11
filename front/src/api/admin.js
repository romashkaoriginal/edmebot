import { apiUrl } from "./base";

// Thin wrapper over the admin API. Sends x-telegram-id (from Telegram WebApp or
// a localStorage fallback) — not enforced server-side yet, but wired for later.
function tgId() {
  try {
    const wa = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
    if (wa) return String(wa);
  } catch {
    /* not in Telegram */
  }
  return localStorage.getItem("edme_tg_id") || "demo";
}

async function req(path, { method = "GET", body } = {}) {
  const res = await fetch(apiUrl(`/api/admin${path}`), {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-telegram-id": tgId(),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const adminApi = {
  // Current user (role check)
  me: () => req("/me"),

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

  // Tasks
  listTasks: (params = {}) => {
    const q = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v != null && v !== "")
    ).toString();
    return req(`/tasks${q ? `?${q}` : ""}`);
  },
  createTask: (t) => req("/tasks", { method: "POST", body: t }),
  deleteTask: (id) => req(`/tasks/${id}`, { method: "DELETE" }),

  // Homework
  listHomework: (studentId) =>
    req(`/homework${studentId ? `?studentId=${studentId}` : ""}`),
  createHomework: (h) => req("/homework", { method: "POST", body: h }),
  deleteHomework: (id) => req(`/homework/${id}`, { method: "DELETE" }),

  // Stats
  stats: () => req("/stats"),
  studentStats: (id) => req(`/stats/${id}`),
};
