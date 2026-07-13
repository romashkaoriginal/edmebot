import "./ProgressBar.css";

/** tone: primary | accent | success | xp */
export default function ProgressBar({ value = 0, max = 100, tone = "primary", size = "md", label, ariaLabel }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={`pbar pbar--${tone} pbar--${size}`}>
      {label && (
        <div className="pbar__label">
          <span>{label}</span>
          <span className="pbar__value">
            {value}
            <span className="pbar__max">/{max}</span>
          </span>
        </div>
      )}
      <div
        className="pbar__track"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={ariaLabel ?? label}
      >
        <div className="pbar__fill" style={{ transform: `scaleX(${pct / 100})` }} />
      </div>
    </div>
  );
}
