/** EDme wordmark — blue "ED" + book with orange pages + orange "me". */
export default function Logo({ height = 32, withText = true }) {
  const w = withText ? height * 2.6 : height * 1.1;
  return (
    <svg
      height={height}
      width={w}
      viewBox={withText ? "0 0 130 50" : "0 0 55 50"}
      fill="none"
      role="img"
      aria-label="EDme"
    >
      {withText && (
        <text
          x="0"
          y="37"
          fontFamily="var(--font-display)"
          fontWeight="800"
          fontSize="34"
          letterSpacing="-1"
          fill="var(--primary)"
        >
          ED
        </text>
      )}
      {/* book mark */}
      <g transform={withText ? "translate(46 8)" : "translate(2 8)"}>
        <path
          d="M2 4 C2 2 3 1 5 1 L18 1 C24 1 28 5 28 12 L28 30 C28 33 25 34 23 32 L4 20 C2 19 2 17 2 15 Z"
          fill="var(--primary)"
        />
        <path d="M12 3 L26 12 M13 8 L27 17 M14 13 L28 22" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      </g>
      {withText && (
        <text
          x="80"
          y="37"
          fontFamily="var(--font-display)"
          fontWeight="800"
          fontSize="34"
          letterSpacing="-1"
          fill="var(--accent)"
        >
          me
        </text>
      )}
    </svg>
  );
}
