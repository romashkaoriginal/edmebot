import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "../router";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Home, Info, RefreshCw, X } from "lucide-react";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import OptionList from "../components/shared/OptionList";
import { studentApi } from "../api/student";
import useModalFocus from "../hooks/useModalFocus";
import "./RunMode.css";
import "./PracticeRun.css";
import "./HomeworkRun.css";

export default function HomeworkRun() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const reduceMotion = useReducedMotion();
  const homeworkId = searchParams.get("id");

  const [homework, setHomework] = useState(null);
  const [tasks, setTasks] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [loadVersion, setLoadVersion] = useState(0);
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [graded, setGraded] = useState(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [attemptId] = useState(() => crypto.randomUUID());
  const [submitError, setSubmitError] = useState("");
  const [result, setResult] = useState(null);
  const explanationRef = useRef(null);
  useModalFocus(explanationRef, { active: showExplanation, onClose: () => setShowExplanation(false) });

  useEffect(() => {
    if (!homeworkId) return;
    let cancelled = false;
    setTasks(null);
    setLoadError("");
    studentApi.homeworkTasks(homeworkId)
      .then((data) => {
        if (cancelled) return;
        setHomework(data.homework);
        setTasks(data.tasks ?? []);
      })
      .catch(() => { if (!cancelled) setLoadError("Не удалось загрузить домашку. Проверь соединение и повтори попытку."); });
    return () => { cancelled = true; };
  }, [homeworkId, loadVersion]);

  const hasProgress = idx > 0 || selected !== null;

  function exitRun() {
    if (hasProgress && !window.confirm("Выйти из домашки? Прогресс не сохранится.")) return;
    navigate("/app/homework");
  }

  function restoreQuestion(target) {
    const saved = answers[target];
    setIdx(target);
    setSelected(saved?.selected ?? null);
    setGraded(saved ? (saved.selected === tasks[target].correctIndex ? "correct" : "wrong") : null);
    setShowExplanation(false);
  }

  if (!homeworkId) {
    return <div className="run"><div className="run__body"><Card pad="lg" className="run__state-card"><h1 className="run__prompt">Домашка не найдена</h1><Button icon={Home} onClick={() => navigate("/app/homework")}>К списку домашки</Button></Card></div></div>;
  }

  if (tasks === null) {
    return <div className="run"><div className="run__body">{loadError ? <RunError message={loadError} onRetry={() => setLoadVersion((v) => v + 1)} /> : <div className="run__loading" aria-label="Загружаем домашку"><span /><span /><span /></div>}</div></div>;
  }

  if (tasks.length === 0) {
    return <div className="run"><div className="run__body"><Card pad="lg" className="run__state-card"><h1 className="run__prompt">В этой домашке нет заданий</h1><p>Сообщи репетитору — задания ещё не добавлены.</p><Button icon={Home} onClick={() => navigate("/app/homework")}>К списку домашки</Button></Card></div></div>;
  }

  if (result) {
    return <HomeworkSummary result={result} onExit={() => navigate("/app/homework")} />;
  }

  const task = tasks[idx];

  function selectAnswer(answer) {
    if (graded) return;
    setSelected(answer);
    const correct = answer === task.correctIndex;
    setGraded(correct ? "correct" : "wrong");
    setAnswers((cur) => ({ ...cur, [idx]: { taskId: task.id, selected: answer } }));
  }

  async function nextOrSubmit() {
    const target = idx + 1;
    if (target < tasks.length) {
      restoreQuestion(target);
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    try {
      const payload = tasks.map((t, i) => ({ taskId: t.id, selected: answers[i]?.selected ?? null }));
      const data = await studentApi.submitHomework(homeworkId, attemptId, payload);
      setResult(data);
    } catch (e) {
      setSubmitError(e.message === "no_attempts_left" ? "Попытки на эту домашку закончились." : "Не удалось отправить домашку. Проверь соединение и повтори попытку.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="run run--practice">
      <header className="run__top run__top--calm">
        <button className="run__close" onClick={exitRun} aria-label="Выйти из домашки"><X size={22} strokeWidth={2.4} /></button>
        <span className="run__counter">{idx + 1} / {tasks.length}</span>
      </header>

      <div className="run__body">
        <Card className={`run__question ${graded ? `run__question--${graded}` : ""}`} pad="lg">
          <div className="pr__qhead"><span className="run__qlabel">{homework?.title}</span><span className={`pr__diff pr__diff--${task.difficulty}`}>{diffLabel(task.difficulty)}</span></div>
          <h1 className="run__prompt">{task.prompt}</h1>

          <div className="run__assist">
            {graded && <Button variant="ghost" size="sm" icon={Info} onClick={() => setShowExplanation((v) => !v)}>{showExplanation ? "Скрыть объяснение" : "Показать объяснение"}</Button>}
          </div>

          {submitError && <div className="run__notices"><div className="run__action-error" role="alert"><span>{submitError}</span></div></div>}

          <OptionList options={task.options} selected={selected} onSelect={selectAnswer} state={graded} correctIndex={task.correctIndex} disabled={!!graded} />
          <div className="run__question-actions">
            {idx > 0 && <Button variant="soft" icon={ArrowLeft} onClick={() => restoreQuestion(idx - 1)}>Назад</Button>}
            {graded && (
              <Button icon={ArrowRight} loading={submitting} onClick={nextOrSubmit}>
                {idx + 1 >= tasks.length ? "Сдать домашку" : "Следующее"}
              </Button>
            )}
          </div>
        </Card>
      </div>
      <AnimatePresence initial={false}>
        {showExplanation && task.explanation && <><motion.button type="button" className="run__sheet-backdrop" aria-label="Закрыть объяснение" onClick={() => setShowExplanation(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} /><motion.aside ref={explanationRef} tabIndex={-1} className="run__explanation-sheet" role="dialog" aria-modal="true" aria-label="Объяснение" initial={reduceMotion ? { opacity: 0 } : { opacity: 0, transform: "translateY(100%)" }} animate={{ opacity: 1, transform: "translateY(0)" }} exit={reduceMotion ? { opacity: 0 } : { opacity: 0, transform: "translateY(100%)" }} transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}><div><strong>Объяснение</strong><button type="button" onClick={() => setShowExplanation(false)} aria-label="Закрыть объяснение"><X size={20} /></button></div><p>{task.explanation}</p></motion.aside></>}
      </AnimatePresence>
    </div>
  );
}

function HomeworkSummary({ result, onExit }) {
  const { results = [], correct, total, attemptsLeft, solved } = result;
  const pct = total ? Math.round((correct / total) * 100) : 0;
  const summary = solved ? "Домашка решена верно" : pct >= 50 ? "Есть прогресс, но не всё верно" : "Стоит повторить тему и попробовать ещё раз";

  useEffect(() => {
    // Best-effort — most mobile browsers only allow this in fullscreen and
    // silently reject it otherwise, hence the CSS orientation fallback above.
    screen.orientation?.lock?.("portrait").catch(() => {});
    return () => { try { screen.orientation?.unlock?.(); } catch { /* not supported */ } };
  }, []);

  return (
    <div className="run run--result hwrun__result-lock">
      <div className="hwrun__rotate-notice" role="alert">
        <p>Поверни телефон вертикально, чтобы увидеть результаты.</p>
      </div>
      <Card className="run__result-card" pad="lg">
        <div className={`pr__score-ring pr__score-ring--${pct >= 80 ? "good" : pct >= 50 ? "mid" : "low"}`}><span className="font-display">{pct}%</span></div>
        <h1>Домашка сдана</h1>
        <p className="run__result-lead">{summary}</p>
        <div className="pr__stats" aria-label="Результаты домашки">
          <div className="pr__stat"><span className="pr__stat-num font-display">{correct}</span><span className="pr__stat-label">верно</span></div>
          <div className="pr__stat"><span className="pr__stat-num font-display pr__stat-num--err">{total - correct}</span><span className="pr__stat-label">ошибок</span></div>
          <div className="pr__stat"><span className="pr__stat-num font-display">{total}</span><span className="pr__stat-label">всего</span></div>
        </div>
        {!solved && <p className="hwrun__attempts-left">Осталось попыток: {attemptsLeft}</p>}

        <div className="hwrun__breakdown" aria-label="Разбор по вопросам">
          {results.map((r, i) => (
            <div key={r.taskId} className={`hwrun__item hwrun__item--${r.correct ? "correct" : "wrong"}`}>
              <div className="hwrun__item-head">
                <span className="hwrun__item-num">Вопрос {i + 1}</span>
                <span className="hwrun__item-mark">
                  {r.correct
                    ? <><Check size={15} strokeWidth={3} /> верно</>
                    : <><X size={15} strokeWidth={3} /> неверно</>}
                </span>
              </div>
              {!r.correct && r.explanation && <p className="hwrun__item-explain">{r.explanation}</p>}
            </div>
          ))}
        </div>

        <div className="run__result-actions"><Button icon={Home} onClick={onExit}>К списку домашки</Button></div>
      </Card>
    </div>
  );
}

function RunError({ message, onRetry }) {
  return <Card pad="lg" className="run__state-card" role="alert"><h1>Домашка не загрузилась</h1><p>{message}</p><Button icon={RefreshCw} onClick={onRetry}>Повторить</Button></Card>;
}

function diffLabel(difficulty) {
  return { easy: "Лёгкий", medium: "Средний", hard: "Сложный" }[difficulty] ?? difficulty;
}
