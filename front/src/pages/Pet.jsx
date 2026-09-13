import { useEffect, useState, useRef, useCallback } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Coins, Check, Info, Cookie, Shirt, Heart, Store, Pencil, X, Sparkles, ArrowRight } from "lucide-react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import SectionTitle from "../components/ui/SectionTitle";
import PetAvatar, { AccessoryPreview } from "../components/pet/PetAvatar";
import { useApp } from "../store/AppStore";
import { studentApi } from "../api/student";
import { petSpecies } from "../data/mock";
import { Link } from "../router";
import "./Pet.css";

const CATEGORIES = [
  { id: "look", label: "Внешний вид" },
  { id: "home", label: "Комната" },
];

const PET_NAMES = ["Искра", "Плюша", "Финик", "Луна", "Тоша", "Пиксель", "Бусинка", "Персик", "Снежок", "Чип"];

export default function Pet() {
  const { profile, ownedItems, hydrate, setPetSpecies, setPetName } = useApp();
  // Render straight from the prefetched payload when it is already warm, so
  // opening the tab does not flash an empty shop while the request repeats.
  const [shopItems, setShopItems] = useState(() => studentApi.peekPet()?.shop ?? []);
  const [outfits, setOutfits] = useState(() => studentApi.peekPet()?.outfits ?? []);
  const [cat, setCat] = useState("look");
  const [lookFilter, setLookFilter] = useState("all");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pendingSpecies, setPendingSpecies] = useState(null);
  const [previewItem, setPreviewItem] = useState(null);
  const [previewOutfit, setPreviewOutfit] = useState(null);
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
  const feedbackTimer = useRef(null);
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    let cancelled = false;
    // Keep the prefetched shop for an instant first paint, but always refresh
    // the profile snapshot before hydrating global XP, coins and streak.
    studentApi.pet({ fresh: true })
      .then(({ shop = [], outfits: nextOutfits = [], ...petProfile }) => {
        if (cancelled) return;
        setShopItems(shop);
        setOutfits(nextOutfits);
        hydrate({ profile: petProfile });
      })
      .catch(() => {
        if (!cancelled) setFeedback({ type: "poor", text: "Магазин временно не загрузился. Попробуй открыть раздел позже." });
      });
    return () => { cancelled = true; };
  }, [hydrate]);

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
  const previewOutfitItems = previewOutfit
    ? previewOutfit.itemIds.map((id) => shopItems.find((item) => item.id === id)).filter(Boolean)
    : [];
  const previewWorn = previewOutfitItems.reduce(
    (next, item) => ({ ...next, [item.slot]: item.accessory }),
    previewItem ? { ...worn, [previewItem.slot]: previewItem.accessory } : worn
  );
  const previewAccessories = Object.values(previewWorn).filter(Boolean);
  const items = shopItems.filter((item) =>
    item.category === cat && (cat !== "look" || lookFilter === "all" || item.outfit === lookFilter)
  );
  const foodItems = shopItems.filter((item) => item.category === "food");
  const foodInventory = profile.foodInventory ?? {};
  const ownedFood = shopItems.find((item) => item.category === "food" && Number(foodInventory[item.id] ?? 0) > 0);
  const petStats = {
    satiety: clampPercent(profile.petStats?.satiety ?? 80),
    mood: clampPercent(profile.petStats?.mood ?? 80),
  };
  const bond = profile.petBond ?? 0;
  const bondLevel = Math.floor(bond / 100) + 1;
  const bondProgress = bond % 100;
  const petState = getPetState(petStats, profile.pet.name);

  const clearLater = useCallback((fn, ms) => {
    const timer = setTimeout(fn, ms);
    timers.current.push(timer);
  }, []);

  useEffect(() => () => {
    timers.current.forEach(clearTimeout);
    window.clearTimeout(feedbackTimer.current);
  }, []);
  useEffect(() => {
    if (!coinsInfoOpen) return undefined;
    const closeOnEscape = (event) => { if (event.key === "Escape") setCoinsInfoOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [coinsInfoOpen]);

  function showFeedback(payload) {
    window.clearTimeout(feedbackTimer.current);
    setFeedback({ ...payload, id: Date.now() });
    feedbackTimer.current = window.setTimeout(() => setFeedback(null), 3500);
  }

  function cheer() {
    setReaction("cheer");
    clearLater(() => setReaction(null), 750);
  }

  async function purchase(item) {
    if (item.category !== "food" && ownedItems.includes(item.id)) return true;
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
          ? missingCoinsMessage(item, profile.coins)
          : "Покупка не сохранилась. Проверь соединение и попробуй ещё раз.",
        action: error.message === "not_enough_coins" ? "practice" : null,
      });
      return false;
    } finally {
      setBusyId(null);
    }
  }

  async function feed(item) {
    if (!item) {
      requestAnimationFrame(() => document.getElementById("pet-food")?.scrollIntoView({ behavior: "smooth", block: "center" }));
      showFeedback({ type: "poor", text: "Выбери корм в комнате — цена видна до покупки." });
      return;
    }
    if (Number(foodInventory[item.id] ?? 0) <= 0) {
      showFeedback({ type: "poor", text: "Этот корм закончился. Купи ещё одну порцию." });
      return;
    }
    setBusyId(`feed:${item.id}`);
    try {
      const data = await studentApi.feedPet(item.id);
      hydrate({ profile: data.profile });
      setEating(item.treat ?? item.icon);
      clearLater(() => setEating(null), 950);
      clearLater(cheer, 700);
      showFeedback({ type: "fed", name: item.name });
    } catch (error) {
      showFeedback({ type: "poor", text: error.message === "food_not_available" ? "Этот корм закончился. Купи ещё одну порцию." : "Не удалось покормить питомца. Попробуй ещё раз." });
    } finally {
      setBusyId(null);
    }
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
      showFeedback({
        type: "poor",
        text: error.message === "not_enough_coins"
          ? `Для смены питомца не хватает ${coinsNeededText(100, profile.coins)}. Заработай их за верные ответы в практике.`
          : "Не удалось сохранить выбор питомца.",
        action: error.message === "not_enough_coins" ? "practice" : null,
      });
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
    setLookFilter("all");
    setPreviewItem(null);
    setPreviewOutfit(null);
    requestAnimationFrame(() => document.getElementById(`pet-tab-${index}`)?.focus());
  }

  function previewInRoom(item) {
    setPreviewItem(item);
    setPreviewOutfit(null);
    requestAnimationFrame(() => {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      document.getElementById("pet-room")?.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "start",
      });
    });
  }

  function previewOutfitInRoom(outfit) {
    setPreviewOutfit(outfit);
    setPreviewItem(null);
    requestAnimationFrame(() => {
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      document.getElementById("pet-room")?.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "start",
      });
    });
  }

  function outfitDetails(outfit) {
    const outfitItems = outfit.itemIds.map((id) => shopItems.find((item) => item.id === id)).filter(Boolean);
    const missingItems = outfitItems.filter((item) => !ownedItems.includes(item.id));
    return {
      items: outfitItems,
      accessories: outfitItems.map((item) => item.accessory),
      ownedCount: outfitItems.length - missingItems.length,
      missingPrice: missingItems.reduce((sum, item) => sum + item.price, 0),
      complete: missingItems.length === 0 && outfitItems.length > 0,
      worn: outfitItems.length > 0 && outfitItems.every((item) => worn[item.slot] === item.accessory),
    };
  }

  async function wearOutfit(outfit) {
    const details = outfitDetails(outfit);
    if (!details.items.length) return;
    setBusyId(`outfit:${outfit.id}`);
    try {
      let data;
      if (details.complete) {
        const nextWorn = details.items.reduce((next, item) => ({ ...next, [item.slot]: item.accessory }), { ...worn });
        data = await studentApi.updatePet({ wornItems: nextWorn });
      } else {
        data = await studentApi.buyPetOutfit(outfit.id);
      }
      setWorn(data.profile.wornItems ?? {});
      hydrate({ profile: data.profile });
      setPreviewOutfit(null);
      cheer();
      showFeedback({ type: "ok", text: details.complete ? `Образ «${outfit.name}» надет` : `Образ «${outfit.name}» собран и надет` });
    } catch (error) {
      showFeedback({
        type: "poor",
        text: error.message === "not_enough_coins"
          ? `До образа «${outfit.name}» не хватает ${coinsNeededText(details.missingPrice, profile.coins)}.`
          : "Не удалось собрать образ. Проверь соединение и попробуй ещё раз.",
        action: error.message === "not_enough_coins" ? "practice" : null,
      });
    } finally {
      setBusyId(null);
    }
  }

  function openCatalog() {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("pet-shop")?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    });
  }

  function openFood() {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("pet-food")?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "center",
    });
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

      <Card className="pet-page__hero" pad="none" id="pet-room">
        <div className={`pet-page__room ${previewItem || previewOutfit ? "pet-page__room--previewing" : ""}`} aria-label={`Комната питомца ${profile.pet.name}`}>
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
              <p>Решай задания в практике — за верные ответы получишь монеты.</p>
              <Link to="/app/practice" className="pet-page__coins-action">К практике</Link>
            </div>
          )}

          <span className="pet-page__sun" aria-hidden="true" />
          <span className="pet-page__cloud pet-page__cloud--one" aria-hidden="true" />
          <span className="pet-page__cloud pet-page__cloud--two" aria-hidden="true" />
          <div className="pet-page__plant" aria-hidden="true"><i /><i /><i /></div>
          {ownedItems.includes("s6") && <RoomItem item={{ id: "s6", name: "Коврик" }} />}
          {ownedItems.includes("s7") && <RoomItem item={{ id: "s7", name: "Лампа" }} />}
          {ownedItems.includes("s12") && <RoomItem item={{ id: "s12", name: "Домик" }} />}
          {ownedItems.includes("s8") && <RoomItem item={{ id: "s8", name: "Звезда" }} />}
          {previewItem?.category === "home" && !ownedItems.includes(previewItem.id) && <RoomItem item={previewItem} preview />}
          <PetSpeech state={petState} onOpenFood={openFood} reduceMotion={reduceMotion} />
          <PetAvatar className="pet-page__avatar" species={profile.pet.species} mood={petState.expression} accessories={previewAccessories} reaction={reaction} eating={eating} size={220} />
        </div>

        {(previewItem || previewOutfit) && (
          <div className="pet-page__preview-bar" aria-live="polite">
            <span className="pet-page__preview-icon" aria-hidden="true">
              {previewOutfit
                ? <PetAvatar species={profile.pet.species} mood="happy" accessories={previewOutfitItems.map((item) => item.accessory)} size={48} animated={false} decorative />
                : previewItem.accessory ? <AccessoryPreview accessory={previewItem.accessory} size={42} /> : previewItem.icon}
            </span>
            <span className="pet-page__preview-copy">
              <strong>Примерка: {previewOutfit?.name ?? previewItem.name}</strong>
              <small>{previewOutfit
                ? `${previewOutfitItems.length} вещи сочетаются в одном образе`
                : previewItem.category === "look" ? "Так предмет выглядит на питомце" : "Так предмет выглядит в комнате"}</small>
            </span>
            <span className="pet-page__preview-actions">
              <Button size="sm" variant="ghost" onClick={() => { setPreviewItem(null); setPreviewOutfit(null); }}>Сбросить</Button>
              {previewOutfit ? (() => {
                const details = outfitDetails(previewOutfit);
                return (
                  <Button size="sm" variant="accent" icon={details.complete ? Shirt : Coins} loading={busyId === `outfit:${previewOutfit.id}`} disabled={details.worn} onClick={() => wearOutfit(previewOutfit)}>
                    {details.worn ? "Образ надет" : details.complete ? "Надеть образ" : `Собрать за ${details.missingPrice}`}
                  </Button>
                );
              })() : previewItem.category === "look" ? (
                <Button
                  size="sm"
                  variant={worn[previewItem.slot] === previewItem.accessory ? "soft" : "accent"}
                  icon={worn[previewItem.slot] === previewItem.accessory ? Check : Shirt}
                  loading={busyId === previewItem.id}
                  onClick={() => wear(previewItem)}
                >
                  {worn[previewItem.slot] === previewItem.accessory
                    ? "Снять"
                    : ownedItems.includes(previewItem.id)
                      ? "Надеть"
                      : `Купить за ${previewItem.price}`}
                </Button>
              ) : ownedItems.includes(previewItem.id) ? (
                <span className="pet-page__preview-owned"><Check size={15} /> Уже в комнате</span>
              ) : (
                <Button
                  size="sm"
                  variant="accent"
                  icon={Coins}
                  loading={busyId === previewItem.id}
                  onClick={async () => (await purchase(previewItem)) && showFeedback({ type: "ok", name: previewItem.name })}
                >
                  Купить за {previewItem.price}
                </Button>
              )}
            </span>
          </div>
        )}

        <div className="pet-page__actions" aria-label="Забота о питомце">
          <button className="pet-action pet-action--primary" onClick={() => feed(ownedFood)} disabled={busyId?.startsWith("feed:")}><Cookie size={19} strokeWidth={2.5} /><span>{ownedFood ? "Покормить" : "Выбрать корм"}</span></button>
          <button className="pet-action" onClick={openCatalog}><Store size={19} strokeWidth={2.5} /><span>Магазин</span></button>
        </div>
      </Card>

      <PetVitals stats={petStats} />

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
            const amount = Number(foodInventory[item.id] ?? 0);
            return <Card key={item.id} className="pet-food" pad="sm">
              <div className="pet-food__head">
                <span className="pet-food__icon" aria-hidden="true">{item.icon}</span>
                <span className="pet-food__name">{item.name}</span>
              </div>
              <div className="pet-food__facts">
                <span className="pet-food__price" aria-label={`Цена: ${item.price} монет`}>
                  <Coins size={16} aria-hidden="true" /><b>{item.price}</b><small>монет</small>
                </span>
                <span className="pet-food__effect" aria-label={`Восстанавливает ${item.effect?.satiety ?? 24}% сытости`}>
                  <b>+{item.effect?.satiety ?? 24}%</b><small>сытость</small>
                </span>
              </div>
              {amount > 0 && <span className="pet-food__count">В запасе: <b>{amount}</b></span>}
              <div className="pet-food__buttons">
                <Button size="sm" variant="accent" icon={Coins} loading={busyId === item.id} onClick={async () => (await purchase(item)) && showFeedback({ type: "ok", name: item.name })}>Купить</Button>
                <Button size="sm" variant={amount > 0 ? "accent" : "soft"} icon={Cookie} disabled={amount <= 0} loading={busyId === `feed:${item.id}`} onClick={() => feed(item)}>Покормить</Button>
              </div>
            </Card>;
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
          <div className="pet-page__change-actions"><Button size="sm" variant="ghost" onClick={() => setPendingSpecies(null)}>Отмена</Button><Button size="sm" icon={Coins} loading={busyId === `species:${pendingSpecies}`} onClick={() => chooseSpecies(pendingSpecies)}>Сменить за 100</Button></div>
        </div>}
        </div>}
      </section>

      <section className="pet-page__shop-section" id="pet-shop">
        <div className="pet-page__section-head"><SectionTitle>Магазин питомца</SectionTitle><p>Нажми «Примерить» — предмет сразу появится в комнате наверху.</p></div>
        <div className="pet-page__cats" role="tablist" aria-label="Категории предметов">
          {CATEGORIES.map((category, index) => (
            <button
              id={`pet-tab-${index}`}
              key={category.id}
              className={`pet-page__cat ${cat === category.id ? "pet-page__cat--on" : ""}`}
              onClick={() => selectCategory(category.id, index)}
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

        {cat === "look" && outfits.length > 0 && (
          <div className="pet-page__outfit-section">
            <div className="pet-page__outfit-heading">
              <div><h3>Готовые образы</h3><p>Примерь комплект целиком. Уже купленные вещи повторно не оплачиваются.</p></div>
              <span>{outfits.length} сетов</span>
            </div>
            <div className="pet-page__outfits">
              {outfits.map((outfit) => {
                const details = outfitDetails(outfit);
                return (
                  <article className={`outfit-card outfit-card--${outfit.tone} ${details.worn ? "outfit-card--worn" : ""}`} key={outfit.id}>
                    <div className="outfit-card__pet" aria-hidden="true">
                      <PetAvatar species={profile.pet.species} mood="happy" accessories={details.accessories} size={112} animated={false} decorative />
                    </div>
                    <div className="outfit-card__content">
                      <div className="outfit-card__title"><strong>{outfit.name}</strong>{details.worn && <span><Check size={13} /> Надет</span>}</div>
                      <p>{outfit.tagline}</p>
                      <span className="outfit-card__progress">{details.ownedCount} из {details.items.length} вещей уже есть</span>
                    </div>
                    <div className="outfit-card__actions">
                      <Button size="sm" variant="soft" onClick={() => previewOutfitInRoom(outfit)}>Примерить</Button>
                      <Button
                        size="sm"
                        variant="accent"
                        icon={details.complete ? Shirt : Coins}
                        loading={busyId === `outfit:${outfit.id}`}
                        disabled={details.worn}
                        aria-label={details.worn ? `Образ «${outfit.name}» надет` : details.complete ? `Надеть образ «${outfit.name}»` : `Собрать образ «${outfit.name}» за ${details.missingPrice} монет`}
                        onClick={() => wearOutfit(outfit)}
                      >
                        {details.worn ? "Надет" : details.complete ? "Надеть" : `${details.missingPrice}`}
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
            <div className="pet-page__look-filters" aria-label="Фильтр одежды">
              <button className={lookFilter === "all" ? "is-active" : ""} aria-pressed={lookFilter === "all"} onClick={() => setLookFilter("all")}>Все вещи</button>
              {outfits.map((outfit) => (
                <button key={outfit.id} className={lookFilter === outfit.id ? "is-active" : ""} aria-pressed={lookFilter === outfit.id} onClick={() => setLookFilter(outfit.id)}>{outfit.name}</button>
              ))}
            </div>
          </div>
        )}

        <div className="pet-page__shop" id="pet-shop-panel" role="tabpanel" aria-live="polite">
          {items.map((item) => {
            const owned = ownedItems.includes(item.id);
            const isWorn = item.slot && worn[item.slot] === item.accessory;
            return (
                <Card key={item.id} className={`shopitem ${previewItem?.id === item.id ? "shopitem--previewing" : ""}`} pad="sm">
                <span className={`shopitem__icon shopitem__icon--${item.category}`} aria-hidden="true">{item.accessory ? <AccessoryPreview accessory={item.accessory} size={52} /> : item.icon}</span>
                <div className="shopitem__meta"><span className="shopitem__name">{item.name}</span>{!owned && <span className="shopitem__price"><Coins size={13} /> {item.price}</span>}</div>
                {cat === "look" ? (
                  <div className="shopitem__actions"><Button size="sm" variant={previewItem?.id === item.id ? "accent" : "soft"} aria-pressed={previewItem?.id === item.id} onClick={() => previewInRoom(item)}>{previewItem?.id === item.id ? "Примеряется" : owned ? "Посмотреть" : "Примерить"}</Button>{owned && <Button size="sm" variant={isWorn ? "soft" : "accent"} icon={isWorn ? Check : Shirt} loading={busyId === item.id} onClick={() => wear(item)}>{isWorn ? "Снять" : "Надеть"}</Button>}</div>
                ) : (
                  <div className="shopitem__actions"><Button size="sm" variant={previewItem?.id === item.id ? "accent" : "soft"} aria-pressed={previewItem?.id === item.id} onClick={() => previewInRoom(item)}>{previewItem?.id === item.id ? "Показан наверху" : owned ? "Посмотреть" : "Примерить"}</Button>{owned && <span className="shopitem__owned"><Check size={14} /> В комнате</span>}</div>
                )}
              </Card>
            );
          })}
        </div>
      </section>

      <AnimatePresence>
      {feedback && (
        <motion.div
          key={feedback.id}
          className={`pet-page__toast pet-page__toast--${feedback.type === "poor" ? "poor" : "ok"}`}
          aria-live="polite"
          initial={reduceMotion ? { opacity: 0, x: "-50%" } : { opacity: 0, x: "-50%", y: 14, scale: 0.98 }}
          animate={reduceMotion ? { opacity: 1, x: "-50%" } : { opacity: 1, x: "-50%", y: 0, scale: 1 }}
          exit={reduceMotion ? { opacity: 0, x: "-50%" } : { opacity: 0, x: "-50%", y: 10, scale: 0.98 }}
          transition={{ duration: reduceMotion ? 0.14 : 0.22, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="pet-page__toast-message" role="status">
          {feedback.text ? <>{feedback.action !== "practice" && <Info size={16} strokeWidth={2.6} />} {feedback.text}</> :
           feedback.type === "poor" ? <><Info size={16} strokeWidth={2.6} /> Не хватает монет, реши ещё пару заданий</> :
           feedback.type === "fed" ? <><Check size={16} strokeWidth={3} /> {profile.pet.name} оценил «{feedback.name}»</> :
           <><Check size={16} strokeWidth={3} /> «{feedback.name}» куплено!</>}
          </span>
          {feedback.action === "practice" && <Button as={Link} to="/app/practice" size="sm" variant="soft">К практике</Button>}
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}

function PetVitals({ stats }) {
  return (
    <Card className="pet-page__vitals" pad="md" aria-label="Состояние питомца">
      <PetVitalBar icon="🍖" label="Сытость" value={stats.satiety} tone="satiety" />
      <PetVitalBar icon="😊" label="Настроение" value={stats.mood} tone="mood" />
    </Card>
  );
}

function PetVitalBar({ icon, label, value, tone }) {
  return (
    <div className={`pet-vital pet-vital--${tone}`}>
      <div className="pet-vital__head">
        <span><span aria-hidden="true">{icon}</span> {label}</span>
        <b>{value}%</b>
      </div>
      <div className="pet-vital__track" role="progressbar" aria-label={label} aria-valuemin="0" aria-valuemax="100" aria-valuenow={value}>
        <i style={{ transform: `scaleX(${value / 100})` }} />
      </div>
    </div>
  );
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function missingCoinsMessage(item, balance) {
  return `До «${item.name}» не хватает ${coinsNeededText(item.price, balance)}. Заработай их за верные ответы в практике.`;
}

function coinsNeededText(price, balance) {
  const missing = Math.max(1, price - Number(balance ?? 0));
  const coinWord = missing % 10 === 1 && missing % 100 !== 11 ? "монеты" : "монет";
  return `${missing} ${coinWord}`;
}

function getPetState(stats, name) {
  const hungry = stats.satiety < 45;
  const sad = stats.mood < 45;
  const veryHungry = stats.satiety <= 20;
  const verySad = stats.mood <= 20;
  const expression = hungry || sad ? "sad" : stats.satiety >= 70 && stats.mood >= 70 ? "happy" : "idle";

  if (hungry && sad) {
    return {
      key: "hungry-and-sad",
      expression,
      text: veryHungry || verySad ? "Мне нужны корм и пара заданий. Поможешь?" : "Корм и пара заданий поднимут мне настроение.",
      actions: ["food", "practice"],
    };
  }
  if (hungry) {
    return {
      key: "hungry",
      expression,
      text: veryHungry ? "Я очень проголодался. Покорми меня, пожалуйста." : "Мне бы перекусить. Заглянем в питание?",
      actions: ["food"],
    };
  }
  if (sad) {
    return {
      key: "sad",
      expression,
      text: verySad ? "Мне немного грустно. Порешаем вместе?" : "Давай решим пару заданий — я повеселею.",
      actions: ["practice"],
    };
  }

  const phrases = [
    "Я рядом. У тебя всё получится!",
    "Учиться вместе — весело!",
    "Рад твоим стараниям!",
    "Сделаем ещё один шаг к цели?",
  ];
  const phraseIndex = Array.from(name).reduce((total, symbol) => total + symbol.codePointAt(0), 0) % phrases.length;
  return { key: "content", expression, text: phrases[phraseIndex], actions: [] };
}

function PetSpeech({ state, onOpenFood, reduceMotion }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={state.key}
        className="pet-page__speech"
        role="status"
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.98 }}
        animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
        transition={{ duration: reduceMotion ? 0.14 : 0.2, ease: [0.16, 1, 0.3, 1] }}
      >
        <p>{state.text}</p>
        {state.actions.length > 0 && (
          <span className="pet-page__speech-actions">
            {state.actions.includes("food") && <button type="button" onClick={onOpenFood}><Cookie size={14} /> К корму</button>}
            {state.actions.includes("practice") && <Link to="/app/practice"><Sparkles size={14} /> К практике</Link>}
          </span>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

function RoomItem({ item, preview = false }) {
  if (!item) return null;
  const kind = { s6: "rug", s7: "lamp", s12: "house", s8: "star" }[item.id];
  if (!kind) return null;
  return (
    <span
      className={`pet-page__${kind} ${preview ? "pet-page__room-item--preview" : ""}`}
      role="img"
      aria-label={`${item.name}${preview ? " — примерка" : ""}`}
    >
      {kind === "star" ? "★" : null}
      {(kind === "lamp" || kind === "house") && <i />}
    </span>
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
        <p>Первый выбор бесплатный. Сменить питомца позже можно за 100 монет.</p>
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
            <PetAvatar species={item.id} mood="happy" size={72} animated={false} decorative />
            <span>{item.name}</span>
            {species === item.id && <i><Check size={14} strokeWidth={3} /></i>}
          </button>
        ))}
      </div>

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
