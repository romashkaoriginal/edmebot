import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, GraduationCap, ArrowRight } from "lucide-react";
import Logo from "../components/brand/Logo";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { adminApi } from "../api/admin";
import "./RoleGate.css";

export default function RoleGate() {
  const navigate = useNavigate();
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi
      .me()
      .then(({ user }) => setRole(user.role))
      .catch(() => setRole(false))
      .finally(() => setLoading(false));
  }, []);

  const isStaff = role === "admin" || role === "tutor";

  return (
    <div className="gate">
      <div className="gate__inner">
        <div className="gate__brand">
          <Logo height={40} />
        </div>

        {loading ? (
          <p className="gate__sub">Загрузка…</p>
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
                    ? "Откройте демо-режим, чтобы проверить интерфейс ученика."
                    : "Практика, домашка, питомец и прогресс."}
                </p>
                <Button full variant="accent" iconRight={ArrowRight} onClick={() => navigate("/app")}>
                  {isStaff ? "Войти как ученик" : "Открыть приложение"}
                </Button>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
