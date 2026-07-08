import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Coins, ArrowUp } from "lucide-react";
import { useApp } from "../../store/AppStore";
import "./RewardOverlay.css";

export default function RewardOverlay() {
  const { reward, clearReward, profile } = useApp();

  useEffect(() => {
    if (!reward) return;
    const t = setTimeout(clearReward, reward.type === "levelup" ? 2600 : 1500);
    return () => clearTimeout(t);
  }, [reward, clearReward]);

  return (
    <AnimatePresence>
      {reward && (
        <motion.div
          className="reward"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={clearReward}
          role="status"
          aria-live="polite"
        >
          <motion.div
            className={`reward__card reward__card--${reward.type}`}
            initial={{ scale: 0.85, y: 12, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", duration: 0.5, bounce: 0.35 }}
          >
            {reward.type === "levelup" ? (
              <>
                <div className="reward__burst">
                  <ArrowUp size={40} strokeWidth={3} />
                </div>
                <div className="reward__title font-display">Новый уровень!</div>
                <div className="reward__level font-display">{profile.level}</div>
              </>
            ) : (
              <div className="reward__title font-display">Отлично!</div>
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
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
