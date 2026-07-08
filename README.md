# EDme — ИИ-бот-репетитор (без ИИ-модулей)

Учебная платформа-геймификация для школьников 5–11 классов. По ТЗ реализованы
все модули, **кроме ИИ-функционала** (модуль 7 «ИИ-помощник» и ИИ-части
автоподбора исключены по требованию заказчика). Вся логика подбора заданий,
разбора ошибок и рекомендаций — правило-основанная.

Дизайн построен на фирменной сине-оранжевой гамме логотипа. См. [DESIGN.md](DESIGN.md)
и [PRODUCT.md](PRODUCT.md).

## Структура

```
edmebot/
├── front/   # React (Vite) — интерфейс всех модулей
└── back/    # Node.js + Express — API с in-memory данными
```

## Запуск

Backend (порт 3001):

```bash
cd back
npm install
npm run dev      # nodemon, или npm start
```

Frontend (порт 5173, проксирует /api на backend):

```bash
cd front
npm install
npm run dev
```

## Реализованные модули

| № | Модуль | Экран(ы) |
| --- | --- | --- |
| 1 | Входной тест и карта знаний | `/diagnostic`, `/diagnostic/run` |
| 2 | Практика (режимы, уровни, автоподбор) | `/practice`, `/practice/run` |
| 3 | Разбор ошибок и обратная связь | в `/practice/run` (feedback + сводка) |
| 4 | Подсказка «Намекни» (макс 2, снижает XP) | в `/practice/run` |
| 5 | XP, уровни, стрики | шапка, `/pet`, `/profile`, reward-оверлей |
| 6 | Питомец и магазин за баллы | `/pet` |
| 8 | Домашние задания и дедлайны | `/homework` |
| 9 | Личный кабинет и аналитика | `/profile` |

Модуль 7 (ИИ-помощник) не реализован намеренно.

## API (backend)

| Метод | Путь | Назначение |
| --- | --- | --- |
| GET | `/api/profile` | Профиль ученика |
| GET | `/api/profile/analytics` | Статистика, рекомендации, отчёт |
| GET | `/api/diagnostic` | Вопросы входного теста |
| POST | `/api/diagnostic/submit` | Ответы → карта знаний |
| GET | `/api/practice/series` | Серия заданий (rule-based подбор) |
| POST | `/api/practice/answer` | Проверка ответа + начисление XP |
| GET | `/api/pet` | Питомец, баллы, магазин |
| POST | `/api/pet/buy` | Покупка предмета |
| GET | `/api/homework` | Список ДЗ с дедлайн-статусами |
| POST | `/api/homework/:id/complete` | Отметить ДЗ выполненным |

Данные — in-memory (демо, без БД). Логика XP/стриков/подбора — в `back/src/store.js`.

## Стек

- **Frontend:** React 19, React Router, Vite, framer-motion (celebration-моменты),
  lucide-react (иконки). Токены дизайна — OKLCH, шрифты Nunito + Baloo 2.
- **Backend:** Express 5, CORS, dotenv.
