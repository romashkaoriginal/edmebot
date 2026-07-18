import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Calculator, PenLine } from "lucide-react";
import Button from "../components/ui/Button";
import Logo from "../components/brand/Logo";
import { studentApi } from "../api/student";
import { useApp } from "../store/AppStore";
import "./StudentOnboarding.css";

const GRADES = [6, 7, 8, 9, 10, 11];

export default function StudentOnboarding() {
  const navigate = useNavigate();
  const { hydrate } = useApp();
  const [step, setStep] = useState("subject");
  const [subject, setSubject] = useState("Математика");
  const [grade, setGrade] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function finish() {
    if (!grade || saving) return;
    setSaving(true);
    setError("");
    try {
      const data = await studentApi.onboard({ subject, grade });
      hydrate({ profile: data.profile });
      navigate("/app/diagnostic", { replace: true });
    } catch {
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
            <p>Выбери предмет, с которого начнём занятия.</p>
          </div>
          <div className="sonboard__subjects">
            <button className={`sonboard__subject ${subject === "Математика" ? "is-selected" : ""}`} type="button" aria-pressed={subject === "Математика"} onClick={() => { setSubject("Математика"); setStep("grade"); }}>
              <Calculator size={28} /><strong>Математика</strong><span>Доступно</span>
            </button>
            <button className={`sonboard__subject ${subject === "Русский" ? "is-selected" : ""}`} type="button" aria-pressed={subject === "Русский"} onClick={() => { setSubject("Русский"); setStep("grade"); }}>
              <PenLine size={28} /><strong>Русский язык</strong><span>Доступно</span>
            </button>
          </div>
          <Button size="lg" full iconRight={ArrowRight} onClick={() => setStep("grade")}>Продолжить</Button>
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
