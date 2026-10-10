import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "../router";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "framer-motion";
import { Coins, Home, Lightbulb, RefreshCw, X, Zap } from "lucide-react";
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
import { answerPrompt, comboAt, correctAnswerText, feedbackTitle, isAnswerComplete, isComboMilestone, isWritten } from "../utils/answers";
import { dateKey } from "../utils/date";
import useModalFocus from "../hooks/useModalFocus";
import useBodyScrollLock from "../hooks/useBodyScrollLock";
import "./RunMode.css";
import "./PracticeRun.css";

// Server-side question instances live 6 hours. Expire the cached session well
// before that, so a resumed run never sends an instance id the server has
// already swept and rejects with practice_instance_invalid.
const SESSION_TTL = 5 * 60 * 60 * 1000;
// An endless run has no total, so its progress bar shows the current batch.
const BATCH = 5;

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
  const [hintText, setHintText] = useState("");
  const [hintLoading, setHintLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [responses, setResponses] = useState({});
  const [done, setDone] = useState(false);
  const [checking, setChecking] = useState(false);
  const [pendingSave, setPendingSave] = useState(null);
  const [extending, setExtending] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [actionError, setActionError] = useState("");
  const [seriesStale, setSeriesStale] = useState(false);
  const [liveAward, setLiveAward] = useState(null);
  // 1 = the next question slides in from the right, -1 = "back" from the left.
  const [direction, setDirection] = useState(1);
  // True only while the answer on screen was graded just now, so reactions
  // and confetti do not replay on a question the student merely revisits.
  const [fresh, setFresh] = useState(false);
  const explanationRef = useRef(null);
  useModalFocus(explanationRef, { active: showExplanation, onClose: () => setShowExplanation(false) });
  // A run screen must never rubber-band/scroll, even by a stray drag — the
  // whole point of the fixed layout is that a swipe can't move anything.
  useBodyScrollLock();

  useEffect(() => {
    let cancelled = false;
    setTasks(null);
    setLoadError("");

    if (loadVersion === 0) {
      try {
        const cached = JSON.parse(localStorage.getItem(sessionKey) || "null");
        if (cached && Date.now() - cached.savedAt < SESSION_TTL && Array.isArray(cached.tasks) && cached.tasks.length && cached.tasks.every((item) => isWritten(item) || Number.isInteger(item.correctIndex))) {
          setTasks(cached.tasks);
          setIdx(Math.min(cached.idx ?? 0, cached.tasks.length - 1));
          setSelected(cached.selected ?? null);
          setGraded(cached.graded ?? null);
          setFeedback(cached.feedback ?? null);
          setHintsUsed(cached.hintsUsed ?? 0);
          setHintText(cached.hintText ?? "");
          setPendingSave(cached.pendingSave ?? null);
          setActionError(cached.actionError ?? "");
          setSeriesStale(cached.seriesStale ?? false);
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
      savedAt: Date.now(), tasks, idx, selected, graded, feedback, hintsUsed, hintText,
      results, responses, pendingSave, actionError, seriesStale,
    }));
  }, [actionError, done, feedback, graded, hintText, hintsUsed, idx, pendingSave, responses, results, selected, seriesStale, sessionKey, tasks]);

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
    setDirection(target < idx ? -1 : 1);
    setFresh(false);
    setIdx(target);
    setSelected(saved?.selected ?? null);
    setGraded(saved?.graded ?? null);
    setFeedback(saved?.feedback ?? null);
    setHintsUsed(saved?.hintsUsed ?? 0);
    setHintText(saved?.hintText ?? "");
    setShowExplanation(false);
    setActionError("");
    setSeriesStale(false);
    setPendingSave(saved?.pendingSave ?? null);
  }

  function startNewSeries() {
    localStorage.removeItem(sessionKey);
    setTasks(null);
    setIdx(0);
    setSelected(null);
    setGraded(null);
    setFeedback(null);
    setHintsUsed(0);
    setHintText("");
    setResults([]);
    setResponses({});
    setPendingSave(null);
    setActionError("");
    setSeriesStale(false);
    setLoadVersion((value) => value + 1);
  }

  if (tasks === null) {
    return <div className="run"><div className="run__body">{loadError ? <RunError message={loadError} onRetry={() => setLoadVersion((value) => value + 1)} /> : <div className="run__loading" aria-label="Загружаем задания"><span /><span /><span /></div>}</div></div>;
  }

  if (tasks.length === 0) {
    return <div className="run"><div className="run__body"><Card pad="lg" className="run__state-card"><h1 className="run__prompt">Для этих настроек заданий нет</h1><p>Выбери другой уровень или режим. Если задания не появляются без фильтров, сообщи репетитору.</p><Button icon={Home} onClick={() => navigate(practicePath)}>Изменить настройки</Button></Card></div></div>;
  }

  if (done) return <Summary results={results} onExit={() => navigate("/app")} />;

  const task = tasks[idx];
  const topicLabel = topics.find((topic) => topic.id === task.topic && (!task.subject || topic.subject === task.subject))?.name ?? task.topic;

  function pickOption(answer) {
    if (checking || graded) return;
    if (answer !== selected) tapHaptic();
    setSelected(answer);
    setActionError("");
  }

  function checkAnswer() {
    if (checking || graded || !isAnswerComplete(task, selected)) return;
    setFresh(true);
    if (isWritten(task)) submitWrittenAnswer(selected);
    else gradeChoice(selected);
  }

  function gradeChoice(answer) {
    const correct = answer === task.correctIndex;
    const nextGraded = correct ? "correct" : "wrong";
    const nextFeedback = {
      explanation: task.explanation,
      commonMistake: correct ? null : "Сравни решение с правилом в объяснении и найди шаг, где изменился ответ.",
      correctIndex: task.correctIndex,
      award: null,
    };
    const response = { selected: answer, graded: nextGraded, feedback: nextFeedback, hintsUsed, hintText };
    setGraded(nextGraded);
    setFeedback(nextFeedback);
    setResponses((items) => ({ ...items, [idx]: response }));
    answerHaptic(correct);
    saveAnswer({ answer, nextGraded, nextFeedback, response, correct });
  }

  function submitWrittenAnswer(answer) {
    const nextFeedback = { explanation: task.explanation, commonMistake: null, correctIndex: null, award: null };
    const response = { selected: answer, graded: null, feedback: nextFeedback, hintsUsed, hintText };
    saveAnswer({ answer, nextFeedback, response, correct: false });
  }

  async function saveAnswer(payload) {
    if (checking) return;
    const { answer, nextFeedback, response } = payload;
    setChecking(true);
    setPendingSave(payload);
    setActionError("");
    try {
      const data = await studentApi.answer({ taskId: task.id, instanceId: task.instanceId, ...(task.questionType === "choice" || !task.questionType ? { selected: answer } : { answer }) });
      if (isWritten(task)) answerHaptic(data.correct);
      const serverGraded = data.correct ? "correct" : "wrong";
      const savedFeedback = { ...nextFeedback, explanation: data.explanation, commonMistake: data.commonMistake, correctIndex: data.correctIndex, acceptedAnswers: data.acceptedAnswers, award: data.award };
      setSelected(answer);
      hydrate({ profile: data.profile, topics: data.topics });
      setGraded(serverGraded);
      setFeedback(savedFeedback);
      setResponses((items) => ({ ...items, [idx]: { ...response, graded: serverGraded, feedback: savedFeedback } }));
      setResults((items) => [...items, { taskId: task.id, correct: data.correct, topic: task.topic, topicLabel, award: data.award }]);
      setPendingSave(null);
      if (data.correct && (data.award?.gained || data.award?.coins)) {
        setLiveAward({ ...data.award, id: Date.now() });
        window.setTimeout(() => setLiveAward(null), 950);
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : "";
      const stale = reason === "practice_instance_invalid" || reason === "practice_instance_expired";
      setSeriesStale(stale);
      setActionError(stale
        ? "Эта серия заданий устарела, поэтому ответ нельзя сохранить. Начни новую серию."
        : "Ответ показан, но пока не сохранён. Проверь соединение и повтори отправку.");
    } finally {
      setChecking(false);
    }
  }

  async function revealHint() {
    if (hintLoading || graded || hintsUsed >= (task.hintCount ?? 0)) return;
    setHintLoading(true);
    setActionError("");
    try {
      const data = await studentApi.revealPracticeHint(task.instanceId);
      setHintsUsed(data.hintsUsed);
      setHintText(data.hint);
    } catch {
      setActionError("Не удалось открыть подсказку. Проверь соединение и попробуй ещё раз.");
    } finally {
      setHintLoading(false);
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

  const marks = tasks.map((_, index) => (index === idx ? graded : responses[index]?.graded) ?? undefined);
  const windowStart = isEndless ? Math.floor(idx / BATCH) * BATCH : 0;
  const windowMarks = isEndless ? Array.from({ length: BATCH }, (_, index) => marks[windowStart + index]) : marks;
  const combo = graded === "correct" ? comboAt(marks, idx) : 0;
  const complete = isAnswerComplete(task, selected);
  const hintsLeft = (task.hintCount ?? 0) - hintsUsed;
  const rightAnswer = graded === "wrong" ? correctAnswerText(task, feedback ?? {}) : "";
  // A full list of pairs does not fit the footer line; the tiles already mark
  // the mixed-up ones and the sheet spells the right pairs out.
  const missDetail = task.questionType === "match" ? "Красные пары перепутаны — верные в разборе" : rightAnswer ? `Верный ответ: ${rightAnswer}` : null;

  return (
    <MotionConfig reducedMotion="user">
    <div className="run run--practice">
      <header className="run__top run__top--calm">
        <button className="run__close" onClick={exitRun} aria-label="Выйти из практики"><X size={22} strokeWidth={2.4} /></button>
        <LivePracticeStats profile={profile} award={liveAward} />
      </header>
      <div className="run__progress-row">
        <RunProgress marks={windowMarks} current={idx - windowStart} counter={isEndless ? `№ ${idx + 1}` : `${idx + 1}/${tasks.length}`} label="Прогресс серии" />
      </div>

      <div className="run__body">
        <QuestionStage stepKey={idx} direction={direction} overlay={fresh && isComboMilestone(combo) && <ConfettiBurst key={idx} />}>
          <QuestionCard graded={graded} fitDeps={[task.prompt, task.options, graded, hintText, actionError]}>
            <div className="pr__qhead"><span className="run__qlabel">{topicLabel}</span><span className={`pr__diff pr__diff--${task.difficulty}`}>{diffLabel(task.difficulty)}</span></div>
            <h1 className="run__prompt">{task.questionType === "blanks" ? "Вставь пропущенные слова" : task.prompt}</h1>

            <div className="run__notices" aria-live="polite">
              {actionError && <div className="run__action-error" role="alert"><span>{actionError}</span>{seriesStale ? <button type="button" onClick={startNewSeries}>Новая серия</button> : pendingSave && <button type="button" disabled={checking} onClick={() => saveAnswer(pendingSave)}>Повторить</button>}</div>}
              {hintText && !graded && <div className="pr__hint"><Lightbulb size={16} /><span>{hintText}</span></div>}
            </div>

            {isWritten(task)
              ? <WrittenAnswer options={task.options} pairChoices={task.pairChoices} questionType={task.questionType} prompt={task.prompt} blankCount={task.blankCount} value={selected} onChange={setSelected} disabled={checking} graded={graded} acceptedAnswers={feedback?.acceptedAnswers} />
              : <OptionList options={task.options} selected={selected} onSelect={pickOption} state={graded} correctIndex={feedback?.correctIndex} disabled={checking || !!graded} />}
          </QuestionCard>
        </QuestionStage>
      </div>

      <RunFooter
        status={graded}
        title={graded ? feedbackTitle(graded, idx) : complete ? "Готово? Жми «Проверить»" : answerPrompt(task)}
        detail={graded === "wrong" ? missDetail : null}
        award={feedback?.award}
        combo={combo}
        pet={profile.petSelected ? profile.pet.species : null}
        fresh={fresh}
        assist={(task.hintCount ?? 0) > 0 && <Button variant="ghost" size="sm" icon={Lightbulb} loading={hintLoading} disabled={hintsLeft <= 0} onClick={revealHint}>Подсказка{hintsLeft > 0 ? ` (${hintsLeft})` : ""}</Button>}
        onWhy={feedback?.explanation ? () => setShowExplanation(true) : null}
        onBack={idx > 0 ? () => restoreQuestion(idx - 1) : null}
        primary={graded
          ? { label: !isEndless && idx + 1 >= tasks.length ? "Завершить" : "Дальше", onClick: nextTask, loading: extending || checking, disabled: !!pendingSave }
          : { label: "Проверить", onClick: checkAnswer, loading: checking, disabled: !complete }}
      />
      <AnimatePresence initial={false}>
        {showExplanation && feedback?.explanation && <><motion.button type="button" className="run__sheet-backdrop" aria-label="Закрыть объяснение" onClick={() => setShowExplanation(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} /><motion.aside ref={explanationRef} tabIndex={-1} className="run__explanation-sheet" role="dialog" aria-modal="true" aria-label="Объяснение" initial={reduceMotion ? { opacity: 0 } : { opacity: 0, transform: "translateY(100%)" }} animate={{ opacity: 1, transform: "translateY(0)" }} exit={reduceMotion ? { opacity: 0 } : { opacity: 0, transform: "translateY(100%)" }} transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}><div><strong>Объяснение</strong><button type="button" onClick={() => setShowExplanation(false)} aria-label="Закрыть объяснение"><X size={20} /></button></div>{rightAnswer && <div className="run__sheet-answer"><b>Верный ответ</b>{rightAnswer.split("; ").map((line) => <span key={line}>{line}</span>)}</div>}<p>{feedback.explanation}</p>{graded === "wrong" && feedback.commonMistake && <small>{feedback.commonMistake}</small>}</motion.aside></>}
      </AnimatePresence>
    </div>
    </MotionConfig>
  );
}

function LivePracticeStats({ profile, award }) {
  const today = dateKey();
  const lit = profile.streakLastDoneOn === today;
  const xpInLevel = Math.max(0, profile.xp - profile.xpFromLevel);
  const xpNeeded = Math.max(1, profile.xpForNext - profile.xpFromLevel);
  const progress = Math.min(1, xpInLevel / xpNeeded);
  return <div className="run__live-stats" aria-label="Прогресс ученика">
    <SoundToggle />
    <span className={`run__live-stat run__live-stat--streak ${lit ? "is-lit" : ""} ${award ? "is-celebrating" : ""}`}><span className="run__live-flame" aria-hidden="true">🔥</span><b>{profile.streak}</b></span>
    <span className="run__live-stat run__live-stat--coins"><Coins size={16} /><b>{profile.coins}</b>{award?.coins > 0 && <i key={`c-${award.id}`} className="run__live-gain">+{award.coins}</i>}</span>
    <span className="run__live-stat run__live-level"><span className="run__live-level-copy"><small>ур. {profile.level}</small><b>{profile.xp} опыта</b></span><span className="run__live-level-track"><i style={{ transform: `scaleX(${progress})` }} /></span>{award?.gained > 0 && <i key={`x-${award.id}`} className="run__live-gain">+{award.gained} опыта</i>}</span>
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
    <div className="run run--result">{pct >= 80 && <ConfettiBurst />}<Card className="run__result-card run__result-card--stagger" pad="lg">
      <ScoreRing pct={pct} />
      <h1>Серия завершена</h1><p className="run__result-lead">{summary}</p>
      <div className="pr__stats" aria-label="Результаты серии"><div className="pr__stat"><span className="pr__stat-num font-display">{correct}</span><span className="pr__stat-label">верно</span></div><div className="pr__stat"><span className="pr__stat-num font-display pr__stat-num--err">{errors}</span><span className="pr__stat-label">ошибок</span></div><div className="pr__stat"><span className="pr__stat-num font-display">{total}</span><span className="pr__stat-label">всего</span></div></div>
      {(gainedXp > 0 || gainedCoins > 0) && <div className="pr__reward" role="status"><span><Zap size={18} /> +{gainedXp} опыта</span><span><Coins size={18} /> +{gainedCoins} монет</span></div>}
      {errorTopics.length > 0 && <div className="pr__recap"><div className="pr__recap-title">Следующий учебный шаг</div><div className="pr__recap-topics">{errorTopics.map((topic) => <span key={topic} className="pr__recap-chip">{topic}</span>)}</div><p className="pr__recap-hint">Эти темы сохранены в режиме «Работа над ошибками».</p></div>}
      <div className="run__result-actions"><Button variant="soft" icon={Home} onClick={onExit}>На главную</Button><Button icon={RefreshCw} onClick={() => navigate(0)}>Ещё серия</Button></div>
    </Card></div>
  );
}

function diffLabel(difficulty) {
  return { easy: "Лёгкий", medium: "Средний", hard: "Сложный" }[difficulty] ?? difficulty;
}
