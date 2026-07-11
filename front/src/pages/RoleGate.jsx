import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, GraduationCap, ArrowRight, ChevronLeft } from "lucide-react";
import Logo from "../components/brand/Logo";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { adminApi, initData, initTelegramWebApp } from "../api/admin";
import { apiUrl } from "../api/base";
import "./RoleGate.css";

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

  useEffect(() => {
    const webApp = initTelegramWebApp();
    const receivedInitData = Boolean(webApp?.initData);
    setHasInitData(receivedInitData);

    if (!receivedInitData) {
      setLoading(false);
      return;
    }

    adminApi
      .me()
      .then(({ user }) => setRole(user.role))
      .catch(() => setRole(false))
      .finally(() => setLoading(false));
  }, []);

  const isStaff = role === "admin" || role === "tutor";

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

            <div className={`gate__cards${!isStaff ? " gate__cards--single" : ""}`}>
              {isStaff && (
                <Card className="gate__card" pad="lg">
                  <span className="gate__icon gate__icon--admin">
                    <ShieldCheck size={28} strokeWidth={2.4} />
                  </span>
                  <h2 className="gate__card-title">Панель управления</h2>
                  <p className="gate__card-desc">
                    Управление учениками, заданиями, домашкой и статистикой.
                  </p>
                  <Button full iconRight={ArrowRight} onClick={() => navigate("/admin")}>
                    Открыть панель
                  </Button>
                </Card>
              )}

              <Card className="gate__card" pad="lg">
                <span className="gate__icon gate__icon--student">
                  <GraduationCap size={28} strokeWidth={2.4} />
                </span>
                <h2 className="gate__card-title">
                  {isStaff ? "Просмотр как ученик" : "Приложение ученика"}
                </h2>
                <p className="gate__card-desc">
                  {isStaff
                    ? "Выберите ученика и откройте приложение от его имени."
                    : "Практика, домашка, питомец и прогресс."}
                </p>
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
