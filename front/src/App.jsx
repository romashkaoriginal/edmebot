import { Navigate, useLocation } from "./router";
import { lazy, Suspense } from "react";
import AppLayout from "./components/layout/AppLayout";
import AdminLayout from "./components/layout/AdminLayout";
import RequireRole from "./components/admin/RequireRole";
import AdminIndex from "./components/admin/AdminIndex";
import { AdminAuthProvider } from "./context/AdminAuth";
import {
  loadDiagnostic,
  loadDiagnosticRun,
  loadHomework,
  loadHomeworkAdmin,
  loadHomeworkRun,
  loadPet,
  loadPractice,
  loadPracticeRun,
  loadProfile,
  loadRoleGate,
  loadStats,
  loadStudentOnboarding,
  loadStudents,
  loadTasks,
  loadTrialStart,
  loadUsers,
} from "./routeModules";

const RoleGate = lazy(loadRoleGate);
const StudentOnboarding = lazy(loadStudentOnboarding);
const TrialStart = lazy(loadTrialStart);
const Practice = lazy(loadPractice);
const PracticeRun = lazy(loadPracticeRun);
const Diagnostic = lazy(loadDiagnostic);
const DiagnosticRun = lazy(loadDiagnosticRun);
const Homework = lazy(loadHomework);
const HomeworkRun = lazy(loadHomeworkRun);
const Pet = lazy(loadPet);
const Profile = lazy(loadProfile);
const Students = lazy(loadStudents);
const Users = lazy(loadUsers);
const Tasks = lazy(loadTasks);
const HomeworkAdmin = lazy(loadHomeworkAdmin);
const Stats = lazy(loadStats);

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
