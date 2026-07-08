import { Check, X } from "lucide-react";
import "./OptionList.css";

/**
 * Renders answer options with selection + optional graded state.
 * state: null (answering) | "correct" | "wrong"
 * selected: index | null ; correctIndex used only when graded.
 */
export default function OptionList({ options, selected, onSelect, state, correctIndex, disabled }) {
  return (
    <ul className="optlist">
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
              onClick={() => onSelect(i)}
              disabled={disabled}
            >
              <span className="opt__marker">{String.fromCharCode(1040 + i)}</span>
              <span className="opt__text">{opt}</span>
              {mod === "correct" && <Check className="opt__icon" size={20} strokeWidth={3} />}
              {mod === "wrong" && <X className="opt__icon" size={20} strokeWidth={3} />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
