import { useState, useRef, useCallback } from "react";
import { Coins, Check, Flame, Info, Cookie, Shirt } from "lucide-react";
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

export default function Pet() {
  const { profile, ownedItems, buyItem, setPetSpecies } = useApp();
  const [cat, setCat] = useState("food");
  const [feedback, setFeedback] = useState(null);

  // Worn accessories: one per slot. Seeded from the starter scarf.
  const [worn, setWorn] = useState(() => ({ neck: "scarf" }));
  const [reaction, setReaction] = useState(null);
  const [eating, setEating] = useState(null);
  const timers = useRef([]);

  const wornAccessories = Object.values(worn).filter(Boolean);
  const items = shopItems.filter((i) => i.category === cat);

  const clearLater = useCallback((fn, ms) => {
    const t = setTimeout(fn, ms);
    timers.current.push(t);
  }, []);

  function showFeedback(payload) {
    setFeedback(payload);
    clearLater(() => setFeedback(null), 1800);
  }

  function cheer() {
    setReaction("cheer");
    clearLater(() => setReaction(null), 750);
  }

  // Feed the pet a treat (buys if needed) — plays the eat animation.
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

  // Toggle a wearable accessory (buys if needed).
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
    setWorn((w) => {
      const isOn = w[item.slot] === item.accessory;
      return { ...w, [item.slot]: isOn ? null : item.accessory };
    });
    cheer();
  }

  function buyGeneric(item) {
    if (ownedItems.includes(item.id)) return;
    const ok = buyItem(item);
    if (ok) {
      cheer();
      showFeedback({ type: "ok", name: item.name });
    } else {
      setReaction("wobble");
      clearLater(() => setReaction(null), 520);
      showFeedback({ type: "poor" });
    }
  }

  return (
    <div className="pet-page">
      <Card className="pet-page__hero" pad="lg">
        <div className="pet-page__stage">
          <PetAvatar
            species={profile.pet.species}
            mood="happy"
            accessories={wornAccessories}
            reaction={reaction}
            eating={eating}
            size={168}
          />
        </div>
        <div className="pet-page__info">
          <h1 className="pet-page__name font-display">{profile.pet.name}</h1>
          <p className="pet-page__mood">Питомец доволен — ты занимаешься регулярно! 💛</p>
          <div className="pet-page__coins">
            <Coins size={20} strokeWidth={2.6} />
            <span className="font-display">{profile.coins}</span>
            <span className="pet-page__coins-label">баллов</span>
          </div>
        </div>
      </Card>

      <Card className="pet-page__streak" pad="md">
        <Flame size={22} strokeWidth={2.4} className="pet-page__streak-icon" />
        <div className="pet-page__streak-body">
          <div className="pet-page__streak-title">
            Стрик <b className="font-display">{profile.streak}</b> дней
          </div>
          <p className="pet-page__streak-hint">
            Одно задание в день сохраняет стрик. При пропуске можно восстановить бесплатно раз в 48 часов.
          </p>
        </div>
        {!profile.streakFreezeUsed && <Badge tone="success" icon={Check}>восстановление доступно</Badge>}
      </Card>

      <section>
        <SectionTitle>Выбор питомца</SectionTitle>
        <div className="pet-page__species">
          {petSpecies.map((s) => (
            <button
              key={s.id}
              className={`petpick ${profile.pet.species === s.id ? "petpick--on" : ""}`}
              onClick={() => setPetSpecies(s.id)}
              aria-pressed={profile.pet.species === s.id}
            >
              <PetAvatar species={s.id} mood="happy" size={64} />
              <span className="petpick__name">{s.name}</span>
              {profile.pet.species === s.id && (
                <span className="petpick__check">
                  <Check size={13} strokeWidth={3} />
                </span>
              )}
            </button>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle>Магазин</SectionTitle>
        <div className="pet-page__cats">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              className={`pet-page__cat ${cat === c.id ? "pet-page__cat--on" : ""}`}
              onClick={() => setCat(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="pet-page__shop">
          {items.map((item) => {
            const owned = ownedItems.includes(item.id);
            const afford = profile.coins >= item.price;
            const isWorn = item.slot && worn[item.slot] === item.accessory;
            return (
              <Card key={item.id} className="shopitem" pad="sm">
                <span className="shopitem__icon" aria-hidden="true">
                  {item.accessory ? <AccessoryPreview accessory={item.accessory} size={46} /> : item.icon}
                </span>
                <span className="shopitem__name">{item.name}</span>

                {cat === "food" ? (
                  <Button
                    size="sm"
                    variant={owned || afford ? "accent" : "soft"}
                    icon={Cookie}
                    disabled={!owned && !afford}
                    onClick={() => feed(item)}
                  >
                    {owned ? "Покормить" : item.price}
                  </Button>
                ) : cat === "look" ? (
                  <Button
                    size="sm"
                    variant={isWorn ? "soft" : owned || afford ? "accent" : "soft"}
                    icon={isWorn ? Check : Shirt}
                    disabled={!owned && !afford}
                    onClick={() => wear(item)}
                  >
                    {isWorn ? "Надето" : owned ? "Надеть" : item.price}
                  </Button>
                ) : owned ? (
                  <span className="shopitem__owned">
                    <Check size={15} strokeWidth={3} /> Куплено
                  </span>
                ) : (
                  <Button
                    size="sm"
                    variant={afford ? "accent" : "soft"}
                    icon={Coins}
                    disabled={!afford}
                    onClick={() => buyGeneric(item)}
                  >
                    {item.price}
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      </section>

      {feedback && (
        <div className={`pet-page__toast pet-page__toast--${feedback.type === "poor" ? "poor" : "ok"}`} role="status">
          {feedback.type === "poor" ? (
            <>
              <Info size={16} strokeWidth={2.6} /> Не хватает баллов — реши ещё пару заданий
            </>
          ) : feedback.type === "fed" ? (
            <>
              <Check size={16} strokeWidth={3} /> Ням! «{feedback.name}» съедено
            </>
          ) : (
            <>
              <Check size={16} strokeWidth={3} /> «{feedback.name}» куплено!
            </>
          )}
        </div>
      )}
    </div>
  );
}
