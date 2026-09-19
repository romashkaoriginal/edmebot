// In-memory seed data mirroring the frontend mock. No AI. Rule-based logic only.

function addDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(18, 0, 0, 0);
  return d.toISOString();
}

const topics = [
  { id: "fractions", subject: "Математика", name: "Дроби", status: "red", mastery: 34 },
  { id: "equations", subject: "Математика", name: "Уравнения", status: "yellow", mastery: 61 },
  { id: "geometry", subject: "Математика", name: "Геометрия: углы", status: "green", mastery: 88 },
  { id: "percents", subject: "Математика", name: "Проценты", status: "yellow", mastery: 55 },
  { id: "powers", subject: "Математика", name: "Степени", status: "green", mastery: 82 },
  { id: "wordproblems", subject: "Математика", name: "Текстовые задачи", status: "red", mastery: 41 },
];

const diagnostic = [
  { id: "d1", subject: "Математика", topic: "fractions", prompt: "Сократи дробь 12/18 до несократимой.", options: ["2/3", "3/4", "6/9", "4/6"], correct: 0 },
  { id: "d2", subject: "Математика", topic: "equations", prompt: "Реши уравнение: 2x + 6 = 14. Чему равен x?", options: ["2", "4", "6", "10"], correct: 1 },
  { id: "d3", subject: "Математика", topic: "percents", prompt: "Сколько будет 20% от 150?", options: ["20", "30", "45", "50"], correct: 1 },
  { id: "d4", subject: "Математика", topic: "geometry", prompt: "Сумма углов треугольника равна…", options: ["90°", "180°", "270°", "360°"], correct: 1 },
  { id: "d5", subject: "Математика", topic: "powers", prompt: "Чему равно 2³?", options: ["6", "8", "9", "16"], correct: 1 },
  { id: "d6", subject: "Математика", topic: "wordproblems", prompt: "В корзине 24 яблока. Треть отдали. Сколько осталось?", options: ["8", "12", "16", "18"], correct: 2 },
  { id: "d7", subject: "Математика", topic: "fractions", prompt: "Что больше: 3/5 или 2/3?", options: ["3/5", "2/3", "равны", "нельзя сравнить"], correct: 1 },
  { id: "d8", subject: "Математика", topic: "equations", prompt: "Реши: x/3 = 5. Чему равен x?", options: ["8", "15", "2", "5/3"], correct: 1 },
  { id: "d9", subject: "Математика", topic: "percents", prompt: "Цена 800 ₽ выросла на 25%. Новая цена?", options: ["1000 ₽", "825 ₽", "1200 ₽", "900 ₽"], correct: 0 },
  { id: "d10", subject: "Математика", topic: "wordproblems", prompt: "Поезд идёт 300 км за 4 ч. Скорость?", options: ["60 км/ч", "75 км/ч", "80 км/ч", "1200 км/ч"], correct: 1 },
];

const taskBank = [
  {
    id: "t1", subject: "Математика", topic: "fractions", difficulty: "easy", prompt: "Сложи дроби: 1/4 + 1/4",
    options: ["1/2", "2/8", "1/8", "2/4"], correct: 0,
    explanation: "Знаменатели одинаковые (4), поэтому складываем только числители: 1 + 1 = 2. Получаем 2/4, а это то же самое, что 1/2.",
    hints: ["Посмотри на знаменатели — они одинаковые. Что тогда нужно сделать только с числителями?", "Сложи числители: 1 + 1. Знаменатель оставь прежним, потом сократи результат."],
    commonMistake: "Частая ошибка — складывать и знаменатели тоже (получается 2/8). Знаменатель при одинаковых дробях не меняется.",
  },
  {
    id: "t2", subject: "Математика", topic: "fractions", difficulty: "medium", prompt: "Сложи дроби: 1/2 + 1/3",
    options: ["2/5", "5/6", "1/6", "2/6"], correct: 1,
    explanation: "Знаменатели разные. Приводим к общему знаменателю 6: 1/2 = 3/6, 1/3 = 2/6. Складываем: 3/6 + 2/6 = 5/6.",
    hints: ["Знаменатели разные (2 и 3). Найди их наименьший общий знаменатель.", "Общий знаменатель — 6. Приведи обе дроби к нему, потом сложи числители."],
    commonMistake: "Нельзя складывать числители и знаменатели напрямую (это даёт 2/5). Сначала — общий знаменатель.",
  },
  {
    id: "t3", subject: "Математика", topic: "equations", difficulty: "medium", prompt: "Реши уравнение: 3x − 7 = 8",
    options: ["3", "5", "15", "1"], correct: 1,
    explanation: "Переносим −7 вправо со сменой знака: 3x = 8 + 7 = 15. Делим обе части на 3: x = 5.",
    hints: ["Сначала перенеси свободное число вправо. Не забудь сменить знак.", "Получишь 3x = 15. Осталось разделить обе части на коэффициент при x."],
    commonMistake: "Частая ошибка — забыть сменить знак при переносе (получают 3x = 1).",
  },
  {
    id: "t4", subject: "Математика", topic: "percents", difficulty: "easy", prompt: "Сколько будет 10% от 250?",
    options: ["10", "25", "50", "2.5"], correct: 1,
    explanation: "10% — это одна десятая. Делим 250 на 10 = 25.",
    hints: ["10% — это то же самое, что разделить число на 10.", "Просто убери один ноль или раздели 250 на 10."],
    commonMistake: "Не путай 10% (÷10) и 1% (÷100).",
  },
  {
    id: "t5", subject: "Математика", topic: "wordproblems", difficulty: "hard", prompt: "Велосипедист проехал 45 км за 3 часа. С какой скоростью он должен ехать, чтобы проехать те же 45 км за 2 часа?",
    options: ["15 км/ч", "22.5 км/ч", "30 км/ч", "90 км/ч"], correct: 1,
    explanation: "Скорость = расстояние ÷ время. Чтобы проехать 45 км за 2 часа: 45 ÷ 2 = 22.5 км/ч.",
    hints: ["Вспомни формулу: скорость = расстояние ÷ время. Первые данные (3 часа) здесь — отвлекающие.", "Нужное время — 2 часа, расстояние то же (45 км). Раздели 45 на 2."],
    commonMistake: "Данные про 3 часа не нужны для ответа — это ловушка. Считай по новому времени.",
  },
  {
    id: "t6", subject: "Математика", topic: "geometry", difficulty: "medium", prompt: "Два угла треугольника равны 50° и 60°. Чему равен третий угол?",
    options: ["60°", "70°", "80°", "110°"], correct: 1,
    explanation: "Сумма углов треугольника = 180°. Третий угол = 180 − 50 − 60 = 70°.",
    hints: ["Чему всегда равна сумма всех трёх углов треугольника?", "Из 180° вычти два известных угла."],
    commonMistake: "Не складывай 50 и 60 как ответ — нужно вычесть их из 180°.",
  },
];

const homework = [
  { id: "hw1", topic: "Дроби", title: "Сложение и вычитание дробей", description: "Реши №4–12 на стр. 48. Обрати внимание на приведение к общему знаменателю.", due: addDays(1), status: "active", materials: [{ label: "Памятка: общий знаменатель", url: "#" }] },
  { id: "hw2", topic: "Уравнения", title: "Линейные уравнения", description: "Составь и реши 5 уравнений по задачам из карточки.", due: addDays(3), status: "active", materials: [] },
  { id: "hw3", topic: "Проценты", title: "Задачи на проценты", description: "Тренажёр «Проценты», уровень 2. Минимум 10 заданий.", due: addDays(-1), status: "overdue", materials: [] },
  { id: "hw4", topic: "Геометрия", title: "Углы треугольника", description: "Повтори теорему о сумме углов и реши задачи 1–6.", due: addDays(-4), status: "done", materials: [] },
];

const achievements = [
  { id: "a1", name: "Первый шаг", desc: "Пройден входной тест", icon: "🎯", tier: "bronze", earned: true },
  { id: "a2", name: "Знакомство", desc: "Выбран питомец", icon: "🐾", tier: "bronze", earned: true },
  { id: "a3", name: "Разминка", desc: "Первое решённое задание", icon: "✏️", tier: "bronze", earned: true },
  { id: "a4", name: "Неделя в строю", desc: "Стрик 7 дней", icon: "🔥", tier: "silver", earned: true },
  { id: "a5", name: "Две недели", desc: "Стрик 14 дней", icon: "⚡", tier: "silver", earned: false, progress: { cur: 12, max: 14 } },
  { id: "a6", name: "Марафонец", desc: "Стрик 30 дней", icon: "🏅", tier: "gold", earned: false, progress: { cur: 12, max: 30 } },
  { id: "a7", name: "Несгибаемый", desc: "Стрик 100 дней", icon: "💎", tier: "diamond", earned: false, progress: { cur: 12, max: 100 } },
  { id: "a8", name: "Меткий стрелок", desc: "10 верных ответов подряд", icon: "🏹", tier: "silver", earned: true },
  { id: "a9", name: "Снайпер", desc: "25 верных подряд", icon: "🎯", tier: "gold", earned: false, progress: { cur: 10, max: 25 } },
  { id: "a10", name: "Без подсказок", desc: "Серия без «Намекни»", icon: "🧠", tier: "silver", earned: true },
  { id: "a11", name: "Идеальная серия", desc: "5 заданий на 100%", icon: "🌟", tier: "gold", earned: false },
  { id: "a12", name: "Полусотка", desc: "50 решённых заданий", icon: "🔟", tier: "silver", earned: true },
  { id: "a13", name: "Сотка", desc: "100 решённых заданий", icon: "💯", tier: "gold", earned: true },
  { id: "a14", name: "Пятьсот", desc: "500 решённых заданий", icon: "🚀", tier: "diamond", earned: false, progress: { cur: 214, max: 500 } },
  { id: "a15", name: "Знаток дробей", desc: "Тема «Дроби» на зелёном", icon: "🧩", tier: "gold", earned: false, progress: { cur: 34, max: 75 } },
  { id: "a16", name: "Геометр", desc: "Тема «Геометрия» на зелёном", icon: "📐", tier: "gold", earned: true },
  { id: "a17", name: "Все темы зелёные", desc: "Карта знаний без пробелов", icon: "🗺️", tier: "diamond", earned: false, progress: { cur: 2, max: 6 } },
  { id: "a18", name: "Пятый уровень", desc: "Достигнут 5 уровень", icon: "⬆️", tier: "silver", earned: true },
  { id: "a19", name: "Десятый уровень", desc: "Достигнут 10 уровень", icon: "👑", tier: "gold", earned: false, progress: { cur: 8, max: 10 } },
  { id: "a20", name: "Домосед", desc: "10 домашних заданий сдано", icon: "📚", tier: "silver", earned: false, progress: { cur: 6, max: 10 } },
  { id: "a21", name: "Ранняя пташка", desc: "Занятие до 8 утра", icon: "🌅", tier: "bronze", earned: true },
  { id: "a22", name: "Богач", desc: "Накоплено 1000 монет", icon: "💰", tier: "gold", earned: false, progress: { cur: 340, max: 1000 } },
  { id: "a23", name: "Модник", desc: "Куплено 5 предметов питомцу", icon: "🎀", tier: "silver", earned: false, progress: { cur: 1, max: 5 } },
  { id: "a24", name: "Коллекционер", desc: "Собран редкий предмет", icon: "🏆", tier: "diamond", earned: false },
];

// Prices for "look"/"home" gear are calibrated against real practice income
// (rewardEligible daily-unique answers pay ~5-13 coins depending on difficulty,
// see XP_BY_DIFFICULTY / gradePractice in studentState.js): the cheapest piece
// costs ~20 solved tasks, and a full 4-piece outfit is a multi-week goal, so
// coins can't be farmed into gear by grinding a handful of easy repeats. Food
// stays cheap (15-25) since it's a consumable meant to be bought often.
const shopItems = [
  { id: "s1", category: "food", name: "Ягоды", price: 20, icon: "🫐", treat: "🫐", effect: { satiety: 22, mood: 8 } },
  { id: "s2", category: "food", name: "Орешки", price: 15, icon: "🌰", treat: "🌰", effect: { satiety: 16, mood: 5 } },
  { id: "s9", category: "food", name: "Печенье", price: 25, icon: "🍪", treat: "🍪", effect: { satiety: 28, mood: 10 } },
  { id: "s3", category: "look", name: "Шарф", price: 210, icon: "🧣", slot: "neck", accessory: "scarf" },
  { id: "s4", category: "look", name: "Очки", price: 280, icon: "🕶️", slot: "eyes", accessory: "glasses" },
  { id: "s5", category: "look", name: "Цилиндр", price: 245, icon: "🎩", slot: "head", accessory: "tophat" },
  { id: "s10", category: "look", name: "Кепка", price: 190, icon: "🧢", slot: "head", accessory: "cap" },
  { id: "s11", category: "look", name: "Бабочка", price: 160, icon: "🎀", slot: "neck", accessory: "bowtie" },
  { id: "s13", category: "look", name: "Корона", price: 420, icon: "👑", slot: "head", accessory: "crown" },
  { id: "s14", category: "look", name: "Наушники", price: 330, icon: "🎧", slot: "ears", accessory: "headphones" },
  { id: "s15", category: "look", name: "Кулон", price: 230, icon: "📿", slot: "neck", accessory: "pendant" },
  { id: "s16", category: "look", name: "Ботинки", price: 370, icon: "🥾", slot: "feet", accessory: "boots" },
  { id: "s17", category: "look", name: "Розовая тиара", price: 400, icon: "👑", slot: "head", accessory: "pink_tiara", outfit: "pink-princess" },
  { id: "s18", category: "look", name: "Платье с бантом", price: 510, icon: "👗", slot: "body", accessory: "pink_dress", outfit: "pink-princess" },
  { id: "s19", category: "look", name: "Жемчужный воротник", price: 260, icon: "🤍", slot: "neck", accessory: "pearl_collar", outfit: "pink-princess" },
  { id: "s20", category: "look", name: "Розовые туфельки", price: 315, icon: "🎀", slot: "feet", accessory: "pink_shoes", outfit: "pink-princess" },
  { id: "s21", category: "look", name: "Космошлем", price: 470, icon: "🪐", slot: "head", accessory: "space_helmet", outfit: "space-explorer" },
  { id: "s22", category: "look", name: "Скафандр", price: 540, icon: "🚀", slot: "body", accessory: "space_suit", outfit: "space-explorer" },
  { id: "s23", category: "look", name: "Звёздный визор", price: 330, icon: "✨", slot: "eyes", accessory: "space_visor", outfit: "space-explorer" },
  { id: "s24", category: "look", name: "Лунные ботинки", price: 370, icon: "🌙", slot: "feet", accessory: "moon_boots", outfit: "space-explorer" },
  { id: "s25", category: "look", name: "Маска героя", price: 300, icon: "⚡", slot: "eyes", accessory: "hero_mask", outfit: "superhero" },
  { id: "s26", category: "look", name: "Костюм и плащ", price: 580, icon: "🦸", slot: "body", accessory: "hero_suit", outfit: "superhero" },
  { id: "s27", category: "look", name: "Сапоги героя", price: 350, icon: "🥾", slot: "feet", accessory: "hero_boots", outfit: "superhero" },
  { id: "s28", category: "look", name: "Повязка чемпиона", price: 245, icon: "🏅", slot: "head", accessory: "hero_headband", outfit: "superhero" },
  { id: "s29", category: "look", name: "Берет отличника", price: 280, icon: "🎓", slot: "head", accessory: "scholar_beret", outfit: "smart-academy" },
  { id: "s30", category: "look", name: "Круглые очки", price: 300, icon: "🤓", slot: "eyes", accessory: "scholar_glasses", outfit: "smart-academy" },
  { id: "s31", category: "look", name: "Жилет академии", price: 440, icon: "📚", slot: "body", accessory: "scholar_vest", outfit: "smart-academy" },
  { id: "s32", category: "look", name: "Кеды отличника", price: 315, icon: "👟", slot: "feet", accessory: "scholar_shoes", outfit: "smart-academy" },
  { id: "s33", category: "look", name: "Звёздные очки", price: 350, icon: "⭐", slot: "eyes", accessory: "star_glasses", outfit: "stage-star" },
  { id: "s34", category: "look", name: "Сценическая куртка", price: 525, icon: "🎸", slot: "body", accessory: "stage_jacket", outfit: "stage-star" },
  { id: "s35", category: "look", name: "Неоновые кеды", price: 385, icon: "👟", slot: "feet", accessory: "neon_shoes", outfit: "stage-star" },
  { id: "s36", category: "look", name: "Наушники-звёзды", price: 420, icon: "🎧", slot: "ears", accessory: "star_headphones", outfit: "stage-star" },
  // Standalone pieces — mix-and-match accessories with no outfit set behind them.
  { id: "s37", category: "look", name: "Бандана", price: 175, icon: "🧢", slot: "neck", accessory: "bandana" },
  { id: "s38", category: "look", name: "Венок из цветов", price: 300, icon: "🌸", slot: "head", accessory: "flower_crown" },
  { id: "s39", category: "look", name: "Монокль", price: 245, icon: "🧐", slot: "eyes", accessory: "monocle" },
  { id: "s40", category: "look", name: "Колпак именинника", price: 190, icon: "🎉", slot: "head", accessory: "party_hat" },
  { id: "s41", category: "look", name: "Круглые тёмные очки", price: 260, icon: "😎", slot: "eyes", accessory: "sunglasses_round" },
  { id: "s42", category: "look", name: "Ошейник с бубенчиком", price: 210, icon: "🔔", slot: "neck", accessory: "bell_collar" },
  { id: "s43", category: "look", name: "Бант на макушку", price: 140, icon: "🎀", slot: "head", accessory: "ribbon_bow" },
  { id: "s45", category: "look", name: "Сандалии", price: 190, icon: "🩴", slot: "feet", accessory: "sandals" },
  { id: "s46", category: "look", name: "Шляпа волшебника", price: 455, icon: "🧙", slot: "head", accessory: "wizard_hat" },
  // Room gear works like clothing: one slot, several skins, exactly one worn
  // per slot (see wornItems in updatePet). "accessory" here is the skin id
  // RoomScene/RoomItemPreview render — same field name as "look" items so the
  // existing wear/owned/slot machinery needs no home-specific branch.
  // "sky" wallpaper and "grass" floor are the default look of an empty slot
  // (see ROOM_DEFAULT_SKIN on the front end) — not purchasable, so they are
  // deliberately not listed here.
  { id: "h2", category: "home", name: "Полоска", price: 260, icon: "🎀", slot: "wallpaper", accessory: "stripe" },
  { id: "h3", category: "home", name: "Звёздное небо", price: 340, icon: "✨", slot: "wallpaper", accessory: "starry" },
  { id: "h4", category: "home", name: "Мятные горошины", price: 240, icon: "🟢", slot: "wallpaper", accessory: "mint" },
  { id: "h5", category: "home", name: "Меловая доска", price: 300, icon: "🖍️", slot: "wallpaper", accessory: "chalkboard" },
  { id: "h7", category: "home", name: "Паркет", price: 220, icon: "🪵", slot: "floor", accessory: "wood" },
  { id: "h8", category: "home", name: "Плитка", price: 210, icon: "◻️", slot: "floor", accessory: "tile" },
  { id: "h9", category: "home", name: "Облачный пол", price: 260, icon: "☁️", slot: "floor", accessory: "clouds" },
  { id: "s6", category: "home", name: "Круглый коврик", price: 190, icon: "🟫", slot: "rug", accessory: "round" },
  { id: "h10", category: "home", name: "Полосатый коврик", price: 230, icon: "🟥", slot: "rug", accessory: "oval_stripe" },
  { id: "h11", category: "home", name: "Коврик-шестиугольник", price: 260, icon: "🔷", slot: "rug", accessory: "hexagon" },
  { id: "h12", category: "home", name: "Коврик-звезда", price: 300, icon: "⭐", slot: "rug", accessory: "star_shape" },
  { id: "s7", category: "home", name: "Торшер", price: 250, icon: "💡", slot: "lamp", accessory: "floor_lamp" },
  { id: "h13", category: "home", name: "Гирлянда", price: 270, icon: "🎇", slot: "lamp", accessory: "fairy_lights" },
  { id: "h14", category: "home", name: "Лунный светильник", price: 320, icon: "🌙", slot: "lamp", accessory: "moon_lamp" },
  { id: "h15", category: "home", name: "Фонарик", price: 240, icon: "🏮", slot: "lamp", accessory: "lantern" },
  { id: "s12", category: "home", name: "Домик", price: 480, icon: "🏠", slot: "furniture", accessory: "house" },
  { id: "h16", category: "home", name: "Кроватка", price: 560, icon: "🛏️", slot: "furniture", accessory: "bed" },
  { id: "h17", category: "home", name: "Книжный шкаф", price: 520, icon: "📚", slot: "furniture", accessory: "bookshelf" },
  { id: "h18", category: "home", name: "Письменный стол", price: 500, icon: "🖥️", slot: "furniture", accessory: "desk" },
  { id: "h19", category: "home", name: "Ящик с игрушками", price: 380, icon: "🧸", slot: "furniture", accessory: "toybox" },
  { id: "s8", category: "home", name: "Звезда на стену", price: 200, icon: "⭐", slot: "decor", accessory: "star" },
  { id: "h20", category: "home", name: "Картина", price: 280, icon: "🖼️", slot: "decor", accessory: "painting" },
  { id: "h21", category: "home", name: "Аквариум", price: 420, icon: "🐠", slot: "decor", accessory: "aquarium" },
  { id: "h22", category: "home", name: "Шарики", price: 230, icon: "🎈", slot: "decor", accessory: "balloons" },
  { id: "h23", category: "home", name: "Кубки", price: 350, icon: "🏆", slot: "decor", accessory: "trophies" },
];

const outfits = [
  { id: "pink-princess", name: "Розовая принцесса", tagline: "Тиара, платье и туфельки в одном образе", itemIds: ["s17", "s18", "s19", "s20"], tone: "pink" },
  { id: "space-explorer", name: "Космоисследователь", tagline: "Полный комплект для экспедиции к звёздам", itemIds: ["s21", "s22", "s23", "s24"], tone: "space" },
  { id: "superhero", name: "Супергерой", tagline: "Маска, плащ и сапоги для большого подвига", itemIds: ["s25", "s26", "s27", "s28"], tone: "hero" },
  { id: "smart-academy", name: "Звезда академии", tagline: "Умный образ для новых учебных побед", itemIds: ["s29", "s30", "s31", "s32"], tone: "academy" },
  { id: "stage-star", name: "Звезда сцены", tagline: "Яркий комплект для собственного концерта", itemIds: ["s33", "s34", "s35", "s36"], tone: "stage" },
];

const weekActivity = [
  { day: "Пн", tasks: 6 }, { day: "Вт", tasks: 8 }, { day: "Ср", tasks: 4 },
  { day: "Чт", tasks: 10 }, { day: "Пт", tasks: 7 }, { day: "Сб", tasks: 3 }, { day: "Вс", tasks: 9 },
];

// Mutable profile state (single demo user).
const profile = {
  name: "Артём", grade: 7, subject: "Математика",
  pet: { species: "fox", name: "Рыжик" },
  petStats: { satiety: 80, mood: 80 },
  foodInventory: {},
  coins: 340, xp: 1240, level: 8, xpForNext: 1600, xpFromLevel: 1000,
  streak: 12, streakFreezeUsed: false,
  solvedTotal: 214, accuracy: 78, avgTimeSec: 42, diagnosticDone: true,
  ownedItems: ["s3"],
};

module.exports = { topics, diagnostic, taskBank, homework, achievements, shopItems, outfits, weekActivity, profile };
