import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, Coins, Home, Info, Lightbulb, RefreshCw, X, Zap } from "lucide-react";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import OptionList from "../components/shared/OptionList";
import { useApp } from "../store/AppStore";
import { studentApi } from "../api/student";
import { answerHaptic } from "../utils/haptics";
import "./RunMode.css";
import "./PracticeRun.css";

const SESSION_TTL = 6 * 60 * 60 * 1000;

export default function PracticeRun() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const reduceMotion = useReducedMotion();
  const { hydrate, topics, profile } = useApp();
  const settingsString = searchParams.toString();
  const isEndless = searchParams.get("mode") === "endless";
  const practicePath = searchParams.get("subject")
    ? `/app/practice?subject=${encodeURIComponent(searchParams.get("subject"))}`
    : "/app/practice";
  const sessionKey = useMemo(() => {
    const student = localStorage.getItem("edme_student_id") || "telegram";
    return `edme:practice:${student}:${settingsString || "auto"}`;
  }, [settingsString]);

  const [tasks, setTasks] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [loadVersion, setLoadVersion] = useState(0);
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [graded, setGraded] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [results, setResults] = useState([]);
  const [responses, setResponses] = useState({});
  const [done, setDone] = useState(false);
  const [checking, setChecking] = useState(false);
  const [pendingSave, setPendingSave] = useState(null);
  const [extending, setExtending] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [actionError, setActionError] = useState("");
  const [liveAward, setLiveAward] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setTasks(null);
    setLoadError("");

    if (loadVersion === 0) {
      try {
        const cached = JSON.parse(localStorage.getItem(sessionKey) || "null");
        if (cached && Date.now() - cached.savedAt < SESSION_TTL && Array.isArray(cached.tasks) && cached.tasks.length && cached.tasks.every((item) => Number.isInteger(item.correctIndex))) {
          setTasks(cached.tasks);
          setIdx(Math.min(cached.idx ?? 0, cached.tasks.length - 1));
          setSelected(cached.selected ?? null);
          setGraded(cached.graded ?? null);
          setFeedback(cached.feedback ?? null);
          setHintsUsed(cached.hintsUsed ?? 0);
          setResults(cached.results ?? []);
          setResponses(cached.responses ?? {});
          return () => { cancelled = true; };
        }
      } catch {
        localStorage.removeItem(sessionKey);
      }
    }

    const settings = Object.fromEntries(searchParams.entries());
    studentApi.practiceSeries(settings)
      .then((data) => { if (!cancelled) setTasks(data.tasks ?? []); })
      .catch(() => { if (!cancelled) setLoadError("Не удалось загрузить задания. Проверь соединение и повтори попытку."); });
    return () => { cancelled = true; };
  }, [loadVersion, searchParams, sessionKey]);

  useEffect(() => {
    if (!tasks?.length || done) return;
    localStorage.setItem(sessionKey, JSON.stringify({
      savedAt: Date.now(), tasks, idx, selected, graded, feedback, hintsUsed, results, responses,
    }));
  }, [done, feedback, graded, hintsUsed, idx, responses, results, selected, sessionKey, tasks]);

  useEffect(() => {
    if (done) localStorage.removeItem(sessionKey);
  }, [done, sessionKey]);

  const hasProgress = idx > 0 || selected !== null || results.length > 0;

  function exitRun() {
    if (hasProgress && !window.confirm("Выйти из практики? Прогресс сохранится, и ты сможешь продолжить позже.")) return;
    navigate(practicePath);
  }

  function restoreQuestion(target) {
    const saved = responses[target];
    setIdx(target);
    setSelected(saved?.selected ?? null);
    setGraded(saved?.graded ?? null);
    setFeedback(saved?.feedback ?? null);
    setHintsUsed(saved?.hintsUsed ?? 0);
    setShowExplanation(false);
    setActionError("");
    setPendingSave(null);
  }

  if (tasks === null) {
    return <div className="run"><div className="run__body">{loadError ? <RunError message={loadError} onRetry={() => setLoadVersion((value) => value + 1)} /> : <div className="run__loading" aria-label="Загружаем задания"><span /><span /><span /></div>}</div></div>;
  }

  if (tasks.length === 0) {
    return <div className="run"><div className="run__body"><Card pad="lg" className="run__state-card"><h1 className="run__prompt">Для этих настроек заданий нет</h1><p>Выбери другой уровень или режим. Если задания не появляются без фильтров, сообщи учителю.</p><Button icon={Home} onClick={() => navigate(practicePath)}>Изменить настройки</Button></Card></div></div>;
  }

  if (done) return <Summary results={results} onExit={() => navigate("/app")} />;

  const task = tasks[idx];
  const topicLabel = topics.find((topic) => topic.id === task.topic && (!task.subject || topic.subject === task.subject))?.name ?? task.topic;

  function selectAnswer(answer) {
    if (checking || graded) return;
    setSelected(answer);
    setActionError("");
    const correct = answer === task.correctIndex;
    const nextGraded = correct ? "correct" : "wrong";
    const nextFeedback = {
      explanation: task.explanation,
      commonMistake: correct ? null : "Сравни решение с правилом в объяснении и найди шаг, где изменился ответ.",
      correctIndex: task.correctIndex,
      award: null,
    };
    const response = { selected: answer, graded: nextGraded, feedback: nextFeedback, hintsUsed };
    setGraded(nextGraded);
    setFeedback(nextFeedback);
    setResponses((items) => ({ ...items, [idx]: response }));
    answerHaptic(correct);
    saveAnswer({ answer, nextGraded, nextFeedback, response, correct });
  }

  async function saveAnswer(payload) {
    if (checking) return;
    const { answer, nextFeedback, response, correct } = payload;
    setChecking(true);
    setPendingSave(payload);
    setActionError("");
    try {
      const data = await studentApi.answer({ taskId: task.id, selected: answer, attempts: 0, hintsUsed });
      const savedFeedback = { ...nextFeedback, explanation: data.explanation, commonMistake: data.commonMistake, correctIndex: data.correctIndex, award: data.award };
      hydrate({ profile: data.profile, topics: data.topics });
      setFeedback(savedFeedback);
      setResponses((items) => ({ ...items, [idx]: { ...response, feedback: savedFeedback } }));
      setResults((items) => [...items, { taskId: task.id, correct, topic: task.topic, topicLabel, award: data.award }]);
      setPendingSave(null);
      if (correct && (data.award?.gained || data.award?.coins)) {
        setLiveAward({ ...data.award, id: Date.now() });
        window.setTimeout(() => setLiveAward(null), 950);
      }
    } catch {
      setActionError("Ответ показан, но пока не сохранён. Проверь соединение и повтори отправку.");
    } finally {
      setChecking(false);
    }
  }

  async function nextTask() {
    const target = idx + 1;
    if (target < tasks.length) {
      restoreQuestion(target);
      return;
    }
    if (!isEndless) {
      setDone(true);
      return;
    }
    setExtending(true);
    setActionError("");
    try {
      const settings = Object.fromEntries(searchParams.entries());
      const data = await studentApi.practiceSeries(settings);
      const nextTasks = data.tasks ?? [];
      if (!nextTasks.length) return setActionError("Новые задания пока не найдены. Попробуй продолжить чуть позже.");
      setTasks((items) => [...items, ...nextTasks]);
      restoreQuestion(target);
    } catch {
      setActionError("Не удалось подгрузить следующее задание. Проверь соединение и попробуй ещё раз.");
    } finally {
      setExtending(false);
    }
  }

  return (
    <div className="run run--practice">
      <header className="run__top run__top--calm">
        <button className="run__close" onClick={exitRun} aria-label="Выйти из практики"><X size={22} strokeWidth={2.4} /></button>
        <LivePracticeStats profile={profile} award={liveAward} />
      </header>

      <div className="run__body">
        <Card className={`run__question ${graded ? `run__question--${graded}` : ""}`} pad="lg">
          <div className="pr__qhead"><span className="run__qlabel">{topicLabel}</span><span className={`pr__diff pr__diff--${task.difficulty}`}>{diffLabel(task.difficulty)}</span></div>
          <h1 className="run__prompt">{task.prompt}</h1>

          <div className="run__assist">
            {!graded && (task.hints ?? []).length > 0 && <Button variant="ghost" size="sm" icon={Lightbulb} disabled={hintsUsed >= task.hints.length} onClick={() => setHintsUsed((value) => value + 1)}>Подсказка{task.hints.length - hintsUsed > 0 ? ` (${task.hints.length - hintsUsed})` : ""}</Button>}
            {graded && <Button variant="ghost" size="sm" icon={Info} onClick={() => setShowExplanation((value) => !value)}>{showExplanation ? "Скрыть объяснение" : "Показать объяснение"}</Button>}
          </div>

          <div className="run__notices" aria-live="polite">
            {actionError && <div className="run__action-error" role="alert"><span>{actionError}</span>{pendingSave && <button type="button" disabled={checking} onClick={() => saveAnswer(pendingSave)}>Повторить</button>}</div>}
            {hintsUsed > 0 && !graded && <div className="pr__hint"><Lightbulb size={16} /><span>{task.hints[hintsUsed - 1]}</span></div>}
          </div>

          <OptionList options={task.options} selected={selected} onSelect={selectAnswer} state={graded} correctIndex={feedback?.correctIndex} disabled={!!graded} />
          <div className="run__question-actions">
            {idx > 0 && <Button variant="soft" icon={ArrowLeft} onClick={() => restoreQuestion(idx - 1)}>Назад</Button>}
            {graded && <Button icon={ArrowRight} loading={extending} disabled={checking || !!pendingSave} onClick={nextTask}>{isEndless ? "Следующее" : idx + 1 >= tasks.length ? "Завершить" : "Следующее"}</Button>}
          </div>
        </Card>
      </div>
      <AnimatePresence initial={false}>
        {showExplanation && feedback?.explanation && <><motion.button type="button" className="run__sheet-backdrop" aria-label="Закрыть объяснение" onClick={() => setShowExplanation(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} /><motion.aside className="run__explanation-sheet" role="dialog" aria-modal="true" aria-label="Объяснение" initial={reduceMotion ? { opacity: 0 } : { opacity: 0, transform: "translateY(100%)" }} animate={{ opacity: 1, transform: "translateY(0)" }} exit={reduceMotion ? { opacity: 0 } : { opacity: 0, transform: "translateY(100%)" }} transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}><div><strong>Объяснение</strong><button type="button" onClick={() => setShowExplanation(false)} aria-label="Закрыть объяснение"><X size={20} /></button></div><p>{feedback.explanation}</p>{graded === "wrong" && feedback.commonMistake && <small>{feedback.commonMistake}</small>}</motion.aside></>}
      </AnimatePresence>
    </div>
  );
}

function LivePracticeStats({ profile, award }) {
  const today = new Date().toISOString().slice(0, 10);
  const lit = profile.streakLastDoneOn === today;
  const xpInLevel = Math.max(0, profile.xp - profile.xpFromLevel);
  const xpNeeded = Math.max(1, profile.xpForNext - profile.xpFromLevel);
  const progress = Math.min(1, xpInLevel / xpNeeded);
  return <div className="run__live-stats" aria-label="Прогресс ученика">
    <span className={`run__live-stat run__live-stat--streak ${lit ? "is-lit" : ""} ${award ? "is-celebrating" : ""}`}><span className="run__live-flame" aria-hidden="true">🔥</span><b>{profile.streak}</b></span>
    <span className="run__live-stat run__live-stat--coins"><Coins size={16} /><b>{profile.coins}</b>{award?.coins > 0 && <i key={`c-${award.id}`} className="run__live-gain">+{award.coins}</i>}</span>
    <span className="run__live-stat run__live-level"><span className="run__live-level-copy"><small>ур. {profile.level}</small><b>{profile.xp} XP</b></span><span className="run__live-level-track"><i style={{ transform: `scaleX(${progress})` }} /></span>{award?.gained > 0 && <i key={`x-${award.id}`} className="run__live-gain">+{award.gained} XP</i>}</span>
  </div>;
}

function RunError({ message, onRetry }) {
  return <Card pad="lg" className="run__state-card" role="alert"><h1>Задания не загрузились</h1><p>{message}</p><Button icon={RefreshCw} onClick={onRetry}>Повторить</Button></Card>;
}

function Summary({ results, onExit }) {
  const navigate = useNavigate();
  const total = results.length;
  const correct = results.filter((result) => result.correct).length;
  const errors = total - correct;
  const errorTopics = [...new Map(results.filter((result) => !result.correct).map((result) => [result.topic, result.topicLabel])).values()];
  const gainedXp = results.reduce((sum, result) => sum + (result.award?.gained ?? 0), 0);
  const gainedCoins = results.reduce((sum, result) => sum + (result.award?.coins ?? 0), 0);
  const pct = total ? Math.round((correct / total) * 100) : 0;
  const summary = pct >= 80 ? "Уверенный результат" : pct >= 50 ? "Есть прогресс и темы для повторения" : "Нужна ещё одна спокойная попытка";

  return (
    <div className="run run--result"><Card className="run__result-card" pad="lg">
      <div className={`pr__score-ring pr__score-ring--${pct >= 80 ? "good" : pct >= 50 ? "mid" : "low"}`}><span className="font-display">{pct}%</span></div>
      <h1>Серия завершена</h1><p className="run__result-lead">{summary}</p>
      <div className="pr__stats" aria-label="Результаты серии"><div className="pr__stat"><span className="pr__stat-num font-display">{correct}</span><span className="pr__stat-label">верно</span></div><div className="pr__stat"><span className="pr__stat-num font-display pr__stat-num--err">{errors}</span><span className="pr__stat-label">ошибок</span></div><div className="pr__stat"><span className="pr__stat-num font-display">{total}</span><span className="pr__stat-label">всего</span></div></div>
      {(gainedXp > 0 || gainedCoins > 0) && <div className="pr__reward" role="status"><span><Zap size={18} /> +{gainedXp} XP</span><span><Coins size={18} /> +{gainedCoins} монет</span></div>}
      {errorTopics.length > 0 && <div className="pr__recap"><div className="pr__recap-title">Следующий учебный шаг</div><div className="pr__recap-topics">{errorTopics.map((topic) => <span key={topic} className="pr__recap-chip">{topic}</span>)}</div><p className="pr__recap-hint">Эти темы сохранены в режиме «Работа над ошибками».</p></div>}
      <div className="run__result-actions"><Button variant="soft" icon={Home} onClick={onExit}>На главную</Button><Button icon={RefreshCw} onClick={() => navigate(0)}>Ещё серия</Button></div>
    </Card></div>
  );
}

function diffLabel(difficulty) {
  return { easy: "Лёгкий", medium: "Средний", hard: "Сложный" }[difficulty] ?? difficulty;
}
