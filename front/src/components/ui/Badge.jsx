import "./Badge.css";

/** tone: primary | accent | success | warning | danger | neutral */
export default function Badge({ tone = "neutral", icon: Icon, className = "", children }) {
  return (
    <span className={`badge badge--${tone} ${className}`}>
      {Icon && <Icon size={13} strokeWidth={2.6} aria-hidden="true" />}
      {children}
    </span>
  );
}
