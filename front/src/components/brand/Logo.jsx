/** EDme wordmark — the real brand logo (blue "ED" + book/play mark + orange "me"). */
import logoUrl from "/image-Photoroom.png";

// Intrinsic PNG is 339×157 (≈2.16:1). `withText={false}` crops to the book mark
// in the middle third so icon-only spots (favicons, tight headers) stay balanced.
export default function Logo({ height = 32, withText = true }) {
  if (!withText) {
    // Show only the central book mark by scaling up and clipping to a square.
    return (
      <span
        aria-label="EDme"
        role="img"
        style={{
          display: "inline-block",
          width: height,
          height,
          backgroundImage: `url(${logoUrl})`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
          backgroundSize: `${height * 2.16}px auto`,
        }}
      />
    );
  }
  return (
    <img
      src={logoUrl}
      alt="EDme"
      height={height}
      style={{ height, width: "auto", display: "block" }}
    />
  );
}
