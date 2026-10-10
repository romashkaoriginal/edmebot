import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "../router";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, CircleHelp, Lightbulb, PartyPopper, RefreshCw, X } from "lucide-react";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import OptionList from "../components/shared/OptionList";
import KnowledgeMap from "../components/shared/KnowledgeMap";
import QuestionStage, { QuestionCard } from "../components/run/QuestionStage";
import RunFooter from "../components/run/RunFooter";
import RunProgress from "../components/run/RunProgress";
import ConfettiBurst from "../components/run/ConfettiBurst";
import SoundToggle from "../components/run/SoundToggle";
import { isAuthError, studentApi } from "../api/student";
import { subjectLabel } from "../utils/subjects";
import { useApp } from "../store/AppStore";
import { answerHaptic, tapHaptic } from "../utils/haptics";
import { answerPrompt, comboAt, feedbackTitle, isComboMilestone } from "../utils/answers";
import useModalFocus from "../hooks/useModalFocus";
import useBodyScrollLock from "../hooks/useBodyScrollLock";
import "./RunMode.css";

const SESSION_TTL = 6 * 60 * 60 * 1000;

export default function DiagnosticRun() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const { hydrate, profile } = useApp();
  // One diagnostic now covers every enrolled subject, so the cached session is
  // keyed per student rather than per subject.
  const sessionKey = useMemo(() => {
    const student = localStorage.getItem("edme_student_id") || "telegram";
    return `edme:diagnostic:${student}`;
  }, []);
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [graded, setGraded] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [helpUsed, setHelpUsed] = useState(false);
  const [questions, setQuestions] = useState(null);
  const [diagnosticSessionId, setDiagnosticSessionId] = useState("");
  const [answers, setAnswers] = useState([]);
  const [responses, setResponses] = useState({});
  const [resultTopics, setResultTopics] = useState([]);
  const [done, setDone] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loadVersion, setLoadVersion] = useState(0);
  // 1 = the next question slides in from the right, -1 = "back" from the left.
  const [direction, setDirection] = useState(1);
  // True only while the answer on screen was graded just now (see RunFooter).
  const [fresh, setFresh] = useState(false);
  const explanationRef = useRef(null);
  useModalFocus(explanationRef, { active: showExplanation, onClose: () => setShowExplanation(false) });
  useBodyScrollLock();

  useEffect(() => {
    let cancelled = false;
    setQuestions(null);
    setLoadError("");
    if (loadVersion === 0) {
      try {
        const cached = JSON.parse(localStorage.getItem(sessionKey) || "null");
        if (cached && cached.diagnosticSessionId && Date.now() - cached.savedAt < SESSION_TTL && cached.questions?.length && cached.questions.every((item) => Number.isInteger(item.correctIndex))) {
          setQuestions(cached.questions);
          setDiagnosticSessionId(cached.diagnosticSessionId ?? "");
          setIdx(Math.min(cached.idx ?? 0, cached.questions.length - 1));
          setAnswers(cached.answers ?? []);
          setResponses(cached.responses ?? {});
          setSelected(cached.selected ?? null);
          setGraded(cached.graded ?? null);
          setFeedback(cached.feedback ?? null);
          setHelpUsed(cached.helpUsed ?? false);
          return () => { cancelled = true; };
        }
      } catch {
        localStorage.removeItem(sessionKey);
      }
    }
    studentApi.diagnostic({ fresh: loadVersion > 0 })
      .then((data) => {
        if (!cancelled) {
          setQuestions(data.questions ?? []);
          setDiagnosticSessionId(data.sessionId ?? "");
        }
      })
      .catch(() => { if (!cancelled) setLoadError("Не удалось загрузить диагностику. Проверь соединение и повтори попытку."); });
    return () => { cancelled = true; };
  }, [loadVersion, sessionKey]);

  useEffect(() => {
    if (!questions?.length || done) return;
    localStorage.setItem(sessionKey, JSON.stringify({ savedAt: Date.now(), diagnosticSessionId, questions, idx, answers, responses, selected, graded, feedback, helpUsed }));
  }, [answers, diagnosticSessionId, done, feedback, graded, helpUsed, idx, questions, responses, selected, sessionKey]);

  useEffect(() => { if (done) localStorage.removeItem(sessionKey); }, [done, sessionKey]);

  const question = questions?.[idx];
  // With several subjects in one run, label each question so the switch from
  // one subject to the next is not disorienting.
  const multiSubject = new Set((questions ?? []).map((item) => item.subject)).size > 1;
  const hasProgress = idx > 0 || graded || answers.length > 0;

  function exitRun() {
    if (hasProgress && !window.confirm("Выйти из диагностики? Ответы сохранятся, и ты сможешь продолжить позже.")) return;
    navigate("/app/diagnostic");
  }

  function restoreQuestion(target) {
    const saved = responses[target];
    setDirection(target < idx ? -1 : 1);
    setFresh(false);
    setIdx(target);
    setSelected(saved?.selected ?? null);
    setGraded(saved?.graded ?? null);
    setFeedback(saved?.feedback ?? null);
    setHelpUsed(saved?.helpUsed ?? false);
    setShowExplanation(false);
    setSubmitError("");
  }

  function pickOption(answer) {
    if (graded) return;
    if (answer !== selected) tapHaptic();
    setSelected(answer);
    setSubmitError("");
  }

  // `answer` is null for "Не знаю": graded as a miss without picking an option.
  function gradeAnswer(answer) {
    if (graded) return;
    setFresh(true);
    setSelected(answer);
    setSubmitError("");
    const correct = answer === question.correctIndex;
    const nextGraded = correct ? "correct" : "wrong";
    const nextFeedback = { correctIndex: question.correctIndex, explanation: question.explanation };
    setShowExplanation(false);
    setGraded(nextGraded);
    setFeedback(nextFeedback);
    setAnswers((items) => [...items.slice(0, idx), { id: question.id, selected: answer, usedHelp: helpUsed }, ...items.slice(idx + 1)]);
    setResponses((items) => ({ ...items, [idx]: { selected: answer, graded: nextGraded, feedback: nextFeedback, helpUsed } }));
    answerHaptic(correct);
  }

  async function next() {
    if (idx + 1 < questions.length) return restoreQuestion(idx + 1);
    setSubmitting(true);
    setSubmitError("");
    try {
      const result = await studentApi.submitDiagnostic(diagnosticSessionId, answers);
      setResultTopics(result.knowledgeMap ?? []);
      hydrate({ profile: result.profile, topics: result.knowledgeMap });
      setDone(true);
    } catch (error) {
      // A stale Telegram session cannot be fixed by retrying — only reopening
      // the Mini App issues fresh initData. The answers survive in
      // localStorage, so nothing is lost by closing.
      setSubmitError(isAuthError(error)
        ? "Сессия устарела. Закрой приложение и открой его снова через кнопку в боте — ответы сохранены и не пропадут."
        : "Результат не сохранился. Ответы не потеряны — попробуй ещё раз.");
    } finally {
      setSubmitting(false);
    }
  }

  if (questions === null) {
    return <div className="run"><div className="run__body">{loadError ? <Card pad="lg" className="run__state-card" role="alert"><h1>Диагностика не загрузилась</h1><p>{loadError}</p><Button icon={RefreshCw} onClick={() => setLoadVersion((value) => value + 1)}>Повторить</Button></Card> : <div className="run__loading" aria-label="Загружаем диагностику"><span /><span /><span /></div>}</div></div>;
  }

  if (!questions.length) {
    return <div className="run"><div className="run__body"><Card pad="lg" className="run__state-card"><h1>Вопросы ещё не готовы</h1><p>Для выбранного класса и предмета пока не хватает заданий. Выбери предмет и класс, для которых тест уже готов.</p><Button variant="soft" icon={RefreshCw} onClick={() => navigate("/app/onboarding", { replace: true })}>Выбрать предмет и класс</Button></Card></div></div>;
  }

  if (done) {
    return <div className="run run--result"><Card className="run__result-card" pad="lg"><div className="run__result-icon"><PartyPopper size={32} strokeWidth={2.4} /></div><h1>Карта знаний готова</h1><p className="run__result-lead">Это не оценка, а маршрут обучения. Сначала потренируем темы, где сейчас нужно больше практики.</p><div className="run__result-map"><KnowledgeMap topics={resultTopics} /></div><div className="run__result-actions"><Button icon={ArrowRight} onClick={() => navigate("/app/pet", { replace: true })}>Выбрать питомца</Button></div></Card></div>;
  }

  const sheetText = graded ? feedback?.explanation : question.hints?.[0];
  const marks = questions.map((_, index) => (index === idx ? graded : responses[index]?.graded) ?? undefined);
  const combo = graded === "correct" ? comboAt(marks, idx) : 0;

  return (
    <MotionConfig reducedMotion="user">
    <div className="run run--diagnostic">
      <header className="run__top">
        <button className="run__close" onClick={exitRun} aria-label="Выйти из диагностики"><X size={22} strokeWidth={2.4} /></button>
        <RunProgress marks={marks} current={idx} counter={`${idx + 1}/${questions.length}`} label="Прогресс диагностики" />
        <SoundToggle />
      </header>

      <div className="run__body">
        <QuestionStage stepKey={idx} direction={direction} overlay={fresh && isComboMilestone(combo) && <ConfettiBurst key={idx} />}>
          <QuestionCard graded={graded} fitDeps={[question.prompt, question.options, graded, submitError]}>
            <div className="run__question-head">
              <span className="run__qlabel">{multiSubject ? `${subjectLabel(question.subject)} · ` : ""}{formatTopicLabel(question.topic)}</span>
              <span className="run__qnumber">Вопрос {idx + 1}</span>
            </div>
            <h1 className="run__prompt">{question.prompt}</h1>
            <div className="run__notices" aria-live="polite">{submitError && <div className="run__action-error" role="alert">{submitError}</div>}</div>
            <OptionList options={question.options} selected={selected} onSelect={pickOption} state={graded} correctIndex={feedback?.correctIndex} disabled={!!graded} />
          </QuestionCard>
        </QuestionStage>
      </div>

      <RunFooter
        status={graded}
        title={graded ? feedbackTitle(graded, idx, { skipped: selected === null }) : selected !== null ? "Готово? Жми «Проверить»" : answerPrompt(question)}
        detail={graded === "wrong" ? `Верный ответ: ${question.options[feedback?.correctIndex] ?? ""}` : null}
        combo={combo}
        pet={profile.petSelected ? profile.pet.species : null}
        fresh={fresh}
        assist={<>
          <Button variant="ghost" size="sm" icon={CircleHelp} onClick={() => gradeAnswer(null)}>Не знаю</Button>
          {question.hints?.[0] && <Button variant="ghost" size="sm" icon={Lightbulb} aria-label="Напомнить правило" onClick={() => { setHelpUsed(true); setShowExplanation(true); }}>Правило</Button>}
        </>}
        onWhy={feedback?.explanation ? () => setShowExplanation(true) : null}
        onBack={idx > 0 ? () => restoreQuestion(idx - 1) : null}
        primary={graded
          ? { label: idx + 1 >= questions.length ? "Завершить" : "Дальше", onClick: next, loading: submitting }
          : { label: "Проверить", onClick: () => gradeAnswer(selected), disabled: selected === null }}
      />
      <AnimatePresence initial={false}>
        {showExplanation && sheetText && <><motion.button type="button" className="run__sheet-backdrop" aria-label="Закрыть подсказку" onClick={() => setShowExplanation(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} /><motion.aside ref={explanationRef} tabIndex={-1} className="run__explanation-sheet" role="dialog" aria-modal="true" aria-label={graded ? "Объяснение" : "Напоминание правила"} initial={reduceMotion ? { opacity: 0 } : { opacity: 0, transform: "translateY(100%)" }} animate={{ opacity: 1, transform: "translateY(0)" }} exit={reduceMotion ? { opacity: 0 } : { opacity: 0, transform: "translateY(100%)" }} transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}><div><strong>{graded ? "Объяснение" : `Тема: ${formatTopicLabel(question.topic)}`}</strong><button type="button" onClick={() => setShowExplanation(false)} aria-label="Закрыть"><X size={20} /></button></div><p>{sheetText}</p></motion.aside></>}
      </AnimatePresence>
    </div>
    </MotionConfig>
  );
}

function formatTopicLabel(topic) {
  const knownTopics = {
    fractions: "Дроби",
    equations: "Уравнения",
    geometry: "Геометрия",
    percents: "Проценты",
    powers: "Степени",
    wordproblems: "Текстовые задачи",
  };
  return knownTopics[topic] ?? String(topic || "Тема задания").replaceAll(/[_-]+/g, " ");
}
