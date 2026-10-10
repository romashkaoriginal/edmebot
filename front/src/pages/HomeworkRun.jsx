import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "../router";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "framer-motion";
import { Check, Home, RefreshCw, X } from "lucide-react";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import OptionList from "../components/shared/OptionList";
import WrittenAnswer from "../components/shared/WrittenAnswer";
import QuestionStage, { QuestionCard } from "../components/run/QuestionStage";
import RunFooter from "../components/run/RunFooter";
import RunProgress from "../components/run/RunProgress";
import ConfettiBurst from "../components/run/ConfettiBurst";
import ScoreRing from "../components/run/ScoreRing";
import SoundToggle from "../components/run/SoundToggle";
import { useApp } from "../store/AppStore";
import { studentApi } from "../api/student";
import { answerHaptic, tapHaptic } from "../utils/haptics";
import { answerPrompt, comboAt, feedbackTitle, isAnswerComplete, isWritten } from "../utils/answers";
import useModalFocus from "../hooks/useModalFocus";
import useBodyScrollLock from "../hooks/useBodyScrollLock";
import "./RunMode.css";
import "./PracticeRun.css";
import "./HomeworkRun.css";

export default function HomeworkRun() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const reduceMotion = useReducedMotion();
  const { profile } = useApp();
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
  // 1 = the next question slides in from the right, -1 = "back" from the left.
  const [direction, setDirection] = useState(1);
  // True only while the answer on screen was given just now (see RunFooter).
  const [fresh, setFresh] = useState(false);
  const explanationRef = useRef(null);
  useModalFocus(explanationRef, { active: showExplanation, onClose: () => setShowExplanation(false) });
  useBodyScrollLock();

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

  // Choice answers are judged on the spot; written ones only after submitting.
  function markOf(index) {
    const saved = answers[index];
    if (!saved) return null;
    return tasks[index].questionType === "choice" ? (saved.selected === tasks[index].correctIndex ? "correct" : "wrong") : "answered";
  }

  function restoreQuestion(target) {
    const saved = answers[target];
    setDirection(target < idx ? -1 : 1);
    setFresh(false);
    setIdx(target);
    setSelected(saved?.answer ?? saved?.selected ?? null);
    setGraded(markOf(target));
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

  function pickOption(answer) {
    if (graded) return;
    if (answer !== selected) tapHaptic();
    setSelected(answer);
  }

  function checkAnswer() {
    if (graded || !isAnswerComplete(task, selected)) return;
    setFresh(true);
    if (isWritten(task)) {
      setGraded("answered");
      setAnswers((cur) => ({ ...cur, [idx]: { taskId: task.id, answer: selected } }));
      return;
    }
    const correct = selected === task.correctIndex;
    setGraded(correct ? "correct" : "wrong");
    setAnswers((cur) => ({ ...cur, [idx]: { taskId: task.id, selected } }));
    answerHaptic(correct);
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
      const payload = tasks.map((t, i) => ({ taskId: t.id, ...(t.questionType === "choice" ? { selected: answers[i]?.selected ?? null } : { answer: answers[i]?.answer ?? null }) }));
      const data = await studentApi.submitHomework(homeworkId, attemptId, payload);
      setResult(data);
    } catch (e) {
      setSubmitError(e.message === "no_attempts_left" ? "Попытки на эту домашку закончились." : "Не удалось отправить домашку. Проверь соединение и повтори попытку.");
    } finally {
      setSubmitting(false);
    }
  }

  const written = isWritten(task);
  const marks = tasks.map((_, index) => (index === idx ? graded : markOf(index)) ?? undefined);
  const combo = graded === "correct" ? comboAt(marks, idx) : 0;
  const complete = isAnswerComplete(task, selected);
  const checkLabel = written ? "Сохранить ответ" : "Проверить";

  return (
    <MotionConfig reducedMotion="user">
    <div className="run run--practice">
      <header className="run__top">
        <button className="run__close" onClick={exitRun} aria-label="Выйти из домашки"><X size={22} strokeWidth={2.4} /></button>
        <RunProgress marks={marks} current={idx} counter={`${idx + 1}/${tasks.length}`} label="Прогресс домашки" />
        <SoundToggle />
      </header>

      <div className="run__body">
        <QuestionStage stepKey={idx} direction={direction}>
          <QuestionCard graded={graded} fitDeps={[task.prompt, task.options, graded, submitError]}>
            <div className="pr__qhead"><span className="run__qlabel">{homework?.title}</span><span className={`pr__diff pr__diff--${task.difficulty}`}>{diffLabel(task.difficulty)}</span></div>
            <h1 className="run__prompt">{task.questionType === "blanks" ? "Вставь пропущенные слова" : task.prompt}</h1>

            {submitError && <div className="run__notices"><div className="run__action-error" role="alert"><span>{submitError}</span></div></div>}

            {written
              ? <WrittenAnswer options={task.options} pairChoices={task.pairChoices} questionType={task.questionType} prompt={task.prompt} blankCount={task.blankCount} value={selected} onChange={setSelected} disabled={submitting} graded={graded} />
              : <OptionList options={task.options} selected={selected} onSelect={pickOption} state={graded} correctIndex={task.correctIndex} disabled={!!graded} />}
          </QuestionCard>
        </QuestionStage>
      </div>

      <RunFooter
        status={graded}
        title={graded ? feedbackTitle(graded, idx) : complete ? `Готово? Жми «${checkLabel}»` : answerPrompt(task)}
        detail={graded === "wrong" ? `Верный ответ: ${task.options[task.correctIndex] ?? ""}` : graded === "answered" ? "Проверим, когда сдашь домашку" : null}
        combo={combo}
        pet={profile.petSelected ? profile.pet.species : null}
        fresh={fresh}
        onWhy={task.explanation ? () => setShowExplanation(true) : null}
        onBack={idx > 0 ? () => restoreQuestion(idx - 1) : null}
        primary={graded
          ? { label: idx + 1 >= tasks.length ? "Сдать домашку" : "Дальше", onClick: nextOrSubmit, loading: submitting }
          : { label: checkLabel, onClick: checkAnswer, disabled: !complete }}
      />
      <AnimatePresence initial={false}>
        {showExplanation && task.explanation && <><motion.button type="button" className="run__sheet-backdrop" aria-label="Закрыть объяснение" onClick={() => setShowExplanation(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} /><motion.aside ref={explanationRef} tabIndex={-1} className="run__explanation-sheet" role="dialog" aria-modal="true" aria-label="Объяснение" initial={reduceMotion ? { opacity: 0 } : { opacity: 0, transform: "translateY(100%)" }} animate={{ opacity: 1, transform: "translateY(0)" }} exit={reduceMotion ? { opacity: 0 } : { opacity: 0, transform: "translateY(100%)" }} transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}><div><strong>Объяснение</strong><button type="button" onClick={() => setShowExplanation(false)} aria-label="Закрыть объяснение"><X size={20} /></button></div><p>{task.explanation}</p></motion.aside></>}
      </AnimatePresence>
    </div>
    </MotionConfig>
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
      {solved && <ConfettiBurst />}
      <Card className="run__result-card run__result-card--stagger" pad="lg">
        <ScoreRing pct={pct} />
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
              {!r.correct && r.acceptedAnswers?.length > 0 && <p className="hwrun__item-explain">Правильный ответ: {r.acceptedAnswers.map((variants) => variants.join(" / ")).join("; ")}</p>}
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
