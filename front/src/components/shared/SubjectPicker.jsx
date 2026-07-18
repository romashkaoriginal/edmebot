import { Calculator, PenLine } from "lucide-react";
import { subjectLabel } from "../../utils/subjects";
import "./SubjectPicker.css";

const SUBJECT_META = {
  "Математика": { icon: Calculator, label: "Математика" },
  "Русский": { icon: PenLine, label: "Русский язык" },
};

export default function SubjectPicker({ subjects, section, onSelect }) {
  return (
    <section className="subject-picker" aria-labelledby="subject-picker-title">
      <div className="subject-picker__copy">
        <h1 id="subject-picker-title">Выбери предмет</h1>
        <p>Куда перейдём: {section}?</p>
      </div>
      <div className="subject-picker__options">
        {subjects.map(({ subject, grade }) => {
          const Icon = SUBJECT_META[subject]?.icon ?? Calculator;
          return (
            <button key={subject} className="subject-picker__option" type="button" onClick={() => onSelect(subject)}>
              <span className="subject-picker__icon" aria-hidden="true"><Icon size={24} strokeWidth={2.3} /></span>
              <span>
                <strong>{SUBJECT_META[subject]?.label ?? subjectLabel(subject)}</strong>
                {grade && <small>{grade} класс</small>}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
