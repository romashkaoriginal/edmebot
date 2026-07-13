import { useEffect, useState, useRef, useCallback } from "react";
import { Coins, Check, Flame, Info, Cookie, Shirt, Heart, Store, Pencil, X } from "lucide-react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import SectionTitle from "../components/ui/SectionTitle";
import PetAvatar, { AccessoryPreview } from "../components/pet/PetAvatar";
import { useApp } from "../store/AppStore";
import { studentApi } from "../api/student";
import { shopItems, petSpecies } from "../data/mock";
import { plural } from "../utils/format";
import "./Pet.css";

const CATEGORIES = [
  { id: "food", label: "Питание" },
  { id: "look", label: "Внешний вид" },
  { id: "home", label: "Домик" },
  { id: "collect", label: "Коллекционное" },
];

export default function Pet() {
  const { profile, ownedItems, hydrate, setPetSpecies, setPetName } = useApp();
  const [cat, setCat] = useState("food");
  const [feedback, setFeedback] = useState(null);
  const [worn, setWorn] = useState(profile.wornItems ?? {});
  const [busyId, setBusyId] = useState(null);
  const [reaction, setReaction] = useState(null);
  const [eating, setEating] = useState(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(profile.pet.name);
  const [savingName, setSavingName] = useState(false);
  const [coinsInfoOpen, setCoinsInfoOpen] = useState(false);
  const timers = useRef([]);
  const shopRef = useRef(null);

  function startEditName() {
    setNameDraft(profile.pet.name);
    setEditingName(true);
  }

  async function saveName() {
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === profile.pet.name) {
      setEditingName(false);
      return;
    }
    setSavingName(true);
    try {
      await studentApi.renamePet(trimmed);
      setPetName(trimmed);
      setEditingName(false);
    } catch {
      // Keep the old name visible and tell the student the save didn't go
      // through, instead of silently reverting with no explanation.
      showFeedback({ type: "poor", text: "Не удалось сохранить имя, попробуй ещё раз" });
    } finally {
      setSavingName(false);
    }
  }

  const wornAccessories = Object.values(worn).filter(Boolean);
  const items = shopItems.filter((item) => item.category === cat);
  const quickTreat = shopItems.find((item) => item.category === "food");

  const clearLater = useCallback((fn, ms) => {
    const timer = setTimeout(fn, ms);
    timers.current.push(timer);
  }, []);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  function showFeedback(payload) {
    setFeedback(payload);
    clearLater(() => setFeedback(null), 3500);
  }

  function cheer() {
    setReaction("cheer");
    clearLater(() => setReaction(null), 750);
  }

  async function purchase(item) {
    if (ownedItems.includes(item.id)) return true;
    setBusyId(item.id);
    try {
      const data = await studentApi.buyPetItem(item.id);
      hydrate({ profile: data.profile });
      return true;
    } catch (error) {
      setReaction("wobble");
      clearLater(() => setReaction(null), 520);
      showFeedback({
        type: "poor",
        text: error.message === "not_enough_coins"
          ? "Не хватает баллов. Реши ещё несколько заданий."
          : "Покупка не сохранилась. Проверь соединение и попробуй ещё раз.",
      });
      return false;
    } finally {
      setBusyId(null);
    }
  }

  async function feed(item) {
    if (!(await purchase(item))) return;
    setEating(item.treat ?? item.icon);
    clearLater(() => setEating(null), 950);
    clearLater(cheer, 700);
    showFeedback({ type: "fed", name: item.name });
  }

  async function wear(item) {
    if (!(await purchase(item))) return;
    const nextWorn = {
      ...worn,
      [item.slot]: worn[item.slot] === item.accessory ? null : item.accessory,
    };
    setBusyId(item.id);
    try {
      const data = await studentApi.updatePet({ wornItems: nextWorn });
      setWorn(nextWorn);
      hydrate({ profile: data.profile });
      cheer();
    } catch {
      showFeedback({ type: "poor", text: "Не удалось сохранить внешний вид питомца." });
    } finally {
      setBusyId(null);
    }
  }

  async function buyGeneric(item) {
    if (ownedItems.includes(item.id)) return;
    const ok = await purchase(item);
    if (ok) {
      cheer();
      showFeedback({ type: "ok", name: item.name });
      return;
    }
    setReaction("wobble");
    clearLater(() => setReaction(null), 520);
    showFeedback({ type: "poor" });
  }

  function scrollToShop() {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    shopRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  }

  async function chooseSpecies(species) {
    if ((profile.petSelected && profile.pet.species === species) || busyId) return;
    if (profile.petSelected && !window.confirm("Смена питомца стоит 100 монет. Вернуться к прежнему питомцу можно будет только через новую платную смену. Продолжить?")) return;
    setBusyId(`species:${species}`);
    try {
      const data = await studentApi.updatePet({ species });
      setPetSpecies(species);
      hydrate({ profile: data.profile });
      cheer();
    } catch (error) {
      showFeedback({ type: "poor", text: error.message === "not_enough_coins" ? "Для смены питомца нужно 100 монет." : "Не удалось сохранить выбор питомца." });
    } finally {
      setBusyId(null);
    }
  }

  function selectCategory(categoryId, index) {
    setCat(categoryId);
    requestAnimationFrame(() => document.getElementById(`pet-tab-${index}`)?.focus());
  }

  return (
    <div className="pet-page">
      <header className="pet-page__heading">
        <h1>Питомец</h1>
        <p>{profile.petSelected ? `Твой питомец — ${profile.pet.name}. Практика приносит монеты для ухода и предметов.` : "Диагностика пройдена. Теперь выбери питомца — первый выбор бесплатный."}</p>
      </header>
      <Card className="pet-page__hero" pad="none">
        <div className="pet-page__room" aria-label={`Комната питомца ${profile.pet.name}`}>
          {editingName ? (
            <div className="pet-page__room-chip pet-page__room-chip--name pet-page__name-edit">
              <input
                className="pet-page__name-input font-display"
                value={nameDraft}
                maxLength={24}
                autoFocus
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveName();
                  if (e.key === "Escape") setEditingName(false);
                }}
                disabled={savingName}
                aria-label="Имя питомца"
              />
              <button className="pet-page__name-btn" onClick={saveName} disabled={savingName} aria-label="Сохранить имя">
                <Check size={16} strokeWidth={3} />
              </button>
              <button className="pet-page__name-btn" onClick={() => setEditingName(false)} aria-label="Отменить">
                <X size={16} strokeWidth={3} />
              </button>
            </div>
          ) : (
            <button
              className="pet-page__room-chip pet-page__room-chip--name pet-page__name-btn-wrap"
              onClick={startEditName}
              aria-label="Изменить имя питомца"
            >
              <span className="pet-page__name font-display">{profile.pet.name}</span>
              <Pencil size={13} strokeWidth={2.6} className="pet-page__name-pencil" />
            </button>
          )}

          <button
            type="button"
            className="pet-page__room-chip pet-page__room-chip--coins"
            onClick={() => setCoinsInfoOpen((o) => !o)}
            aria-expanded={coinsInfoOpen}
            aria-label={`${profile.coins} баллов — как заработать`}
          >
            <Coins size={16} strokeWidth={2.6} />
            <span className="font-display">{profile.coins}</span>
          </button>
          {coinsInfoOpen && (
            <div className="pet-page__coins-popover" role="status">
              Начисляются автоматически: половина от XP за каждое верно решённое задание.
            </div>
          )}

          <span className="pet-page__sun" aria-hidden="true" />
          <span className="pet-page__cloud pet-page__cloud--one" aria-hidden="true" />
          <span className="pet-page__cloud pet-page__cloud--two" aria-hidden="true" />
          <div className="pet-page__plant" aria-hidden="true"><i /><i /><i /></div>
          <div className="pet-page__rug" aria-hidden="true" />
          <PetAvatar className="pet-page__avatar" species={profile.pet.species} mood="happy" accessories={wornAccessories} reaction={reaction} eating={eating} size={220} />
        </div>

        <div className="pet-page__actions" aria-label="Забота о питомце">
          <button className="pet-action pet-action--primary" onClick={() => quickTreat && feed(quickTreat)}><Cookie size={19} strokeWidth={2.5} /><span>Покормить</span></button>
          <button className="pet-action" onClick={cheer}><Heart size={19} strokeWidth={2.5} /><span>Погладить</span></button>
          <button className="pet-action" onClick={scrollToShop}><Store size={19} strokeWidth={2.5} /><span>Предметы</span></button>
        </div>
      </Card>

      <Card className="pet-page__streak" pad="md">
        <Flame size={22} strokeWidth={2.4} className="pet-page__streak-icon" />
        <div className="pet-page__streak-body">
          <div className="pet-page__streak-title">Серия <b className="font-display">{profile.streak}</b> {plural(profile.streak, "день", "дня", "дней")}</div>
          <p className="pet-page__streak-hint">Выполни одно задание сегодня, чтобы питомец не заскучал.</p>
        </div>
        {profile.streak > 0 && !profile.streakFreezeUsed && <Badge tone="success" icon={Check}>Защита серии готова</Badge>}
      </Card>

      <section className="pet-page__collection">
        <div className="pet-page__section-head"><SectionTitle>{profile.petSelected ? "Сменить питомца · 100 монет" : "Выбери питомца"}</SectionTitle></div>
        <div className="pet-page__species">
          {petSpecies.map((species) => (
            <button
              key={species.id}
              className={`petpick ${profile.pet.species === species.id ? "petpick--on" : ""}`}
              onClick={() => chooseSpecies(species.id)}
              disabled={busyId === `species:${species.id}`}
              aria-pressed={profile.pet.species === species.id}
            >
              <PetAvatar species={species.id} mood="happy" size={84} />
              <span className="petpick__name">{species.name}</span>
              {profile.pet.species === species.id && <span className="petpick__check"><Check size={13} strokeWidth={3} /></span>}
            </button>
          ))}
        </div>
      </section>

      <section className="pet-page__shop-section" ref={shopRef}>
        <div className="pet-page__section-head"><SectionTitle>Предметы за учебные баллы</SectionTitle></div>
        <div className="pet-page__cats" role="tablist" aria-label="Категории предметов">
          {CATEGORIES.map((category, index) => (
            <button
              id={`pet-tab-${index}`}
              key={category.id}
              className={`pet-page__cat ${cat === category.id ? "pet-page__cat--on" : ""}`}
              onClick={() => setCat(category.id)}
              onKeyDown={(event) => {
                if (event.key === "ArrowRight") { event.preventDefault(); selectCategory(CATEGORIES[(index + 1) % CATEGORIES.length].id, (index + 1) % CATEGORIES.length); }
                if (event.key === "ArrowLeft") { event.preventDefault(); selectCategory(CATEGORIES[(index - 1 + CATEGORIES.length) % CATEGORIES.length].id, (index - 1 + CATEGORIES.length) % CATEGORIES.length); }
              }}
              role="tab"
              aria-selected={cat === category.id}
              aria-controls="pet-shop-panel"
              tabIndex={cat === category.id ? 0 : -1}
            >
              {category.label}
            </button>
          ))}
        </div>

        <div className="pet-page__shop" id="pet-shop-panel" role="tabpanel" aria-live="polite">
          {items.map((item) => {
            const owned = ownedItems.includes(item.id);
            const afford = profile.coins >= item.price;
            const isWorn = item.slot && worn[item.slot] === item.accessory;
            return (
              <Card key={item.id} className="shopitem" pad="sm">
                <span className={`shopitem__icon shopitem__icon--${item.category}`} aria-hidden="true">{item.accessory ? <AccessoryPreview accessory={item.accessory} size={52} /> : item.icon}</span>
                <div className="shopitem__meta"><span className="shopitem__name">{item.name}</span>{!owned && <span className="shopitem__price"><Coins size={13} /> {item.price}</span>}</div>
                {cat === "food" ? (
                  <Button size="sm" variant={owned || afford ? "accent" : "soft"} icon={Cookie} disabled={!owned && !afford} loading={busyId === item.id} onClick={() => feed(item)}>{owned ? "Покормить" : "Купить"}</Button>
                ) : cat === "look" ? (
                  <Button size="sm" variant={isWorn ? "soft" : owned || afford ? "accent" : "soft"} icon={isWorn ? Check : Shirt} disabled={!owned && !afford} loading={busyId === item.id} onClick={() => wear(item)}>{isWorn ? "Снять" : owned ? "Надеть" : "Купить"}</Button>
                ) : owned ? (
                  <span className="shopitem__owned"><Check size={15} strokeWidth={3} /> Куплено</span>
                ) : (
                  <Button size="sm" variant={afford ? "accent" : "soft"} icon={Coins} disabled={!afford} loading={busyId === item.id} onClick={() => buyGeneric(item)}>Купить</Button>
                )}
              </Card>
            );
          })}
        </div>
      </section>

      {feedback && (
        <div className={`pet-page__toast pet-page__toast--${feedback.type === "poor" ? "poor" : "ok"}`} role="status" aria-live="polite">
          {feedback.text ? <><Info size={16} strokeWidth={2.6} /> {feedback.text}</> :
           feedback.type === "poor" ? <><Info size={16} strokeWidth={2.6} /> Не хватает баллов, реши ещё пару заданий</> :
           feedback.type === "fed" ? <><Check size={16} strokeWidth={3} /> Ням! «{feedback.name}» съедено</> :
           <><Check size={16} strokeWidth={3} /> «{feedback.name}» куплено!</>}
        </div>
      )}
    </div>
  );
}
