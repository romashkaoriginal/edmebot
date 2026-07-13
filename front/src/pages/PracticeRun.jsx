import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, Coins, Home, Info, Lightbulb, RefreshCw, X, Zap } from "lucide-react";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import OptionList from "../components/shared/OptionList";
import { useApp } from "../store/AppStore";
import { studentApi } from "../api/student";
import "./RunMode.css";
import "./PracticeRun.css";

const SESSION_TTL = 6 * 60 * 60 * 1000;

export default function PracticeRun() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const reduceMotion = useReducedMotion();
  const { hydrate, topics } = useApp();
  const settingsString = searchParams.toString();
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
  const [attempts, setAttempts] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [results, setResults] = useState([]);
  const [done, setDone] = useState(false);
  const [checking, setChecking] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setTasks(null);
    setLoadError("");

    if (loadVersion === 0) {
      try {
        const cached = JSON.parse(localStorage.getItem(sessionKey) || "null");
        if (cached && Date.now() - cached.savedAt < SESSION_TTL && Array.isArray(cached.tasks) && cached.tasks.length) {
          setTasks(cached.tasks);
          setIdx(Math.min(cached.idx ?? 0, cached.tasks.length - 1));
          setSelected(cached.selected ?? null);
          setGraded(cached.graded ?? null);
          setFeedback(cached.feedback ?? null);
          setAttempts(cached.attempts ?? 0);
          setHintsUsed(cached.hintsUsed ?? 0);
          setResults(cached.results ?? []);
          return () => { cancelled = true; };
        }
      } catch {
        localStorage.removeItem(sessionKey);
      }
    }

    const settings = Object.fromEntries(searchParams.entries());
    studentApi.practiceSeries(settings)
      .then((data) => {
        if (!cancelled) setTasks(data.tasks ?? []);
      })
      .catch(() => {
        if (!cancelled) setLoadError("Не удалось загрузить задания. Проверь соединение и повтори попытку.");
      });
    return () => { cancelled = true; };
  }, [loadVersion, searchParams, sessionKey]);

  useEffect(() => {
    if (!tasks?.length || done) return;
    localStorage.setItem(sessionKey, JSON.stringify({
      savedAt: Date.now(), tasks, idx, selected, graded, feedback, attempts, hintsUsed, results,
    }));
  }, [attempts, done, feedback, graded, hintsUsed, idx, results, selected, sessionKey, tasks]);

  useEffect(() => {
    if (done) localStorage.removeItem(sessionKey);
  }, [done, sessionKey]);

  const hasProgress = idx > 0 || selected !== null || attempts > 0 || results.length > 0;

  function exitRun() {
    if (hasProgress && !window.confirm("Выйти из практики? Прогресс серии сохранится, и ты сможешь продолжить позже.")) return;
    navigate("/app/practice");
  }

  if (tasks === null) {
    return (
      <div className="run">
        <div className="run__body">
          {loadError ? (
            <RunError message={loadError} onRetry={() => setLoadVersion((value) => value + 1)} />
          ) : (
            <div className="run__loading" aria-label="Загружаем задания"><span /><span /><span /></div>
          )}
        </div>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="run">
        <div className="run__body">
          <Card pad="lg" className="run__state-card">
            <h1 className="run__prompt">Для этих настроек заданий нет</h1>
            <p>Выбери другой уровень или режим. Если задания не появляются без фильтров, сообщи учителю.</p>
            <Button icon={Home} onClick={() => navigate("/app/practice")}>Изменить настройки</Button>
          </Card>
        </div>
      </div>
    );
  }

  if (done) return <Summary results={results} onExit={() => navigate("/app")} />;

  const task = tasks[idx];
  const topicLabel = topics.find((topic) => topic.id === task.topic && (!task.subject || topic.subject === task.subject))?.name ?? task.topic;
  const progress = ((idx + (graded ? 1 : 0)) / tasks.length) * 100;

  async function check() {
    if (checking || selected === null) return;
    setChecking(true);
    setActionError("");
    try {
      const data = await studentApi.answer({ taskId: task.id, selected, attempts, hintsUsed });
      hydrate({ profile: data.profile, topics: data.topics });
      if (data.correct) {
        setGraded("correct");
        setFeedback({ explanation: data.explanation, commonMistake: null, correctIndex: data.correctIndex });
        setResults((items) => [...items, { taskId: task.id, correct: true, topic: task.topic, topicLabel, award: data.award }]);
      } else if (attempts === 0) {
        setAttempts(1);
        setSelected(null);
      } else {
        setGraded("wrong");
        setFeedback({ explanation: data.explanation, commonMistake: data.commonMistake, correctIndex: data.correctIndex });
        setResults((items) => [...items, { taskId: task.id, correct: false, topic: task.topic, topicLabel, award: data.award }]);
      }
    } catch {
      setActionError("Ответ не сохранился. Проверь соединение и нажми «Проверить» ещё раз.");
    } finally {
      setChecking(false);
    }
  }

  function nextTask() {
    if (idx + 1 >= tasks.length) {
      setDone(true);
      return;
    }
    setIdx((value) => value + 1);
    setSelected(null);
    setGraded(null);
    setFeedback(null);
    setAttempts(0);
    setHintsUsed(0);
    setActionError("");
  }

  return (
    <div className="run">
      <header className="run__top">
        <button className="run__close" onClick={exitRun} aria-label="Выйти из практики"><X size={22} strokeWidth={2.4} /></button>
        <div className="run__progress" role="progressbar" aria-label="Прогресс практики" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(progress)}>
          <div className="run__progress-fill" style={{ transform: `scaleX(${progress / 100})` }} />
        </div>
        <span className="run__counter font-display">{idx + 1}/{tasks.length}</span>
      </header>

      <div className="run__body">
        <Card className="run__question" pad="lg">
          <div className="pr__qhead">
            <span className="run__qlabel">{topicLabel}</span>
            <span className={`pr__diff pr__diff--${task.difficulty}`}>{diffLabel(task.difficulty)}</span>
          </div>
          <h1 className="run__prompt">{task.prompt}</h1>

          <div aria-live="polite">
            {attempts === 1 && !graded && (
              <div className="pr__retry"><Info size={16} /> Не совсем. Проверь ход решения и попробуй ещё раз.</div>
            )}
            {actionError && <div className="run__action-error" role="alert">{actionError}</div>}
          </div>

          <OptionList options={task.options} selected={selected} onSelect={setSelected} state={graded} correctIndex={feedback?.correctIndex} disabled={!!graded || checking} />

          <AnimatePresence initial={false}>
            {hintsUsed > 0 && !graded && (
              <motion.div
                className="pr__hints"
                initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
              >
                {(task.hints ?? []).slice(0, hintsUsed).map((hint, index) => (
                  <div key={index} className="pr__hint"><Lightbulb size={16} /><span>{hint}</span></div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {graded && (
              <motion.div
                className={`pr__feedback pr__feedback--${graded}`}
                role="status"
                initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="pr__feedback-head">
                  {graded === "correct" ? <><Check size={18} strokeWidth={3} /> Верно</> : <><Info size={18} /> Разберём ошибку</>}
                </div>
                {feedback?.explanation && <p className="pr__feedback-text">{feedback.explanation}</p>}
                {graded === "wrong" && feedback?.commonMistake && <p className="pr__mistake">{feedback.commonMistake}</p>}
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </div>

      <footer className="run__footer">
        {!graded ? (
          <>
            {(task.hints ?? []).length > 0 && (
              <Button variant="ghost" icon={Lightbulb} disabled={hintsUsed >= task.hints.length || checking} onClick={() => setHintsUsed((value) => value + 1)}>
                Подсказка {task.hints.length - hintsUsed > 0 ? `(${task.hints.length - hintsUsed})` : ""}
              </Button>
            )}
            <Button icon={ArrowRight} disabled={selected === null} loading={checking} onClick={check}>Проверить</Button>
          </>
        ) : (
          <Button icon={ArrowRight} full onClick={nextTask}>{idx + 1 >= tasks.length ? "Завершить" : "Следующее задание"}</Button>
        )}
      </footer>
    </div>
  );
}

function RunError({ message, onRetry }) {
  return (
    <Card pad="lg" className="run__state-card" role="alert">
      <h1>Задания не загрузились</h1>
      <p>{message}</p>
      <Button icon={RefreshCw} onClick={onRetry}>Повторить</Button>
    </Card>
  );
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
    <div className="run run--result">
      <Card className="run__result-card" pad="lg">
        <div className={`pr__score-ring pr__score-ring--${pct >= 80 ? "good" : pct >= 50 ? "mid" : "low"}`}><span className="font-display">{pct}%</span></div>
        <h1>Серия завершена</h1>
        <p className="run__result-lead">{summary}</p>

        <div className="pr__stats" aria-label="Результаты серии">
          <div className="pr__stat"><span className="pr__stat-num font-display">{correct}</span><span className="pr__stat-label">верно</span></div>
          <div className="pr__stat"><span className="pr__stat-num font-display pr__stat-num--err">{errors}</span><span className="pr__stat-label">ошибок</span></div>
          <div className="pr__stat"><span className="pr__stat-num font-display">{total}</span><span className="pr__stat-label">всего</span></div>
        </div>

        {(gainedXp > 0 || gainedCoins > 0) && (
          <div className="pr__reward" role="status">
            <span><Zap size={18} aria-hidden="true" /> +{gainedXp} XP</span>
            <span><Coins size={18} aria-hidden="true" /> +{gainedCoins} баллов питомцу</span>
          </div>
        )}

        {errorTopics.length > 0 && (
          <div className="pr__recap">
            <div className="pr__recap-title">Следующий учебный шаг</div>
            <div className="pr__recap-topics">{errorTopics.map((topic) => <span key={topic} className="pr__recap-chip">{topic}</span>)}</div>
            <p className="pr__recap-hint">Повтори эти темы в следующей серии — они уже будут в приоритете.</p>
          </div>
        )}

        <div className="run__result-actions">
          <Button variant="soft" icon={Home} onClick={onExit}>На главную</Button>
          <Button icon={RefreshCw} onClick={() => navigate(0)}>Ещё серия</Button>
        </div>
      </Card>
    </div>
  );
}

function diffLabel(difficulty) {
  return { easy: "Лёгкий", medium: "Средний", hard: "Сложный" }[difficulty] ?? difficulty;
}
