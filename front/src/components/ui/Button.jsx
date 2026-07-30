import "./Button.css";

/**
 * variant: primary | accent | soft | ghost | danger
 * size: sm | md | lg
 */
export default function Button({
  as: Tag = "button",
  variant = "primary",
  size = "md",
  full = false,
  icon: Icon,
  iconRight: IconRight,
  loading = false,
  disabled = false,
  onClick,
  className = "",
  children,
  ...props
}) {
  const isNative = Tag === "button";
  return (
    <Tag
      className={`btn btn--${variant} btn--${size} ${full ? "btn--full" : ""} ${className}`}
      disabled={isNative ? disabled || loading : undefined}
      aria-disabled={!isNative && (disabled || loading) ? true : undefined}
      aria-busy={loading || undefined}
      onClick={(event) => {
        if (disabled || loading) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
      data-loading={loading || undefined}
      {...props}
    >
      {loading && <span className="btn__spinner" aria-hidden="true" />}
      <span className="btn__content">
        {Icon && <Icon size={size === "sm" ? 16 : 18} strokeWidth={2.4} aria-hidden="true" />}
        {children && <span>{children}</span>}
        {IconRight && <IconRight size={18} strokeWidth={2.4} aria-hidden="true" />}
      </span>
    </Tag>
  );
}
