import { useRef } from "react";
import { Check, X, PencilLine, ArrowRight } from "lucide-react";
import "./WrittenAnswer.css";
import InteractiveAnswer from "./InteractiveAnswer";

export default function WrittenAnswer({ questionType, prompt, blankCount, value, onChange, onSubmit, disabled, graded, acceptedAnswers, options, pairChoices, submitLabel = "Проверить" }) {
  const inputs = useRef([]);
  const isText = questionType === "text";
  const values = isText ? [typeof value === "string" ? value : ""] : Array.isArray(value) ? value : Array(blankCount || 1).fill("");
  const complete = values.every((item) => item.trim());
  const parts = !isText ? String(prompt ?? "").split("_") : [];
  if (questionType === "order" || questionType === "match") return <InteractiveAnswer {...{ questionType, options, pairChoices, value, onChange, onSubmit, disabled, graded, acceptedAnswers, submitLabel }} />;

  function update(index, next) {
    if (isText) onChange(next);
    else onChange(values.map((item, i) => i === index ? next : item));
  }

  function handleEnter(event, index) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (!isText && index < values.length - 1) inputs.current[index + 1]?.focus();
    else if (complete && !disabled && !graded) onSubmit(value);
  }

  return (
    <div className={`written-answer written-answer--${questionType} ${graded ? `written-answer--${graded}` : ""}`}>
      <div className="written-answer__exercise">
        <div className="written-answer__eyebrow"><PencilLine size={16} aria-hidden="true" /> {isText ? "Напиши ответ" : "Заполни пропуски"}</div>
        {isText ? (
          <label className="written-answer__field">
            <span>Твой ответ</span>
            <input
              ref={(node) => { inputs.current[0] = node; }}
              value={values[0]}
              disabled={disabled || !!graded}
              inputMode="text"
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => update(0, event.target.value)}
              onKeyDown={(event) => handleEnter(event, 0)}
              placeholder="Введи ответ"
            />
          </label>
        ) : (
          <div className="written-answer__sentence" aria-label="Предложение с пропусками">
            {parts.map((part, index) => (
              <span key={index}>
                {part}
                {index < values.length && (
                  <input
                    ref={(node) => { inputs.current[index] = node; }}
                    aria-label={`Пропуск ${index + 1} из ${values.length}`}
                    value={values[index]}
                    disabled={disabled || !!graded}
                    inputMode="text"
                    autoComplete="off"
                    spellCheck={false}
                    onChange={(event) => update(index, event.target.value)}
                    onKeyDown={(event) => handleEnter(event, index)}
                  />
                )}
              </span>
            ))}
          </div>
        )}
      </div>
      {graded && (
        <div className={`written-answer__feedback written-answer__feedback--${graded}`} role="status" aria-live="polite">
          <strong>{graded === "correct" ? <Check size={18} aria-hidden="true" /> : graded === "answered" ? <PencilLine size={18} aria-hidden="true" /> : <X size={18} aria-hidden="true" />} {graded === "correct" ? "Верно!" : graded === "answered" ? "Ответ записан" : "Почти получилось"}</strong>
          {graded === "wrong" && acceptedAnswers?.length > 0 && <span>Правильный ответ: {acceptedAnswers.map((variants) => variants.join(" / ")).join("; ")}</span>}
        </div>
      )}
      {!graded && (
        <button type="button" className="written-answer__submit" disabled={disabled || !complete} onClick={() => onSubmit(value)}>
          {submitLabel} <ArrowRight size={18} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
