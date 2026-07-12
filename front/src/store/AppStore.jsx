import { createContext, useContext, useState, useCallback, useMemo } from "react";

const AppContext = createContext(null);

// Neutral starting state — NO fabricated content. Real values arrive via
// hydrate() from the backend. `topics` stays empty until a diagnostic assesses
// them, so the knowledge map / weak-topics never show made-up data.
const EMPTY_PROFILE = {
  name: "",
  grade: null,
  subject: "",
  pet: { species: "fox", name: "Рыжик" },
  coins: 0,
  xp: 0,
  level: 1,
  xpForNext: 400,
  xpFromLevel: 0,
  streak: 0,
  streakFreezeUsed: false,
  streakLastDoneOn: null,
  diagnosticDone: false,
};

export function AppProvider({ children }) {
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [topics, setTopics] = useState([]);
  const [homework, setHomework] = useState([]);
  const [ownedItems, setOwnedItems] = useState([]);
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

  const setPetName = useCallback((name) => {
    setProfile((p) => ({ ...p, pet: { ...p.pet, name } }));
  }, []);

  const clearReward = useCallback(() => setReward(null), []);

  const hydrate = useCallback((data) => {
    if (data.profile) {
      setProfile((current) => ({ ...current, ...data.profile, pet: { ...current.pet, ...data.profile.pet } }));
      setOwnedItems(data.profile.ownedItems ?? []);
    }
    if (data.topics) setTopics(data.topics);
  }, []);

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
      setPetName,
      clearReward,
      hydrate,
    }),
    [profile, topics, homework, ownedItems, reward, awardXp, spendCoins, buyItem, bumpStreak, setTopicMastery, completeHomework, setPetSpecies, setPetName, clearReward, hydrate]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
