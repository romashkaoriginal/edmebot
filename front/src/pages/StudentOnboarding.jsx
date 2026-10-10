import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "../router";
import { ArrowLeft, ArrowRight, Calculator, Check, PenLine, FlaskConical, Atom, Languages, RefreshCw } from "lucide-react";
import Button from "../components/ui/Button";
import Logo from "../components/brand/Logo";
import { isAuthError, studentApi } from "../api/student";
import { useApp } from "../store/AppStore";
import "./StudentOnboarding.css";

const GRADES = [5, 6, 7, 8, 9, 10, 11];
const SUBJECTS = [
  { name: "Математика", icon: Calculator, hint: "Алгебра и геометрия" },
  { name: "Русский язык", icon: PenLine, label: "Русский язык", hint: "Правила и разборы" },
  { name: "Химия", icon: FlaskConical, hint: "Реакции и вещества" },
  { name: "Физика", icon: Atom, hint: "Законы и явления" },
  { name: "Английский язык", icon: Languages, hint: "Слова и грамматика" },
];

export default function StudentOnboarding() {
  const navigate = useNavigate();
  const { hydrate } = useApp();
  const [step, setStep] = useState("subject");
  const [selected, setSelected] = useState([]);
  const [grade, setGrade] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [availability, setAvailability] = useState(null);
  const [availabilityError, setAvailabilityError] = useState(false);
  const [availabilityAttempt, setAvailabilityAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    studentApi.onboardingOptions()
      .then((data) => { if (!cancelled) setAvailability(data); })
      .catch((error) => { if (!cancelled) setAvailabilityError(isAuthError(error) ? "auth" : "network"); });
    return () => { cancelled = true; };
  }, [availabilityAttempt]);

  const combinationMap = useMemo(() => new Map(
    (availability?.combinations ?? []).map((item) => [`${item.grade}:${item.subject}`, item])
  ), [availability]);

  const readyGrades = useMemo(() => {
    const bySubject = new Map();
    for (const item of availability?.combinations ?? []) {
      if (!item.ready) continue;
      const grades = bySubject.get(item.subject) ?? new Set();
      grades.add(item.grade);
      bySubject.set(item.subject, grades);
    }
    return bySubject;
  }, [availability]);

  function canAddSubject(name) {
    if (!availability) return false;
    const alreadySelected = new Set(selected);
    const candidateSubjects = [...selected, name];
    return availability.grades.some((value) =>
      candidateSubjects.every((subject) => readyGrades.get(subject)?.has(value))
    ) || alreadySelected.has(name);
  }

  function subjectHint(name, fallback) {
    if (!availability) return fallback;
    const grades = [...(readyGrades.get(name) ?? [])].sort((a, b) => a - b);
    if (!grades.length) return "Тест пока не готов";
    if (selected.length && !selected.includes(name) && !canAddSubject(name)) return "Нет общего класса с выбранными предметами";
    const ranges = [];
    let start = grades[0];
    let end = start;
    for (const value of grades.slice(1)) {
      if (value === end + 1) end = value;
      else { ranges.push(start === end ? `${start}` : `${start}–${end}`); start = end = value; }
    }
    ranges.push(start === end ? `${start}` : `${start}–${end}`);
    return `Тест готов: ${ranges.join(", ")} классы`;
  }

  function gradeStatus(value) {
    const combinations = selected.map((name) => combinationMap.get(`${value}:${name}`));
    const ready = combinations.length > 0 && combinations.every((item) => item?.ready);
    const counts = combinations.map((item) => item?.questionCount ?? 0);
    return {
      ready,
      label: ready ? "Тест готов" : "Нет теста",
      detail: ready
        ? `${value} класс: тест готов по всем выбранным предметам`
        : `${value} класс: есть ${Math.min(...counts)} вопросов, нужно ${availability?.minimumQuestions ?? 5} по каждому выбранному предмету`,
    };
  }

  function toggleSubject(name) {
    if (!selected.includes(name) && !canAddSubject(name)) return;
    setSelected((current) => current.includes(name)
      ? current.filter((item) => item !== name)
      : [...current, name]);
  }

  async function finish() {
    if (!grade || !selected.length || saving) return;
    setSaving(true);
    setError("");
    try {
      const data = await studentApi.onboard({ subjects: selected, grade });
      hydrate({ profile: data.profile });
      navigate("/app/diagnostic", { replace: true });
    } catch (err) {
      // The student is already past this step (usually a stale onboarding
      // screen after the diagnostic). Re-reading the profile lets the router
      // send them to the step they are actually on instead of looping here.
      if (err instanceof Error && err.message === "onboarding_step_invalid") {
        try {
          const profile = await studentApi.profile();
          hydrate(profile);
          return;
        } catch { /* fall through to the generic message */ }
      }
      setError(isAuthError(err)
        ? "Сессия устарела. Закрой приложение и открой его снова через кнопку в боте — выбор нужно будет повторить."
        : err?.message === "diagnostic_unavailable"
          ? "Для этого класса не хватает заданий по одному из предметов. Вернись назад и выбери доступный класс."
          : "Не удалось сохранить выбор. Проверь соединение и попробуй ещё раз.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="sonboard">
      <header className="sonboard__head">
        <Logo height={34} />
        <span>Шаг {step === "subject" ? "1" : "2"} из 2</span>
      </header>

      {step === "subject" ? (
        <section className="sonboard__panel">
          <div>
            <h1>Что будем изучать?</h1>
            <p>Можно выбрать несколько предметов. У каждого указан класс, для которого уже готов входной тест.</p>
          </div>
          {availabilityError && (
            <div className="sonboard__availability-error" role="alert">
              <span>{availabilityError === "auth"
                ? "Сессия устарела. Закрой приложение и открой его снова через кнопку в боте."
                : "Не удалось проверить готовность тестов."}</span>
              {availabilityError !== "auth" && <Button variant="soft" size="sm" icon={RefreshCw} onClick={() => {
                setAvailability(null);
                setAvailabilityError(null);
                setAvailabilityAttempt((value) => value + 1);
              }}>Повторить</Button>}
            </div>
          )}
          {!availability && !availabilityError && <p className="sonboard__availability" role="status">Проверяем, для каких классов готовы задания…</p>}
          <div className="sonboard__subjects" role="group" aria-label="Предметы">
            {SUBJECTS.map(({ name, icon: Icon, label, hint }) => {
              const checked = selected.includes(name);
              const enabled = checked || canAddSubject(name);
              const availabilityHint = subjectHint(name, hint);
              return (
                <label key={name} className={`sonboard__subject ${checked ? "is-selected" : ""} ${enabled ? "" : "is-unavailable"}`}>
                  <input
                    type="checkbox"
                    className="sonboard__subject-input"
                    checked={checked}
                    disabled={!enabled}
                    onChange={() => toggleSubject(name)}
                  />
                  <span className="sonboard__subject-check" aria-hidden="true"><Check size={15} strokeWidth={3.5} /></span>
                  <Icon className="sonboard__subject-icon" size={26} aria-hidden="true" />
                  <strong>{label ?? name}</strong>
                  <span>{availabilityHint}</span>
                </label>
              );
            })}
          </div>
          <div className="sonboard__sticky-actions">
            <Button size="lg" full iconRight={ArrowRight} disabled={!availability || !selected.length} onClick={() => setStep("grade")}>
              {selected.length > 1 ? `Продолжить с ${selected.length} предметами` : "Продолжить"}
            </Button>
          </div>
        </section>
      ) : (
        <section className="sonboard__panel">
          <div>
            <h1>В каком ты классе?</h1>
          </div>
          <div className="sonboard__grades" role="radiogroup" aria-label="Класс">
            {GRADES.map((value) => {
              const status = gradeStatus(value);
              return (
                <button
                  key={value}
                  type="button"
                  className={`${grade === value ? "is-selected" : ""} ${status.ready ? "" : "is-unavailable"}`}
                  aria-label={status.detail}
                  title={status.detail}
                  aria-pressed={grade === value}
                  disabled={!status.ready}
                  onClick={() => setGrade(value)}
                >
                  <strong>{value}</strong><span>класс</span><small>{status.label}</small>
                </button>
              );
            })}
          </div>
          {error && <p className="sonboard__error" role="alert">{error}</p>}
          {availability && <p className="sonboard__availability" role="status">Недоступные классы отмечены: в банке ещё нет пяти вопросов по каждому выбранному предмету.</p>}
          <div className="sonboard__actions">
            <Button variant="soft" icon={ArrowLeft} onClick={() => setStep("subject")}>Назад</Button>
            <Button iconRight={ArrowRight} disabled={!grade || saving} loading={saving} onClick={finish}>К диагностике</Button>
          </div>
        </section>
      )}
    </div>
  );
}
