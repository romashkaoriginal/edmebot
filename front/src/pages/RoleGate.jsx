import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, GraduationCap, ArrowRight, ChevronLeft } from "lucide-react";
import Logo from "../components/brand/Logo";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { adminApi, initData, initTelegramWebApp } from "../api/admin";
import { apiUrl } from "../api/base";
import { studentApi } from "../api/student";
import "./RoleGate.css";

const ONBOARD_SUBJECTS = ["Математика", "Русский"];
const ONBOARD_GRADES = [5, 6, 7, 8, 9, 10, 11];

async function fetchStudentList() {
  const res = await fetch(apiUrl("/api/students/list"));
  if (!res.ok) throw new Error("failed");
  const { students } = await res.json();
  return students;
}

export default function RoleGate() {
  const navigate = useNavigate();
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("main");
  const [students, setStudents] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [hasInitData, setHasInitData] = useState(() => Boolean(initData()));
  const [onboardSubject, setOnboardSubject] = useState(ONBOARD_SUBJECTS[0]);
  const [onboardGrade, setOnboardGrade] = useState(7);
  const [onboardSubmitting, setOnboardSubmitting] = useState(false);
  const [onboardError, setOnboardError] = useState("");

  useEffect(() => {
    const webApp = initTelegramWebApp();
    const receivedInitData = Boolean(webApp?.initData);
    setHasInitData(receivedInitData);

    if (!receivedInitData) {
      setLoading(false);
      return;
    }

    async function resolveRole() {
      try {
        const { user } = await adminApi.me();
        setRole(user.role);
      } catch {
        // Normal students are not present in `users`. This call also
        // auto-provisions a first-time Telegram user server-side.
        setRole(false);
        try {
          const { profile } = await studentApi.profile();
          if (profile?.status === "pending") setView("onboarding");
        } catch {
          // Keep the Telegram-only entry card when student auth also fails.
        }
      } finally {
        setLoading(false);
      }
    }
    resolveRole();
  }, []);

  const isStaff = role === "admin" || role === "tutor";

  async function submitOnboarding(e) {
    e.preventDefault();
    setOnboardError("");
    setOnboardSubmitting(true);
    try {
      await studentApi.onboard({ subject: onboardSubject, grade: onboardGrade });
      navigate("/app");
    } catch {
      setOnboardError("Не удалось сохранить данные. Попробуйте ещё раз.");
    } finally {
      setOnboardSubmitting(false);
    }
  }

  async function openStudentPick() {
    setStudentsLoading(true);
    try {
      const list = await fetchStudentList();
      setStudents(list);
      setView("student-pick");
    } catch {
      navigate("/app");
    } finally {
      setStudentsLoading(false);
    }
  }

  function pickStudent(s) {
    localStorage.setItem("edme_student_id", String(s.id));
    navigate("/app");
  }

  if (view === "onboarding") {
    return (
      <div className="gate">
        <div className="gate__inner">
          <div className="gate__brand"><Logo height={40} /></div>
          <h1 className="gate__title font-display">Расскажи о себе</h1>
          <p className="gate__sub">Выбери предмет и класс — мы подберём входной тест.</p>
          <form className="gate__onboard-form" onSubmit={submitOnboarding}>
            <label className="gate__onboard-field">
              <span>Предмет</span>
              <select
                className="gate__onboard-select"
                value={onboardSubject}
                onChange={(e) => setOnboardSubject(e.target.value)}
              >
                {ONBOARD_SUBJECTS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="gate__onboard-field">
              <span>Класс</span>
              <select
                className="gate__onboard-select"
                value={onboardGrade}
                onChange={(e) => setOnboardGrade(Number(e.target.value))}
              >
                {ONBOARD_GRADES.map((g) => (
                  <option key={g} value={g}>{g} класс</option>
                ))}
              </select>
            </label>
            <Button type="submit" full iconRight={ArrowRight} disabled={onboardSubmitting}>
              {onboardSubmitting ? "Секунду…" : "Продолжить"}
            </Button>
            {onboardError && <p className="gate__onboard-error">{onboardError}</p>}
          </form>
        </div>
      </div>
    );
  }

  if (view === "student-pick") {
    return (
      <div className="gate">
        <div className="gate__inner">
          <div className="gate__brand"><Logo height={40} /></div>
          <h1 className="gate__title font-display">Выберите ученика</h1>
          <p className="gate__sub">Откройте приложение от имени выбранного ученика.</p>
          <div className="gate__student-list">
            {students.length === 0 ? (
              <p className="gate__sub">Нет учеников в базе.</p>
            ) : (
              students.map((s) => (
                <Card key={s.id} className="gate__student-row" pad="sm">
                  <div className="gate__student-info">
                    <strong>{s.name}</strong>
                    <span>{s.grade} класс · {s.subject}</span>
                  </div>
                  <Button size="sm" iconRight={ArrowRight} onClick={() => pickStudent(s)}>
                    Войти
                  </Button>
                </Card>
              ))
            )}
          </div>
          <button className="gate__back" onClick={() => setView("main")}>
            <ChevronLeft size={16} /> Назад
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="gate">
      <div className="gate__inner">
        <div className="gate__brand"><Logo height={40} /></div>

        {loading ? (
          <p className="gate__sub">Загрузка…</p>
        ) : !hasInitData ? (
          <>
            <h1 className="gate__title font-display">Откройте через Telegram</h1>
            <p className="gate__sub">
              Приложение доступно только через Telegram Mini App.
              Откройте его через кнопку в боте.
            </p>
          </>
        ) : (
          <>
            <h1 className="gate__title font-display">
              {isStaff ? "Как вы хотите войти?" : "Добро пожаловать"}
            </h1>
            <p className="gate__sub">
              {isStaff
                ? "Войдите в панель или просмотрите приложение глазами ученика."
                : "Откройте приложение ученика."}
            </p>

            <div className="gate__cards">
              {isStaff && (
                <Card className="gate__card" pad="md">
                  <div className="gate__card-head">
                    <span className="gate__icon gate__icon--admin">
                      <ShieldCheck size={24} strokeWidth={2.4} />
                    </span>
                    <div>
                      <h2 className="gate__card-title">Панель управления</h2>
                      <p className="gate__card-desc">
                        Управление учениками, заданиями, домашкой и статистикой.
                      </p>
                    </div>
                  </div>
                  <Button full iconRight={ArrowRight} onClick={() => navigate("/admin")}>
                    Открыть панель
                  </Button>
                </Card>
              )}

              <Card className="gate__card" pad="md">
                <div className="gate__card-head">
                  <span className="gate__icon gate__icon--student">
                    <GraduationCap size={24} strokeWidth={2.4} />
                  </span>
                  <div>
                    <h2 className="gate__card-title">
                      {isStaff ? "Просмотр как ученик" : "Приложение ученика"}
                    </h2>
                    <p className="gate__card-desc">
                      {isStaff
                        ? "Выберите ученика и откройте приложение от его имени."
                        : "Практика, домашка, питомец и прогресс."}
                    </p>
                  </div>
                </div>
                <Button
                  full
                  variant="accent"
                  iconRight={ArrowRight}
                  onClick={isStaff ? openStudentPick : () => navigate("/app")}
                  disabled={studentsLoading}
                >
                  {isStaff
                    ? studentsLoading ? "Загрузка…" : "Выбрать ученика"
                    : "Открыть приложение"}
                </Button>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
