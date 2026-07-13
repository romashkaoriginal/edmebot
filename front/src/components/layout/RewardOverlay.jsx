import { useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Zap, Coins, ArrowUp } from "lucide-react";
import { useApp } from "../../store/AppStore";
import "./RewardOverlay.css";

export default function RewardOverlay() {
  const { reward, clearReward, profile } = useApp();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!reward) return;
    const t = setTimeout(clearReward, reward.type === "levelup" ? 2600 : 1500);
    return () => clearTimeout(t);
  }, [reward, clearReward]);

  return (
    <AnimatePresence initial={false}>
      {reward && (
        <motion.div
          className="reward"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -28 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -18 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          onClick={clearReward}
          role="status"
          aria-live="polite"
        >
          <div className={`reward__card reward__card--${reward.type}`}>
            {reward.type === "levelup" ? (
              <>
                <div className="reward__burst">
                  <ArrowUp size={20} strokeWidth={3} />
                </div>
                <div className="reward__copy"><div className="reward__title">Новый уровень</div><div className="reward__subtitle">Теперь у тебя {profile.level} уровень</div></div>
              </>
            ) : (
              <div className="reward__copy"><div className="reward__title">Награда начислена</div><div className="reward__subtitle">Верный ответ укрепил прогресс</div></div>
            )}
            <div className="reward__gains">
              <span className="reward__gain reward__gain--xp">
                <Zap size={16} strokeWidth={2.6} /> +{reward.amount} XP
              </span>
              {reward.coins > 0 && (
                <span className="reward__gain reward__gain--coins">
                  <Coins size={16} strokeWidth={2.6} /> +{reward.coins}
                </span>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
