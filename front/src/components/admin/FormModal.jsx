import { useEffect } from "react";
import { X } from "lucide-react";
import useBodyScrollLock from "../../hooks/useBodyScrollLock";
import "./FormModal.css";

/**
 * A focused, self-contained modal for admin create/edit forms.
 *
 * Every previous inline form overlay (users, students, tasks, homework) lacked
 * a visible way out — you could only dismiss it by hitting a sliver of backdrop,
 * which on a phone meant reopening the whole Mini App. This gives all of them one
 * consistent shell: a titled sticky header with a real close button, a scrollable
 * body that never pushes content off-screen, Escape-to-close, and a locked page
 * behind it so the mobile tab bar can't be scrolled away.
 *
 * Props:
 *   title    — heading text
 *   eyebrow  — optional small label + icon above the title ({ icon, text })
 *   onClose  — () => void
 *   size     — "md" (default) | "lg"
 */
export default function FormModal({ title, eyebrow, onClose, size = "md", children }) {
  useBodyScrollLock();

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const EyebrowIcon = eyebrow?.icon;

  return (
    <div
      className="fmodal"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        className={`fmodal__dialog fmodal__dialog--${size}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="fmodal__head">
          <div className="fmodal__titles">
            {eyebrow && (
              <p className="fmodal__eyebrow">
                {EyebrowIcon && <EyebrowIcon size={15} strokeWidth={2.6} />}
                {eyebrow.text}
              </p>
            )}
            <h2 className="fmodal__title">{title}</h2>
          </div>
          <button className="fmodal__close" type="button" onClick={onClose} aria-label="Закрыть">
            <X size={20} strokeWidth={2.6} />
          </button>
        </header>
        <div className="fmodal__body">{children}</div>
      </section>
    </div>
  );
}
