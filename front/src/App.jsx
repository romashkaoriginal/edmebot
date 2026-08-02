import { Navigate, useLocation } from "./router";
import { lazy, Suspense } from "react";
import AppLayout from "./components/layout/AppLayout";
import AdminLayout from "./components/layout/AdminLayout";
import RequireRole from "./components/admin/RequireRole";
import AdminIndex from "./components/admin/AdminIndex";
import { AdminAuthProvider } from "./context/AdminAuth";

const RoleGate = lazy(() => import("./pages/RoleGate"));
const StudentOnboarding = lazy(() => import("./pages/StudentOnboarding"));
const TrialStart = lazy(() => import("./pages/TrialStart"));
const Practice = lazy(() => import("./pages/Practice"));
const PracticeRun = lazy(() => import("./pages/PracticeRun"));
const Diagnostic = lazy(() => import("./pages/Diagnostic"));
const DiagnosticRun = lazy(() => import("./pages/DiagnosticRun"));
const Homework = lazy(() => import("./pages/Homework"));
const HomeworkRun = lazy(() => import("./pages/HomeworkRun"));
const Pet = lazy(() => import("./pages/Pet"));
const Profile = lazy(() => import("./pages/Profile"));
const Students = lazy(() => import("./pages/admin/Students"));
const Users = lazy(() => import("./pages/admin/Users"));
const Tasks = lazy(() => import("./pages/admin/Tasks"));
const HomeworkAdmin = lazy(() => import("./pages/admin/HomeworkAdmin"));
const Stats = lazy(() => import("./pages/admin/Stats"));

export default function App() {
  const { pathname } = useLocation();
  let content;

  if (pathname === "/") {
    content = <RoleGate />;
  } else if (pathname === "/app" || pathname.startsWith("/app/")) {
    content = <AppLayout>{studentPage(pathname)}</AppLayout>;
  } else if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    content = (
      <AdminAuthProvider>
        <AdminLayout>{adminPage(pathname)}</AdminLayout>
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

function studentPage(pathname) {
  const routes = {
    "/app": <Navigate to="/app/profile" replace />,
    "/app/onboarding": <StudentOnboarding />,
    "/app/trial": <TrialStart />,
    "/app/practice": <Practice />,
    "/app/practice/run": <PracticeRun />,
    "/app/diagnostic": <Diagnostic />,
    "/app/diagnostic/run": <DiagnosticRun />,
    "/app/homework": <Homework />,
    "/app/homework/run": <HomeworkRun />,
    "/app/pet": <Pet />,
    "/app/profile": <Profile />,
  };
  return routes[pathname] ?? <Navigate to="/app/profile" replace />;
}

function adminPage(pathname) {
  const routes = {
    "/admin": <AdminIndex />,
    "/admin/students": <RequireRole roles={["admin"]}><Students /></RequireRole>,
    "/admin/users": <RequireRole roles={["admin"]}><Users /></RequireRole>,
    "/admin/tasks": <Tasks />,
    "/admin/homework": <HomeworkAdmin />,
    "/admin/stats": <Stats />,
  };
  return routes[pathname] ?? <Navigate to="/admin" replace />;
}
