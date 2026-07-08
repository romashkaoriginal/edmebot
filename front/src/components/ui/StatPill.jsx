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
