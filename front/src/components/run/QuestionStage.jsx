import { AnimatePresence, motion } from "framer-motion";
import Card from "../ui/Card";
import useFitScale from "../../hooks/useFitScale";

// Direction-aware: the next question arrives from the right, "back" from the left.
// Short and offset-only on purpose — a student sees this dozens of times a session.
const variants = {
  enter: (direction) => ({ opacity: 0, x: direction * 28 }),
  center: { opacity: 1, x: 0, transition: { duration: 0.26, ease: [0.23, 1, 0.32, 1] } },
  exit: (direction) => ({ opacity: 0, x: direction * -20, transition: { duration: 0.13, ease: [0.4, 0, 1, 1] } }),
};

/**
 * Holds one question at a time and animates the swap between them.
 * `overlay` renders above the card without counting towards its fit-scale
 * measurement (confetti would otherwise read as overflowing content).
 */
export default function QuestionStage({ stepKey, direction = 1, overlay = null, children }) {
  return (
    <div className="run__stage">
      <AnimatePresence initial={false} custom={direction}>
        <motion.div key={stepKey} className="run__stage-item" custom={direction} variants={variants} initial="enter" animate="center" exit="exit">
          {children}
        </motion.div>
      </AnimatePresence>
      {overlay}
    </div>
  );
}

/** The question card. Owns its own fit-scale ref so two cards can coexist mid-transition. */
export function QuestionCard({ graded, fitDeps = [], children }) {
  const fitRef = useFitScale(fitDeps);
  return <Card ref={fitRef} className={`run__question ${graded ? `run__question--${graded}` : ""}`} pad="lg">{children}</Card>;
}
