import { Navigate } from "./router";
import StudentOnboarding from "./pages/StudentOnboarding";
import TrialStart from "./pages/TrialStart";
import Practice from "./pages/Practice";
import PracticeRun from "./pages/PracticeRun";
import Diagnostic from "./pages/Diagnostic";
import DiagnosticRun from "./pages/DiagnosticRun";
import Homework from "./pages/Homework";
import HomeworkRun from "./pages/HomeworkRun";
import Pet from "./pages/Pet";
import Profile from "./pages/Profile";

// This module is the single student-area chunk. Once the first student page
// appears, every sibling route is already executable; switching tabs cannot
// suspend on another page-level import.
export default function StudentRoutes({ pathname }) {
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
