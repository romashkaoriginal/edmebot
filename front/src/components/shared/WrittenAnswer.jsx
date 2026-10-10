import { useRef } from "react";
import { partVerdicts } from "../../utils/answers";
import InteractiveAnswer from "./InteractiveAnswer";
import "./WrittenAnswer.css";

/**
 * Answer area for every non-choice question type. Checking and feedback are
 * owned by the run footer; this only collects the answer and, once graded,
 * colours each part of it.
 */
export default function WrittenAnswer(props) {
  const { questionType } = props;
  if (questionType === "order" || questionType === "match") return <InteractiveAnswer {...props} />;
  return questionType === "text" ? <TextAnswer {...props} /> : <BlanksAnswer {...props} />;
}

function TextAnswer({ value, onChange, disabled, graded }) {
  return (
    <div className="written-answer">
      <div className="written-answer__exercise written-answer__exercise--compact">
        <label className="written-answer__field">
          <span className="sr-only">Твой ответ</span>
          <input
            className={graded ? `is-${graded}` : ""}
            value={typeof value === "string" ? value : ""}
            disabled={disabled || !!graded}
            inputMode="text"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="done"
            onChange={(event) => onChange(event.target.value)}
            placeholder="Введи ответ"
          />
        </label>
      </div>
    </div>
  );
}

function BlanksAnswer({ prompt, blankCount, value, onChange, disabled, graded, acceptedAnswers }) {
  const inputs = useRef([]);
  const values = Array.isArray(value) ? value : Array(blankCount || 1).fill("");
  const parts = String(prompt ?? "").split("_");
  const verdicts = partVerdicts(graded, values, acceptedAnswers);

  // Enter walks through the blanks; on the last one it is left alone so the
  // footer's primary action ("Проверить") picks it up.
  function handleEnter(event, index) {
    if (event.key !== "Enter" || index >= values.length - 1) return;
    event.preventDefault();
    inputs.current[index + 1]?.focus();
  }

  function blankState(index) {
    if (verdicts) return verdicts[index] ? "is-correct" : "is-wrong";
    return graded ? `is-${graded}` : "";
  }

  return (
    <div className="written-answer">
      <div className="written-answer__exercise">
        <div className="written-answer__sentence" aria-label="Предложение с пропусками">
          {parts.map((part, index) => (
            <span key={index}>
              {part}
              {index < values.length && (
                <input
                  ref={(node) => { inputs.current[index] = node; }}
                  className={blankState(index)}
                  // The blank grows with the word typed into it.
                  style={{ width: `calc(${Math.max(4, (values[index] ?? "").length + 1)}ch + 28px)` }}
                  aria-label={`Пропуск ${index + 1} из ${values.length}`}
                  value={values[index] ?? ""}
                  disabled={disabled || !!graded}
                  inputMode="text"
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  enterKeyHint={index < values.length - 1 ? "next" : "done"}
                  onChange={(event) => onChange(values.map((item, i) => (i === index ? event.target.value : item)))}
                  onKeyDown={(event) => handleEnter(event, index)}
                />
              )}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
