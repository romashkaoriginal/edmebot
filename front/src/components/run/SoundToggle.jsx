import { useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { playAnswerSound, setSoundEnabled, soundEnabled } from "../../utils/sounds";

/** Round mute button for the run screens' top bar. */
export default function SoundToggle() {
  const [on, setOn] = useState(soundEnabled);
  const Icon = on ? Volume2 : VolumeX;

  function toggle() {
    const next = !on;
    setSoundEnabled(next);
    setOn(next);
    // Unlocks audio on this tap and lets the student hear what they switched on.
    if (next) playAnswerSound(true);
  }

  return (
    <button type="button" className="run__close" onClick={toggle} aria-pressed={on} aria-label={on ? "Выключить звук" : "Включить звук"}>
      <Icon size={21} strokeWidth={2.3} />
    </button>
  );
}
