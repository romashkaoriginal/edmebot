import { useId } from "react";
import "./PetAvatar.css";

/**
 * A polished, characterful mascot rendered in brand colors.
 * Each species has a UNIQUE head silhouette + a torso/body so worn accessories
 * (scarf, bowtie) sit on the neck/chest rather than floating.
 *
 * species: fox | raccoon | squirrel | owl | cat
 * mood: happy | idle | sad
 * accessories: worn SVG layer ids ("scarf", "glasses", "tophat", ...)
 * reaction: transient class ("cheer" | "wobble")
 * eating: treat char animated into the mouth (falsy = none)
 * size in px.
 *
 * Layout in the 120×120 viewBox:
 *   body/torso ~y74–110 · head ~y18–74 · eyes ~y48–56 · nose ~y60
 *   neck (accessory) ~y72–84 · head-top (accessory) varies per species head.
 */
export default function PetAvatar({
  species = "fox",
  mood = "happy",
  accessories = [],
  reaction = null,
  eating = null,
  size = 120,
  className = "",
  animated = true,
  decorative = false,
}) {
  const uid = useId().replace(/[:]/g, "");
  const Body = SPECIES[species] ?? SPECIES.fox;
  const effectiveMood = eating ? "happy" : mood;
  const anchor = ANCHOR[species] ?? ANCHOR.fox;
  return (
    <div
      className={`pet pet--${species} pet--${mood} ${animated ? "" : "pet--static"} ${reaction ? `pet--${reaction}` : ""} ${eating ? "pet--eating" : ""} ${className}`}
      style={{ width: size, height: size }}
      data-mood={mood}
    >
      <svg
        viewBox="0 0 120 120"
        width={size}
        height={size}
        role={decorative ? undefined : "img"}
        aria-hidden={decorative || undefined}
        aria-label={decorative ? undefined : `Питомец: ${LABEL[species]}, настроение ${MOOD_LABEL[mood]}`}
      >
        <ellipse className="pet__shadow" cx="60" cy="113" rx="30" ry="5" />
        <g className="pet__scene">
          {/* Accessories render INSIDE the body group (as children) so they are
              part of the same animated unit — they breathe/bounce with the pet. */}
          <Body mood={effectiveMood} uid={uid}>
            {accessories.map((a) => {
              const A = ACCESSORY[a];
              return A ? <A key={a} species={species} anchor={anchor} /> : null;
            })}
          </Body>
          {eating && (
            <text className="pet__treat" x="60" y="24" textAnchor="middle" fontSize="18">
              {eating}
            </text>
          )}
        </g>
        {reaction === "cheer" && <Sparkles />}
      </svg>
    </div>
  );
}

const LABEL = { fox: "лиса", raccoon: "енот", squirrel: "белка", owl: "совёнок", cat: "котёнок" };
const MOOD_LABEL = { happy: "радостное", idle: "спокойное", sad: "скучает" };

/**
 * Attachment anchors per species, so accessories snap to the right spot on
 * each animal rather than fixed coordinates.
 *   neckY  — y where head meets body (scarf/bowtie wrap here)
 *   neckW  — half-width of the neck at that line (how wide the wrap is)
 *   chestY — y down the chest where a hanging scarf tail ends
 *   eyeCx/eyeCy/eyeR — eye centres + lens radius (glasses)
 *   crownY — y of the top of the head (hat brim rests here)
 *   crownW — half-width of the head at the crown (hat width)
 */
const ANCHOR = {
  fox: { neckY: 71, neckW: 21, chestY: 96, eyeCx: [48, 72], eyeCy: 51, eyeR: 10, crownY: 24, crownW: 24 },
  raccoon: { neckY: 72, neckW: 22, chestY: 98, eyeCx: [48, 72], eyeCy: 51, eyeR: 10, crownY: 22, crownW: 25 },
  squirrel: { neckY: 73, neckW: 19, chestY: 98, eyeCx: [49, 71], eyeCy: 49, eyeR: 10, crownY: 23, crownW: 23 },
  // Owl has no neck: the "scarf" sits high, right under the eye discs on the loaf.
  owl: { neckY: 62, neckW: 26, chestY: 86, eyeCx: [47, 73], eyeCy: 48, eyeR: 11, crownY: 18, crownW: 28 },
  cat: { neckY: 72, neckW: 20, chestY: 98, eyeCx: [48, 72], eyeCy: 50, eyeR: 10, crownY: 26, crownW: 24 },
};

/* ---------------- Shared facial features ---------------- */

function Eyes({ mood, cx = [48, 72], cy = 51, r = 5.5 }) {
  const [lx, rx] = cx;
  if (mood === "sad") {
    return (
      <g>
        <path d={`M${lx - 4} ${cy - 1} q4 -4 8 0`} fill="none" stroke="var(--ink)" strokeWidth="2.8" strokeLinecap="round" />
        <path d={`M${rx - 4} ${cy - 1} q4 -4 8 0`} fill="none" stroke="var(--ink)" strokeWidth="2.8" strokeLinecap="round" />
      </g>
    );
  }
  const eye = (x) => (
    <g>
      <ellipse cx={x} cy={cy} rx={r} ry={r + 1} fill="var(--ink)" />
      <circle cx={x + 1.6} cy={cy - 2} r={1.8} fill="#fff" />
      <circle cx={x - 1.2} cy={cy + 2} r={0.9} fill="#fff" opacity="0.7" />
    </g>
  );
  return (
    <g>
      {eye(lx)}
      {eye(rx)}
    </g>
  );
}

function Mouth({ mood, cx = 60, cy = 66 }) {
  if (mood === "sad") {
    return <path d={`M${cx - 4} ${cy + 3} q4 -4 8 0`} fill="none" stroke="var(--ink)" strokeWidth="2.2" strokeLinecap="round" />;
  }
  if (mood === "happy") {
    return (
      <g>
        <path d={`M${cx - 6} ${cy} q6 8 12 0`} fill="none" stroke="var(--ink)" strokeWidth="2.4" strokeLinecap="round" />
        <path d={`M${cx - 3} ${cy + 2} q3 3.5 6 0`} fill="oklch(0.62 0.16 20)" opacity="0.85" />
      </g>
    );
  }
  return <path d={`M${cx - 4} ${cy} q4 3 8 0`} fill="none" stroke="var(--ink)" strokeWidth="2.2" strokeLinecap="round" />;
}

function Nose({ cx = 60, cy = 60, rx = 4, ry = 3 }) {
  return (
    <g>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="var(--ink)" />
      <ellipse cx={cx + 1.3} cy={cy - 1} rx={rx * 0.35} ry={ry * 0.35} fill="#fff" opacity="0.55" />
    </g>
  );
}

function Blush({ cx = [40, 80], cy = 60, uid }) {
  return (
    <g fill={`url(#blush-${uid})`}>
      <ellipse cx={cx[0]} cy={cy} rx="5.5" ry="3.5" />
      <ellipse cx={cx[1]} cy={cy} rx="5.5" ry="3.5" />
    </g>
  );
}

function Defs({ uid, from, to, bodyFrom, bodyTo, blush = "oklch(0.72 0.14 20 / 0.55)" }) {
  return (
    <defs>
      <radialGradient id={`fur-${uid}`} cx="42%" cy="32%" r="72%">
        <stop offset="0%" stopColor={from} />
        <stop offset="100%" stopColor={to} />
      </radialGradient>
      <linearGradient id={`body-${uid}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={bodyFrom ?? from} />
        <stop offset="100%" stopColor={bodyTo ?? to} />
      </linearGradient>
      <radialGradient id={`blush-${uid}`} cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor={blush} />
        <stop offset="100%" stopColor="transparent" />
      </radialGradient>
    </defs>
  );
}

/* ---------------- Species (each visually unique, with a torso) ---------------- */

function Fox({ mood, uid, children }) {
  const fur = `url(#fur-${uid})`;
  return (
    <g className="pet__body">
      <Defs uid={uid} from="oklch(0.78 0.16 55)" to="oklch(0.64 0.17 45)" bodyFrom="oklch(0.72 0.16 50)" bodyTo="oklch(0.6 0.17 44)" />
      {/* bushy tail curling from behind the body */}
      <path d="M84 100 C112 100 110 72 92 74 C102 82 96 94 82 92 Z" fill="oklch(0.6 0.17 44)" />
      <path d="M92 88 C100 86 100 80 96 78 C98 83 95 87 90 87 Z" fill="#fff" opacity="0.9" />
      {/* torso */}
      <path d="M60 70 C40 70 34 84 36 96 C38 108 82 108 84 96 C86 84 80 70 60 70 Z" fill={`url(#body-${uid})`} />
      {/* chest bib */}
      <path d="M60 74 C50 74 46 92 60 102 C74 92 70 74 60 74 Z" fill="#fff" opacity="0.95" />
      {/* HEAD — sharp inverted triangle, the fox signature */}
      {/* ears */}
      <path d="M34 40 L27 12 L54 30 Z" fill="oklch(0.6 0.17 42)" />
      <path d="M86 40 L93 12 L66 30 Z" fill="oklch(0.6 0.17 42)" />
      <path d="M37 36 L33 20 L49 31 Z" fill="oklch(0.28 0.03 30)" />
      <path d="M83 36 L87 20 L71 31 Z" fill="oklch(0.28 0.03 30)" />
      {/* upper head (wide) tapering to a pointed chin */}
      <path d="M60 22 C36 22 30 40 34 52 C38 64 48 70 60 72 C72 70 82 64 86 52 C90 40 84 22 60 22 Z" fill={fur} />
      {/* white cheeks / muzzle wrap */}
      <path d="M60 46 C46 46 40 58 48 66 C53 71 60 72 60 72 C60 72 67 71 72 66 C80 58 74 46 60 46 Z" fill="#fff" />
      <Blush uid={uid} cx={[40, 80]} cy={56} />
      <Eyes mood={mood} />
      <Nose cx={60} cy={60} rx={4.5} ry={3} />
      <Mouth mood={mood} cy={66} />
      {children}
    </g>
  );
}

function Raccoon({ mood, uid, children }) {
  const fur = `url(#fur-${uid})`;
  return (
    <g className="pet__body">
      <Defs uid={uid} from="oklch(0.72 0.02 265)" to="oklch(0.56 0.02 265)" bodyFrom="oklch(0.66 0.02 265)" bodyTo="oklch(0.5 0.02 265)" blush="oklch(0.72 0.12 20 / 0.5)" />
      {/* ringed tail */}
      <path d="M84 102 C110 100 108 74 90 74 C100 82 96 96 82 94 Z" fill="oklch(0.5 0.02 265)" />
      <path d="M104 84 q4 4 0 8 M98 78 q5 5 0 10" stroke="oklch(0.28 0.02 265)" strokeWidth="4" fill="none" strokeLinecap="round" />
      {/* torso */}
      <path d="M60 70 C40 70 34 84 36 96 C38 108 82 108 84 96 C86 84 80 70 60 70 Z" fill={`url(#body-${uid})`} />
      <path d="M60 74 C51 74 48 92 60 102 C72 92 69 74 60 74 Z" fill="oklch(0.82 0.01 265)" opacity="0.9" />
      {/* round head */}
      <path d="M34 40 L28 20 L50 33 Z" fill="oklch(0.4 0.02 265)" />
      <path d="M86 40 L92 20 L70 33 Z" fill="oklch(0.4 0.02 265)" />
      <circle cx="60" cy="46" r="27" fill={fur} />
      {/* bandit mask */}
      <path d="M32 50 C42 42 52 46 52 54 C52 62 40 66 33 60 Z" fill="oklch(0.24 0.02 265)" />
      <path d="M88 50 C78 42 68 46 68 54 C68 62 80 66 87 60 Z" fill="oklch(0.24 0.02 265)" />
      {/* white muzzle */}
      <path d="M60 52 C50 52 46 64 54 70 C58 73 60 73 60 73 C60 73 62 73 66 70 C74 64 70 52 60 52 Z" fill="#fff" />
      <Blush uid={uid} cx={[40, 80]} cy={58} />
      <Eyes mood={mood} cy={51} />
      <Nose cx={60} cy={61} rx={4} ry={3} />
      <Mouth mood={mood} cy={67} />
      {children}
    </g>
  );
}

function Squirrel({ mood, uid, children }) {
  const fur = `url(#fur-${uid})`;
  return (
    <g className="pet__body">
      <Defs uid={uid} from="oklch(0.68 0.13 48)" to="oklch(0.54 0.14 42)" bodyFrom="oklch(0.64 0.13 46)" bodyTo="oklch(0.5 0.14 42)" />
      {/* enormous curling tail — the squirrel signature */}
      <path d="M80 104 C120 96 118 40 84 40 C108 52 104 84 74 84 C86 90 84 100 80 104 Z" fill="oklch(0.6 0.13 45)" />
      <path d="M92 56 C104 60 104 78 88 82 C100 74 98 62 88 60 Z" fill="oklch(0.72 0.12 50)" opacity="0.7" />
      {/* torso */}
      <path d="M60 72 C44 72 40 84 42 96 C44 108 78 108 80 96 C82 84 76 72 60 72 Z" fill={`url(#body-${uid})`} />
      <path d="M60 76 C52 76 49 92 60 102 C71 92 68 76 60 76 Z" fill="oklch(0.92 0.04 55)" opacity="0.9" />
      {/* tufted round head */}
      <path d="M36 38 L32 22 L48 32 Z" fill="oklch(0.58 0.14 44)" />
      <path d="M84 38 L88 22 L72 32 Z" fill="oklch(0.58 0.14 44)" />
      <circle cx="60" cy="46" r="25" fill={fur} />
      {/* big cheeks */}
      <circle cx="42" cy="58" r="9" fill={fur} />
      <circle cx="78" cy="58" r="9" fill={fur} />
      <Blush uid={uid} cx={[42, 78]} cy={60} />
      <Eyes mood={mood} cx={[49, 71]} cy={49} />
      <Nose cx={60} cy={59} rx={3.6} ry={2.8} />
      {/* buck teeth */}
      <rect x="57" y="63" width="6" height="7" rx="1.5" fill="#fff" stroke="oklch(0.85 0 0)" strokeWidth="0.6" />
      <line x1="60" y1="63" x2="60" y2="70" stroke="oklch(0.85 0 0)" strokeWidth="0.6" />
      {children}
    </g>
  );
}

function Owl({ mood, uid, children }) {
  const fur = `url(#fur-${uid})`;
  return (
    <g className="pet__body">
      <Defs uid={uid} from="oklch(0.62 0.16 262)" to="oklch(0.46 0.18 263)" bodyFrom="oklch(0.58 0.17 262)" bodyTo="oklch(0.44 0.18 263)" blush="oklch(0.72 0.14 40 / 0.5)" />
      {/* feet */}
      <path d="M48 104 l-4 6 M48 104 l0 7 M48 104 l4 6" stroke="var(--accent-strong)" strokeWidth="3" strokeLinecap="round" />
      <path d="M72 104 l-4 6 M72 104 l0 7 M72 104 l4 6" stroke="var(--accent-strong)" strokeWidth="3" strokeLinecap="round" />
      {/* one-piece rounded loaf body (owls have no neck) */}
      <path d="M60 20 C34 20 26 44 28 70 C30 96 90 96 92 70 C94 44 86 20 60 20 Z" fill={fur} />
      {/* wings hugging the sides */}
      <path d="M30 58 C24 66 26 84 34 90 C34 78 34 68 36 60 Z" fill={`url(#body-${uid})`} />
      <path d="M90 58 C96 66 94 84 86 90 C86 78 86 68 84 60 Z" fill={`url(#body-${uid})`} />
      {/* ear tufts */}
      <path d="M38 24 L32 8 L50 22 Z" fill="oklch(0.44 0.18 263)" />
      <path d="M82 24 L88 8 L70 22 Z" fill="oklch(0.44 0.18 263)" />
      {/* speckled belly */}
      <path d="M60 46 C44 46 40 78 60 92 C80 78 76 46 60 46 Z" fill="oklch(0.94 0.05 60)" />
      <g fill="oklch(0.8 0.08 60)" opacity="0.7">
        <circle cx="54" cy="66" r="1.6" /><circle cx="66" cy="66" r="1.6" />
        <circle cx="60" cy="74" r="1.6" /><circle cx="52" cy="78" r="1.4" /><circle cx="68" cy="78" r="1.4" />
      </g>
      {/* big eye discs */}
      <circle cx="47" cy="48" r="15" fill="#fff" />
      <circle cx="73" cy="48" r="15" fill="#fff" />
      {mood === "sad" ? (
        <Eyes mood="sad" cx={[47, 73]} cy={48} />
      ) : (
        <g>
          <circle cx="47" cy="48" r="7" fill="var(--ink)" />
          <circle cx="73" cy="48" r="7" fill="var(--ink)" />
          <circle cx="49.5" cy="45.5" r="2.4" fill="#fff" />
          <circle cx="75.5" cy="45.5" r="2.4" fill="#fff" />
        </g>
      )}
      {/* beak */}
      <path d="M60 54 L54 62 L66 62 Z" fill="var(--accent)" />
      <path d="M60 62 L57 66 L63 66 Z" fill="var(--accent-strong)" />
      {children}
    </g>
  );
}

function Cat({ mood, uid, children }) {
  const fur = `url(#fur-${uid})`;
  const stripe = "oklch(0.5 0.06 55)";
  return (
    <g className="pet__body">
      <Defs uid={uid} from="oklch(0.74 0.05 60)" to="oklch(0.6 0.06 55)" bodyFrom="oklch(0.7 0.05 58)" bodyTo="oklch(0.56 0.06 54)" />
      {/* curled tail wrapping around the body */}
      <path d="M82 104 C106 104 106 82 90 80 C100 84 98 96 82 96 Z" fill="oklch(0.58 0.06 54)" />
      <path d="M96 90 q4 -2 6 2 M92 84 q4 -1 6 3" stroke={stripe} strokeWidth="3" fill="none" strokeLinecap="round" />
      {/* torso */}
      <path d="M60 72 C42 72 38 84 40 96 C42 108 78 108 80 96 C82 84 78 72 60 72 Z" fill={`url(#body-${uid})`} />
      <path d="M60 76 C52 76 49 92 60 102 C71 92 68 76 60 76 Z" fill="#fff" opacity="0.9" />
      <path d="M46 88 q14 6 28 0" stroke={stripe} strokeWidth="2.4" fill="none" strokeLinecap="round" opacity="0.6" />
      {/* rounded head with small triangle ears */}
      <path d="M36 34 L30 16 L52 30 Z" fill="oklch(0.62 0.06 55)" />
      <path d="M84 34 L90 16 L68 30 Z" fill="oklch(0.62 0.06 55)" />
      <path d="M39 31 L36 21 L48 29 Z" fill="oklch(0.72 0.12 20 / 0.6)" />
      <path d="M81 31 L84 21 L72 29 Z" fill="oklch(0.72 0.12 20 / 0.6)" />
      <path d="M60 26 C38 26 32 44 36 56 C40 68 50 72 60 72 C70 72 80 68 84 56 C88 44 82 26 60 26 Z" fill={fur} />
      {/* tabby stripes on the forehead */}
      <path d="M54 30 q6 5 12 0" fill="none" stroke={stripe} strokeWidth="2.6" strokeLinecap="round" />
      <path d="M46 38 q5 3 8 0 M66 38 q5 3 8 0" fill="none" stroke={stripe} strokeWidth="2.2" strokeLinecap="round" />
      <Blush uid={uid} cx={[42, 78]} cy={58} />
      <Eyes mood={mood} cy={50} />
      <path d="M60 58 L56 62 L64 62 Z" fill="oklch(0.62 0.16 20)" />
      <Mouth mood={mood} cy={66} />
      {/* whiskers */}
      <g stroke="var(--ink)" strokeWidth="1.3" strokeLinecap="round" opacity="0.5">
        <path d="M44 60 L28 57 M44 64 L29 66" />
        <path d="M76 60 L92 57 M76 64 L91 66" />
      </g>
      {children}
    </g>
  );
}

const SPECIES = { fox: Fox, raccoon: Raccoon, squirrel: Squirrel, owl: Owl, cat: Cat };

/* ---------------- Accessories (real worn SVG layers) ----------------
   Every accessory positions itself from the species ANCHOR so it snaps onto
   the actual neck / eyes / crown of each animal — never floating. */

function Scarf({ anchor }) {
  const { neckY: y, neckW: w, chestY } = anchor;
  const l = 60 - w;
  const r = 60 + w;
  // wrap that dips at the sides and rises over the throat, hugging the neck line
  const wrap = `M${l} ${y - 3} C${l + 4} ${y + 5} ${r - 4} ${y + 5} ${r} ${y - 3} C${r} ${y + 3} ${r - 3} ${y + 7} 60 ${y + 8} C${l + 3} ${y + 7} ${l} ${y + 3} ${l} ${y - 3} Z`;
  // hanging tail down the chest, starting from the wrap
  const tail = `M${60 + w * 0.4} ${y + 4} C${68} ${y + 8} ${70} ${chestY - 8} ${68} ${chestY} L${60} ${chestY + 2} L${56} ${y + 6} Z`;
  return (
    <g className="acc acc--neck">
      <path d={wrap} fill="oklch(0.58 0.2 25)" />
      <path d={tail} fill="oklch(0.5 0.2 25)" />
      <path
        d={`M${l} ${y - 3} C${l + 4} ${y + 5} ${r - 4} ${y + 5} ${r} ${y - 3} C${r} ${y - 1} ${r - 2} ${y} ${r - 3} ${y + 1} C${r - 10} ${y + 6} ${l + 10} ${y + 6} ${l + 3} ${y + 1} C${l + 2} ${y} ${l} ${y - 1} ${l} ${y - 3} Z`}
        fill="oklch(0.66 0.18 30)"
        opacity="0.7"
      />
      {/* fringe on the tail end */}
      <g stroke="oklch(0.5 0.2 25)" strokeWidth="1.8" strokeLinecap="round">
        <path d={`M59 ${chestY + 1} l-1 4 M62 ${chestY + 1} l0 4 M65 ${chestY} l1 4`} />
      </g>
    </g>
  );
}

function Bowtie({ anchor }) {
  const y = anchor.neckY + 3;
  return (
    <g className="acc acc--neck">
      <path d={`M60 ${y} L45 ${y - 6} L45 ${y + 8} Z`} fill="var(--primary)" />
      <path d={`M60 ${y} L75 ${y - 6} L75 ${y + 8} Z`} fill="var(--primary)" />
      <path d={`M60 ${y} L45 ${y - 6} L48 ${y + 1} Z`} fill="var(--primary-strong)" opacity="0.6" />
      <path d={`M60 ${y} L75 ${y - 6} L72 ${y + 1} Z`} fill="var(--primary-strong)" opacity="0.6" />
      <circle cx="60" cy={y + 1} r="4" fill="var(--primary-strong)" />
    </g>
  );
}

function Glasses({ anchor }) {
  const { eyeCx: cx, eyeCy: cy, eyeR: r } = anchor;
  return (
    <g className="acc acc--eyes" fill="none" stroke="var(--ink)" strokeWidth="2.8">
      <circle cx={cx[0]} cy={cy} r={r} fill="oklch(0.7 0.12 220 / 0.16)" />
      <circle cx={cx[1]} cy={cy} r={r} fill="oklch(0.7 0.12 220 / 0.16)" />
      <path d={`M${cx[0] + r} ${cy} L${cx[1] - r} ${cy}`} strokeLinecap="round" />
      <path d={`M${cx[0] - r} ${cy} L${cx[0] - r - 12} ${cy - 3}`} strokeLinecap="round" />
      <path d={`M${cx[1] + r} ${cy} L${cx[1] + r + 12} ${cy - 3}`} strokeLinecap="round" />
    </g>
  );
}

function TopHat({ anchor }) {
  const base = anchor.crownY + 1; // brim sits just on the crown
  const brimW = anchor.crownW - 1;
  return (
    <g className="acc acc--head">
      <ellipse cx="60" cy={base} rx={brimW} ry="5.5" fill="oklch(0.22 0.02 260)" />
      <rect x={60 - brimW * 0.6} y={base - 20} width={brimW * 1.2} height="21" rx="3" fill="oklch(0.24 0.02 260)" />
      <rect x={60 - brimW * 0.6} y={base - 7} width={brimW * 1.2} height="5" fill="var(--accent)" />
      <ellipse cx="60" cy={base - 20} rx={brimW * 0.6} ry="3.6" fill="oklch(0.28 0.02 260)" />
    </g>
  );
}

function Cap({ anchor }) {
  const y = anchor.crownY + 7; // dome sits over the crown
  const w = anchor.crownW;
  const l = 60 - w;
  const r = 60 + w;
  return (
    <g className="acc acc--head">
      <path d={`M${l} ${y} C${l} ${y - 20} ${r} ${y - 20} ${r} ${y} C${r - 12} ${y - 6} ${l + 12} ${y - 6} ${l} ${y} Z`} fill="var(--primary)" />
      {/* peak/brim to the side */}
      <path d={`M${l} ${y} C${l - 12} ${y} ${l - 14} ${y + 8} ${l - 10} ${y + 10} C${l} ${y + 4} ${l + 10} ${y + 2} ${l + 10} ${y} Z`} fill="var(--primary-strong)" />
      <circle cx="60" cy={y - 16} r="3" fill="var(--accent)" />
    </g>
  );
}

const ACCESSORY = {
  scarf: Scarf,
  bowtie: Bowtie,
  glasses: Glasses,
  tophat: TopHat,
  cap: Cap,
};

/**
 * Standalone accessory preview for the shop card — renders the SAME accessory
 * SVG that gets worn, cropped to the accessory's own region so the card
 * matches exactly what appears on the pet.
 */
const PREVIEW_VIEWBOX = {
  scarf: "30 62 60 48",
  bowtie: "40 60 40 26",
  glasses: "32 36 56 30",
  tophat: "32 2 56 30",
  cap: "26 4 68 32",
};
export function AccessoryPreview({ accessory, size = 44 }) {
  const A = ACCESSORY[accessory];
  if (!A) return null;
  return (
    <svg viewBox={PREVIEW_VIEWBOX[accessory] ?? "0 0 120 120"} width={size} height={size} aria-hidden="true">
      <A anchor={ANCHOR.fox} species="fox" />
    </svg>
  );
}

/* Celebration sparkles for the "cheer" reaction */
function Sparkles() {
  return (
    <g className="pet__sparkles" fill="var(--accent)">
      <path className="spk spk--1" d="M22 28 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 Z" />
      <path className="spk spk--2" d="M98 24 l1.5 4 4 1.5 -4 1.5 -1.5 4 -1.5 -4 -4 -1.5 4 -1.5 Z" />
      <path className="spk spk--3" d="M94 56 l1.5 4 4 1.5 -4 1.5 -1.5 4 -1.5 -4 -4 -1.5 4 -1.5 Z" fill="var(--primary)" />
      <path className="spk spk--4" d="M24 58 l1.5 4 4 1.5 -4 1.5 -1.5 4 -1.5 -4 -4 -1.5 4 -1.5 Z" fill="var(--primary)" />
    </g>
  );
}
