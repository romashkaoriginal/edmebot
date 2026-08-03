import { createContext, useContext, useState, useCallback, useMemo } from "react";
import { laterOnboardingStep } from "../utils/onboarding";

const AppContext = createContext(null);

// Neutral starting state — NO fabricated content. Real values arrive via
// hydrate() from the backend. `topics` stays empty until a diagnostic assesses
// them, so the knowledge map / weak-topics never show made-up data.
const EMPTY_PROFILE = {
  name: "",
  grade: null,
  subject: "",
  subjects: [],
  // Safe default: treat an unhydrated profile as not-yet-active so nothing
  // flashes the full nav before the real status is known.
  status: "pending",
  accessKind: null,
  accessUntil: null,
  trialStartedAt: null,
  trialUsed: false,
  pet: { species: "fox", name: "Рыжик" },
  petSelected: false,
  petBond: 0,
  petStats: { satiety: 80, mood: 80 },
  foodInventory: {},
  onboardingStep: "subject",
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
  const [hydrated, setHydrated] = useState(false);

  const setPetSpecies = useCallback((species) => {
    setProfile((p) => ({ ...p, pet: { ...p.pet, species } }));
  }, []);

  const setPetName = useCallback((name) => {
    setProfile((p) => ({ ...p, pet: { ...p.pet, name } }));
  }, []);

  const hydrate = useCallback((data) => {
    if (data.profile) {
      setProfile((current) => ({
        ...current,
        ...data.profile,
        // Several sections return the whole profile, and some of those
        // responses are cached (GET /api/pet is prefetched before the
        // diagnostic finishes). Replaying one of them must not walk the
        // student back to a step they already completed: that bounced them
        // from the pet choice to the subject picker, where /profile/onboard
        // then 409'd because the server knew they were past it.
        onboardingStep: laterOnboardingStep(current.onboardingStep, data.profile.onboardingStep),
        pet: { ...current.pet, ...data.profile.pet },
      }));
    }
    if (data.topics) setTopics(data.topics);
    setHydrated(true);
  }, []);

  const value = useMemo(
    () => ({
      profile,
      topics,
      ownedItems: profile.ownedItems ?? [],
      hydrated,
      setPetSpecies,
      setPetName,
      hydrate,
    }),
    [profile, topics, hydrated, setPetSpecies, setPetName, hydrate]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// oxlint-disable-next-line react/only-export-components
export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
