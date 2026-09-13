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
  anchorOverride = null,
}) {
  const uid = useId().replace(/[:]/g, "");
  const Body = SPECIES[species] ?? SPECIES.fox;
  const effectiveMood = eating ? "happy" : mood;
  const base = ANCHOR[species] ?? ANCHOR.fox;
  // anchorOverride lets tooling dial an anchor in live; production never passes it.
  const anchor = anchorOverride ? { ...base, ...anchorOverride } : base;
  // Body-worn clothing is not layered on top of the pet — it becomes the torso,
  // so it goes to the species component instead of the accessory layer.
  const outfit = accessories.find((a) => OUTFIT[a]) ?? null;
  const worn = accessories.filter((a) => !OUTFIT[a]);
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
          <Body mood={effectiveMood} uid={uid} outfit={outfit} anchor={anchor}>
            {worn.map((a) => {
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
 *   feetY  — y where footwear rests (the owl's bare legs sit lower)
 *   torso  — the shape clothing REPLACES, so an outfit is the body rather
 *            than a sticker on top of it. See <Torso/>:
 *              topY/topW  — shoulder line and its half-width
 *              hipY/hipW  — widest point of the belly and its half-width
 *              hemY       — where the body ends (hem of a shirt/dress)
 */
export const ANCHOR = {
  // Fox and raccoon used to carry a noticeably wider torso than squirrel/cat,
  // which made the same garment read bulky on them. All four now share one
  // build so an outfit sits identically across the species.
  fox: {
    neckY: 71, neckW: 20, chestY: 96, eyeCx: [48, 72], eyeCy: 51, eyeR: 10, crownY: 24, crownW: 24, feetY: 98,
    torso: { topY: 70, topW: 18, hipY: 94, hipW: 20.5, hemY: 105 },
  },
  raccoon: {
    neckY: 72, neckW: 20, chestY: 98, eyeCx: [48, 72], eyeCy: 51, eyeR: 10, crownY: 22, crownW: 25, feetY: 98,
    torso: { topY: 70, topW: 18, hipY: 94, hipW: 20.5, hemY: 105 },
  },
  squirrel: {
    neckY: 73, neckW: 19, chestY: 98, eyeCx: [49, 71], eyeCy: 49, eyeR: 10, crownY: 23, crownW: 23, feetY: 98,
    torso: { topY: 72, topW: 18, hipY: 94, hipW: 19.4, hemY: 105 },
  },
  // Owl has no neck: the "scarf" sits high, right under the eye discs on the loaf.
  // It also has slender bare legs (not a torso taper), so footwear needs its own,
  // lower feetY — otherwise boots swallow the legs and float under the belly.
  // Its "torso" is the lower half of the one-piece loaf, so clothing starts under
  // the face discs and ends where the loaf does.
  owl: {
    neckY: 62, neckW: 26, chestY: 86, eyeCx: [47, 73], eyeCy: 48, eyeR: 11, crownY: 18, crownW: 28, feetY: 104,
    torso: { topY: 62, topW: 26, hipY: 76, hipW: 31.5, hemY: 89.5 },
  },
  cat: {
    neckY: 72, neckW: 20, chestY: 98, eyeCx: [48, 72], eyeCy: 50, eyeR: 10, crownY: 26, crownW: 24, feetY: 98,
    torso: { topY: 72, topW: 18, hipY: 94, hipW: 20.5, hemY: 105 },
  },
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

/* ---------------- Outfits: clothing IS the torso ----------------
   An outfit does not sit on top of the body — it replaces the torso, so the
   pet reads as wearing a garment rather than holding a sign against its belly.
   Each entry reshapes the silhouette (flare/volume), then paints the collar,
   sleeves and trim on the shape it just defined.

     flare   — how much wider than the bare hip the hem falls (a dress flares,
               a vest hugs)
     lift    — how much higher than the bare shoulder the garment starts
     fill    — main fabric
     shade   — the darker side/under panel that gives the fabric volume
     collar  — neckline colour (null = no collar band)
     sleeve  — short sleeve caps at the shoulders (null = sleeveless)
     detail  — extra marks drawn over the fabric, given the resolved geometry
*/

/**
 * The body outline, optionally pinched at a waist.
 *
 * Without a waist it is one smooth flank (shoulder -> hip), which is how bare
 * fur and close-fitting garments read. With one, the silhouette goes
 * shoulder -> narrow waist -> flared hem, which is what makes a dress or a
 * skirted coat read as tailored rather than as a sack.
 */
function torsoPath({ topY, topW, hipY, hipW, hemY, waistY, waistW }) {
  // Control points for the hem sit BELOW hemY so the curve actually reaches
  // the hem line instead of falling short of it.
  const drop = (hemY - hipY) * 1.6;
  const hem = `C${60 - hipW} ${hipY + drop} ${60 + hipW} ${hipY + drop} ${60 + hipW} ${hipY}`;

  if (waistY == null) {
    return `M60 ${topY}
      C${60 - topW} ${topY} ${60 - hipW - 2} ${hipY - 12} ${60 - hipW} ${hipY}
      ${hem}
      C${60 + hipW + 2} ${hipY - 12} ${60 + topW} ${topY} 60 ${topY} Z`;
  }

  return `M60 ${topY}
    C${60 - topW} ${topY} ${60 - waistW - 1} ${waistY - 8} ${60 - waistW} ${waistY}
    C${60 - waistW - 2} ${waistY + 5} ${60 - hipW} ${hipY - 6} ${60 - hipW} ${hipY}
    ${hem}
    C${60 + hipW} ${hipY - 6} ${60 + waistW + 2} ${waistY + 5} ${60 + waistW} ${waistY}
    C${60 + waistW + 1} ${waistY - 8} ${60 + topW} ${topY} 60 ${topY} Z`;
}

const OUTFIT = {
  pink_dress: {
    // A fitted bodice down to a high waist, then a skirt that flares past the hip.
    flare: 6, lift: 1, waist: 0.42, waistFlare: -2,
    fill: "oklch(0.72 0.18 350)", shade: "oklch(0.6 0.19 348)",
    collar: "oklch(0.93 0.07 345)", sleeve: "oklch(0.66 0.19 349)",
    detail: ({ hipW, hipY, topY, hemY, waistY, waistW }) => (
      <g>
        {/* waistband sits on the pinch, so the skirt reads as a separate piece */}
        <path d={`M${60 - waistW - 1} ${waistY} Q60 ${waistY + 4} ${60 + waistW + 1} ${waistY}`} fill="none" stroke="oklch(0.93 0.07 345)" strokeWidth="3.4" strokeLinecap="round" />
        {/* pleats fanning out from the waist to the hem */}
        <g stroke="oklch(0.62 0.19 348)" strokeWidth="1.3" opacity="0.45" strokeLinecap="round">
          <path d={`M${60 - waistW * 0.55} ${waistY + 3} L${60 - hipW * 0.62} ${hemY - 3}`} />
          <path d={`M60 ${waistY + 3} L60 ${hemY - 2}`} />
          <path d={`M${60 + waistW * 0.55} ${waistY + 3} L${60 + hipW * 0.62} ${hemY - 3}`} />
        </g>
        {/* bow at the collar */}
        <path d={`M60 ${topY + 7} l-6.5 -4 v8.5 Z M60 ${topY + 7} l6.5 -4 v8.5 Z`} fill="oklch(0.58 0.2 345)" />
        <circle cx="60" cy={topY + 7} r="2.4" fill="oklch(0.95 0.06 350)" />
        <circle cx={60 - hipW * 0.45} cy={hipY + 1} r="1.7" fill="#fff" opacity="0.75" />
      </g>
    ),
  },
  space_suit: {
    flare: 3, lift: 2,
    fill: "oklch(0.93 0.02 250)", shade: "oklch(0.8 0.04 255)",
    collar: "oklch(0.56 0.13 260)", sleeve: "oklch(0.87 0.03 252)",
    detail: ({ hipW, hipY, topY, hemY }) => (
      <g>
        {/* chest control panel */}
        <rect x={60 - 12} y={topY + 11} width="24" height="15" rx="3.5" fill="oklch(0.33 0.12 265)" />
        <circle cx={60 - 6} cy={topY + 18.5} r="2.2" fill="oklch(0.78 0.18 45)" />
        <circle cx="60" cy={topY + 18.5} r="2.2" fill="oklch(0.74 0.16 150)" />
        <rect x={60 + 3} y={topY + 16} width="7" height="5" rx="1.2" fill="oklch(0.7 0.14 230)" />
        {/* seams + reflective belt */}
        <path d={`M60 ${topY + 27} V${hemY - 6}`} stroke="oklch(0.56 0.13 260)" strokeWidth="1.6" opacity="0.7" />
        <path d={`M${60 - hipW * 0.92} ${hipY - 1} Q60 ${hipY + 3} ${60 + hipW * 0.92} ${hipY - 1}`} fill="none" stroke="oklch(0.76 0.17 45)" strokeWidth="3.5" />
        <path d={`M${60 - hipW * 0.8} ${topY + 6} Q60 ${topY + 10} ${60 + hipW * 0.8} ${topY + 6}`} fill="none" stroke="oklch(0.56 0.13 260)" strokeWidth="1.5" opacity="0.6" />
      </g>
    ),
  },
  hero_suit: {
    flare: 4, lift: 2, cape: "oklch(0.64 0.21 25)",
    fill: "oklch(0.48 0.19 282)", shade: "oklch(0.38 0.18 283)",
    collar: "oklch(0.64 0.21 25)", sleeve: "oklch(0.43 0.19 283)",
    detail: ({ hipW, hipY, topY, hemY }) => (
      <g>
        {/* chest emblem */}
        <path d={`M60 ${topY + 9} l9 10 -9 13 -9 -13 Z`} fill="oklch(0.83 0.17 78)" />
        <path d={`M60 ${topY + 14} l4 5 -4 6 -4 -6 Z`} fill="oklch(0.64 0.21 25)" />
        {/* utility belt */}
        <path d={`M${60 - hipW * 0.95} ${hipY} Q60 ${hipY + 4} ${60 + hipW * 0.95} ${hipY}`} fill="none" stroke="oklch(0.8 0.17 75)" strokeWidth="5" />
        <rect x={60 - 4} y={hipY - 1.5} width="8" height="6" rx="1.5" fill="oklch(0.6 0.2 28)" />
        <path d={`M${60 - hipW * 0.55} ${hemY - 5} h${hipW * 1.1}`} stroke="oklch(0.38 0.18 283)" strokeWidth="2" opacity="0.5" />
      </g>
    ),
  },
  scholar_vest: {
    flare: 2, lift: 0,
    fill: "oklch(0.48 0.14 292)", shade: "oklch(0.38 0.13 292)",
    collar: "oklch(0.9 0.03 295)", sleeve: null,
    detail: ({ hipW, hipY, topY, hemY }) => (
      <g>
        {/* open V of a vest over a shirt */}
        <path d={`M${60 - 11} ${topY + 1} L60 ${topY + 15} L${60 + 11} ${topY + 1} L${60 + 7} ${topY} L60 ${topY + 10} L${60 - 7} ${topY} Z`} fill="oklch(0.95 0.02 290)" />
        <path d={`M60 ${topY + 15} V${hemY - 5}`} stroke="oklch(0.88 0.03 295)" strokeWidth="1.8" opacity="0.8" />
        <circle cx="60" cy={topY + 22} r="1.7" fill="oklch(0.88 0.03 295)" />
        <circle cx="60" cy={topY + 29} r="1.7" fill="oklch(0.88 0.03 295)" />
        {/* pocket + trim */}
        <path d={`M${60 - hipW * 0.72} ${topY + 20} h9 v6 h-9 Z`} fill="none" stroke="oklch(0.74 0.17 45)" strokeWidth="1.4" opacity="0.9" />
        <path d={`M${60 - hipW * 0.9} ${hipY + 2} Q60 ${hipY + 6} ${60 + hipW * 0.9} ${hipY + 2}`} fill="none" stroke="oklch(0.74 0.17 45)" strokeWidth="3" />
      </g>
    ),
  },
  stage_jacket: {
    flare: 5, lift: 1,
    fill: "oklch(0.32 0.11 290)", shade: "oklch(0.25 0.1 291)",
    collar: "oklch(0.8 0.19 350)", sleeve: "oklch(0.28 0.11 290)",
    detail: ({ hipW, hipY, topY, hemY }) => (
      <g>
        {/* neon lapels running down the chest */}
        <path d={`M${60 - 12} ${topY + 1} L60 ${topY + 17} L${60 + 12} ${topY + 1}`} fill="none" stroke="oklch(0.8 0.19 350)" strokeWidth="3.2" strokeLinejoin="round" />
        <path d={`M60 ${topY + 17} V${hemY - 5}`} stroke="oklch(0.75 0.18 200)" strokeWidth="2" opacity="0.9" />
        <circle cx={60 - hipW * 0.55} cy={topY + 21} r="2.4" fill="oklch(0.84 0.18 75)" />
        <path d={`M${60 - hipW * 0.92} ${hipY + 1} Q60 ${hipY + 5} ${60 + hipW * 0.92} ${hipY + 1}`} fill="none" stroke="oklch(0.75 0.18 200)" strokeWidth="3" />
        <path d={`M${60 + hipW * 0.45} ${topY + 24} l4 7 -4 7`} fill="none" stroke="oklch(0.8 0.19 350)" strokeWidth="1.6" opacity="0.7" strokeLinecap="round" />
      </g>
    ),
  },
};

/**
 * The torso — bare fur, or the outfit that replaces it.
 * Rendered before the head, so the head always overlaps the collar and the
 * garment can tuck right under the chin with no seam.
 */
function Torso({ anchor, outfit, uid, bib, bibFill = "#fff", bibOpacity = 0.95, bibExtra, bareBody, children }) {
  const t = anchor.torso;
  const look = outfit ? OUTFIT[outfit] : null;

  if (!look) {
    // bareBody is for species whose undressed torso is not a separate shape
    // (the owl's loaf already covers it — only the belly marking differs).
    return (
      <g>
        {bareBody ?? (
          <>
            <path d={torsoPath(t)} fill={`url(#body-${uid})`} />
            {bib && <path d={bib} fill={bibFill} opacity={bibOpacity} />}
            {bibExtra}
          </>
        )}
        {children}
      </g>
    );
  }

  // The garment reshapes the body: it starts a touch higher and falls wider.
  // `waist` (0..1 of the way down the torso) pinches it there first, which is
  // what separates a tailored dress from a shapeless smock.
  const topY = t.topY - look.lift;
  const g = {
    topY,
    topW: t.topW,
    hipY: t.hipY,
    hipW: t.hipW + look.flare,
    hemY: t.hemY,
  };
  if (look.waist) {
    g.waistY = topY + (t.hemY - topY) * look.waist;
    g.waistW = t.topW + (look.waistFlare ?? 0);
  }
  const shoulderY = g.topY + 6;

  return (
    <g>
      {look.cape && (
        <path
          d={`M${60 - g.topW - 2} ${g.topY + 4}
              C${60 - g.hipW - 16} ${g.hipY - 6} ${60 - g.hipW - 14} ${g.hemY - 4} ${60 - g.hipW - 8} ${g.hemY + 1}
              L${60 - g.hipW + 2} ${g.hemY - 4}
              L${60 - g.topW + 3} ${g.topY + 8} Z
              M${60 + g.topW + 2} ${g.topY + 4}
              C${60 + g.hipW + 16} ${g.hipY - 6} ${60 + g.hipW + 14} ${g.hemY - 4} ${60 + g.hipW + 8} ${g.hemY + 1}
              L${60 + g.hipW - 2} ${g.hemY - 4}
              L${60 + g.topW - 3} ${g.topY + 8} Z`}
          fill={look.cape}
        />
      )}
      {/* the garment body itself */}
      <path d={torsoPath(g)} fill={look.fill} />
      {/* Side shading for volume, clipped to the garment so it can never spill
          past the silhouette whatever shape the outfit asks for. */}
      <clipPath id={`cloth-${uid}`}>
        <path d={torsoPath(g)} />
      </clipPath>
      <g clipPath={`url(#cloth-${uid})`}>
        <ellipse cx={60 - g.hipW * 0.75} cy={(g.topY + g.hemY) / 2} rx={g.hipW * 0.55} ry={(g.hemY - g.topY) * 0.75} fill={look.shade} opacity="0.45" />
        <ellipse cx={60 + g.hipW * 0.85} cy={(g.topY + g.hemY) / 2} rx={g.hipW * 0.4} ry={(g.hemY - g.topY) * 0.7} fill="#fff" opacity="0.1" />
      </g>
      {look.sleeve && (
        <g fill={look.sleeve}>
          {/* short sleeve caps where the arms would leave the shoulders */}
          <path d={`M${60 - g.topW - 1} ${shoulderY - 4} C${60 - g.hipW - 3} ${shoulderY - 1} ${60 - g.hipW - 4} ${shoulderY + 9} ${60 - g.hipW - 1} ${shoulderY + 13} L${60 - g.hipW + 6} ${shoulderY + 9} C${60 - g.topW - 2} ${shoulderY + 5} ${60 - g.topW - 1} ${shoulderY} ${60 - g.topW - 1} ${shoulderY - 4} Z`} />
          <path d={`M${60 + g.topW + 1} ${shoulderY - 4} C${60 + g.hipW + 3} ${shoulderY - 1} ${60 + g.hipW + 4} ${shoulderY + 9} ${60 + g.hipW + 1} ${shoulderY + 13} L${60 + g.hipW - 6} ${shoulderY + 9} C${60 + g.topW + 2} ${shoulderY + 5} ${60 + g.topW + 1} ${shoulderY} ${60 + g.topW + 1} ${shoulderY - 4} Z`} />
        </g>
      )}
      {look.collar && (
        <path
          d={`M${60 - g.topW + 1} ${g.topY + 1} Q60 ${g.topY + 9} ${60 + g.topW - 1} ${g.topY + 1}`}
          fill="none"
          stroke={look.collar}
          strokeWidth="3.2"
          strokeLinecap="round"
        />
      )}
      {look.detail?.(g)}
      {children}
    </g>
  );
}

/* ---------------- Species (each visually unique, with a torso) ---------------- */

function Fox({ mood, uid, outfit, anchor, children }) {
  const fur = `url(#fur-${uid})`;
  return (
    <g className="pet__body">
      <Defs uid={uid} from="oklch(0.78 0.16 55)" to="oklch(0.64 0.17 45)" bodyFrom="oklch(0.72 0.16 50)" bodyTo="oklch(0.6 0.17 44)" />
      {/* A broad base hides beneath the torso, so the tail feels attached. */}
      <g className="pet__tail pet__tail--fox">
        <path d="M67 102 C94 112 114 100 111 81 C109 67 100 63 90 69 C100 75 102 84 97 91 C92 98 82 99 67 94 Z" fill="oklch(0.6 0.17 44)" />
        <path d="M104 71 C112 78 112 89 105 96 C101 99 96 100 92 98 C99 94 103 88 102 82 C101 77 98 74 94 72 Z" fill="#fff" opacity="0.94" />
        <path d="M82 96 C88 100 94 99 98 95 M86 91 C92 95 97 93 100 89" stroke="oklch(0.68 0.17 46)" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.8" />
      </g>
      {/* torso — or the outfit that replaces it */}
      <Torso anchor={anchor} outfit={outfit} uid={uid} bib="M60 74 C50 74 46 92 60 102 C74 92 70 74 60 74 Z" />
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

function Raccoon({ mood, uid, outfit, anchor, children }) {
  const fur = `url(#fur-${uid})`;
  return (
    <g className="pet__body">
      <Defs uid={uid} from="oklch(0.72 0.02 265)" to="oklch(0.56 0.02 265)" bodyFrom="oklch(0.66 0.02 265)" bodyTo="oklch(0.5 0.02 265)" blush="oklch(0.72 0.12 20 / 0.5)" />
      {/* A fuller, banded tail starts beneath the hip instead of beside it. */}
      <g className="pet__tail pet__tail--raccoon">
        <path d="M67 102 C92 110 113 99 111 81 C110 67 99 62 87 69 C97 73 101 80 99 87 C97 97 85 100 67 94 Z" fill="oklch(0.5 0.02 265)" />
        <path d="M103 70 C109 74 112 80 111 85 L101 89 C102 82 100 76 96 73 Z" fill="oklch(0.26 0.02 265)" />
        <path d="M101 89 C99 95 94 99 89 100 L85 92 C91 90 96 86 97 81 Z" fill="oklch(0.26 0.02 265)" />
        <path d="M89 100 C82 102 73 100 67 94 L75 87 C80 92 87 94 92 92 Z" fill="oklch(0.26 0.02 265)" />
        <path d="M69 95 C77 101 87 103 92 99 C84 100 77 97 74 91 Z" fill="oklch(0.78 0.01 265)" opacity="0.66" />
      </g>
      {/* torso — or the outfit that replaces it */}
      <Torso
        anchor={anchor}
        outfit={outfit}
        uid={uid}
        bib="M60 74 C51 74 48 92 60 102 C72 92 69 74 60 74 Z"
        bibFill="oklch(0.82 0.01 265)"
        bibOpacity={0.9}
      />
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

function Squirrel({ mood, uid, outfit, anchor, children }) {
  const fur = `url(#fur-${uid})`;
  return (
    <g className="pet__body">
      <Defs uid={uid} from="oklch(0.68 0.13 48)" to="oklch(0.54 0.14 42)" bodyFrom="oklch(0.64 0.13 46)" bodyTo="oklch(0.5 0.14 42)" />
      {/* The tail overlaps the torso at its base, keeping the curl connected. */}
      <g className="pet__tail pet__tail--squirrel">
        <path d="M64 103 C95 112 118 91 111 63 C107 46 95 35 81 40 C94 48 101 61 97 73 C93 84 81 89 64 84 C73 91 72 99 64 103 Z" fill="oklch(0.6 0.13 45)" />
        <path d="M82 43 C99 52 105 69 96 81 C92 86 85 88 78 85 C90 79 95 70 92 61 C90 53 85 48 79 46 Z" fill="oklch(0.72 0.12 50)" opacity="0.72" />
        <path d="M108 61 C114 75 110 89 100 96 C105 86 105 77 100 69 Z" fill="oklch(0.54 0.14 42)" opacity="0.75" />
      </g>
      {/* torso — or the outfit that replaces it */}
      <Torso
        anchor={anchor}
        outfit={outfit}
        uid={uid}
        bib="M60 76 C52 76 49 92 60 102 C71 92 68 76 60 76 Z"
        bibFill="oklch(0.92 0.04 55)"
        bibOpacity={0.9}
      />
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

function Owl({ mood, uid, outfit, anchor, children }) {
  const fur = `url(#fur-${uid})`;
  return (
    <g className="pet__body">
      <Defs uid={uid} from="oklch(0.62 0.16 262)" to="oklch(0.46 0.18 263)" bodyFrom="oklch(0.58 0.17 262)" bodyTo="oklch(0.44 0.18 263)" blush="oklch(0.72 0.14 40 / 0.5)" />
      {/* one-piece rounded loaf body (owls have no neck) */}
      <path d="M60 20 C34 20 26 44 28 70 C30 96 90 96 92 70 C94 44 86 20 60 20 Z" fill={fur} />
      {/* wings hugging the sides — tucked under the garment when dressed */}
      {!outfit && <path d="M30 58 C24 66 26 84 34 90 C34 78 34 68 36 60 Z" fill={`url(#body-${uid})`} />}
      {!outfit && <path d="M90 58 C96 66 94 84 86 90 C86 78 86 68 84 60 Z" fill={`url(#body-${uid})`} />}
      {/* ear tufts */}
      <path d="M38 24 L32 8 L50 22 Z" fill="oklch(0.44 0.18 263)" />
      <path d="M82 24 L88 8 L70 22 Z" fill="oklch(0.44 0.18 263)" />
      {/* speckled belly — or the outfit that takes its place */}
      <Torso
        anchor={anchor}
        outfit={outfit}
        uid={uid}
        bareBody={
          <g>
            <path d="M60 46 C44 46 40 78 60 92 C80 78 76 46 60 46 Z" fill="oklch(0.94 0.05 60)" />
            <g fill="oklch(0.8 0.08 60)" opacity="0.7">
              <circle cx="54" cy="66" r="1.6" /><circle cx="66" cy="66" r="1.6" />
              <circle cx="60" cy="74" r="1.6" /><circle cx="52" cy="78" r="1.4" /><circle cx="68" cy="78" r="1.4" />
            </g>
          </g>
        }
      />
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
      {/* Short legs make the toes feel attached to the body instead of floating. */}
      <g stroke="var(--accent-strong)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M49 94 L49 105 M71 94 L71 105" />
        <path d="M49 105 l-4 6 M49 105 l0 7 M49 105 l4 6" />
        <path d="M71 105 l-4 6 M71 105 l0 7 M71 105 l4 6" />
      </g>
      {children}
    </g>
  );
}

function Cat({ mood, uid, outfit, anchor, children }) {
  const fur = `url(#fur-${uid})`;
  const stripe = "oklch(0.5 0.06 55)";
  return (
    <g className="pet__body">
      <Defs uid={uid} from="oklch(0.74 0.05 60)" to="oklch(0.6 0.06 55)" bodyFrom="oklch(0.7 0.05 58)" bodyTo="oklch(0.56 0.06 54)" />
      {/* A cat's tail is slim and tapered: it grows under the hip and makes one soft curl. */}
      <g className="pet__tail pet__tail--cat">
        <path d="M69 100 C82 105 99 103 104 92 C109 81 104 72 96 71 C101 78 101 84 97 90 C92 97 80 97 69 92 Z" fill="oklch(0.58 0.06 54)" />
        <path d="M97 72 C103 76 106 83 103 89 C101 93 98 95 94 95 C99 88 100 81 96 75 Z" fill="oklch(0.7 0.06 57)" opacity="0.72" />
        <path d="M89 97 C94 96 98 93 100 89 M83 96 C88 95 92 92 94 88" stroke={stripe} strokeWidth="1.8" fill="none" strokeLinecap="round" opacity="0.62" />
      </g>
      {/* torso — or the outfit that replaces it */}
      <Torso
        anchor={anchor}
        outfit={outfit}
        uid={uid}
        bib="M60 76 C52 76 49 92 60 102 C71 92 68 76 60 76 Z"
        bibOpacity={0.9}
        bibExtra={<path d="M46 88 q14 6 28 0" stroke={stripe} strokeWidth="2.4" fill="none" strokeLinecap="round" opacity="0.6" />}
      />
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

function Crown({ anchor }) {
  const y = anchor.crownY + 1;
  const w = Math.min(anchor.crownW, 24);
  return <g className="acc acc--head"><path d={`M${60 - w} ${y} L${60 - w + 3} ${y - 17} L${51} ${y - 8} L60 ${y - 22} L69 ${y - 8} L${60 + w - 3} ${y - 17} L${60 + w} ${y} Z`} fill="var(--accent)" stroke="oklch(0.58 0.16 70)" strokeWidth="2" /><circle cx="60" cy={y - 12} r="3" fill="var(--primary)" /></g>;
}

function Headphones({ anchor }) {
  const [left, right] = anchor.eyeCx;
  const y = anchor.eyeCy;
  return <g className="acc acc--ears" fill="none" stroke="var(--primary)" strokeWidth="4"><path d={`M${left - 10} ${y} C${left - 10} ${y - 30} ${right + 10} ${y - 30} ${right + 10} ${y}`} /><rect x={left - 15} y={y - 7} width="9" height="19" rx="4" fill="var(--primary)" /><rect x={right + 6} y={y - 7} width="9" height="19" rx="4" fill="var(--primary)" /></g>;
}

function Pendant({ anchor }) {
  const y = anchor.neckY + 2;
  return <g className="acc acc--neck"><path d={`M44 ${y - 4} Q60 ${y + 18} 76 ${y - 4}`} fill="none" stroke="oklch(0.58 0.14 75)" strokeWidth="2.5" /><circle cx="60" cy={y + 13} r="5" fill="var(--accent)" stroke="oklch(0.58 0.14 75)" strokeWidth="2" /></g>;
}

/**
 * Vertical offset for footwear, as an SVG transform.
 *
 * It MUST be applied to a group nested inside `.acc`, never on `.acc` itself:
 * the CSS `acc-pop` entrance animation animates `transform`, and an animated
 * CSS transform overrides the element's own transform attribute outright — the
 * shoes would silently render at the default height no matter what feetY says.
 */
function feetShift(anchor) {
  return `translate(0 ${(anchor?.feetY ?? 98) - 98})`;
}

function Boots({ anchor }) {
  return <g className="acc acc--feet" fill="oklch(0.38 0.08 45)"><g transform={feetShift(anchor)}><path d="M36 98 h19 v11 H32 q-4 0-2-5 q2-4 6-6 Z" /><path d="M65 98 h19 q4 2 6 6 q2 5-2 5 H65 Z" /><path d="M38 99 h15" stroke="var(--accent)" strokeWidth="3" /><path d="M67 99 h15" stroke="var(--accent)" strokeWidth="3" /></g></g>;
}

/* ---------------- Standalone accessories ----------------
   Small worn items with no outfit set behind them — mix-and-match pieces
   rather than parts of a themed look. */

function Bandana({ anchor }) {
  const { neckY: y, neckW: w } = anchor;
  const l = 60 - w, r = 60 + w;
  return (
    <g className="acc acc--neck">
      <path d={`M${l} ${y - 2} Q60 ${y + 6} ${r} ${y - 2} L${r - 2} ${y + 4} Q60 ${y + 11} ${l + 2} ${y + 4} Z`} fill="oklch(0.55 0.19 25)" />
      <g fill="#fff" opacity="0.85">
        <circle cx={60 - w * 0.4} cy={y + 2} r="1.4" /><circle cx="60" cy={y + 4} r="1.4" /><circle cx={60 + w * 0.4} cy={y + 2} r="1.4" />
      </g>
      {/* knot trailing down one side */}
      <path d={`M${r - 4} ${y + 2} q6 3 5 10 q-1 4 -5 3 q3 -4 0 -8 q-2 -3 0 -5 Z`} fill="oklch(0.48 0.18 25)" />
    </g>
  );
}

function FlowerCrown({ anchor }) {
  const y = anchor.crownY + 4;
  const w = anchor.crownW;
  const flower = (cx, cy, s, hue) => (
    <g key={`${cx}-${cy}`}>
      <g fill={`oklch(0.78 0.16 ${hue})`}>
        <circle cx={cx - s} cy={cy} r={s} /><circle cx={cx + s} cy={cy} r={s} />
        <circle cx={cx} cy={cy - s} r={s} /><circle cx={cx} cy={cy + s} r={s} />
      </g>
      <circle cx={cx} cy={cy} r={s * 0.8} fill="oklch(0.85 0.15 90)" />
    </g>
  );
  return (
    <g className="acc acc--head">
      <path d={`M${60 - w} ${y} Q60 ${y - 6} ${60 + w} ${y}`} fill="none" stroke="oklch(0.56 0.13 140)" strokeWidth="3.5" strokeLinecap="round" />
      {flower(60 - w * 0.65, y - 2, 3, 350)}
      {flower(60 - w * 0.2, y - 5, 2.6, 40)}
      {flower(60 + w * 0.25, y - 5, 2.8, 300)}
      {flower(60 + w * 0.65, y - 2, 3, 200)}
      <g stroke="oklch(0.62 0.15 140)" strokeWidth="1.4" strokeLinecap="round" opacity="0.8">
        <path d={`M${60 - w * 0.4} ${y - 2} l-2 4 M${60 + w * 0.45} ${y - 3} l2 4`} />
      </g>
    </g>
  );
}

function Monocle({ anchor }) {
  const [, right] = anchor.eyeCx;
  const y = anchor.eyeCy;
  const r = anchor.eyeR - 1;
  return (
    <g className="acc acc--eyes" fill="none" stroke="oklch(0.6 0.13 75)" strokeWidth="2.4">
      <circle cx={right} cy={y} r={r} fill="oklch(0.85 0.05 75 / 0.18)" />
      <circle cx={right} cy={y} r={r + 2} stroke="oklch(0.42 0.1 75)" strokeWidth="1.4" />
      {/* chain looping down to the chest */}
      <path d={`M${right + r} ${y + 2} Q${right + r + 8} ${y + 12} ${right + 2} ${y + 22}`} strokeWidth="1.4" strokeDasharray="1.5 2" />
    </g>
  );
}

function PartyHat({ anchor }) {
  const base = anchor.crownY + 4;
  const w = Math.min(anchor.crownW, 18);
  return (
    <g className="acc acc--head">
      <path d={`M${60 - w} ${base} L60 ${base - 26} L${60 + w} ${base} Z`} fill="oklch(0.68 0.19 340)" />
      <path d={`M${60 - w} ${base} L60 ${base - 26} L60 ${base} Z`} fill="oklch(0.6 0.19 340)" opacity="0.7" />
      <g fill="oklch(0.85 0.15 90)">
        <circle cx="60" cy={base - 22} r="2.2" /><circle cx={60 - 4} cy={base - 12} r="1.8" /><circle cx={60 + 5} cy={base - 8} r="1.8" />
      </g>
      <circle cx="60" cy={base - 27} r="2.6" fill="oklch(0.9 0.1 90)" />
    </g>
  );
}

function SunglassesRound({ anchor }) {
  const { eyeCx: [left, right], eyeCy: y, eyeR: r } = anchor;
  return (
    <g className="acc acc--eyes" fill="oklch(0.2 0.02 260)" stroke="oklch(0.32 0.03 260)" strokeWidth="1.6">
      <circle cx={left} cy={y} r={r + 1} />
      <circle cx={right} cy={y} r={r + 1} />
      <path d={`M${left + r + 1} ${y} H${right - r - 1}`} stroke="oklch(0.32 0.03 260)" fill="none" />
      <path d={`M${left - r - 1} ${y} L${left - r - 11} ${y - 3}`} stroke="oklch(0.32 0.03 260)" fill="none" />
      <path d={`M${right + r + 1} ${y} L${right + r + 11} ${y - 3}`} stroke="oklch(0.32 0.03 260)" fill="none" />
      <circle cx={left - r * 0.3} cy={y - r * 0.3} r={r * 0.22} fill="#fff" opacity="0.5" />
      <circle cx={right - r * 0.3} cy={y - r * 0.3} r={r * 0.22} fill="#fff" opacity="0.5" />
    </g>
  );
}

function BellCollar({ anchor }) {
  const y = anchor.neckY + 3;
  const w = anchor.neckW;
  return (
    <g className="acc acc--neck">
      <path d={`M${60 - w} ${y - 2} Q60 ${y + 5} ${60 + w} ${y - 2}`} fill="none" stroke="oklch(0.6 0.16 25)" strokeWidth="4" strokeLinecap="round" />
      <circle cx="60" cy={y + 6} r="4" fill="oklch(0.8 0.15 85)" stroke="oklch(0.6 0.14 80)" strokeWidth="1.2" />
      <circle cx="60" cy={y + 8.5} r="1" fill="oklch(0.45 0.1 80)" />
      <path d={`M60 ${y + 4} v2`} stroke="oklch(0.6 0.14 80)" strokeWidth="1" />
    </g>
  );
}

function RibbonBow({ anchor }) {
  const y = anchor.crownY - 1;
  return (
    <g className="acc acc--head">
      <path d={`M60 ${y} l-8 -5 v10 Z M60 ${y} l8 -5 v10 Z`} fill="oklch(0.62 0.19 340)" />
      <path d={`M60 ${y} l-8 -5 l3 5 l-3 5 Z`} fill="oklch(0.52 0.19 340)" opacity="0.6" />
      <path d={`M60 ${y} l8 -5 l-3 5 l3 5 Z`} fill="oklch(0.52 0.19 340)" opacity="0.6" />
      <circle cx="60" cy={y} r="3" fill="oklch(0.7 0.17 340)" />
    </g>
  );
}

function Sandals({ anchor }) {
  return (
    <g className="acc acc--feet">
      <g transform={feetShift(anchor)}>
        <g fill="oklch(0.7 0.1 55)">
          <path d="M36 103 h18 v6 q0 2 -2 2 H38 q-2 0 -2 -2 Z" />
          <path d="M66 103 h18 v6 q0 2 -2 2 H68 q-2 0 -2 -2 Z" />
        </g>
        <g stroke="oklch(0.5 0.14 30)" strokeWidth="1.6" fill="none">
          <path d="M39 103 L45 98 M48 103 L45 98 M51 103 L45 98" />
          <path d="M69 103 L75 98 M72 103 L75 98 M75 103 L75 98" />
        </g>
      </g>
    </g>
  );
}

function WizardHat({ anchor }) {
  const base = anchor.crownY + 2;
  const w = anchor.crownW;
  return (
    <g className="acc acc--head">
      <ellipse cx="60" cy={base} rx={w + 4} ry="4" fill="oklch(0.42 0.14 280)" />
      <path d={`M${60 - w * 0.7} ${base} Q58 ${base - 22} 56 ${base - 30} Q60 ${base - 26} 63 ${base - 32} Q65 ${base - 20} ${60 + w * 0.7} ${base} Z`} fill="oklch(0.46 0.15 280)" />
      <circle cx="59" cy={base - 24} r="1.6" fill="oklch(0.85 0.15 90)" />
      <circle cx="61.5" cy={base - 14} r="1.3" fill="oklch(0.85 0.15 90)" />
      <path d={`M${60 - w * 0.75} ${base - 3} Q60 ${base - 8} ${60 + w * 0.75} ${base - 3}`} fill="none" stroke="oklch(0.6 0.16 45)" strokeWidth="2.5" />
    </g>
  );
}

function PinkTiara({ anchor }) {
  const y = anchor.crownY + 3;
  const w = Math.min(anchor.crownW, 23);
  return (
    <g className="acc acc--head">
      <path d={`M${60 - w} ${y} L${60 - w + 4} ${y - 15} L51 ${y - 7} L60 ${y - 21} L69 ${y - 7} L${60 + w - 4} ${y - 15} L${60 + w} ${y} Z`} fill="oklch(0.76 0.18 350)" stroke="oklch(0.57 0.19 345)" strokeWidth="1.8" />
      <circle cx="60" cy={y - 12} r="3.4" fill="oklch(0.9 0.09 330)" />
      <circle cx={60 - w + 5} cy={y - 9} r="2.2" fill="#fff" />
      <circle cx={60 + w - 5} cy={y - 9} r="2.2" fill="#fff" />
    </g>
  );
}

function PearlCollar({ anchor }) {
  const y = anchor.neckY + 1;
  return (
    <g className="acc acc--neck" fill="#fff" stroke="oklch(0.76 0.05 330)" strokeWidth="0.8">
      {[-15, -10, -5, 0, 5, 10, 15].map((x, index) => <circle key={x} cx={60 + x} cy={y + 5 + Math.abs(index - 3) * -0.7} r="3.1" />)}
      <path d={`M56 ${y + 8} Q60 ${y + 17} 64 ${y + 8}`} fill="none" stroke="oklch(0.65 0.1 75)" strokeWidth="1.5" />
      <circle cx="60" cy={y + 14} r="3" fill="oklch(0.78 0.17 350)" stroke="none" />
    </g>
  );
}

function PinkShoes({ anchor }) {
  return <g className="acc acc--feet"><g transform={feetShift(anchor)}><path d="M35 99 h20 v10 H31 q-4 0-2-5 q2-4 6-5 Z" fill="oklch(0.72 0.18 350)" /><path d="M65 99 h20 q4 1 6 5 q2 5-2 5 H65 Z" fill="oklch(0.72 0.18 350)" /><path d="M38 100 q7 5 14 0 M68 100 q7 5 14 0" fill="none" stroke="oklch(0.93 0.07 345)" strokeWidth="2.5" /><circle cx="45" cy="101" r="2.5" fill="#fff" /><circle cx="75" cy="101" r="2.5" fill="#fff" /></g></g>;
}

function SpaceHelmet({ anchor }) {
  const top = anchor.crownY - 6;
  const height = anchor.eyeCy - top + 25;
  return (
    <g className="acc acc--head">
      <ellipse cx="60" cy={top + height / 2} rx={anchor.crownW + 7} ry={height / 2} fill="oklch(0.9 0.04 245 / 0.18)" stroke="oklch(0.63 0.13 255)" strokeWidth="3" />
      <path d={`M${34} ${anchor.eyeCy + 17} Q60 ${anchor.eyeCy + 23} 86 ${anchor.eyeCy + 17}`} fill="none" stroke="oklch(0.39 0.16 273)" strokeWidth="4" />
      <path d={`M42 ${top + 8} Q50 ${top + 2} 58 ${top + 4}`} fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity="0.9" />
    </g>
  );
}

function SpaceVisor({ anchor }) {
  const [left, right] = anchor.eyeCx;
  const y = anchor.eyeCy;
  return <g className="acc acc--eyes"><path d={`M${left - 10} ${y - 8} Q60 ${y - 13} ${right + 10} ${y - 8} L${right + 7} ${y + 8} Q60 ${y + 13} ${left - 7} ${y + 8} Z`} fill="oklch(0.46 0.16 255 / 0.7)" stroke="oklch(0.75 0.14 220)" strokeWidth="2" /><path d={`M${left - 3} ${y - 6} Q60 ${y - 9} ${right + 3} ${y - 5}`} fill="none" stroke="#fff" strokeWidth="2" opacity="0.75" /></g>;
}

function MoonBoots({ anchor }) {
  return <g className="acc acc--feet"><g transform={feetShift(anchor)}><path d="M34 97 h21 v12 H29 q-3-6 5-12 Z M65 97 h21 q8 6 5 12 H65 Z" fill="oklch(0.87 0.035 255)" stroke="oklch(0.55 0.13 265)" strokeWidth="1.8" /><path d="M33 104 h21 M66 104 h21" stroke="oklch(0.72 0.17 45)" strokeWidth="3" /></g></g>;
}

function HeroMask({ anchor }) {
  const [left, right] = anchor.eyeCx;
  const y = anchor.eyeCy;
  return <g className="acc acc--eyes"><path d={`M${left - 12} ${y - 8} Q${left} ${y - 13} 60 ${y - 5} Q${right} ${y - 13} ${right + 12} ${y - 8} L${right + 8} ${y + 8} Q${right} ${y + 12} 60 ${y + 4} Q${left} ${y + 12} ${left - 8} ${y + 8} Z`} fill="oklch(0.43 0.19 285)" /><ellipse cx={left} cy={y} rx="6" ry="4" fill="#fff" /><ellipse cx={right} cy={y} rx="6" ry="4" fill="#fff" /></g>;
}

function HeroBoots({ anchor }) {
  return <g className="acc acc--feet" fill="oklch(0.62 0.21 25)"><g transform={feetShift(anchor)}><path d="M34 96 h21 v13 H29 q-3-6 5-13 Z M65 96 h21 q8 7 5 13 H65 Z" /><path d="M35 100 h19 M66 100 h19" stroke="oklch(0.82 0.17 75)" strokeWidth="3" /></g></g>;
}

function HeroHeadband({ anchor }) {
  const y = anchor.crownY + 10;
  const w = anchor.crownW + 2;
  return <g className="acc acc--head"><path d={`M${60 - w} ${y} Q60 ${y - 7} ${60 + w} ${y} L${60 + w - 1} ${y + 6} Q60 ${y} ${60 - w + 1} ${y + 6} Z`} fill="oklch(0.68 0.21 25)" /><path d={`M${60 + w - 1} ${y + 2} l13 -6 -6 11 9 4 -16 2 Z`} fill="oklch(0.8 0.17 75)" /></g>;
}

function ScholarBeret({ anchor }) {
  const y = anchor.crownY + 3;
  const w = anchor.crownW;
  return <g className="acc acc--head"><ellipse cx="60" cy={y - 8} rx={w} ry="12" fill="oklch(0.38 0.13 292)" /><path d={`M${60 - w} ${y - 6} Q60 ${y + 2} ${60 + w} ${y - 6}`} fill="none" stroke="oklch(0.29 0.1 292)" strokeWidth="4" /><circle cx="60" cy={y - 21} r="3" fill="oklch(0.72 0.17 45)" /></g>;
}

function ScholarGlasses({ anchor }) {
  const { eyeCx: [left, right], eyeCy: y, eyeR } = anchor;
  return <g className="acc acc--eyes" fill="oklch(0.95 0.02 260 / 0.18)" stroke="oklch(0.31 0.07 292)" strokeWidth="2.2"><circle cx={left} cy={y} r={eyeR + 1} /><circle cx={right} cy={y} r={eyeR + 1} /><path d={`M${left + eyeR + 1} ${y} H${right - eyeR - 1}`} /></g>;
}

function ScholarShoes({ anchor }) {
  return <g className="acc acc--feet"><g transform={feetShift(anchor)}><path d="M35 100 h20 v9 H30 q-2-5 5-9 Z M65 100 h20 q7 4 5 9 H65 Z" fill="oklch(0.94 0.02 290)" stroke="oklch(0.38 0.13 292)" strokeWidth="1.8" /><path d="M37 102 h15 M68 102 h15" stroke="oklch(0.72 0.17 45)" strokeWidth="2.5" /></g></g>;
}

function StarGlasses({ anchor }) {
  const [left, right] = anchor.eyeCx;
  const y = anchor.eyeCy;
  const star = (cx) => `${cx},${y - 10} ${cx + 3},${y - 3} ${cx + 10},${y - 3} ${cx + 5},${y + 2} ${cx + 7},${y + 9} ${cx},${y + 5} ${cx - 7},${y + 9} ${cx - 5},${y + 2} ${cx - 10},${y - 3} ${cx - 3},${y - 3}`;
  return <g className="acc acc--eyes" fill="oklch(0.78 0.2 350)" stroke="oklch(0.49 0.18 292)" strokeWidth="1.7"><polygon points={star(left)} /><polygon points={star(right)} /><path d={`M${left + 8} ${y} H${right - 8}`} /></g>;
}

function NeonShoes({ anchor }) {
  return <g className="acc acc--feet"><g transform={feetShift(anchor)}><path d="M34 99 h21 v10 H29 q-2-6 5-10 Z M65 99 h21 q7 4 5 10 H65 Z" fill="oklch(0.3 0.09 290)" /><path d="M32 106 h23 M65 106 h23" stroke="oklch(0.78 0.18 190)" strokeWidth="3" /><path d="M38 101 h14 M68 101 h14" stroke="oklch(0.82 0.2 350)" strokeWidth="2" /></g></g>;
}

function StarHeadphones({ anchor }) {
  const [left, right] = anchor.eyeCx;
  const y = anchor.eyeCy;
  return <g className="acc acc--ears" fill="none" stroke="oklch(0.75 0.2 350)" strokeWidth="4"><path d={`M${left - 11} ${y} C${left - 11} ${y - 31} ${right + 11} ${y - 31} ${right + 11} ${y}`} /><rect x={left - 16} y={y - 7} width="10" height="20" rx="4" fill="oklch(0.42 0.17 292)" /><rect x={right + 6} y={y - 7} width="10" height="20" rx="4" fill="oklch(0.42 0.17 292)" /><circle cx={left - 11} cy={y + 3} r="3" fill="oklch(0.85 0.18 75)" stroke="none" /><circle cx={right + 11} cy={y + 3} r="3" fill="oklch(0.85 0.18 75)" stroke="none" /></g>;
}

const ACCESSORY = {
  scarf: Scarf,
  bowtie: Bowtie,
  glasses: Glasses,
  tophat: TopHat,
  cap: Cap,
  crown: Crown,
  headphones: Headphones,
  pendant: Pendant,
  boots: Boots,
  pink_tiara: PinkTiara,
  pearl_collar: PearlCollar,
  pink_shoes: PinkShoes,
  space_helmet: SpaceHelmet,
  space_visor: SpaceVisor,
  moon_boots: MoonBoots,
  hero_mask: HeroMask,
  hero_boots: HeroBoots,
  hero_headband: HeroHeadband,
  scholar_beret: ScholarBeret,
  scholar_glasses: ScholarGlasses,
  scholar_shoes: ScholarShoes,
  star_glasses: StarGlasses,
  neon_shoes: NeonShoes,
  star_headphones: StarHeadphones,
  bandana: Bandana,
  flower_crown: FlowerCrown,
  monocle: Monocle,
  party_hat: PartyHat,
  sunglasses_round: SunglassesRound,
  bell_collar: BellCollar,
  ribbon_bow: RibbonBow,
  sandals: Sandals,
  wizard_hat: WizardHat,
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
  crown: "30 0 60 34",
  headphones: "28 14 64 56",
  pendant: "34 60 52 40",
  boots: "24 92 72 22",
  pink_tiara: "30 0 60 34",
  // Clothing previews frame the whole dressed torso (sleeves included).
  pink_dress: "22 64 76 48",
  pearl_collar: "36 66 48 34",
  pink_shoes: "24 92 72 22",
  space_helmet: "24 4 72 76",
  space_suit: "26 64 68 48",
  space_visor: "30 34 60 34",
  moon_boots: "24 92 72 22",
  hero_mask: "28 34 64 34",
  hero_suit: "14 64 92 48",
  hero_boots: "24 92 72 22",
  hero_headband: "25 10 75 35",
  scholar_beret: "30 0 60 34",
  scholar_glasses: "30 35 60 32",
  scholar_vest: "28 64 64 48",
  scholar_shoes: "24 94 72 20",
  star_glasses: "28 34 64 34",
  stage_jacket: "24 64 72 48",
  neon_shoes: "24 94 72 20",
  star_headphones: "28 14 64 56",
  bandana: "34 66 52 24",
  flower_crown: "26 8 68 26",
  monocle: "56 36 40 34",
  party_hat: "34 4 52 40",
  sunglasses_round: "28 34 64 28",
  bell_collar: "36 66 48 26",
  ribbon_bow: "42 12 36 24",
  sandals: "24 94 72 20",
  wizard_hat: "22 0 76 40",
};
export function AccessoryPreview({ accessory, size = 44 }) {
  // Clothing has no standalone sprite any more — it IS the torso, so the card
  // shows the dressed torso itself rather than a cut-out garment.
  if (OUTFIT[accessory]) {
    return (
      <svg viewBox={PREVIEW_VIEWBOX[accessory] ?? "0 0 120 120"} width={size} height={size} aria-hidden="true">
        <Torso anchor={ANCHOR.fox} outfit={accessory} uid={`preview-${accessory}`} />
      </svg>
    );
  }
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
