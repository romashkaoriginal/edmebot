import { playAnswerSound } from "./sounds";

// Every graded answer goes through here, so the sound rides along with the buzz.
export function answerHaptic(correct) {
  playAnswerSound(correct);
  const telegramHaptics = window.Telegram?.WebApp?.HapticFeedback;
  if (telegramHaptics?.notificationOccurred) {
    telegramHaptics.notificationOccurred(correct ? "success" : "error");
    return;
  }
  if (navigator.vibrate) navigator.vibrate(correct ? [24, 32, 42] : [70, 35, 30]);
}

/** Light tick for picking an option, placing a word or linking a pair. */
export function tapHaptic() {
  const telegramHaptics = window.Telegram?.WebApp?.HapticFeedback;
  if (telegramHaptics?.selectionChanged) {
    telegramHaptics.selectionChanged();
    return;
  }
  if (navigator.vibrate) navigator.vibrate(8);
}
