import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import "./OptionList.css";

/**
 * Renders answer options with selection + optional graded state.
 * state: null (answering) | "correct" | "wrong"
 * selected: index | null ; correctIndex used only when graded.
 * The result itself is announced by the run footer, not here.
 */
export default function OptionList({ options, selected, onSelect, state, correctIndex, disabled }) {
  // A question restored already graded must not replay the pulse/shake.
  const [settled] = useState(!!state);

  // 1–6 pick an option on a physical keyboard.
  useEffect(() => {
    if (disabled) return undefined;
    function onKey(event) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.target instanceof Element && event.target.closest("input, textarea, [role='dialog']")) return;
      const index = Number(event.key) - 1;
      if (Number.isInteger(index) && index >= 0 && index < options.length) onSelect(index);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [disabled, onSelect, options.length]);

  return (
    <ul className={`optlist ${settled ? "optlist--settled" : ""}`} data-fit-clip>
      {options.map((opt, i) => {
        const isSelected = selected === i;
        let mod = "";
        if (state) {
          if (i === correctIndex) mod = "correct";
          else if (isSelected) mod = "wrong";
          else mod = "dim";
        } else if (isSelected) {
          mod = "selected";
        }
        return (
          <li key={i}>
            <button
              type="button"
              className={`opt opt--${mod || "idle"}`}
              style={{ "--i": i }}
              onClick={() => onSelect(i)}
              disabled={disabled}
              aria-pressed={isSelected}
            >
              <span className="opt__marker">{String.fromCharCode(1040 + i)}</span>
              <span className="opt__text">{opt}</span>
              {mod === "correct" && <Check aria-hidden="true" className="opt__icon" size={20} strokeWidth={3} />}
              {mod === "wrong" && <X aria-hidden="true" className="opt__icon" size={20} strokeWidth={3} />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
