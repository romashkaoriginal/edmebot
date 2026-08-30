import { useState } from "react";
import { ArrowRight, CalendarDays, ShieldCheck } from "lucide-react";
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
  const plannedAccessUntil = new Date();
  plannedAccessUntil.setDate(plannedAccessUntil.getDate() + 30);
  const accessUntil = activeTrial && profile.accessUntil ? new Date(profile.accessUntil) : plannedAccessUntil;
  const accessUntilLabel = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(accessUntil);

  return (
    <section className="trial" aria-labelledby="trial-title">
      <Card className="trial__card" pad="lg">
        <span className="trial__icon" aria-hidden="true">
          {trialExpired ? <ShieldCheck size={30} /> : <CalendarDays size={30} />}
        </span>
        <h1 id="trial-title">
          {trialExpired ? "Пробный период завершён" : activeTrial ? "Пробный доступ активен" : "30 дней бесплатно"}
        </h1>
        <p className="trial__lead">
          {trialExpired
            ? "Чтобы продолжить занятия, попроси репетитора открыть доступ."
            : activeTrial
              ? "Продолжай заниматься: практика, домашние задания, питомец и статистика уже доступны."
              : "Вам предоставляется бесплатный пробный доступ на 30 дней. Практика, домашние задания, питомец и статистика откроются сразу после запуска."}
        </p>

        {!trialExpired && (
          <div className="trial__until">
            <span>{activeTrial ? "Доступ открыт до" : "Если начать сегодня, доступ будет открыт до"}</span>
            <strong>{accessUntilLabel}</strong>
          </div>
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
