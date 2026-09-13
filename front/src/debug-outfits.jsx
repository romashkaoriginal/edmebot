import { useState, useRef, useCallback } from "react";
import { createRoot } from "react-dom/client";
import "./styles/tokens.css";

// Static owl body pieces, copied straight from PetAvatar.jsx's <Owl/> (non-interactive reference).
const OWL_BODY = (
  <g>
    <defs>
      <radialGradient id="fur" cx="42%" cy="32%" r="72%">
        <stop offset="0%" stopColor="oklch(0.62 0.16 262)" />
        <stop offset="100%" stopColor="oklch(0.46 0.18 263)" />
      </radialGradient>
      <linearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="oklch(0.58 0.17 262)" />
        <stop offset="100%" stopColor="oklch(0.44 0.18 263)" />
      </linearGradient>
    </defs>
    <ellipse cx="60" cy="113" rx="30" ry="5" fill="oklch(0.4 0.05 262 / 0.14)" />
    <path d="M60 20 C34 20 26 44 28 70 C30 96 90 96 92 70 C94 44 86 20 60 20 Z" fill="url(#fur)" />
    <path d="M30 58 C24 66 26 84 34 90 C34 78 34 68 36 60 Z" fill="url(#bodyGrad)" />
    <path d="M90 58 C96 66 94 84 86 90 C86 78 86 68 84 60 Z" fill="url(#bodyGrad)" />
    <path d="M38 24 L32 8 L50 22 Z" fill="oklch(0.44 0.18 263)" />
    <path d="M82 24 L88 8 L70 22 Z" fill="oklch(0.44 0.18 263)" />
    <path d="M60 46 C44 46 40 78 60 92 C80 78 76 46 60 46 Z" fill="oklch(0.94 0.05 60)" />
    <g fill="oklch(0.8 0.08 60)" opacity="0.7">
      <circle cx="54" cy="66" r="1.6" /><circle cx="66" cy="66" r="1.6" />
      <circle cx="60" cy="74" r="1.6" /><circle cx="52" cy="78" r="1.4" /><circle cx="68" cy="78" r="1.4" />
    </g>
    <circle cx="47" cy="48" r="15" fill="#fff" />
    <circle cx="73" cy="48" r="15" fill="#fff" />
    <circle cx="47" cy="48" r="7" fill="#22252b" />
    <circle cx="73" cy="48" r="7" fill="#22252b" />
    <circle cx="49.5" cy="45.5" r="2.4" fill="#fff" />
    <circle cx="75.5" cy="45.5" r="2.4" fill="#fff" />
    <path d="M60 54 L54 62 L66 62 Z" fill="oklch(0.752 0.164 69)" />
    <path d="M60 62 L57 66 L63 66 Z" fill="oklch(0.43 0.13 62)" />
    <g stroke="oklch(0.43 0.13 62)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M49 94 L49 105 M71 94 L71 105" />
      <path d="M49 105 l-4 6 M49 105 l0 7 M49 105 l4 6" />
      <path d="M71 105 l-4 6 M71 105 l0 7 M71 105 l4 6" />
    </g>
  </g>
);

const DEFAULTS = {
  left: { dx: 0, dy: 6, scale: 1 },
  right: { dx: 0, dy: 6, scale: 1 },
};

// The original Boots path, split into a LEFT half (around x=36-55) and a
// RIGHT half (around x=65-84), each with its own local origin so dx/dy/scale
// can be applied per-foot via an SVG transform without rewriting the path data.
// Local origin picked at the ankle-top of each boot (36,98) and (84,98).
function BootPath({ side, dx, dy, scale }) {
  const originX = side === "left" ? 36 : 84;
  const originY = 98;
  const transform = `translate(${originX + dx} ${originY + dy}) scale(${scale}) translate(${-originX} ${-originY})`;
  if (side === "left") {
    return (
      <g transform={transform} fill="oklch(0.38 0.08 45)">
        <path d="M36 98 h19 v11 H32 q-4 0-2-5 q2-4 6-6 Z" />
        <path d="M38 99 h15" stroke="var(--accent)" strokeWidth="3" />
      </g>
    );
  }
  return (
    <g transform={transform} fill="oklch(0.38 0.08 45)">
      <path d="M65 98 h19 q4 2 6 6 q2 5-2 5 H65 Z" />
      <path d="M67 99 h15" stroke="var(--accent)" strokeWidth="3" />
    </g>
  );
}

function NumberRow({ label, value, onChange, step = 0.5, min = -40, max = 40 }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
      <span style={{ width: 60, color: "#555" }}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ flex: 1 }}
      />
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        style={{ width: 56 }}
      />
    </label>
  );
}

function App() {
  const [left, setLeft] = useState(DEFAULTS.left);
  const [right, setRight] = useState(DEFAULTS.right);
  const [linked, setLinked] = useState(true);
  const svgRef = useRef(null);
  const dragState = useRef(null);

  const setBoth = useCallback((patch) => {
    setLeft((l) => ({ ...l, ...patch }));
    setRight((r) => ({ ...r, ...patch }));
  }, []);

  const updateSide = (side, patch) => {
    if (linked) {
      setBoth(patch);
    } else if (side === "left") {
      setLeft((l) => ({ ...l, ...patch }));
    } else {
      setRight((r) => ({ ...r, ...patch }));
    }
  };

  // Drag directly on the boot: horizontal mouse movement -> dx, vertical -> dy.
  const onPointerDown = (side) => (e) => {
    e.preventDefault();
    const svg = svgRef.current;
    const rect = svg.getBoundingClientRect();
    const scaleFactor = 120 / rect.width; // svg viewBox units per screen px
    dragState.current = {
      side,
      startX: e.clientX,
      startY: e.clientY,
      startDx: (side === "left" ? left : right).dx,
      startDy: (side === "left" ? left : right).dy,
      scaleFactor,
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const onPointerMove = (e) => {
    const d = dragState.current;
    if (!d) return;
    const dx = d.startDx + (e.clientX - d.startX) * d.scaleFactor;
    const dy = d.startDy + (e.clientY - d.startY) * d.scaleFactor;
    updateSideRef.current(d.side, { dx: Math.round(dx * 10) / 10, dy: Math.round(dy * 10) / 10 });
  };
  const onPointerUp = () => {
    dragState.current = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
  };
  // keep a stable ref to updateSide so the module-level listener always calls the latest closure
  const updateSideRef = useRef(updateSide);
  updateSideRef.current = updateSide;

  const code = `// Owl boot offsets (relative to the original Boots path)
const OWL_BOOT_LEFT  = { dx: ${left.dx}, dy: ${left.dy}, scale: ${left.scale} };
const OWL_BOOT_RIGHT = { dx: ${right.dx}, dy: ${right.dy}, scale: ${right.scale} };`;

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      alert("Скопировано в буфер обмена");
    } catch {
      // clipboard may be blocked in the preview sandbox; fall back to prompt
      window.prompt("Скопируй вручную:", code);
    }
  };

  return (
    <div style={{ fontFamily: "sans-serif", padding: 20, background: "#f4f4f4", minHeight: "100vh", display: "flex", gap: 24 }}>
      <div style={{ background: "#fff", borderRadius: 12, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,.1)" }}>
        <h2 style={{ marginTop: 0 }}>Сова + boots (тяни ботинки мышкой)</h2>
        <svg ref={svgRef} viewBox="0 0 120 120" width={480} height={480} style={{ background: "#eef1f5", borderRadius: 8, touchAction: "none" }}>
          {OWL_BODY}
          <g onPointerDown={onPointerDown("left")} style={{ cursor: "grab" }}>
            <BootPath side="left" {...left} />
          </g>
          <g onPointerDown={onPointerDown("right")} style={{ cursor: "grab" }}>
            <BootPath side="right" {...right} />
          </g>
        </svg>
        <p style={{ fontSize: 12, color: "#888", maxWidth: 480 }}>
          Клик и перетаскивание на ботинке двигает его (dx/dy). Точные значения и масштаб — в панели справа.
          Оригинальные якорные точки: левый ботинок (36,98), правый (84,98). Ноги совы: верх y≈94, низ голени y≈105, кончики когтей y≈112.
        </p>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,.1)", width: 340 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <input type="checkbox" checked={linked} onChange={(e) => setLinked(e.target.checked)} />
          Синхронизировать левый/правый (зеркально по значениям)
        </label>

        <h3 style={{ marginBottom: 4 }}>Левый ботинок</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          <NumberRow label="dx" value={left.dx} onChange={(v) => updateSide("left", { dx: v })} />
          <NumberRow label="dy" value={left.dy} onChange={(v) => updateSide("left", { dy: v })} />
          <NumberRow label="scale" value={left.scale} step={0.05} min={0.3} max={2} onChange={(v) => updateSide("left", { scale: v })} />
        </div>

        <h3 style={{ marginBottom: 4 }}>Правый ботинок</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          <NumberRow label="dx" value={right.dx} onChange={(v) => updateSide("right", { dx: v })} />
          <NumberRow label="dy" value={right.dy} onChange={(v) => updateSide("right", { dy: v })} />
          <NumberRow label="scale" value={right.scale} step={0.05} min={0.3} max={2} onChange={(v) => updateSide("right", { scale: v })} />
        </div>

        <button onClick={() => { setLeft(DEFAULTS.left); setRight(DEFAULTS.right); }} style={{ marginBottom: 12 }}>
          Сбросить
        </button>

        <h3 style={{ marginBottom: 4 }}>Итоговый код</h3>
        <pre style={{ background: "#f4f4f4", padding: 10, borderRadius: 6, fontSize: 11, whiteSpace: "pre-wrap" }}>{code}</pre>
        <button onClick={copyCode}>Скопировать</button>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
