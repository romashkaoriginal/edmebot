import { useId } from "react";
import "./RoomScene.css";

/**
 * Real drawn furniture/decor for the pet's room — same idea as PetAvatar's
 * worn accessories, but for the room instead of the pet.
 *
 * Six slots, each with a handful of purchasable skins:
 *   wallpaper — fills the room background
 *   floor     — the strip along the bottom
 *   rug       — sits on the floor, in front of the pet
 *   lamp      — a light source along one side
 *   furniture — one big piece (bed, shelf, desk, toybox, house)
 *   decor     — a small accent (painting, aquarium, balloons, trophies, star)
 *
 * RoomScene renders the whole room (background layers, in DOM order back to
 * front). RoomItemPreview renders a single skin cropped to its own icon, for
 * the shop card — the exact same SVG the room uses, not a stand-in emoji.
 */

const VIEWBOX = "0 0 320 200";

export default function RoomScene({ skins = {}, previewSlot = null, previewSkin = null }) {
  const uid = useId().replace(/[:]/g, "");
  const resolved = { ...skins };
  if (previewSlot) resolved[previewSlot] = previewSkin;

  const Wallpaper = WALLPAPER[resolved.wallpaper] ?? WALLPAPER.sky;
  const Floor = FLOOR[resolved.floor] ?? FLOOR.grass;
  const Furniture = FURNITURE[resolved.furniture];
  const Lamp = LAMP[resolved.lamp];
  const Rug = RUG[resolved.rug];
  const Decor = DECOR[resolved.decor];

  return (
    <svg className="room-scene" viewBox={VIEWBOX} preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <Wallpaper uid={uid} />
      <Floor uid={uid} />
      {Furniture && (
        <g className={`room-scene__item ${previewSlot === "furniture" ? "room-scene__item--preview" : ""}`}>
          <Furniture uid={uid} />
        </g>
      )}
      {Lamp && (
        <g className={`room-scene__item ${previewSlot === "lamp" ? "room-scene__item--preview" : ""}`}>
          <Lamp uid={uid} />
        </g>
      )}
      {Decor && (
        <g className={`room-scene__item ${previewSlot === "decor" ? "room-scene__item--preview" : ""}`}>
          <Decor uid={uid} />
        </g>
      )}
      {Rug && (
        <g className={`room-scene__item ${previewSlot === "rug" ? "room-scene__item--preview" : ""}`}>
          <Rug uid={uid} />
        </g>
      )}
    </svg>
  );
}

/* ---------------- wallpaper (fills the whole scene behind everything) ---------------- */

const WALLPAPER = {
  sky: ({ uid }) => (
    <g>
      <defs>
        <linearGradient id={`wp-sky-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.9 0.085 210)" />
          <stop offset="100%" stopColor="oklch(0.94 0.05 200)" />
        </linearGradient>
      </defs>
      <rect width="320" height="200" fill={`url(#wp-sky-${uid})`} />
      <circle cx="272" cy="42" r="22" fill="oklch(0.92 0.14 85)" opacity="0.9" />
      <circle cx="272" cy="42" r="32" fill="oklch(0.94 0.1 90)" opacity="0.28" />
      <g fill="oklch(1 0 0 / 0.62)">
        <ellipse cx="52" cy="46" rx="24" ry="9" />
        <ellipse cx="46" cy="52" rx="14" ry="9" />
        <ellipse cx="60" cy="52" rx="15" ry="10" />
      </g>
    </g>
  ),
  stripe: () => (
    <g>
      <rect width="320" height="200" fill="oklch(0.95 0.02 95)" />
      {Array.from({ length: 9 }).map((_, i) => (
        <rect key={i} x={i * 40 - 6} width="20" height="200" fill="oklch(0.86 0.07 350 / 0.55)" />
      ))}
    </g>
  ),
  starry: ({ uid }) => (
    <g>
      <defs>
        <linearGradient id={`wp-star-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.32 0.09 275)" />
          <stop offset="100%" stopColor="oklch(0.46 0.1 268)" />
        </linearGradient>
      </defs>
      <rect width="320" height="200" fill={`url(#wp-star-${uid})`} />
      <circle cx="250" cy="34" r="16" fill="oklch(0.95 0.05 95)" opacity="0.9" />
      <g fill="#fff" opacity="0.85">
        {[[30,28],[70,50],[110,22],[150,60],[190,30],[300,60],[20,80],[130,90]].map(([x,y],i) => (
          <path key={i} d={`M${x} ${y} l1.6 4 4 1.6 -4 1.6 -1.6 4 -1.6 -4 -4 -1.6 4 -1.6 Z`} />
        ))}
      </g>
    </g>
  ),
  mint: () => (
    <g>
      <rect width="320" height="200" fill="oklch(0.93 0.05 165)" />
      <g fill="oklch(0.86 0.07 165)" opacity="0.6">
        {Array.from({ length: 5 }).map((_, row) => Array.from({ length: 9 }).map((_, col) => (
          <circle key={`${row}-${col}`} cx={col * 38 + (row % 2 ? 19 : 0)} cy={row * 32 + 16} r="6" />
        )))}
      </g>
    </g>
  ),
  chalkboard: () => (
    <g>
      <rect width="320" height="200" fill="oklch(0.32 0.03 200)" />
      <rect x="10" y="10" width="300" height="150" rx="6" fill="none" stroke="oklch(0.72 0.1 75)" strokeWidth="3" strokeDasharray="6 5" opacity="0.7" />
      <path d="M40 100 q20 -22 40 0 t40 0 t40 0 t40 0" fill="none" stroke="#fff" strokeWidth="2" opacity="0.35" strokeLinecap="round" />
      <path d="M60 60 l30 0 M180 130 l26 0" stroke="#fff" strokeWidth="2" opacity="0.3" strokeLinecap="round" />
    </g>
  ),
};

/* ---------------- floor (bottom strip) ---------------- */

const FLOOR = {
  grass: () => (
    <g>
      <rect y="144" width="320" height="56" fill="oklch(0.82 0.08 142)" />
      <path d="M0 144 L320 144" stroke="oklch(0.52 0.09 145 / 0.3)" strokeWidth="3" />
    </g>
  ),
  wood: () => (
    <g>
      <rect y="144" width="320" height="56" fill="oklch(0.72 0.09 62)" />
      {Array.from({ length: 9 }).map((_, i) => (
        <rect key={i} x={i * 38} y="144" width="1.6" height="56" fill="oklch(0.58 0.08 55 / 0.5)" />
      ))}
      <path d="M0 144 L320 144" stroke="oklch(0.5 0.09 55 / 0.5)" strokeWidth="3" />
    </g>
  ),
  tile: () => (
    <g>
      <rect y="144" width="320" height="56" fill="oklch(0.9 0.02 90)" />
      {Array.from({ length: 9 }).map((_, i) => (
        <rect key={i} x={i * 38} y="144" width="38" height="56" fill="none" stroke="oklch(0.78 0.03 90)" strokeWidth="1.6" />
      ))}
      <path d="M0 144 L320 144" stroke="oklch(0.6 0.03 90 / 0.5)" strokeWidth="3" />
    </g>
  ),
  clouds: () => (
    <g>
      <rect y="144" width="320" height="56" fill="oklch(0.88 0.05 235)" />
      <g fill="#fff" opacity="0.75">
        <ellipse cx="60" cy="150" rx="26" ry="8" /><ellipse cx="180" cy="154" rx="30" ry="9" /><ellipse cx="280" cy="149" rx="22" ry="7" />
      </g>
      <path d="M0 144 L320 144" stroke="oklch(0.7 0.06 230 / 0.5)" strokeWidth="3" />
    </g>
  ),
};

/* ---------------- rug (sits low, in front of the pet) ---------------- */

const RUG = {
  round: () => <ellipse className="room-scene__rug" cx="160" cy="182" rx="118" ry="17" fill="oklch(0.7 0.11 68 / 0.55)" stroke="oklch(0.95 0.09 82 / 0.8)" strokeWidth="5" />,
  oval_stripe: () => (
    <g>
      <ellipse cx="160" cy="182" rx="112" ry="16" fill="oklch(0.62 0.14 25 / 0.5)" stroke="oklch(0.95 0.05 30 / 0.8)" strokeWidth="4" />
      <ellipse cx="160" cy="182" rx="82" ry="11" fill="none" stroke="#fff" strokeWidth="2.5" opacity="0.7" />
      <ellipse cx="160" cy="182" rx="50" ry="6.5" fill="none" stroke="#fff" strokeWidth="2" opacity="0.6" />
    </g>
  ),
  hexagon: () => (
    <g>
      <path d="M92 168 L160 156 L228 168 L228 190 L160 202 L92 190 Z" fill="oklch(0.62 0.15 250 / 0.62)" stroke="oklch(0.95 0.06 250 / 0.9)" strokeWidth="4" />
      <path d="M108 170 L160 161 L212 170 L212 188 L160 197 L108 188 Z" fill="none" stroke="#fff" strokeWidth="2" opacity="0.6" />
    </g>
  ),
  star_shape: () => (
    <path
      d="M160 156 l9 22 24 2 -18 16 6 24 -21 -13 -21 13 6 -24 -18 -16 24 -2 Z"
      transform="translate(0 6) scale(1.7) translate(-68 -85)"
      fill="oklch(0.82 0.16 82 / 0.55)"
      stroke="oklch(0.5 0.13 75 / 0.7)"
      strokeWidth="2"
    />
  ),
};

/* ---------------- lamp (light source, right side) ---------------- */

const LAMP = {
  // Lamps live in the room's near-right corner, clear of the furniture slot
  // (which occupies the wall behind/left of it) so the two never overlap.
  floor_lamp: () => (
    <g transform="translate(288 40)">
      <rect x="-4.5" y="20" width="9" height="78" rx="4" fill="oklch(0.42 0.06 55)" />
      <path d="M-22 20 h44 l-7 -28 h-30 Z" fill="var(--accent)" />
      <ellipse cx="0" cy="14" rx="17" ry="5" fill="oklch(0.94 0.1 90 / 0.5)" />
      <ellipse cx="0" cy="100" rx="18" ry="5" fill="oklch(0.36 0.05 55)" />
    </g>
  ),
  fairy_lights: () => (
    <g transform="translate(24 10)">
      <path d="M0 4 Q68 38 136 4 T272 4" fill="none" stroke="oklch(0.5 0.03 90)" strokeWidth="1.6" />
      <g fill="oklch(0.85 0.18 85)">
        {Array.from({ length: 9 }).map((_, i) => {
          const x = i * 34;
          const y = 4 + Math.sin((i / 8) * Math.PI) * 20;
          return <circle key={i} cx={x} cy={y} r="5" className="room-scene__twinkle" style={{ animationDelay: `${i * 0.18}s` }} />;
        })}
      </g>
    </g>
  ),
  moon_lamp: () => (
    <g transform="translate(290 30)">
      <circle cx="0" cy="18" r="18" fill="oklch(0.95 0.03 95)" />
      <path d="M-7 5 a13 13 0 1 0 3 22 a11 11 0 0 1 -3 -22 Z" fill="oklch(0.86 0.02 260 / 0.55)" />
      <circle cx="0" cy="18" r="24" fill="oklch(0.9 0.08 90 / 0.3)" />
      <rect x="-3" y="36" width="6" height="62" rx="3" fill="oklch(0.5 0.02 260)" />
    </g>
  ),
  lantern: () => (
    <g transform="translate(290 26)">
      <path d="M-14 0 h28 l-5 11 h-18 Z" fill="oklch(0.4 0.06 55)" />
      <rect x="-12" y="11" width="24" height="36" rx="5" fill="oklch(0.82 0.14 70 / 0.85)" stroke="oklch(0.4 0.06 55)" strokeWidth="2.5" />
      <line x1="0" y1="11" x2="0" y2="47" stroke="oklch(0.4 0.06 55)" strokeWidth="1.6" />
      <path d="M-12 29 h24" stroke="oklch(0.4 0.06 55)" strokeWidth="1.6" />
      <circle cx="0" cy="29" r="22" fill="oklch(0.9 0.1 85 / 0.3)" />
      <rect x="-3" y="47" width="6" height="51" rx="3" fill="oklch(0.36 0.05 55)" />
    </g>
  ),
};

/* ---------------- furniture (one big piece) ----------------
   Anchored so the widest piece (bookshelf, 84px) still clears both room
   edges: the pet stands center-left, the lamp corner sits past x=270. */

const FURNITURE = {
  house: () => (
    <g transform="translate(188 66)">
      <rect y="40" width="80" height="60" rx="4" fill="oklch(0.74 0.12 48)" />
      <path d="M-6 40 L40 6 L86 40 Z" fill="oklch(0.5 0.15 28)" />
      <rect x="30" y="64" width="20" height="36" rx="2" fill="oklch(0.32 0.06 48)" />
      <circle cx="46" cy="82" r="1.6" fill="oklch(0.82 0.14 70)" />
      <rect x="7" y="52" width="15" height="14" rx="2" fill="oklch(0.9 0.08 90 / 0.7)" stroke="oklch(0.5 0.15 28)" strokeWidth="2" />
    </g>
  ),
  bed: () => (
    <g transform="translate(172 78)">
      <rect y="30" width="96" height="16" rx="4" fill="oklch(0.5 0.08 40)" />
      <rect x="-4" y="10" width="13" height="46" rx="4" fill="oklch(0.44 0.08 40)" />
      <rect y="14" width="96" height="20" rx="6" fill="oklch(0.7 0.1 25)" />
      <rect x="6" y="6" width="28" height="18" rx="6" fill="#fff" />
      <rect x="8" y="30" width="88" height="10" fill="oklch(0.62 0.13 220)" />
      <path d="M8 34 h88" stroke="oklch(0.5 0.11 220)" strokeWidth="1.4" opacity="0.6" />
    </g>
  ),
  bookshelf: () => (
    <g transform="translate(196 42)">
      <rect width="72" height="96" rx="4" fill="oklch(0.5 0.08 40)" />
      <rect x="5" y="6" width="62" height="25" fill="oklch(0.4 0.07 40)" />
      <rect x="5" y="36" width="62" height="25" fill="oklch(0.4 0.07 40)" />
      <rect x="5" y="66" width="62" height="25" fill="oklch(0.4 0.07 40)" />
      <g>
        {[
          [9, 6, "oklch(0.62 0.16 25)"], [17, 6, "oklch(0.6 0.14 145)"], [25, 6, "oklch(0.65 0.14 250)"], [33, 6, "oklch(0.75 0.14 85)"],
          [9, 36, "oklch(0.65 0.14 300)"], [17, 36, "oklch(0.6 0.14 60)"], [25, 36, "oklch(0.62 0.16 25)"],
        ].map(([x, y, fill], i) => <rect key={i} x={x} y={y + 4} width="7" height="17" fill={fill} />)}
        <circle cx="49" cy="78" r="9" fill="oklch(0.8 0.1 55)" />
      </g>
    </g>
  ),
  desk: () => (
    <g transform="translate(178 84)">
      <rect x="4" y="24" width="88" height="10" rx="2" fill="oklch(0.62 0.1 55)" />
      <rect x="10" y="34" width="7" height="28" fill="oklch(0.5 0.09 50)" />
      <rect x="79" y="34" width="7" height="28" fill="oklch(0.5 0.09 50)" />
      <rect x="46" y="0" width="28" height="24" rx="2" fill="oklch(0.4 0.1 240)" />
      <rect x="49" y="3" width="22" height="16" rx="1.5" fill="oklch(0.68 0.14 210)" />
      <rect x="14" y="10" width="18" height="14" rx="1.5" fill="oklch(0.85 0.1 85)" />
      <rect x="18" y="14" width="10" height="2" fill="oklch(0.6 0.13 60)" />
    </g>
  ),
  toybox: () => (
    <g transform="translate(196 98)">
      <path d="M0 18 h68 l-4 28 a6 6 0 0 1 -6 5 H10 a6 6 0 0 1 -6 -5 Z" fill="oklch(0.68 0.18 25)" />
      <path d="M-3 4 h74 a5 5 0 0 1 5 5 v9 h-84 v-9 a5 5 0 0 1 5 -5 Z" fill="oklch(0.76 0.19 25)" />
      <circle cx="34" cy="18" r="4" fill="oklch(0.5 0.15 25)" />
      <circle cx="13" cy="33" r="6" fill="oklch(0.78 0.16 145)" />
      <rect x="44" y="27" width="11" height="11" rx="2" fill="oklch(0.78 0.16 85)" transform="rotate(12 49 32)" />
      <path d="M26 38 l6 -10 6 10 Z" fill="oklch(0.7 0.16 250)" />
    </g>
  ),
};

/* ---------------- decor (small accent) ---------------- */

const DECOR = {
  star: () => (
    <text className="room-scene__star" x="70" y="80" textAnchor="middle" fontSize="34">★</text>
  ),
  painting: () => (
    <g transform="translate(56 26)">
      <rect width="56" height="42" rx="3" fill="oklch(0.42 0.1 60)" />
      <rect x="4" y="4" width="48" height="34" fill="oklch(0.92 0.06 210)" />
      <path d="M4 30 l14 -14 10 8 12 -16 12 22 Z" fill="oklch(0.62 0.13 150)" />
      <circle cx="42" cy="12" r="5" fill="oklch(0.88 0.14 85)" />
    </g>
  ),
  aquarium: () => (
    <g transform="translate(48 44)">
      <rect width="70" height="46" rx="4" fill="oklch(0.72 0.1 210 / 0.55)" stroke="oklch(0.5 0.08 210)" strokeWidth="3" />
      <path d="M6 34 q6 -6 12 0 t12 0 t12 0 t12 0 t12 0" fill="none" stroke="oklch(0.6 0.1 145)" strokeWidth="2" opacity="0.6" />
      <path d="M40 18 q6 -3 8 3 q-4 3 -8 0 Z" fill="oklch(0.78 0.18 45)" />
      <circle cx="49" cy="19" r="1.2" fill="#fff" />
      <path d="M20 24 q5 -3 7 2 q-3 3 -7 0 Z" fill="oklch(0.75 0.19 25)" />
      <g fill="#fff" opacity="0.5"><circle cx="14" cy="12" r="1.6" /><circle cx="30" cy="8" r="1.3" /><circle cx="54" cy="10" r="1.4" /></g>
    </g>
  ),
  balloons: () => (
    <g transform="translate(44 8)">
      <path d="M0 30 Q4 60 8 78" stroke="oklch(0.6 0.02 90)" strokeWidth="1.4" fill="none" />
      <path d="M22 22 Q24 58 20 78" stroke="oklch(0.6 0.02 90)" strokeWidth="1.4" fill="none" />
      <path d="M42 30 Q40 58 36 78" stroke="oklch(0.6 0.02 90)" strokeWidth="1.4" fill="none" />
      <ellipse cx="0" cy="18" rx="14" ry="18" fill="oklch(0.7 0.19 25)" />
      <ellipse cx="22" cy="14" rx="15" ry="19" fill="oklch(0.75 0.15 145)" />
      <ellipse cx="42" cy="20" rx="13" ry="17" fill="oklch(0.7 0.14 250)" />
      <g fill="#fff" opacity="0.5"><ellipse cx="-4" cy="10" rx="3" ry="5" /><ellipse cx="18" cy="6" rx="3" ry="5" /><ellipse cx="38" cy="12" rx="2.6" ry="4.4" /></g>
    </g>
  ),
  trophies: () => (
    <g transform="translate(44 60)">
      <rect x="-2" y="24" width="70" height="8" rx="2" fill="oklch(0.5 0.08 60)" />
      <g transform="translate(6 0)">
        <path d="M0 0 h16 v10 a8 8 0 0 1 -16 0 Z" fill="oklch(0.8 0.16 85)" />
        <rect x="6" y="10" width="4" height="8" fill="oklch(0.7 0.14 80)" />
        <rect x="2" y="18" width="12" height="4" rx="1" fill="oklch(0.6 0.12 75)" />
      </g>
      <g transform="translate(28 -6)">
        <path d="M0 0 h20 v13 a10 10 0 0 1 -20 0 Z" fill="oklch(0.85 0.18 82)" />
        <rect x="7.5" y="13" width="5" height="10" fill="oklch(0.72 0.15 78)" />
        <rect x="3" y="23" width="14" height="5" rx="1.5" fill="oklch(0.62 0.13 75)" />
      </g>
      <g transform="translate(52 4)">
        <path d="M0 0 h14 v9 a7 7 0 0 1 -14 0 Z" fill="oklch(0.75 0.1 60)" />
        <rect x="5" y="9" width="4" height="7" fill="oklch(0.65 0.1 60)" />
        <rect x="1.5" y="16" width="11" height="3.5" rx="1" fill="oklch(0.56 0.09 58)" />
      </g>
    </g>
  ),
};

/**
 * Standalone preview for the shop card — the SAME svg group the room uses,
 * cropped to its own icon, so the card matches exactly what appears in the
 * room. Mirrors PetAvatar's AccessoryPreview.
 */
const PREVIEW_VIEWBOX = {
  wallpaper: "0 0 320 200",
  floor: "0 130 320 70",
  rug: "40 148 240 46",
  // fairy_lights crops tight around the middle third of the strand (where the
  // sine dip puts several bulbs close together) instead of the full width,
  // so the bulbs read as bulbs rather than specks.
  lamp: { floor_lamp: "254 32 68 100", fairy_lights: "90 4 100 46", moon_lamp: "260 22 60 88", lantern: "264 18 52 96" },
  furniture: { house: "176 62 92 76", bed: "162 32 116 90", bookshelf: "190 36 84 106", desk: "172 78 100 60", toybox: "190 94 80 60" },
  decor: { star: "36 46 68 56", painting: "48 18 72 58", aquarium: "40 36 86 62", balloons: "34 0 66 90", trophies: "36 46 92 46" },
};

export function RoomItemPreview({ slot, skin, size = 52 }) {
  const registry = { wallpaper: WALLPAPER, floor: FLOOR, rug: RUG, lamp: LAMP, furniture: FURNITURE, decor: DECOR }[slot];
  const Skin = registry?.[skin];
  if (!Skin) return null;
  const box = typeof PREVIEW_VIEWBOX[slot] === "string" ? PREVIEW_VIEWBOX[slot] : PREVIEW_VIEWBOX[slot]?.[skin];
  return (
    <svg className="room-item-preview" viewBox={box ?? VIEWBOX} width={size} height={size} aria-hidden="true">
      <Skin uid={`preview-${skin}`} />
    </svg>
  );
}

export const ROOM_SLOTS = ["wallpaper", "floor", "rug", "lamp", "furniture", "decor"];
