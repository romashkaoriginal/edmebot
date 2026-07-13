import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, CircleHelp, Info, PartyPopper, RefreshCw, X } from "lucide-react";
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
  const reduceMotion = useReducedMotion();
  const { hydrate, profile } = useApp();
  const sessionKey = useMemo(() => {
    const student = localStorage.getItem("edme_student_id") || "telegram";
    return `edme:diagnostic:${student}:${profile.subject || "default"}`;
  }, [profile.subject]);
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [graded, setGraded] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [questions, setQuestions] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [responses, setResponses] = useState({});
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
        if (cached && Date.now() - cached.savedAt < SESSION_TTL && cached.questions?.length && cached.questions.every((item) => Number.isInteger(item.correctIndex))) {
          setQuestions(cached.questions);
          setIdx(Math.min(cached.idx ?? 0, cached.questions.length - 1));
          setAnswers(cached.answers ?? []);
          setResponses(cached.responses ?? {});
          setSelected(cached.selected ?? null);
          setGraded(cached.graded ?? null);
          setFeedback(cached.feedback ?? null);
          return () => { cancelled = true; };
        }
      } catch {
        localStorage.removeItem(sessionKey);
      }
    }
    studentApi.diagnostic({ fresh: loadVersion > 0 })
      .then((data) => { if (!cancelled) setQuestions(data.questions ?? []); })
      .catch(() => { if (!cancelled) setLoadError("Не удалось загрузить диагностику. Проверь соединение и повтори попытку."); });
    return () => { cancelled = true; };
  }, [loadVersion, sessionKey]);

  useEffect(() => {
    if (!questions?.length || done) return;
    localStorage.setItem(sessionKey, JSON.stringify({ savedAt: Date.now(), questions, idx, answers, responses, selected, graded, feedback }));
  }, [answers, done, feedback, graded, idx, questions, responses, selected, sessionKey]);

  useEffect(() => { if (done) localStorage.removeItem(sessionKey); }, [done, sessionKey]);

  const question = questions?.[idx];
  const progress = questions?.length ? ((idx + (graded ? 1 : 0)) / questions.length) * 100 : 0;
  const hasProgress = idx > 0 || graded || answers.length > 0;

  function exitRun() {
    if (hasProgress && !window.confirm("Выйти из диагностики? Ответы сохранятся, и ты сможешь продолжить позже.")) return;
    navigate("/app/diagnostic");
  }

  function restoreQuestion(target) {
    const saved = responses[target];
    setIdx(target);
    setSelected(saved?.selected ?? null);
    setGraded(saved?.graded ?? null);
    setFeedback(saved?.feedback ?? null);
    setShowExplanation(false);
    setSubmitError("");
  }

  function selectAnswer(answer) {
    if (graded) return;
    setSelected(answer);
    setSubmitError("");
    const correct = answer === question.correctIndex;
    const nextGraded = correct ? "correct" : "wrong";
    const nextFeedback = { correctIndex: question.correctIndex, explanation: question.explanation };
    setGraded(nextGraded);
    setFeedback(nextFeedback);
    setAnswers((items) => [...items.slice(0, idx), { id: question.id, selected: answer }, ...items.slice(idx + 1)]);
    setResponses((items) => ({ ...items, [idx]: { selected: answer, graded: nextGraded, feedback: nextFeedback } }));
    if (navigator.vibrate) navigator.vibrate(correct ? [18, 28, 34] : [60, 30, 24]);
  }

  async function next() {
    if (idx + 1 < questions.length) return restoreQuestion(idx + 1);
    setSubmitting(true);
    setSubmitError("");
    try {
      const result = await studentApi.submitDiagnostic(answers);
      setResultTopics(result.knowledgeMap ?? []);
      hydrate({ profile: result.profile, topics: result.knowledgeMap });
      setDone(true);
    } catch {
      setSubmitError("Результат не сохранился. Ответы не потеряны — попробуй ещё раз.");
    } finally {
      setSubmitting(false);
    }
  }

  if (questions === null) {
    return <div className="run"><div className="run__body">{loadError ? <Card pad="lg" className="run__state-card" role="alert"><h1>Диагностика не загрузилась</h1><p>{loadError}</p><Button icon={RefreshCw} onClick={() => setLoadVersion((value) => value + 1)}>Повторить</Button></Card> : <div className="run__loading" aria-label="Загружаем диагностику"><span /><span /><span /></div>}</div></div>;
  }

  if (!questions.length) {
    return <div className="run"><div className="run__body"><Card pad="lg" className="run__state-card"><h1>Вопросы ещё не готовы</h1><p>Для выбранного класса и предмета пока нет заданий. Сообщи учителю.</p><Button variant="soft" onClick={() => navigate("/app")}>На главную</Button></Card></div></div>;
  }

  if (done) {
    return <div className="run run--result"><Card className="run__result-card" pad="lg"><div className="run__result-icon"><PartyPopper size={32} strokeWidth={2.4} /></div><h1>Карта знаний готова</h1><p className="run__result-lead">Это не оценка, а маршрут обучения. Сначала потренируем темы, где сейчас нужно больше практики.</p><div className="run__result-map"><KnowledgeMap topics={resultTopics} /></div><div className="run__result-actions"><Button icon={ArrowRight} onClick={() => navigate("/app/pet", { replace: true })}>Выбрать питомца</Button></div></Card></div>;
  }

  return (
    <div className="run run--diagnostic">
      <header className="run__top">
        <button className="run__close" onClick={exitRun} aria-label="Выйти из диагностики"><X size={22} strokeWidth={2.4} /></button>
        <div className="run__progress" role="progressbar" aria-label="Прогресс диагностики" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(progress)}><div className="run__progress-fill" style={{ transform: `scaleX(${progress / 100})` }} /></div>
        <span className="run__counter font-display">{idx + 1}/{questions.length}</span>
      </header>

      <div className="run__body">
        <Card className={`run__question ${graded ? `run__question--${graded}` : ""}`} pad="lg">
          <span className="run__qlabel">Вопрос {idx + 1}</span>
          <h1 className="run__prompt">{question.prompt}</h1>
          <div className="run__assist">
            {!graded && <Button variant="ghost" size="sm" icon={CircleHelp} onClick={() => selectAnswer(null)}>Не знаю</Button>}
            {graded && <Button variant="ghost" size="sm" icon={Info} onClick={() => setShowExplanation((value) => !value)}>{showExplanation ? "Скрыть объяснение" : "Показать объяснение"}</Button>}
          </div>
          <div className="run__notices" aria-live="polite">{submitError && <div className="run__action-error" role="alert">{submitError}</div>}</div>
          <AnimatePresence initial={false}>
            {showExplanation && feedback?.explanation && <motion.div className="run__explanation" initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}><div><strong>Объяснение</strong><button type="button" onClick={() => setShowExplanation(false)} aria-label="Закрыть объяснение"><X size={18} /></button></div><p>{feedback.explanation}</p></motion.div>}
          </AnimatePresence>
          <OptionList options={question.options} selected={selected} onSelect={selectAnswer} state={graded} correctIndex={feedback?.correctIndex} disabled={!!graded} />
          {graded === "correct" && <ConfettiBurst reduceMotion={reduceMotion} />}
        </Card>
      </div>

      <footer className="run__footer">
        {idx > 0 && <Button variant="ghost" icon={ArrowLeft} onClick={() => restoreQuestion(idx - 1)}>Назад</Button>}
        {graded && <Button icon={ArrowRight} loading={submitting} onClick={next}>{idx + 1 >= questions.length ? "Завершить" : "Следующее"}</Button>}
      </footer>
    </div>
  );
}

function ConfettiBurst({ reduceMotion }) {
  if (reduceMotion) return null;
  return <div className="run__burst" aria-hidden="true">{Array.from({ length: 18 }, (_, index) => <i key={index} style={{ "--burst-index": index }} />)}</div>;
}
