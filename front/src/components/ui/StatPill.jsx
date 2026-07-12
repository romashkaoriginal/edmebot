import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
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
 * color + a brief pulse animation when today's practice is done. Tapping it
 * opens a small popover explaining what "lights the flame".
 */
export function StreakPill({ value, doneToday }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("pointerdown", onOutside);
    return () => document.removeEventListener("pointerdown", onOutside);
  }, [open]);

  return (
    <div className="statpill-wrap" ref={ref}>
      <button
        type="button"
        className={`statpill statpill--streak ${doneToday ? "statpill--lit" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={`Стрик ${value} ${doneToday ? "(сегодня выполнено)" : "(сегодня ещё не выполнено)"}`}
      >
        <span className="statpill__flame" aria-hidden="true">🔥</span>
        <span className="statpill__value font-display">{value}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="statpill__popover"
            role="status"
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            {doneToday
              ? "Стрик горит! Ты уже позанимался сегодня 🔥"
              : "Реши хотя бы одно задание сегодня, чтобы зажечь стрик."}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
