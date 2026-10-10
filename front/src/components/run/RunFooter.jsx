import { useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, BookOpen, Check, Coins, PencilLine, X, Zap } from "lucide-react";
import Button from "../ui/Button";
import PetAvatar from "../pet/PetAvatar";
import "./RunFooter.css";

const MARK = { correct: Check, wrong: X, answered: PencilLine };
// Rewards are the one place a bounce is allowed (see DESIGN.md → Motion).
const POP = { type: "spring", duration: 0.4, bounce: 0.35 };

/**
 * Bottom bar of a run screen: the pet reacts on the left, contextual help sits
 * on the right, and a single primary action below drives the whole flow
 * (Проверить → Дальше). Its height is the same in every state, so grading an
 * answer never shifts the question above it.
 *
 * status: null (answering) | "correct" | "wrong" | "answered"
 * fresh: the answer was graded just now — replaying a reaction on a question
 *        the student merely navigated back to would be noise.
 * primary: { label, onClick, disabled, loading }
 */
export default function RunFooter({ status = null, title, detail, award, combo = 0, pet = null, fresh = false, assist = null, onWhy, onBack, primary }) {
  useEffect(() => {
    function onKey(event) {
      if (event.key !== "Enter" || event.defaultPrevented || event.repeat) return;
      // A focused control keeps its own Enter; a blank that moves focus to the
      // next blank has already called preventDefault.
      if (event.target instanceof Element && event.target.closest("button, a, textarea, [role='dialog']")) return;
      if (primary.disabled || primary.loading) return;
      event.preventDefault();
      primary.onClick();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const Mark = status ? MARK[status] : null;
  const reaction = !fresh ? null : status === "correct" ? "cheer" : status === "wrong" ? "wobble" : null;
  const chipMotion = { initial: fresh ? { opacity: 0, scale: 0.7 } : false, animate: { opacity: 1, scale: 1 }, transition: POP };
  const hasChips = status === "correct" && (combo >= 2 || award?.gained > 0 || award?.coins > 0);

  return (
    <footer className={`runfoot ${status ? `runfoot--${status}` : ""}`}>
      <div className="runfoot__coach">
        {pet
          ? <PetAvatar className="runfoot__pet" species={pet} mood={status === "correct" ? "happy" : "idle"} reaction={reaction} size={48} decorative />
          : Mark && <span className="runfoot__mark" aria-hidden="true"><Mark size={22} strokeWidth={3} /></span>}
        <div className="runfoot__msg" role="status" aria-live="polite">
          <motion.div
            key={status ?? "idle"}
            className="runfoot__msg-inner"
            initial={status && fresh ? { opacity: 0, y: 8 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
          >
            <strong className={`runfoot__title ${status ? "" : "runfoot__title--idle"}`}>{title}</strong>
            {detail && <span className="runfoot__detail">{detail}</span>}
            {hasChips && (
              <span className="runfoot__chips">
                {combo >= 2 && <motion.span className="runfoot__chip runfoot__chip--combo" {...chipMotion}><Zap size={13} strokeWidth={2.6} aria-hidden="true" /> {combo} подряд</motion.span>}
                {award?.gained > 0 && <motion.span className="runfoot__chip" {...chipMotion}>+{award.gained} опыта</motion.span>}
                {award?.coins > 0 && <motion.span className="runfoot__chip" {...chipMotion}><Coins size={13} aria-hidden="true" /> +{award.coins}</motion.span>}
              </span>
            )}
          </motion.div>
        </div>
        <div className="runfoot__side">
          {status
            ? onWhy && <button type="button" className="runfoot__why" onClick={onWhy}><BookOpen size={16} strokeWidth={2.4} aria-hidden="true" /> Разбор</button>
            : assist}
        </div>
      </div>
      <div className="runfoot__actions">
        {onBack && <Button variant="soft" className="runfoot__back" icon={ArrowLeft} aria-label="Предыдущий вопрос" onClick={onBack} />}
        <Button size="lg" full className="runfoot__primary" iconRight={status ? ArrowRight : undefined} loading={primary.loading} disabled={primary.disabled} onClick={primary.onClick}>
          {primary.label}
        </Button>
      </div>
    </footer>
  );
}
