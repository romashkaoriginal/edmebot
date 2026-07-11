import { useEffect, useState, useRef, useCallback } from "react";
import { Coins, Check, Flame, Info, Cookie, Shirt, Heart, Sparkles, Store } from "lucide-react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import SectionTitle from "../components/ui/SectionTitle";
import PetAvatar, { AccessoryPreview } from "../components/pet/PetAvatar";
import { useApp } from "../store/AppStore";
import { shopItems, petSpecies } from "../data/mock";
import "./Pet.css";

const CATEGORIES = [
  { id: "food", label: "Питание" },
  { id: "look", label: "Внешний вид" },
  { id: "home", label: "Домик" },
  { id: "collect", label: "Коллекционное" },
];

const FOX_DESIGNS = [
  { id: "widget", name: "Widget", note: "яркий chibi" },
  { id: "cozy", name: "Cozy", note: "мягкий и спокойный" },
  { id: "sticker", name: "Sticker", note: "как стикер" },
  { id: "storybook", name: "Story", note: "сказочный" },
];

export default function Pet() {
  const { profile, ownedItems, buyItem, setPetSpecies } = useApp();
  const [cat, setCat] = useState("food");
  const [feedback, setFeedback] = useState(null);
  const [foxDesign, setFoxDesign] = useState("widget");
  const [worn, setWorn] = useState(() => ({ neck: "scarf" }));
  const [reaction, setReaction] = useState(null);
  const [eating, setEating] = useState(null);
  const timers = useRef([]);
  const shopRef = useRef(null);

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
    clearLater(() => setFeedback(null), 1800);
  }

  function cheer() {
    setReaction("cheer");
    clearLater(() => setReaction(null), 750);
  }

  function feed(item) {
    if (!ownedItems.includes(item.id)) {
      const ok = buyItem(item);
      if (!ok) {
        setReaction("wobble");
        clearLater(() => setReaction(null), 520);
        showFeedback({ type: "poor" });
        return;
      }
    }
    setEating(item.treat ?? item.icon);
    clearLater(() => setEating(null), 950);
    clearLater(cheer, 700);
    showFeedback({ type: "fed", name: item.name });
  }

  function wear(item) {
    if (!ownedItems.includes(item.id)) {
      const ok = buyItem(item);
      if (!ok) {
        setReaction("wobble");
        clearLater(() => setReaction(null), 520);
        showFeedback({ type: "poor" });
        return;
      }
    }
    setWorn((current) => ({
      ...current,
      [item.slot]: current[item.slot] === item.accessory ? null : item.accessory,
    }));
    cheer();
  }

  function buyGeneric(item) {
    if (ownedItems.includes(item.id)) return;
    const ok = buyItem(item);
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
    shopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="pet-page">
      <Card className="pet-page__hero" pad="none">
        <div className="pet-page__hero-top">
          <div>
            <p className="pet-page__eyebrow">Твой компаньон</p>
            <h1 className="pet-page__name font-display">{profile.pet.name}</h1>
          </div>
          <div className="pet-page__coins" aria-label={`${profile.coins} баллов`}>
            <Coins size={18} strokeWidth={2.6} />
            <span className="font-display">{profile.coins}</span>
          </div>
        </div>

        <div className="pet-page__room" aria-label={`Комната питомца ${profile.pet.name}`}>
          <span className="pet-page__sun" aria-hidden="true" />
          <span className="pet-page__cloud pet-page__cloud--one" aria-hidden="true" />
          <span className="pet-page__cloud pet-page__cloud--two" aria-hidden="true" />
          <div className="pet-page__speech"><Sparkles size={15} aria-hidden="true" /><span>Мне нравится, когда ты учишься!</span></div>
          <div className="pet-page__plant" aria-hidden="true"><i /><i /><i /></div>
          <div className="pet-page__rug" aria-hidden="true" />
          <PetAvatar className="pet-page__avatar" species={profile.pet.species} mood="happy" accessories={wornAccessories} reaction={reaction} eating={eating} designVariant={profile.pet.species === "fox" ? foxDesign : "widget"} size={220} />
        </div>

        <div className="pet-page__actions" aria-label="Забота о питомце">
          <button className="pet-action pet-action--primary" onClick={() => quickTreat && feed(quickTreat)}><Cookie size={19} strokeWidth={2.5} /><span>Покормить</span></button>
          <button className="pet-action" onClick={cheer}><Heart size={19} strokeWidth={2.5} /><span>Погладить</span></button>
          <button className="pet-action" onClick={scrollToShop}><Store size={19} strokeWidth={2.5} /><span>Предметы</span></button>
        </div>
      </Card>

      <section className="pet-designs" aria-labelledby="pet-designs-title">
        <div className="pet-page__section-head">
          <div>
            <p className="pet-page__eyebrow">Эскизы</p>
            <SectionTitle id="pet-designs-title">Какой должна быть лиса?</SectionTitle>
          </div>
          <p className="pet-designs__hint">Выбор сразу меняет питомца на сцене</p>
        </div>
        <div className="pet-designs__grid">
          {FOX_DESIGNS.map((design) => (
            <button
              key={design.id}
              className={`pet-design ${foxDesign === design.id ? "pet-design--on" : ""}`}
              onClick={() => setFoxDesign(design.id)}
              aria-pressed={foxDesign === design.id}
            >
              <PetAvatar species="fox" mood="happy" designVariant={design.id} size={102} />
              <span className="pet-design__name">{design.name}</span>
              <span className="pet-design__note">{design.note}</span>
              {foxDesign === design.id && <Check className="pet-design__check" size={15} strokeWidth={3} />}
            </button>
          ))}
        </div>
      </section>

      <Card className="pet-page__streak" pad="md">
        <Flame size={22} strokeWidth={2.4} className="pet-page__streak-icon" />
        <div className="pet-page__streak-body">
          <div className="pet-page__streak-title">Серия <b className="font-display">{profile.streak}</b> дней</div>
          <p className="pet-page__streak-hint">Выполни одно задание сегодня, чтобы питомец не заскучал.</p>
        </div>
        {!profile.streakFreezeUsed && <Badge tone="success" icon={Check}>Защита серии готова</Badge>}
      </Card>

      <section className="pet-page__collection">
        <div className="pet-page__section-head"><div><p className="pet-page__eyebrow">Коллекция</p><SectionTitle>Выбери друга</SectionTitle></div></div>
        <div className="pet-page__species">
          {petSpecies.map((species) => (
            <button key={species.id} className={`petpick ${profile.pet.species === species.id ? "petpick--on" : ""}`} onClick={() => setPetSpecies(species.id)} aria-pressed={profile.pet.species === species.id}>
              <PetAvatar species={species.id} mood="happy" size={72} />
              <span className="petpick__name">{species.name}</span>
              {profile.pet.species === species.id && <span className="petpick__check"><Check size={13} strokeWidth={3} /></span>}
            </button>
          ))}
        </div>
      </section>

      <section className="pet-page__shop-section" ref={shopRef}>
        <div className="pet-page__section-head"><div><p className="pet-page__eyebrow">Лавка</p><SectionTitle>Сделай комнату уютнее</SectionTitle></div></div>
        <div className="pet-page__cats" role="tablist" aria-label="Категории предметов">
          {CATEGORIES.map((category) => (
            <button key={category.id} className={`pet-page__cat ${cat === category.id ? "pet-page__cat--on" : ""}`} onClick={() => setCat(category.id)} role="tab" aria-selected={cat === category.id}>{category.label}</button>
          ))}
        </div>

        <div className="pet-page__shop">
          {items.map((item) => {
            const owned = ownedItems.includes(item.id);
            const afford = profile.coins >= item.price;
            const isWorn = item.slot && worn[item.slot] === item.accessory;
            return (
              <Card key={item.id} className="shopitem" pad="sm">
                <span className={`shopitem__icon shopitem__icon--${item.category}`} aria-hidden="true">{item.accessory ? <AccessoryPreview accessory={item.accessory} size={52} /> : item.icon}</span>
                <div className="shopitem__meta"><span className="shopitem__name">{item.name}</span>{!owned && <span className="shopitem__price"><Coins size={13} /> {item.price}</span>}</div>
                {cat === "food" ? (
                  <Button size="sm" variant={owned || afford ? "accent" : "soft"} icon={Cookie} disabled={!owned && !afford} onClick={() => feed(item)}>{owned ? "Покормить" : "Купить"}</Button>
                ) : cat === "look" ? (
                  <Button size="sm" variant={isWorn ? "soft" : owned || afford ? "accent" : "soft"} icon={isWorn ? Check : Shirt} disabled={!owned && !afford} onClick={() => wear(item)}>{isWorn ? "Надето" : owned ? "Надеть" : "Купить"}</Button>
                ) : owned ? (
                  <span className="shopitem__owned"><Check size={15} strokeWidth={3} /> Куплено</span>
                ) : (
                  <Button size="sm" variant={afford ? "accent" : "soft"} icon={Coins} disabled={!afford} onClick={() => buyGeneric(item)}>Купить</Button>
                )}
              </Card>
            );
          })}
        </div>
      </section>

      {feedback && (
        <div className={`pet-page__toast pet-page__toast--${feedback.type === "poor" ? "poor" : "ok"}`} role="status">
          {feedback.type === "poor" ? <><Info size={16} strokeWidth={2.6} /> Не хватает баллов, реши ещё пару заданий</> : feedback.type === "fed" ? <><Check size={16} strokeWidth={3} /> Ням! «{feedback.name}» съедено</> : <><Check size={16} strokeWidth={3} /> «{feedback.name}» куплено!</>}
        </div>
      )}
    </div>
  );
}
