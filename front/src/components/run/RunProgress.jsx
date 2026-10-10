import "./RunProgress.css";

// Above this many questions individual segments get too thin to read.
const SEGMENT_LIMIT = 12;

/**
 * Progress of a run. Short runs show one segment per question, coloured by its
 * result; long ones (the diagnostic) fall back to a single filling bar.
 *
 * marks: result per question — "correct" | "wrong" | "answered" | undefined
 * current: index (within marks) of the question on screen
 */
export default function RunProgress({ marks, current, counter, label = "Прогресс" }) {
  const done = marks.filter(Boolean).length;
  const segmented = marks.length <= SEGMENT_LIMIT;
  return (
    <div className="runprog">
      <div
        className={`runprog__track ${segmented ? "runprog__track--segments" : ""}`}
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={marks.length}
        aria-valuenow={done}
      >
        {segmented
          ? marks.map((mark, index) => <i key={index} className={`runprog__seg ${mark ? `is-${mark}` : ""} ${index === current ? "is-current" : ""}`} />)
          : <i className="runprog__fill" style={{ transform: `scaleX(${marks.length ? done / marks.length : 0})` }} />}
      </div>
      {counter && <span className="runprog__count font-display">{counter}</span>}
    </div>
  );
}
