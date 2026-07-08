import { createContext, useContext, useState, useCallback, useMemo } from "react";
import { initialProfile, topics as seedTopics, homework as seedHw } from "../data/mock";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [profile, setProfile] = useState(initialProfile);
  const [topics, setTopics] = useState(seedTopics);
  const [homework, setHomework] = useState(seedHw);
  const [ownedItems, setOwnedItems] = useState(["s3"]); // starts with a scarf
  const [reward, setReward] = useState(null); // celebration overlay payload

  // Award XP + coins; handle level-up. Returns the level-up flag.
  const awardXp = useCallback((amount, coins = 0) => {
    let leveledUp = false;
    setProfile((p) => {
      let xp = p.xp + amount;
      let level = p.level;
      let xpFromLevel = p.xpFromLevel;
      let xpForNext = p.xpForNext;
      while (xp >= xpForNext) {
        level += 1;
        leveledUp = true;
        xpFromLevel = xpForNext;
        xpForNext = xpForNext + 400 + level * 40;
      }
      return { ...p, xp, level, xpFromLevel, xpForNext, coins: p.coins + coins };
    });
    setReward({ type: leveledUp ? "levelup" : "xp", amount, coins });
    return leveledUp;
  }, []);

  const spendCoins = useCallback((amount) => {
    let ok = false;
    setProfile((p) => {
      if (p.coins >= amount) {
        ok = true;
        return { ...p, coins: p.coins - amount };
      }
      return p;
    });
    return ok;
  }, []);

  const buyItem = useCallback(
    (item) => {
      if (ownedItems.includes(item.id)) return false;
      const ok = spendCoins(item.price);
      if (ok) setOwnedItems((s) => [...s, item.id]);
      return ok;
    },
    [ownedItems, spendCoins]
  );

  const bumpStreak = useCallback(() => {
    setProfile((p) => ({ ...p, streak: p.streak + 1 }));
  }, []);

  const setTopicMastery = useCallback((topicId, delta) => {
    setTopics((ts) =>
      ts.map((t) => {
        if (t.id !== topicId) return t;
        const mastery = Math.max(0, Math.min(100, t.mastery + delta));
        const status = mastery >= 75 ? "green" : mastery >= 50 ? "yellow" : "red";
        return { ...t, mastery, status };
      })
    );
  }, []);

  const completeHomework = useCallback((id) => {
    setHomework((hw) => hw.map((h) => (h.id === id ? { ...h, status: "done" } : h)));
  }, []);

  const setPetSpecies = useCallback((species) => {
    setProfile((p) => ({ ...p, pet: { ...p.pet, species } }));
  }, []);

  const clearReward = useCallback(() => setReward(null), []);

  const value = useMemo(
    () => ({
      profile,
      topics,
      homework,
      ownedItems,
      reward,
      awardXp,
      spendCoins,
      buyItem,
      bumpStreak,
      setTopicMastery,
      completeHomework,
      setPetSpecies,
      clearReward,
    }),
    [profile, topics, homework, ownedItems, reward, awardXp, spendCoins, buyItem, bumpStreak, setTopicMastery, completeHomework, setPetSpecies, clearReward]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
