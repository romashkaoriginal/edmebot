import { useId, useState } from "react";
import { motion } from "framer-motion";
import { RotateCcw } from "lucide-react";
import { partVerdicts } from "../../utils/answers";
import { tapHaptic } from "../../utils/haptics";
import "./WrittenAnswer.css";

// A tile travelling between the bank and the sentence: quick, barely any overshoot.
const TILE_MOVE = { type: "spring", duration: 0.32, bounce: 0.12 };

function shuffled(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export default function InteractiveAnswer(props) {
  return props.questionType === "order" ? <OrderAnswer {...props} /> : <MatchAnswer {...props} />;
}

function ResetButton({ visible, onClick }) {
  // Kept in the layout while hidden, so the exercise does not jump on the first tap.
  return (
    <button type="button" className="mechanic-reset" style={{ visibility: visible ? "visible" : "hidden" }} onClick={onClick}>
      <RotateCcw size={15} strokeWidth={2.4} aria-hidden="true" /> Сбросить
    </button>
  );
}

/** Build a sentence: a word flies from the bank into the line and back on tap. */
function OrderAnswer({ options = [], value, onChange, disabled, graded }) {
  const uid = useId();
  const [bank] = useState(() => shuffled(options));
  const locked = disabled || !!graded;
  const values = Array.isArray(value) ? value : [];
  // Which bank slot each placed word came from. Words can repeat, so every
  // occurrence claims its own slot.
  const placed = [];
  values.forEach((word) => {
    const index = bank.findIndex((item, i) => item === word && !placed.includes(i));
    if (index >= 0) placed.push(index);
  });

  function emit(indices) {
    tapHaptic();
    onChange(indices.map((index) => bank[index]));
  }

  return (
    <div className="written-answer">
      <motion.div layoutScroll className="written-answer__exercise order">
        <div className={`order__line ${graded ? `is-${graded}` : ""}`} aria-label="Собранное предложение" aria-live="polite">
          {!placed.length && <span className="order__placeholder">Нажимай на слова ниже</span>}
          {placed.map((bankIndex, position) => (
            <motion.button
              type="button"
              key={bankIndex}
              layoutId={`${uid}-${bankIndex}`}
              transition={TILE_MOVE}
              className="word-tile"
              style={{ "--i": position }}
              disabled={locked}
              aria-label={`Убрать «${bank[bankIndex]}», позиция ${position + 1}`}
              onClick={() => emit(placed.filter((_, i) => i !== position))}
            >
              {bank[bankIndex]}
            </motion.button>
          ))}
        </div>
        <div className="order__bank" aria-label="Слова для предложения">
          {bank.map((word, bankIndex) => (
            <span className="order__slot" key={bankIndex}>
              {/* The slot keeps its size and shows a hole while its word is in the sentence. */}
              <span className="word-tile word-tile--ghost" aria-hidden="true">{word}</span>
              {!placed.includes(bankIndex) && (
                <motion.button
                  type="button"
                  layoutId={`${uid}-${bankIndex}`}
                  transition={TILE_MOVE}
                  className="word-tile"
                  disabled={locked}
                  onClick={() => emit([...placed, bankIndex])}
                >
                  {word}
                </motion.button>
              )}
            </span>
          ))}
        </div>
        {!locked && <ResetButton visible={placed.length > 0} onClick={() => emit([])} />}
      </motion.div>
    </div>
  );
}

/**
 * Match pairs: tap one side, then the other — in either order. A linked pair
 * shares a number and a colour, so the link never depends on colour alone.
 */
function MatchAnswer({ options = [], pairChoices = [], value, onChange, disabled, graded, acceptedAnswers }) {
  const [bank] = useState(() => shuffled(pairChoices));
  const [active, setActive] = useState(null); // { side: "left" | "right", index }
  const locked = disabled || !!graded;
  const values = options.map((_, index) => (Array.isArray(value) ? value[index] : "") || "");
  const verdicts = partVerdicts(graded, values, acceptedAnswers);

  function link(leftIndex, word) {
    const next = values.map((item) => (item === word ? "" : item));
    next[leftIndex] = word;
    tapHaptic();
    onChange(next);
    setActive(null);
  }

  function unlink(leftIndex) {
    onChange(values.map((item, index) => (index === leftIndex ? "" : item)));
  }

  function tapLeft(index) {
    if (active?.side === "right") return link(index, bank[active.index]);
    // Tapping a linked tile breaks the pair and leaves it selected for a new one.
    if (values[index]) unlink(index);
    setActive(active?.side === "left" && active.index === index ? null : { side: "left", index });
  }

  function tapRight(index) {
    if (active?.side === "left") return link(active.index, bank[index]);
    const owner = values.indexOf(bank[index]);
    if (owner >= 0) unlink(owner);
    setActive(active?.side === "right" && active.index === index ? null : { side: "right", index });
  }

  function verdictClass(leftIndex) {
    if (!verdicts || leftIndex < 0) return "";
    return verdicts[leftIndex] ? "is-correct" : "is-wrong";
  }

  return (
    <div className="written-answer">
      <div className="written-answer__exercise">
        <div className="pairs">
          {options.map((term, row) => {
            const word = bank[row];
            const owner = values.indexOf(word);
            return [
              <button
                type="button"
                key={`l${row}`}
                className={`pair-tile ${verdictClass(row)}`}
                style={{ "--i": row }}
                data-pair={values[row] ? row % 8 : undefined}
                aria-pressed={active?.side === "left" && active.index === row}
                aria-label={values[row] ? `${term}, пара: ${values[row]}` : term}
                disabled={locked}
                onClick={() => tapLeft(row)}
              >
                <b className="pair-tile__num" aria-hidden="true">{row + 1}</b>
                <span>{term}</span>
              </button>,
              word !== undefined && (
                <button
                  type="button"
                  key={`r${row}`}
                  className={`pair-tile pair-tile--right ${verdictClass(owner)}`}
                  style={{ "--i": row }}
                  data-pair={owner >= 0 ? owner % 8 : undefined}
                  aria-pressed={active?.side === "right" && active.index === row}
                  aria-label={owner >= 0 ? `${word}, пара: ${options[owner]}` : word}
                  disabled={locked}
                  onClick={() => tapRight(row)}
                >
                  <b className="pair-tile__num" aria-hidden="true">{owner >= 0 ? owner + 1 : ""}</b>
                  <span>{word}</span>
                </button>
              ),
            ];
          })}
        </div>
        {!locked && <ResetButton visible={values.some(Boolean)} onClick={() => { onChange([]); setActive(null); }} />}
      </div>
    </div>
  );
}
