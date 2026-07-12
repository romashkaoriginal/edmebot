import "./StatPill.css";

/** Small game-stat chip used in the header: streak, XP, level. */
export default function StatPill({ icon: Icon, value, tone = "accent", label }) {
  return (
    <div className={`statpill statpill--${tone}`} title={label} aria-label={`${label}: ${value}`}>
      {Icon && <Icon size={16} strokeWidth={2.6} aria-hidden="true" />}
      <span className="statpill__value font-display">{value}</span>
    </div>
  );
}

/**
 * Streak pill using a literal flame emoji so its meaning ("did you practice
 * today?") reads at a glance: grayscale + still when not done today, full
 * color + a brief pulse animation when today's practice is done.
 */
export function StreakPill({ value, doneToday }) {
  return (
    <div
      className={`statpill statpill--streak ${doneToday ? "statpill--lit" : ""}`}
      title={doneToday ? "Стрик горит — сегодня позанимался" : "Стрик — позанимайся сегодня, чтобы не погас"}
      aria-label={`Стрик ${value} ${doneToday ? "(сегодня выполнено)" : "(сегодня ещё не выполнено)"}`}
    >
      <span className="statpill__flame" aria-hidden="true">🔥</span>
      <span className="statpill__value font-display">{value}</span>
    </div>
  );
}
