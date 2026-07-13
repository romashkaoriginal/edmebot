export function answerHaptic(correct) {
  const telegramHaptics = window.Telegram?.WebApp?.HapticFeedback;
  if (telegramHaptics?.notificationOccurred) {
    telegramHaptics.notificationOccurred(correct ? "success" : "error");
    return;
  }
  if (navigator.vibrate) navigator.vibrate(correct ? [24, 32, 42] : [70, 35, 30]);
}
