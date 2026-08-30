import { Navigate, useLocation } from "./router";
import { lazy, Suspense } from "react";
import AppLayout from "./components/layout/AppLayout";
import AdminLayout from "./components/layout/AdminLayout";
import { AdminAuthProvider } from "./context/AdminAuth";
import {
  loadAdminRoutes,
  loadRoleGate,
  loadStudentRoutes,
} from "./routeModules";

const RoleGate = lazy(loadRoleGate);
const StudentRoutes = lazy(loadStudentRoutes);
const AdminRoutes = lazy(loadAdminRoutes);

export default function App() {
  const { pathname } = useLocation();
  let content;

  if (pathname === "/") {
    content = <RoleGate />;
  } else if (pathname === "/app" || pathname.startsWith("/app/")) {
    content = <AppLayout><StudentRoutes pathname={pathname} /></AppLayout>;
  } else if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    content = (
      <AdminAuthProvider>
        <AdminLayout><AdminRoutes pathname={pathname} /></AdminLayout>
      </AdminAuthProvider>
    );
  } else {
    content = <Navigate to="/" replace />;
  }

  return (
    <Suspense fallback={<div className="app__loading" role="status">Загружаем раздел…</div>}>
      {content}
    </Suspense>
  );
}
