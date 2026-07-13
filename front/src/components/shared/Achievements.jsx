import { Trophy, Lock } from "lucide-react";
import "./Achievements.css";

/**
 * Achievement showcase with tiers (bronze/silver/gold/diamond), earned/locked
 * states, and progress bars for in-progress badges.
 * Set `compact` to cap the number shown (with a "+N ещё" tail).
 */
export default function Achievements({ items, compact }) {
  const earned = items.filter((a) => a.earned).length;
  const shown = compact ? items.slice(0, compact) : items;
  const rest = compact ? items.length - shown.length : 0;

  return (
    <div className="achv">
      <div className="achv__summary">
        <span className="achv__trophy">
          <Trophy size={18} strokeWidth={2.6} />
        </span>
        <span className="achv__count font-display">{earned}</span>
        <span className="achv__of">{earned === items.length ? "получено" : `из ${items.length} наград`}</span>
      </div>

      <div className="achv__grid">
        {shown.map((a) => (
          <div
            key={a.id}
            className={`ach ach--${a.tier ?? "silver"} ${a.earned ? "ach--on" : "ach--off"}`}
            title={a.desc}
          >
            <span className="ach__medal">
              <span className="ach__icon" aria-hidden="true">
                {a.icon}
              </span>
              {!a.earned && (
                <span className="ach__lock" aria-hidden="true">
                  <Lock size={11} strokeWidth={2.8} />
                </span>
              )}
            </span>
            <span className="ach__name">{a.name}</span>
            <span className="ach__desc">{a.desc}</span>
            {!a.earned && a.progress && (
              <div className="ach__progress">
                <div className="ach__progress-track">
                  <div
                    className="ach__progress-fill"
                    style={{ width: `${(a.progress.cur / a.progress.max) * 100}%` }}
                  />
                </div>
                <span className="ach__progress-label">
                  {a.progress.cur}/{a.progress.max}
                </span>
              </div>
            )}
            {a.earned && <span className="ach__ribbon">получено</span>}
          </div>
        ))}
      </div>

      {rest > 0 && <div className="achv__more">и ещё {rest} наград</div>}
    </div>
  );
}
