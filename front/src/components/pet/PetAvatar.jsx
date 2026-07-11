import "./PetAvatar.css";

const LABEL = { fox: "лиса", raccoon: "енот", squirrel: "белка", owl: "совёнок", cat: "котёнок" };
const MOOD = { happy: "радостное", idle: "спокойное", sad: "скучает" };
const INK = "var(--ink)";

export default function PetAvatar({ species = "fox", mood = "happy", accessories = [], reaction = null, eating = null, size = 120, className = "" }) {
  const Animal = SPECIES[species] ?? Fox;
  const activeMood = eating ? "happy" : mood;
  return (
    <div className={`pet pet--${mood} ${reaction ? `pet--${reaction}` : ""} ${eating ? "pet--eating" : ""} ${className}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" width={size} height={size} role="img" aria-label={`Питомец: ${LABEL[species]}, настроение ${MOOD[mood]}`}>
        <ellipse className="pet__shadow" cx="60" cy="109" rx="31" ry="5" />
        <g className="pet__scene">
          <Animal mood={activeMood} accessories={accessories} />
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

function Fox({ mood, accessories }) {
  const anchor = { neckY: 76, eyes: [47, 73], crownY: 22 };
  return <g className="pet__body">
    <path d="M77 91 C104 98 108 73 88 72 C99 82 90 91 76 86 Z" fill="#ef8739" stroke={INK} strokeWidth="2" strokeLinejoin="round" /><path d="M92 84 q10 0 9-6 q-6 5-13 3" fill="#fff7ed" />
    <ellipse cx="60" cy="88" rx="25" ry="22" fill="#f59642" stroke={INK} strokeWidth="2.2" /><ellipse cx="60" cy="94" rx="13" ry="14" fill="#fff9f2" />
    <path d="M35 43 L28 15 L52 31 Z M85 43 L92 15 L68 31 Z" fill="#ef8739" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" /><path d="M34 23 l8 14 -9-5 Z M86 23 l-8 14 9-5 Z" fill="#f2b3a3" />
    <path d="M60 20 C38 20 30 37 34 56 C37 71 48 79 60 79 C72 79 83 71 86 56 C90 37 82 20 60 20 Z" fill="#f59642" stroke={INK} strokeWidth="2.2" /><path d="M60 55 C47 55 42 65 48 73 C52 78 56 80 60 80 C64 80 68 78 72 73 C78 65 73 55 60 55 Z" fill="#fff9f2" />
    <Face mood={mood} noseY={66} /><Finish accessories={accessories} anchor={anchor} />
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
