import { useState } from "react";
import { useNavigate } from "../router";
import { ArrowLeft, ArrowRight, Calculator, Check, PenLine } from "lucide-react";
import Button from "../components/ui/Button";
import Logo from "../components/brand/Logo";
import { studentApi } from "../api/student";
import { useApp } from "../store/AppStore";
import "./StudentOnboarding.css";

const GRADES = [6, 7, 8, 9, 10, 11];
const SUBJECTS = [
  { name: "Математика", icon: Calculator, hint: "Алгебра и геометрия" },
  { name: "Русский", icon: PenLine, label: "Русский язык", hint: "Правила и разборы" },
];

export default function StudentOnboarding() {
  const navigate = useNavigate();
  const { hydrate } = useApp();
  const [step, setStep] = useState("subject");
  const [selected, setSelected] = useState([]);
  const [grade, setGrade] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function toggleSubject(name) {
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
      setError("Не удалось сохранить выбор. Проверь соединение и попробуй ещё раз.");
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
            <p>Можно выбрать оба предмета — или начать с одного и добавить второй позже.</p>
          </div>
          <div className="sonboard__subjects" role="group" aria-label="Предметы">
            {SUBJECTS.map(({ name, icon: Icon, label, hint }) => {
              const checked = selected.includes(name);
              return (
                <label key={name} className={`sonboard__subject ${checked ? "is-selected" : ""}`}>
                  <input
                    type="checkbox"
                    className="sonboard__subject-input"
                    checked={checked}
                    onChange={() => toggleSubject(name)}
                  />
                  <span className="sonboard__subject-check" aria-hidden="true"><Check size={15} strokeWidth={3.5} /></span>
                  <Icon className="sonboard__subject-icon" size={26} aria-hidden="true" />
                  <strong>{label ?? name}</strong>
                  <span>{hint}</span>
                </label>
              );
            })}
          </div>
          <Button size="lg" full iconRight={ArrowRight} disabled={!selected.length} onClick={() => setStep("grade")}>
            {selected.length === 2 ? "Продолжить с двумя предметами" : "Продолжить"}
          </Button>
        </section>
      ) : (
        <section className="sonboard__panel">
          <div>
            <h1>В каком ты классе?</h1>
          </div>
          <div className="sonboard__grades" role="radiogroup" aria-label="Класс">
            {GRADES.map((value) => (
              <button key={value} type="button" className={grade === value ? "is-selected" : ""} aria-pressed={grade === value} onClick={() => setGrade(value)}>
                <strong>{value}</strong><span>класс</span>
              </button>
            ))}
          </div>
          {error && <p className="sonboard__error" role="alert">{error}</p>}
          <div className="sonboard__actions">
            <Button variant="soft" icon={ArrowLeft} onClick={() => setStep("subject")}>Назад</Button>
            <Button iconRight={ArrowRight} disabled={!grade} loading={saving} onClick={finish}>К диагностике</Button>
          </div>
        </section>
      )}
    </div>
  );
}
