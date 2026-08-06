import { useState } from "react";
import { ArrowRight, CalendarDays, CheckCircle2, ShieldCheck } from "lucide-react";
import { useNavigate } from "../router";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import { isAuthError, studentApi } from "../api/student";
import { useApp } from "../store/AppStore";
import "./TrialStart.css";

export default function TrialStart() {
  const navigate = useNavigate();
  const { profile, hydrate } = useApp();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function startTrial() {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const data = await studentApi.startTrial();
      hydrate(data);
      navigate("/app", { replace: true });
    } catch (requestError) {
      setError(requestError?.message === "trial_already_used"
        ? "Пробный период уже использован. Попроси репетитора открыть постоянный доступ."
        : isAuthError(requestError)
          ? "Сессия устарела. Закрой приложение и открой его снова через кнопку в боте."
          : "Не удалось запустить пробный период. Проверь соединение и попробуй ещё раз.");
    } finally {
      setLoading(false);
    }
  }

  const trialExpired = profile.trialUsed && profile.status !== "active";
  const activeTrial = profile.status === "active" && profile.accessKind === "trial";

  return (
    <section className="trial" aria-labelledby="trial-title">
      <Card className="trial__card" pad="lg">
        <span className="trial__icon" aria-hidden="true">
          {trialExpired ? <ShieldCheck size={30} /> : <CalendarDays size={30} />}
        </span>
        <h1 id="trial-title">
          {trialExpired ? "Пробный период завершён" : activeTrial ? "Пробный период активен" : "30 дней пробного доступа"}
        </h1>
        <p className="trial__lead">
          {trialExpired
            ? "Повторно запустить trial нельзя. Репетитор может открыть постоянный доступ."
            : activeTrial
              ? "Можно заниматься до даты, указанной в верхней панели. Автоматического продления нет."
              : "После запуска откроются практика, домашние задания, питомец и статистика."}
        </p>

        {!trialExpired && !activeTrial && (
          <ul className="trial__facts">
            <li><CheckCircle2 size={19} aria-hidden="true" /> Запускается один раз</li>
            <li><CheckCircle2 size={19} aria-hidden="true" /> Действует ровно 30 дней</li>
            <li><CheckCircle2 size={19} aria-hidden="true" /> Не продлевается и не списывает деньги</li>
          </ul>
        )}

        {error && <p className="trial__error" role="alert">{error}</p>}

        {trialExpired ? (
          <p className="trial__contact">Напиши репетитору, чтобы продолжить обучение.</p>
        ) : activeTrial ? (
          <Button full iconRight={ArrowRight} onClick={() => navigate("/app", { replace: true })}>
            Перейти к занятиям
          </Button>
        ) : (
          <Button full iconRight={ArrowRight} loading={loading} onClick={startTrial}>
            Начать 30 дней бесплатно
          </Button>
        )}
      </Card>
    </section>
  );
}
