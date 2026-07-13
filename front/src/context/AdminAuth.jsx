import { createContext, useContext, useEffect, useState } from "react";
import { adminApi } from "../api/admin";

const Ctx = createContext(null);
const previewUser = import.meta.env.DEV && new URLSearchParams(window.location.search).get("preview") === "admin"
  ? { id: "preview", tgId: "preview", name: "Тестировщик EDme", role: "admin" }
  : null;

// Fetches the current user's role once (via /api/admin/me) and shares it
// across the admin panel — layout nav, route guards, and page-level UI all
// read from here instead of re-fetching.
export function AdminAuthProvider({ children }) {
  const [state, setState] = useState(
    previewUser
      ? { loading: false, user: previewUser, error: "" }
      : { loading: true, user: null, error: "" }
  );

  useEffect(() => {
    if (previewUser) return undefined;
    adminApi
      .me()
      .then(({ user }) => setState({ loading: false, user, error: "" }))
      .catch((e) => setState({ loading: false, user: null, error: e.message }));
    return undefined;
  }, []);

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export function useAdminAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
}
