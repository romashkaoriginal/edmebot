import { useEffect } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";

const EASE = [0.23, 1, 0.32, 1];

/** Result ring for a finished run: the arc draws in while the number counts up. */
export default function ScoreRing({ pct }) {
  const reduceMotion = useReducedMotion();
  const tone = pct >= 80 ? "good" : pct >= 50 ? "mid" : "low";
  const value = useMotionValue(reduceMotion ? pct : 0);
  const label = useTransform(value, (current) => `${Math.round(current)}%`);

  useEffect(() => {
    if (reduceMotion) {
      value.set(pct);
      return undefined;
    }
    const controls = animate(value, pct, { duration: 0.9, delay: 0.15, ease: EASE });
    return () => controls.stop();
  }, [pct, reduceMotion, value]);

  return (
    <div className={`score-ring score-ring--${tone}`} role="img" aria-label={`Результат: ${pct}%`}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle className="score-ring__track" cx="50" cy="50" r="42" />
        {pct > 0 && (
          <g transform="rotate(-90 50 50)">
            <motion.circle
              className="score-ring__value"
              cx="50"
              cy="50"
              r="42"
              initial={{ pathLength: reduceMotion ? pct / 100 : 0 }}
              animate={{ pathLength: pct / 100 }}
              transition={{ duration: reduceMotion ? 0 : 0.9, delay: reduceMotion ? 0 : 0.15, ease: EASE }}
            />
          </g>
        )}
      </svg>
      <motion.span className="score-ring__num font-display" aria-hidden="true">{label}</motion.span>
    </div>
  );
}
