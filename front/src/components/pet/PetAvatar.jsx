import "./PetAvatar.css";

const LABEL = { fox: "лиса", raccoon: "енот", squirrel: "белка", owl: "совёнок", cat: "котёнок" };
const MOOD = { happy: "радостное", idle: "спокойное", sad: "скучает" };
const INK = "var(--ink)";

export default function PetAvatar({ species = "fox", mood = "happy", accessories = [], reaction = null, eating = null, size = 120, className = "", designVariant = "widget" }) {
  const Animal = SPECIES[species] ?? Fox;
  const activeMood = eating ? "happy" : mood;
  return (
    <div className={`pet pet--${mood} ${reaction ? `pet--${reaction}` : ""} ${eating ? "pet--eating" : ""} ${className}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" width={size} height={size} role="img" aria-label={`Питомец: ${LABEL[species]}, настроение ${MOOD[mood]}`}>
        <ellipse className="pet__shadow" cx="60" cy="109" rx="31" ry="5" />
        <g className="pet__scene">
          <Animal mood={activeMood} accessories={accessories} designVariant={designVariant} />
          {eating && <text className="pet__treat" x="60" y="18" textAnchor="middle" fontSize="18">{eating}</text>}
        </g>
        {reaction === "cheer" && <Sparkles />}
      </svg>
    </div>
  );
}

function Eyes({ mood, cx = [47, 73], cy = 51, scale = 1 }) {
  if (mood === "sad") return <g fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round"><path d={`M${cx[0] - 5} ${cy} q5 -4 10 0`} /><path d={`M${cx[1] - 5} ${cy} q5 -4 10 0`} /></g>;
  return <g>{cx.map((x) => <g key={x}><ellipse cx={x} cy={cy} rx={7 * scale} ry={9 * scale} fill={INK} /><ellipse cx={x + 2} cy={cy - 3} rx={2.8 * scale} ry={3.3 * scale} fill="#fff" /><circle cx={x - 2.2} cy={cy + 3.5} r={1.3 * scale} fill="#fff" opacity=".8" /></g>)}</g>;
}

function Face({ mood, cx = [47, 73], cy = 51, noseY = 64 }) {
  return <><ellipse cx="40" cy={noseY - 1} rx="5" ry="3" fill="oklch(0.76 0.14 20 / .45)" /><ellipse cx="80" cy={noseY - 1} rx="5" ry="3" fill="oklch(0.76 0.14 20 / .45)" /><Eyes mood={mood} cx={cx} cy={cy} /><path d={`M60 ${noseY - 3} l-4 4 h8 Z`} fill={INK} /><path d={`M55 ${noseY + 5} q5 6 10 0`} fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round" /></>;
}

function Finish({ accessories, anchor }) { return accessories.map((item) => <Accessory key={item} type={item} anchor={anchor} />); }

function Fox({ mood, accessories, designVariant }) {
  if (designVariant === "cozy") return <FoxOrigami mood={mood} accessories={accessories} />;
  if (designVariant === "sticker") return <FoxLong mood={mood} accessories={accessories} />;
  if (designVariant === "storybook") return <FoxFluffy mood={mood} accessories={accessories} />;
  return <FoxRound mood={mood} accessories={accessories} />;
}

function FoxRound({ mood, accessories }) {
  const anchor = { neckY: 77, eyes: [48, 72], crownY: 25 };
  return <g className="pet__body">
    <path d="M76 96 C107 101 107 72 84 74 C99 84 90 96 75 89 Z" fill="#dc7136" stroke={INK} strokeWidth="2.2" /><path d="M92 83 q9 1 8-6 q-7 5-14 2" fill="#fff5ea" />
    <circle cx="60" cy="89" r="23" fill="#f28a41" stroke={INK} strokeWidth="2.2" /><ellipse cx="60" cy="97" rx="13" ry="12" fill="#fff8f1" />
    <path d="M34 42 L29 19 L51 33 Z M86 42 L91 19 L69 33 Z" fill="#e67a39" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" /><circle cx="60" cy="52" r="29" fill="#f28a41" stroke={INK} strokeWidth="2.2" />
    <ellipse cx="60" cy="65" rx="19" ry="13" fill="#fff8f1" /><Face mood={mood} cx={[48, 72]} cy={53} noseY={66} /><Finish accessories={accessories} anchor={anchor} />
  </g>;
}

function FoxOrigami({ mood, accessories }) {
  const anchor = { neckY: 76, eyes: [48, 72], crownY: 20 };
  return <g className="pet__body">
    <path d="M75 95 L104 86 L88 67 L76 78 Z" fill="#b9502f" stroke={INK} strokeWidth="2" strokeLinejoin="round" /><path d="M85 84 l15 2 -11-12 Z" fill="#fff3e8" />
    <path d="M43 77 L60 67 L80 81 L75 106 L45 106 L38 90 Z" fill="#d96535" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" /><path d="M60 76 l12 12 -12 15 -12-15 Z" fill="#fff5ea" />
    <path d="M33 43 L30 12 L54 31 Z M87 43 L90 12 L66 31 Z" fill="#c65b32" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" /><path d="M60 18 L84 40 L78 65 L60 80 L42 65 L36 40 Z" fill="#eb7a3c" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
    <path d="M60 18 L60 53 L42 65 L36 40 Z" fill="#f59a52" opacity=".7" /><path d="M60 53 L78 65 L60 80 Z" fill="#c75b32" opacity=".55" /><path d="M60 53 L48 67 L60 74 L72 67 Z" fill="#fff5ea" /><Eyes mood={mood} cx={[48, 72]} cy={52} scale={.84} /><path d="M60 59 l-4 5 h8 Z" fill={INK} /><path d="M55 68 q5 5 10 0" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" /><Finish accessories={accessories} anchor={anchor} />
  </g>;
}

function FoxLong({ mood, accessories }) {
  const anchor = { neckY: 73, eyes: [38, 50], crownY: 27 };
  return <g className="pet__body">
    <path d="M77 85 C109 92 106 55 78 62 C97 70 91 83 73 80 Z" fill="#d86e36" stroke={INK} strokeWidth="2.2" /><path d="M91 70 q11 0 9-8 q-8 6-16 3" fill="#fff4e8" />
    <path d="M39 74 C52 62 78 66 84 82 L80 98 H31 L29 83 Z" fill="#ee8540" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" /><path d="M47 79 C57 73 70 76 73 87 L65 96 H42 Z" fill="#fff5ec" /><path d="M37 94 v13 M52 94 v13 M70 94 v13 M80 92 v15" stroke={INK} strokeWidth="3" strokeLinecap="round" />
    <path d="M25 58 L22 31 L42 52 Z M54 52 L58 27 L68 57 Z" fill="#d96d35" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" /><path d="M44 48 C30 46 20 56 24 70 C28 80 47 82 59 72 C70 63 61 49 44 48 Z" fill="#f08a44" stroke={INK} strokeWidth="2.2" />
    <path d="M25 63 L13 67 L25 70" fill="#f08a44" stroke={INK} strokeWidth="2" strokeLinejoin="round" /><ellipse cx="41" cy="67" rx="15" ry="9" fill="#fff5ec" /><Eyes mood={mood} cx={[37, 49]} cy={60} scale={.66} /><path d="M27 66 l-3 3 h6 Z" fill={INK} /><path d="M28 73 q5 4 10 0" fill="none" stroke={INK} strokeWidth="1.8" strokeLinecap="round" /><Finish accessories={accessories} anchor={anchor} />
  </g>;
}

function FoxFluffy({ mood, accessories }) {
  const anchor = { neckY: 77, eyes: [47, 73], crownY: 20 };
  return <g className="pet__body">
    <path d="M76 97 C110 100 106 62 80 70 C99 80 91 95 74 89 Z" fill="#cc6232" stroke={INK} strokeWidth="2.2" /><path d="M91 80 q12 0 10-10 q-8 7-17 3" fill="#fff5eb" />
    <path d="M38 84 q-4 8 3 12 q-5 9 5 12 h28 q10-3 5-12 q7-6 1-12 q4-10-6-14 H46 q-11 4-8 14 Z" fill="#e87c3d" stroke={INK} strokeWidth="2.2" /><path d="M60 79 q-14 9-7 25 h14 q7-16-7-25 Z" fill="#fff7f0" />
    <path d="M33 43 L27 13 L53 30 Z M87 43 L93 13 L67 30 Z" fill="#cd6132" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" /><path d="M60 18 q-16 0-25 14 q-10 10 0 18 q-5 12 8 16 q4 12 17 14 q13-2 17-14 q13-4 8-16 q10-8 0-18 Q76 18 60 18 Z" fill="#ee8441" stroke={INK} strokeWidth="2.2" />
    <path d="M60 52 q-14 0-18 10 q1 12 10 16 q8 4 8 4 q0 0 8-4 q9-4 10-16 q-4-10-18-10 Z" fill="#fff7f0" /><Face mood={mood} noseY={66} /><path d="M41 42 l5-5 M79 42 l-5-5 M46 30 l4 5 M74 30 l-4 5" stroke="#f5ae71" strokeWidth="2" strokeLinecap="round" /><Finish accessories={accessories} anchor={anchor} />
  </g>;
}

function FoxWidget({ mood, accessories }) {
  const anchor = { neckY: 76, eyes: [47, 73], crownY: 22 };
  return <g className="pet__body">
    <path d="M77 91 C104 98 108 73 88 72 C99 82 90 91 76 86 Z" fill="#ef8739" stroke={INK} strokeWidth="2" strokeLinejoin="round" /><path d="M92 84 q10 0 9-6 q-6 5-13 3" fill="#fff7ed" />
    <ellipse cx="60" cy="88" rx="25" ry="22" fill="#f59642" stroke={INK} strokeWidth="2.2" /><ellipse cx="60" cy="94" rx="13" ry="14" fill="#fff9f2" />
    <path d="M35 43 L28 15 L52 31 Z M85 43 L92 15 L68 31 Z" fill="#ef8739" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" /><path d="M34 23 l8 14 -9-5 Z M86 23 l-8 14 9-5 Z" fill="#f2b3a3" />
    <path d="M60 20 C38 20 30 37 34 56 C37 71 48 79 60 79 C72 79 83 71 86 56 C90 37 82 20 60 20 Z" fill="#f59642" stroke={INK} strokeWidth="2.2" /><path d="M60 55 C47 55 42 65 48 73 C52 78 56 80 60 80 C64 80 68 78 72 73 C78 65 73 55 60 55 Z" fill="#fff9f2" />
    <Face mood={mood} noseY={66} /><Finish accessories={accessories} anchor={anchor} />
  </g>;
}

function FoxCozy({ mood, accessories }) {
  const anchor = { neckY: 72, eyes: [37, 53], crownY: 28 };
  return <g className="pet__body">
    <path d="M26 90 C29 63 59 55 84 70 C104 82 96 105 75 106 H42 C28 105 22 100 26 90 Z" fill="#b96e42" stroke={INK} strokeWidth="2.2" />
    <path d="M56 89 C69 75 89 82 88 96 C87 106 68 108 55 104 C45 101 47 94 56 89 Z" fill="#fff4e8" /><path d="M79 72 C108 75 108 45 83 48 C98 57 90 67 76 67 Z" fill="#c97847" stroke={INK} strokeWidth="2.2" /><path d="M91 55 q10 2 8-6 q-7 5-14 2" fill="#fff4e8" />
    <path d="M21 67 L28 39 L44 59 Z M56 58 L65 34 L73 63 Z" fill="#bd7042" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" /><path d="M45 53 C28 51 18 65 24 80 C29 91 52 90 62 80 C71 68 62 54 45 53 Z" fill="#d9824a" stroke={INK} strokeWidth="2.2" />
    <ellipse cx="41" cy="75" rx="15" ry="9" fill="#fff5e9" /><path d="M31 68 q6 6 12 0 M48 68 q6 6 12 0" fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" /><path d="M42 74 l-3 3 h6 Z" fill={INK} /><path d="M34 82 q8 4 16 0" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" /><path d="M54 88 q11 4 20 0" fill="none" stroke="#8a4a31" strokeWidth="2" strokeLinecap="round" opacity=".65" /><Finish accessories={accessories} anchor={anchor} />
  </g>;
}

function FoxSticker({ mood, accessories }) {
  const anchor = { neckY: 82, eyes: [46, 74], crownY: 16 };
  return <g className="pet__body">
    <path d="M60 12 L87 29 L96 65 L78 101 L42 101 L24 65 L33 29 Z" fill="#fff" stroke="#fff" strokeWidth="10" strokeLinejoin="round" />
    <path d="M60 12 L87 29 L96 65 L78 101 L42 101 L24 65 L33 29 Z" fill="#ff8e4a" stroke={INK} strokeWidth="2.8" strokeLinejoin="round" /><path d="M34 30 l10 20 -13-8 Z M86 30 l-10 20 13-8 Z" fill="#fac1b0" />
    <path d="M60 52 C43 52 34 66 43 82 C48 91 54 96 60 96 C66 96 72 91 77 82 C86 66 77 52 60 52 Z" fill="#fff9f2" /><Eyes mood={mood} cx={[46, 74]} cy={61} scale={1.22} /><path d="M60 73 l-5 5 h10 Z" fill={INK} /><path d="M53 82 q7 8 14 0" fill="none" stroke={INK} strokeWidth="2.7" strokeLinecap="round" /><path d="M32 78 l-12 6 M88 78 l12 6" stroke={INK} strokeWidth="2" strokeLinecap="round" /><Finish accessories={accessories} anchor={anchor} />
  </g>;
}

function FoxStorybook({ mood, accessories }) {
  const anchor = { neckY: 70, eyes: [47, 73], crownY: 19 };
  return <g className="pet__body">
    <path d="M72 79 C90 81 100 95 91 107 L72 104 Z" fill="#3e63b7" stroke={INK} strokeWidth="2" /><path d="M36 68 C38 85 35 101 42 109 H78 C85 101 82 85 84 68 Z" fill="#5c83dc" stroke={INK} strokeWidth="2.4" /><path d="M50 75 h20 v34 H50 Z" fill="#e8f0ff" stroke={INK} strokeWidth="1.5" /><path d="M60 75 v34" stroke="#9db4e8" strokeWidth="1.5" />
    <path d="M28 84 l17 5 -4 14 -17 -5 Z" fill="#f3c548" stroke={INK} strokeWidth="2" /><path d="M31 87 l10 3 M29 93 l10 3" stroke="#b67b28" strokeWidth="1.5" />
    <path d="M34 40 L31 13 L53 30 Z M86 40 L89 13 L67 30 Z" fill="#bf6638" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" /><path d="M60 19 C39 19 31 36 35 54 C38 68 48 73 60 73 C72 73 82 68 85 54 C89 36 81 19 60 19 Z" fill="#d87842" stroke={INK} strokeWidth="2.2" />
    <path d="M60 49 C48 49 43 58 49 67 C53 71 57 73 60 73 C63 73 67 71 71 67 C77 58 72 49 60 49 Z" fill="#fff4e0" /><Face mood={mood} cx={[47, 73]} cy={48} noseY={60} /><path d="M40 38 q7-6 13 0 M67 38 q7-6 13 0" fill="none" stroke="#8a432d" strokeWidth="2" strokeLinecap="round" /><path d="M77 81 q14 2 13 18" fill="none" stroke="#314d95" strokeWidth="5" strokeLinecap="round" /><Finish accessories={accessories} anchor={anchor} />
  </g>;
}

function Raccoon({ mood, accessories }) {
  const anchor = { neckY: 76, eyes: [47, 73], crownY: 23 };
  return <g className="pet__body">
    <path d="M78 94 C106 100 109 76 87 73 C99 85 90 92 77 87 Z" fill="#8a91a0" stroke={INK} strokeWidth="2" /><path d="M91 78 l4 14 M98 80 l2 10" stroke="#4e5561" strokeWidth="4" />
    <ellipse cx="60" cy="89" rx="25" ry="21" fill="#929aaa" stroke={INK} strokeWidth="2.2" /><ellipse cx="60" cy="94" rx="13" ry="13" fill="#e9edf3" />
    <circle cx="39" cy="30" r="12" fill="#727987" stroke={INK} strokeWidth="2.2" /><circle cx="81" cy="30" r="12" fill="#727987" stroke={INK} strokeWidth="2.2" /><circle cx="60" cy="51" r="30" fill="#9da5b4" stroke={INK} strokeWidth="2.2" />
    <path d="M31 48 C39 39 53 42 55 51 C53 62 40 65 32 58 Z M89 48 C81 39 67 42 65 51 C67 62 80 65 88 58 Z" fill="#4e5561" /><ellipse cx="60" cy="67" rx="15" ry="12" fill="#f7f8fb" />
    <Face mood={mood} noseY={67} /><Finish accessories={accessories} anchor={anchor} />
  </g>;
}

function Squirrel({ mood, accessories }) {
  const anchor = { neckY: 76, eyes: [47, 73], crownY: 23 };
  return <g className="pet__body">
    <path d="M77 101 C115 94 110 35 78 38 C102 51 99 78 77 82 C87 89 85 96 77 101 Z" fill="#c97843" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" /><path d="M91 49 C105 61 99 79 84 82 C94 71 94 58 86 54 Z" fill="#e5a36b" />
    <ellipse cx="58" cy="90" rx="22" ry="20" fill="#d8874b" stroke={INK} strokeWidth="2.2" /><ellipse cx="58" cy="95" rx="11" ry="12" fill="#fff4e6" />
    <path d="M35 41 L30 19 L50 32 Z M83 41 L89 19 L69 32 Z" fill="#c97843" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" /><circle cx="60" cy="52" r="29" fill="#d8874b" stroke={INK} strokeWidth="2.2" /><ellipse cx="41" cy="64" rx="10" ry="9" fill="#d8874b" /><ellipse cx="79" cy="64" rx="10" ry="9" fill="#d8874b" />
    <Face mood={mood} noseY={66} /><rect x="56" y="69" width="8" height="7" rx="2" fill="#fff" stroke="#e2d2be" /><path d="M60 69 v7" stroke="#e2d2be" /><Finish accessories={accessories} anchor={anchor} />
  </g>;
}

function Owl({ mood, accessories }) {
  const anchor = { neckY: 70, eyes: [46, 74], crownY: 17 };
  return <g className="pet__body">
    <path d="M39 27 L32 10 L51 23 M81 27 L88 10 L69 23" fill="#7784dc" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" /><path d="M60 19 C36 19 28 40 29 70 C30 99 90 99 91 70 C92 40 84 19 60 19 Z" fill="#8694ed" stroke={INK} strokeWidth="2.2" />
    <path d="M34 60 C23 70 29 88 39 90 L43 61 Z M86 60 C97 70 91 88 81 90 L77 61 Z" fill="#6878cf" stroke={INK} strokeWidth="2" /><ellipse cx="60" cy="78" rx="18" ry="18" fill="#edf0ff" />
    <circle cx="46" cy="51" r="17" fill="#fff" stroke={INK} strokeWidth="2" /><circle cx="74" cy="51" r="17" fill="#fff" stroke={INK} strokeWidth="2" /><Eyes mood={mood} cx={[46, 74]} cy={51} scale={.95} /><path d="M60 58 l-6 8 h12 Z" fill="#f5ad38" stroke={INK} strokeWidth="1.5" /><Finish accessories={accessories} anchor={anchor} />
  </g>;
}

function Cat({ mood, accessories }) {
  const anchor = { neckY: 76, eyes: [47, 73], crownY: 23 };
  return <g className="pet__body">
    <path d="M78 95 C105 104 108 80 86 77 C100 87 90 96 76 89 Z" fill="#c5a77d" stroke={INK} strokeWidth="2.2" /><path d="M94 84 q5 1 7 5 M90 78 q5 1 8 5" stroke="#927752" strokeWidth="3" strokeLinecap="round" />
    <ellipse cx="60" cy="90" rx="24" ry="21" fill="#ceb18a" stroke={INK} strokeWidth="2.2" /><ellipse cx="60" cy="95" rx="12" ry="13" fill="#fff8ef" />
    <path d="M35 39 L30 15 L52 29 Z M85 39 L90 15 L68 29 Z" fill="#c5a77d" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" /><path d="M38 28 l4-7 6 9 M82 28 l-4-7-6 9" stroke="#e8a8a1" strokeWidth="3" /><path d="M60 21 C38 21 31 39 34 57 C37 72 48 79 60 79 C72 79 83 72 86 57 C89 39 82 21 60 21 Z" fill="#ceb18a" stroke={INK} strokeWidth="2.2" />
    <path d="M52 27 q8 7 16 0 M45 36 q5 4 9 0 M66 36 q5 4 9 0" fill="none" stroke="#927752" strokeWidth="2.4" strokeLinecap="round" /><Face mood={mood} noseY={66} /><path d="M43 66 l-15-3 M43 70 l-15 3 M77 66 l15-3 M77 70 l15 3" stroke={INK} strokeWidth="1.4" strokeLinecap="round" opacity=".65" /><Finish accessories={accessories} anchor={anchor} />
  </g>;
}

function Accessory({ type, anchor }) {
  const y = anchor.neckY;
  if (type === "scarf") return <g><path d={`M39 ${y - 3} C45 ${y + 8} 75 ${y + 8} 81 ${y - 3} L79 ${y + 7} C70 ${y + 13} 50 ${y + 13} 41 ${y + 7} Z`} fill="#e8564f" stroke={INK} strokeWidth="1.5" /><path d={`M64 ${y + 8} l10 3 -4 19 -10 -3 Z`} fill="#cf3e43" stroke={INK} strokeWidth="1.5" /></g>;
  if (type === "bowtie") return <g fill="#5473d9" stroke={INK} strokeWidth="1.5"><path d={`M60 ${y + 3} l-17 -7 v15 Z`} /><path d={`M60 ${y + 3} l17 -7 v15 Z`} /><circle cx="60" cy={y + 3} r="4" /></g>;
  if (type === "glasses") return <g fill="oklch(0.7 0.12 220 / .18)" stroke={INK} strokeWidth="2.4"><circle cx={anchor.eyes[0]} cy="51" r="11" /><circle cx={anchor.eyes[1]} cy="51" r="11" /><path d={`M58 51 h4`} /></g>;
  if (type === "tophat") return <g fill="#354052" stroke={INK} strokeWidth="1.5"><ellipse cx="60" cy={anchor.crownY + 2} rx="27" ry="5" /><rect x="45" y={anchor.crownY - 19} width="30" height="21" rx="3" /><path d={`M45 ${anchor.crownY - 4} h30 v5 H45 Z`} fill="#e8564f" /></g>;
  if (type === "cap") return <g fill="#5473d9" stroke={INK} strokeWidth="1.5"><path d={`M37 ${anchor.crownY + 7} C39 ${anchor.crownY - 12} 81 ${anchor.crownY - 12} 83 ${anchor.crownY + 7} Z`} /><path d={`M43 ${anchor.crownY + 6} q-15 0 -18 9 q14 -2 25 -6 Z`} fill="#405bb9" /></g>;
  return null;
}

const SPECIES = { fox: Fox, raccoon: Raccoon, squirrel: Squirrel, owl: Owl, cat: Cat };

export function AccessoryPreview({ accessory, size = 44 }) { return <svg viewBox="20 0 80 100" width={size} height={size} aria-hidden="true"><Accessory type={accessory} anchor={{ neckY: 76, eyes: [47, 73], crownY: 23 }} /></svg>; }
function Sparkles() { return <g className="pet__sparkles" fill="var(--accent)"><path className="spk spk--1" d="M18 30 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 Z" /><path className="spk spk--2" d="M98 24 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 Z" /></g>; }
