import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, CircleHelp, PartyPopper, RefreshCw, X } from "lucide-react";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import OptionList from "../components/shared/OptionList";
import KnowledgeMap from "../components/shared/KnowledgeMap";
import { studentApi } from "../api/student";
import { useApp } from "../store/AppStore";
import "./RunMode.css";

const SESSION_TTL = 6 * 60 * 60 * 1000;

export default function DiagnosticRun() {
  const navigate = useNavigate();
  const { hydrate, profile } = useApp();
  const sessionKey = useMemo(() => {
    const student = localStorage.getItem("edme_student_id") || "telegram";
    return `edme:diagnostic:${student}:${profile.subject || "default"}`;
  }, [profile.subject]);
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [questions, setQuestions] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [resultTopics, setResultTopics] = useState([]);
  const [done, setDone] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loadVersion, setLoadVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setQuestions(null);
    setLoadError("");

    if (loadVersion === 0) {
      try {
        const cached = JSON.parse(localStorage.getItem(sessionKey) || "null");
        if (cached && Date.now() - cached.savedAt < SESSION_TTL && cached.questions?.length) {
          setQuestions(cached.questions);
          setIdx(Math.min(cached.idx ?? 0, cached.questions.length - 1));
          setAnswers(cached.answers ?? []);
          setSelected(cached.selected ?? null);
          return () => { cancelled = true; };
        }
      } catch {
        localStorage.removeItem(sessionKey);
      }
    }

    studentApi.diagnostic()
      .then((data) => {
        if (!cancelled) setQuestions(data.questions ?? []);
      })
      .catch(() => {
        if (!cancelled) setLoadError("Не удалось загрузить диагностику. Проверь соединение и повтори попытку.");
      });
    return () => { cancelled = true; };
  }, [loadVersion, sessionKey]);

  useEffect(() => {
    if (!questions?.length || done) return;
    localStorage.setItem(sessionKey, JSON.stringify({ savedAt: Date.now(), questions, idx, answers, selected }));
  }, [answers, done, idx, questions, selected, sessionKey]);

  useEffect(() => {
    if (done) localStorage.removeItem(sessionKey);
  }, [done, sessionKey]);

  const question = questions?.[idx];
  const progress = questions?.length ? (idx / questions.length) * 100 : 0;
  const hasProgress = idx > 0 || selected !== null || answers.length > 0;

  function exitRun() {
    if (hasProgress && !window.confirm("Выйти из диагностики? Ответы сохранятся, и ты сможешь продолжить позже.")) return;
    navigate("/app/diagnostic");
  }

  async function next(answer) {
    if (submitting) return;
    const nextAnswers = [...answers.slice(0, idx), { id: question.id, selected: answer }];
    setAnswers(nextAnswers);
    setSelected(null);
    setSubmitError("");

    if (idx + 1 < questions.length) {
      setIdx((value) => value + 1);
      return;
    }

    setSubmitting(true);
    try {
      const result = await studentApi.submitDiagnostic(nextAnswers);
      setResultTopics(result.knowledgeMap ?? []);
      hydrate({ profile: result.profile, topics: result.knowledgeMap });
      setDone(true);
    } catch {
      setSelected(answer);
      setSubmitError("Результат не сохранился. Ответы не потеряны — попробуй отправить ещё раз.");
    } finally {
      setSubmitting(false);
    }
  }

  if (questions === null) {
    return (
      <div className="run"><div className="run__body">
        {loadError ? (
          <Card pad="lg" className="run__state-card" role="alert">
            <h1>Диагностика не загрузилась</h1><p>{loadError}</p>
            <Button icon={RefreshCw} onClick={() => setLoadVersion((value) => value + 1)}>Повторить</Button>
          </Card>
        ) : <div className="run__loading" aria-label="Загружаем диагностику"><span /><span /><span /></div>}
      </div></div>
    );
  }

  if (!questions.length) {
    return (
      <div className="run"><div className="run__body">
        <Card pad="lg" className="run__state-card">
          <h1>Вопросы ещё не готовы</h1>
          <p>Для выбранного класса и предмета пока нет заданий. Сообщи учителю.</p>
          <Button variant="soft" onClick={() => navigate("/app")}>На главную</Button>
        </Card>
      </div></div>
    );
  }

  if (done) {
    return (
      <div className="run run--result">
        <Card className="run__result-card" pad="lg">
          <div className="run__result-icon"><PartyPopper size={32} strokeWidth={2.4} /></div>
          <h1>Карта знаний готова</h1>
          <p className="run__result-lead">Это не оценка, а маршрут обучения. Сначала потренируем темы, где сейчас нужно больше практики.</p>
          <div className="run__result-map"><KnowledgeMap topics={resultTopics} /></div>
          <div className="run__result-actions">
            <Button icon={ArrowRight} onClick={() => navigate("/app/pet", { replace: true })}>Выбрать питомца</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="run">
      <header className="run__top">
        <button className="run__close" onClick={exitRun} aria-label="Выйти из диагностики"><X size={22} strokeWidth={2.4} /></button>
        <div className="run__progress" role="progressbar" aria-label="Прогресс диагностики" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(progress)}>
          <div className="run__progress-fill" style={{ transform: `scaleX(${progress / 100})` }} />
        </div>
        <span className="run__counter font-display">{idx + 1}/{questions.length}</span>
      </header>

      <div className="run__body">
        <Card className="run__question" pad="lg">
          <span className="run__qlabel">Вопрос {idx + 1}</span>
          <h1 className="run__prompt">{question.prompt}</h1>
          {submitError && <div className="run__action-error" role="alert">{submitError}</div>}
          <OptionList options={question.options} selected={selected} onSelect={setSelected} disabled={submitting} />
        </Card>
      </div>

      <footer className="run__footer">
        <Button variant="ghost" icon={CircleHelp} disabled={submitting} onClick={() => next(null)}>Не знаю</Button>
        <Button icon={ArrowRight} disabled={selected === null} loading={submitting} onClick={() => next(selected)}>
          {idx + 1 >= questions.length ? "Сохранить результат" : "Дальше"}
        </Button>
      </footer>
    </div>
  );
}
