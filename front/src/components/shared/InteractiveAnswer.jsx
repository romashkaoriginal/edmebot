import { useState } from "react";
import "./WrittenAnswer.css";

function shuffled(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export default function InteractiveAnswer({ questionType, options = [], pairChoices = [], value, onChange, onSubmit, disabled, graded, acceptedAnswers, submitLabel }) {
  const [bank] = useState(() => shuffled(questionType === "order" ? options : pairChoices));
  const [active, setActive] = useState(null);
  const values = Array.isArray(value) ? value : [];
  const locked = disabled || !!graded;
  const used = [];
  values.forEach((word) => {
    const index = bank.findIndex((item, i) => item === word && !used.includes(i));
    if (index >= 0) used.push(index);
  });
  const complete = questionType === "order" ? values.length === options.length : options.every((_, i) => !!values[i]);
  function pair(right) {
    if (active === null || locked) return;
    const next = options.map((_, i) => values[i] || "");
    const previous = next.indexOf(right);
    if (previous >= 0) next[previous] = "";
    next[active] = right;
    onChange(next);
    setActive(null);
  }
  return (
    <div className="written-answer">
      <div className="written-answer__exercise">
        <p className="mechanic-help">{questionType === "order" ? "Нажимай на слова, чтобы собрать предложение. Нажми на слово в ответе, чтобы вернуть его." : "Выбери слово слева, затем его пару справа. Нажми на готовую пару, чтобы изменить её."}</p>
        {questionType === "order" ? <>
          <div className="word-answer" aria-label="Собранное предложение" aria-live="polite">
            {!values.length && <span className="mechanic-placeholder">Здесь появится твоё предложение</span>}
            {values.map((word, i) => <button className="word-tile" key={i} disabled={locked} aria-label={`Убрать ${word}, позиция ${i + 1}`} onClick={() => onChange(values.filter((_, index) => index !== i))}>{word}</button>)}
          </div>
          <div className="word-bank" aria-label="Слова для предложения">{bank.map((word, i) => <button className="word-tile" key={i} disabled={locked || used.includes(i)} onClick={() => onChange([...values, word])}>{word}</button>)}</div>
        </> : <div className="pair-board">
          <div className="pair-column">{options.map((word, i) => <button key={i} className="word-tile pair-tile" aria-pressed={active === i} disabled={locked} onClick={() => setActive(i)}><span>{word}</span><small>{values[i] ? `↔ ${values[i]}` : "Выбери пару"}</small></button>)}</div>
          <div className="pair-column">{bank.map((word, i) => <button key={i} className="word-tile pair-tile" disabled={locked || active === null} onClick={() => pair(word)}><span>{word}</span>{values.includes(word) && <small>Связано ✓</small>}</button>)}</div>
        </div>}
        <p className="mechanic-progress" role="status">{questionType === "order" ? `${values.length} из ${options.length} слов` : `${values.filter(Boolean).length} из ${options.length} пар`}</p>
        {!locked && values.some(Boolean) && <button type="button" className="mechanic-reset" onClick={() => { onChange([]); setActive(null); }}>Начать заново</button>}
      </div>
      {graded && <div className={`written-answer__feedback written-answer__feedback--${graded}`} role="status"><strong>{graded === "correct" ? "✓ Верно!" : graded === "answered" ? "Ответ записан" : "Попробуем ещё раз в следующем задании"}</strong>{graded === "wrong" && acceptedAnswers?.length > 0 && <span>Правильный ответ: {acceptedAnswers.map((variants, i) => questionType === "match" ? `${options[i]} ↔ ${variants[0]}` : variants.join(" / ")).join("; ")}</span>}</div>}
      {!graded && <button className="written-answer__submit" disabled={disabled || !complete} onClick={() => onSubmit(values)}>{submitLabel || "Проверить"} →</button>}
    </div>
  );
}
