import { useEffect, useState, useRef, useCallback } from "react";
import { Coins, Check, Info, Cookie, Shirt, Heart, Store, Pencil, X, Sparkles, ArrowRight } from "lucide-react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import SectionTitle from "../components/ui/SectionTitle";
import PetAvatar, { AccessoryPreview } from "../components/pet/PetAvatar";
import { useApp } from "../store/AppStore";
import { studentApi } from "../api/student";
import { shopItems, petSpecies } from "../data/mock";
import "./Pet.css";

const CATEGORIES = [
  { id: "look", label: "Внешний вид" },
  { id: "home", label: "Комната" },
];

const PET_NAMES = ["Искра", "Плюша", "Финик", "Луна", "Тоша", "Пиксель", "Бусинка", "Персик", "Снежок", "Чип"];

export default function Pet() {
  const { profile, ownedItems, hydrate, setPetSpecies, setPetName } = useApp();
  const [cat, setCat] = useState("look");
  const [view, setView] = useState("room");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pendingSpecies, setPendingSpecies] = useState(null);
  const [previewItem, setPreviewItem] = useState(null);
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
  const previewAccessories = previewItem
    ? Object.values({ ...worn, [previewItem.slot]: previewItem.accessory }).filter(Boolean)
    : wornAccessories;
  const items = shopItems.filter((item) => item.category === cat);
  const foodItems = shopItems.filter((item) => item.category === "food");
  const ownedFood = shopItems.find((item) => item.category === "food" && ownedItems.includes(item.id));
  const bond = profile.petBond ?? 0;
  const bondLevel = Math.floor(bond / 100) + 1;
  const bondProgress = bond % 100;
  const studiedToday = profile.streakLastDoneOn === new Date().toISOString().slice(0, 10);

  const clearLater = useCallback((fn, ms) => {
    const timer = setTimeout(fn, ms);
    timers.current.push(timer);
  }, []);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => {
    if (!coinsInfoOpen) return undefined;
    const closeOnEscape = (event) => { if (event.key === "Escape") setCoinsInfoOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [coinsInfoOpen]);

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
          ? "Не хватает монет. Реши ещё несколько заданий."
          : "Покупка не сохранилась. Проверь соединение и попробуй ещё раз.",
      });
      return false;
    } finally {
      setBusyId(null);
    }
  }

  async function feed(item) {
    if (!item) {
      setView("room");
      requestAnimationFrame(() => document.getElementById("pet-food")?.scrollIntoView({ behavior: "smooth", block: "center" }));
      showFeedback({ type: "poor", text: "Выбери корм в комнате — цена видна до покупки." });
      return;
    }
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

  async function chooseSpecies(species) {
    if ((profile.petSelected && profile.pet.species === species) || busyId) return;
    setBusyId(`species:${species}`);
    try {
      const data = await studentApi.updatePet({ species });
      setPetSpecies(species);
      hydrate({ profile: data.profile });
      setPendingSpecies(null);
      setSettingsOpen(false);
      cheer();
    } catch (error) {
      showFeedback({ type: "poor", text: error.message === "not_enough_coins" ? "Для смены питомца нужно 100 монет." : "Не удалось сохранить выбор питомца." });
    } finally {
      setBusyId(null);
    }
  }

  function requestSpecies(species) {
    if (species === profile.pet.species || busyId) return;
    setPendingSpecies(species);
  }

  function selectCategory(categoryId, index) {
    setCat(categoryId);
    requestAnimationFrame(() => document.getElementById(`pet-tab-${index}`)?.focus());
  }

  if (!profile.petSelected && profile.onboardingStep === "pet") {
    return <PetFirstChoice hydrate={hydrate} />;
  }

  return (
    <div className="pet-page">
      <header className="pet-page__heading">
        <h1>Питомец</h1>
        <p>{profile.pet.name} растёт вместе с твоим учебным прогрессом.</p>
      </header>

      <div className="pet-page__views" role="tablist" aria-label="Разделы питомца">
        <button type="button" role="tab" aria-selected={view === "room"} className={view === "room" ? "is-active" : ""} onClick={() => setView("room")}><Heart size={17} /> Комната</button>
        <button type="button" role="tab" aria-selected={view === "shop"} className={view === "shop" ? "is-active" : ""} onClick={() => setView("shop")}><Store size={17} /> Каталог</button>
      </div>

      {view === "room" && <>
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
            aria-label={`${profile.coins} монет — как заработать`}
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
          {ownedItems.includes("s6") && <div className="pet-page__rug" aria-hidden="true" />}
          {ownedItems.includes("s7") && <div className="pet-page__lamp" aria-hidden="true"><i /></div>}
          {ownedItems.includes("s12") && <div className="pet-page__house" aria-hidden="true"><i /></div>}
          {ownedItems.includes("s8") && <div className="pet-page__star" aria-hidden="true">★</div>}
          <div className="pet-page__mood" role="status">{studiedToday ? "Воодушевлён после учёбы" : "Спокоен и готов заниматься"}</div>
          <PetAvatar className="pet-page__avatar" species={profile.pet.species} mood={studiedToday ? "happy" : "idle"} accessories={wornAccessories} reaction={reaction} eating={eating} size={220} />
        </div>

        <div className="pet-page__actions" aria-label="Забота о питомце">
          <button className="pet-action pet-action--primary" onClick={() => feed(ownedFood)}><Cookie size={19} strokeWidth={2.5} /><span>{ownedFood ? "Покормить" : "Выбрать корм"}</span></button>
          <button className="pet-action" onClick={cheer}><Heart size={19} strokeWidth={2.5} /><span>Погладить</span></button>
          <button className="pet-action" onClick={() => setView("shop")}><Store size={19} strokeWidth={2.5} /><span>Каталог</span></button>
        </div>
      </Card>

      <Card className="pet-page__bond" pad="md">
        <div className="pet-page__bond-icon"><Heart size={20} fill="currentColor" /></div>
        <div className="pet-page__bond-body">
          <div className="pet-page__bond-title">Дружба · уровень {bondLevel}</div>
          <p>Растёт за верные ответы. Ошибки и пропуски её не уменьшают.</p>
          <div className="pet-page__bond-track" role="progressbar" aria-label="Прогресс дружбы" aria-valuemin="0" aria-valuemax="100" aria-valuenow={bondProgress}><i style={{ transform: `scaleX(${bondProgress / 100})` }} /></div>
        </div>
      </Card>

      <section className="pet-page__food" id="pet-food">
        <div className="pet-page__section-head"><SectionTitle>Питание</SectionTitle><p>Корм находится прямо в комнате питомца.</p></div>
        <div className="pet-page__food-list">
          {foodItems.map((item) => {
            const owned = ownedItems.includes(item.id);
            const afford = profile.coins >= item.price;
            return <Card key={item.id} className="pet-food" pad="sm"><span className="pet-food__icon" aria-hidden="true">{item.icon}</span><span className="pet-food__name">{item.name}</span>{!owned && <span className="shopitem__price"><Coins size={13} /> {item.price}</span>}<Button size="sm" variant={owned || afford ? "accent" : "soft"} icon={Cookie} disabled={!owned && !afford} loading={busyId === item.id} onClick={async () => owned ? feed(item) : (await purchase(item)) && feed(item)}>{owned ? "Покормить" : `Купить · ${item.price}`}</Button></Card>;
          })}
        </div>
      </section>

      <section className="pet-page__collection">
        <button type="button" className="pet-page__settings-toggle" onClick={() => setSettingsOpen((value) => !value)} aria-expanded={settingsOpen}><Sparkles size={18} /><span><b>Сменить питомца</b><small>Смена вида стоит 100 монет</small></span><ArrowRight size={18} className={settingsOpen ? "is-open" : ""} /></button>
        {settingsOpen && <div className="pet-page__settings-panel">
        <div className="pet-page__section-head"><SectionTitle>Сменить питомца · 100 монет</SectionTitle><p>Чтобы вернуться к прежнему виду, потребуется новая смена.</p></div>
        <div className="pet-page__species">
          {petSpecies.map((species) => (
            <button
              key={species.id}
              className={`petpick ${profile.pet.species === species.id ? "petpick--on" : ""}`}
              onClick={() => requestSpecies(species.id)}
              disabled={busyId === `species:${species.id}`}
              aria-pressed={profile.pet.species === species.id}
            >
              <PetAvatar species={species.id} mood="happy" size={84} animated={false} decorative />
              <span className="petpick__name">{species.name}</span>
              {profile.pet.species === species.id && <span className="petpick__check"><Check size={13} strokeWidth={3} /></span>}
            </button>
          ))}
        </div>
        {pendingSpecies && <div className="pet-page__change-confirm" role="region" aria-labelledby="pet-change-title">
          <div className="pet-page__change-pets"><PetAvatar species={profile.pet.species} mood="idle" size={72} animated={false} decorative /><ArrowRight size={20} /><PetAvatar species={pendingSpecies} mood="happy" size={72} animated={false} decorative /></div>
          <div><strong id="pet-change-title">Сменить питомца?</strong><p>{petSpecies.find((item) => item.id === profile.pet.species)?.name} → {petSpecies.find((item) => item.id === pendingSpecies)?.name}. Будет списано 100 монет.</p></div>
          <div className="pet-page__change-actions"><Button size="sm" variant="ghost" onClick={() => setPendingSpecies(null)}>Отмена</Button><Button size="sm" icon={Coins} loading={busyId === `species:${pendingSpecies}`} disabled={profile.coins < 100} onClick={() => chooseSpecies(pendingSpecies)}>Сменить за 100</Button></div>
        </div>}
        </div>}
      </section>
      </>}

      {view === "shop" && <section className="pet-page__shop-section">
        <div className="pet-page__section-head"><SectionTitle>Каталог питомца</SectionTitle><p>Примеряй одежду или добавляй предметы прямо в комнату.</p></div>
        {cat === "look" && <Card className="pet-page__shop-preview" pad="sm"><PetAvatar species={profile.pet.species} mood="idle" accessories={previewAccessories} size={112} animated={false} /><div><strong>{previewItem ? `Примерка: ${previewItem.name}` : "Текущий образ"}</strong><p>Примерка бесплатна и не меняет сохранённый образ.</p>{previewItem && <button type="button" onClick={() => setPreviewItem(null)}>Сбросить примерку</button>}</div></Card>}
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
                {cat === "look" ? (
                  <div className="shopitem__actions"><Button size="sm" variant="soft" onClick={() => setPreviewItem(item)}>Примерить</Button><Button size="sm" variant={isWorn ? "soft" : owned || afford ? "accent" : "soft"} icon={isWorn ? Check : Shirt} disabled={!owned && !afford} loading={busyId === item.id} onClick={() => wear(item)}>{isWorn ? "Снять" : owned ? "Надеть" : `Купить за ${item.price}`}</Button></div>
                ) : (
                  owned ? <span className="shopitem__owned"><Check size={14} /> В комнате</span> : <Button size="sm" variant={afford ? "accent" : "soft"} icon={Store} disabled={!afford} loading={busyId === item.id} onClick={async () => (await purchase(item)) && showFeedback({ type: "ok", name: item.name })}>Купить за {item.price}</Button>
                )}
              </Card>
            );
          })}
        </div>
      </section>}

      {feedback && (
        <div className={`pet-page__toast pet-page__toast--${feedback.type === "poor" ? "poor" : "ok"}`} role="status" aria-live="polite">
          {feedback.text ? <><Info size={16} strokeWidth={2.6} /> {feedback.text}</> :
           feedback.type === "poor" ? <><Info size={16} strokeWidth={2.6} /> Не хватает монет, реши ещё пару заданий</> :
           feedback.type === "fed" ? <><Check size={16} strokeWidth={3} /> {profile.pet.name} оценил «{feedback.name}»</> :
           <><Check size={16} strokeWidth={3} /> «{feedback.name}» куплено!</>}
        </div>
      )}
    </div>
  );
}

function PetFirstChoice({ hydrate }) {
  const [species, setSpecies] = useState(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [adoptedProfile, setAdoptedProfile] = useState(null);

  function generateName() {
    const alternatives = PET_NAMES.filter((item) => item !== name);
    setName(alternatives[Math.floor(Math.random() * alternatives.length)] || PET_NAMES[0]);
  }

  async function completeChoice() {
    const trimmed = name.trim();
    if (!trimmed || !species || saving) return;
    setSaving(true);
    setError("");
    try {
      const data = await studentApi.updatePet({ species, name: trimmed });
      setAdoptedProfile(data.profile);
    } catch {
      setError("Не удалось сохранить питомца. Проверь соединение и попробуй ещё раз.");
    } finally {
      setSaving(false);
    }
  }

  function moveSelection(direction) {
    const current = petSpecies.findIndex((item) => item.id === species);
    const next = current < 0 ? (direction > 0 ? 0 : petSpecies.length - 1) : (current + direction + petSpecies.length) % petSpecies.length;
    setSpecies(petSpecies[next].id);
    requestAnimationFrame(() => document.getElementById(`pet-choice-${petSpecies[next].id}`)?.focus());
  }

  if (adoptedProfile) {
    return (
      <section className="pet-adopted" aria-labelledby="pet-adopted-title">
        <span className="pet-adopted__spark"><Sparkles size={22} /></span>
        <PetAvatar species={adoptedProfile.pet.species} mood="happy" reaction="cheer" size={220} />
        <h1 id="pet-adopted-title">{adoptedProfile.pet.name} теперь с тобой</h1>
        <p>Дружба будет расти за верные ответы. Ошибки и пропуски ничего не уменьшают.</p>
        <Button full icon={ArrowRight} onClick={() => hydrate({ profile: adoptedProfile })}>В приложение</Button>
      </section>
    );
  }

  return (
    <section className="pet-choice" aria-labelledby="pet-choice-title">
      <header className="pet-choice__head">
        <span className="pet-choice__step"><Check size={15} strokeWidth={3} /> Диагностика готова</span>
        <h1 id="pet-choice-title">Выбери своего питомца</h1>
        <p>Он останется с тобой во время обучения. Первый выбор бесплатный.</p>
      </header>

      <div className="pet-choice__list" role="radiogroup" aria-label="Вид питомца">
        {petSpecies.map((item) => (
          <button
            type="button"
            id={`pet-choice-${item.id}`}
            key={item.id}
            className={`pet-choice__item ${species === item.id ? "pet-choice__item--selected" : ""}`}
            onClick={() => setSpecies(item.id)}
            role="radio"
            aria-checked={species === item.id}
            tabIndex={species === item.id || (!species && item.id === petSpecies[0].id) ? 0 : -1}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight" || event.key === "ArrowDown") { event.preventDefault(); moveSelection(1); }
              if (event.key === "ArrowLeft" || event.key === "ArrowUp") { event.preventDefault(); moveSelection(-1); }
            }}
          >
            <PetAvatar species={item.id} mood="happy" size={94} animated={false} decorative />
            <span>{item.name}</span>
            {species === item.id && <i><Check size={14} strokeWidth={3} /></i>}
          </button>
        ))}
      </div>

      <div className="pet-choice__summary" role="status"><strong>{species ? `${petSpecies.find((item) => item.id === species)?.name} · ${name.trim() || "Без имени"}` : "Сначала выбери питомца"}</strong><span>Первый выбор бесплатный · сменить позже — 100 монет</span></div>

      <div className="pet-choice__name">
        <label htmlFor="pet-first-name">Как его будут звать?</label>
        <div className="pet-choice__name-row">
          <input id="pet-first-name" value={name} maxLength={24} onChange={(event) => setName(event.target.value)} />
          <button type="button" className="pet-choice__generate" onClick={generateName} aria-label="Придумать случайное имя">
            <Sparkles size={18} /> <span>Придумать</span>
          </button>
        </div>
      </div>

      {error && <p className="pet-choice__error" role="alert">{error}</p>}
      <Button full icon={Check} loading={saving} disabled={!name.trim() || !species} onClick={completeChoice}>Подтвердить выбор</Button>
    </section>
  );
}
