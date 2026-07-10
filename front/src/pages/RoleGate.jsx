import { useNavigate } from "react-router-dom";
import { ShieldCheck, GraduationCap, ArrowRight } from "lucide-react";
import Logo from "../components/brand/Logo";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import "./RoleGate.css";

// Entry screen: pick admin panel or the demo student app.
// Roles will later be gated by Telegram id; for now both are open.
export default function RoleGate() {
  const navigate = useNavigate();

  return (
    <div className="gate">
      <div className="gate__inner">
        <div className="gate__brand">
          <Logo height={40} />
        </div>
        <h1 className="gate__title font-display">Как вы хотите войти?</h1>
        <p className="gate__sub">Выберите режим — позже доступ будет определяться по Telegram‑аккаунту.</p>

        <div className="gate__cards">
          <Card className="gate__card" pad="lg">
            <span className="gate__icon gate__icon--admin">
              <ShieldCheck size={28} strokeWidth={2.4} />
            </span>
            <h2 className="gate__card-title">Админ‑панель</h2>
            <p className="gate__card-desc">
              Управление учениками, заданиями, домашкой и статистикой.
            </p>
            <Button full iconRight={ArrowRight} onClick={() => navigate("/admin")}>
              Войти как админ
            </Button>
          </Card>

          <Card className="gate__card" pad="lg">
            <span className="gate__icon gate__icon--student">
              <GraduationCap size={28} strokeWidth={2.4} />
            </span>
            <h2 className="gate__card-title">Демо‑ученик</h2>
            <p className="gate__card-desc">
              Приложение ученика: практика, домашка, питомец и прогресс.
            </p>
            <Button full variant="accent" iconRight={ArrowRight} onClick={() => navigate("/app")}>
              Войти как ученик
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
