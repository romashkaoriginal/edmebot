# EDme — ИИ-бот-репетитор (без ИИ-модулей)

Учебная платформа-геймификация для школьников 5–11 классов. По ТЗ реализованы
все модули, **кроме ИИ-функционала** (модуль 7 «ИИ-помощник» и ИИ-части
адаптивного ИИ-подбора исключены по требованию заказчика). Вся логика подбора заданий,
разбора ошибок и рекомендаций — правило-основанная.

Дизайн построен на глубокой фиолетово-оранжевой гамме. См. [DESIGN.md](DESIGN.md)
и [PRODUCT.md](PRODUCT.md).

## Структура

```
edmebot/
├── front/   # React (Vite) — интерфейс ученика + админ-панель
└── back/    # Node.js + Express — API, данные в Postgres (Supabase)
```

## Вход в приложение

Стартовый экран (`/`) определяет роль по подписанным данным Telegram Mini App:

- **Админ‑панель** (`/admin`) — управление учениками, заданиями, домашкой и статистикой.
- **Ученик** (`/app`) — приложение ученика (практика, домашка, питомец, прогресс).

Backend проверяет подпись и срок жизни `Telegram.WebApp.initData`. Роли сотрудников
хранятся в таблице `users`; открытие чужого реального профиля не поддерживается.
Для локальной UI-проверки админки в dev-режиме доступен `/admin?preview=admin`,
но preview не отключает серверную авторизацию API.

## База данных (Supabase)

1. Создай проект на [supabase.com](https://supabase.com), задай пароль БД.
2. Скопируй **connection string** через **Connect → Connection string**
   (для Render/serverless — pooler, хост `...pooler.supabase.com`, порт `6543`).
3. Положи её в `back/.env` (см. `back/.env.example`):
   ```
   DATABASE_URL=postgresql://postgres.xxxx:ПАРОЛЬ@aws-0-...pooler.supabase.com:6543/postgres
   ```

Схема (`students`, `tasks`, `homework`, `attempts`) создаётся автоматически
при старте бэкенда, seed-задания и демо‑ученик добавляются один раз.

## Запуск локально

Backend (порт 3001):

```bash
cd back
npm ci
npm run dev      # nodemon, или npm start
```

Frontend (порт 5173, проксирует /api на backend):

```bash
cd front
npm ci
npm run dev
```

## Деплой

- **Backend → Render:** blueprint `render.yaml` (rootDir `back`). Задай
  `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `APP_URL`
  и при необходимости `CORS_ALLOWED_ORIGINS` в дашборде Render. Webhook secret
  должен быть случайной URL-safe строкой длиной не менее 32 символов.
- **Frontend → Vercel:** rootDir `front`, `vercel.json` уже настроен (SPA-rewrite).
  Задай env `VITE_API_URL` = URL бэкенда на Render (напр.
  `https://edmebot-api.onrender.com`), иначе фронт будет ходить на относительный
  `/api` и не найдёт бэкенд.
- **DB → Supabase:** см. раздел выше.

## Реализованные модули

| № | Модуль | Экран(ы) |
| --- | --- | --- |
| 1 | Входной тест и карта знаний | `/diagnostic`, `/diagnostic/run` |
| 2 | Практика (режимы, уровни, смешанная сложность) | `/practice`, `/practice/run` |
| 3 | Разбор ошибок и обратная связь | в `/practice/run` (feedback + сводка) |
| 4 | Подсказка «Намекни» (макс 2, снижает опыт) | в `/practice/run` |
| 5 | Опыт, уровни, стрики | шапка, `/pet`, `/profile` |
| 6 | Питомец и магазин за монеты | `/pet` |
| 8 | Домашние задания и дедлайны | `/homework` |
| 9 | Личный кабинет и аналитика | `/profile` |

Модуль 7 (ИИ-помощник) не реализован намеренно.

## API (backend)

| Метод | Путь | Назначение |
| --- | --- | --- |
| GET | `/api/profile` | Профиль ученика |
| POST | `/api/profile/trial/start` | Одноразовый trial на 30 дней |
| GET | `/api/profile/analytics` | Статистика, рекомендации, отчёт |
| GET | `/api/diagnostic` | Вопросы входного теста |
| POST | `/api/diagnostic/submit` | Ответы → карта знаний |
| GET | `/api/practice/series` | Серия заданий (rule-based подбор) |
| POST | `/api/practice/answer` | Проверка ответа + начисление опыта и монет |
| GET | `/api/pet` | Питомец, монеты, магазин |
| POST | `/api/pet/buy` | Покупка предмета |
| GET | `/api/homework` | Список ДЗ с дедлайн-статусами |
| POST | `/api/homework/:id/submit` | Атомарная отправка попытки ДЗ |

### Админ‑API (`/api/admin`, БД)

| Метод | Путь | Назначение |
| --- | --- | --- |
| GET/POST | `/api/admin/students` | Список / создание ученика |
| PUT/DELETE | `/api/admin/students/:id` | Изменение / удаление ученика |
| GET/POST | `/api/admin/tasks` | Список (фильтр `?grade=&subject=`) / создание задания |
| DELETE | `/api/admin/tasks/:id` | Удаление задания |
| GET/POST | `/api/admin/homework` | Список (фильтр `?studentId=`) / выдача домашки |
| DELETE | `/api/admin/homework/:id` | Удаление домашки |
| GET | `/api/admin/stats` | Сводная статистика по всем ученикам |
| GET | `/api/admin/stats/:studentId` | Детальная статистика ученика (по темам) |

Задания практики и домашка ученика читаются из БД, попытки пишутся в `attempts` —
поэтому задания и ДЗ, созданные в админке, сразу видны демо‑ученику, а статистика
реальна. Опыт, монеты, уровни, стрики, питомец, покупки и trial также хранятся в Postgres.

## Стек

- **Frontend:** React 19, Vite, небольшой встроенный SPA-роутер, framer-motion,
  lucide-react. Токены дизайна — OKLCH, системные шрифты.
- **Backend:** Express 5, Helmet, rate limiting, CORS, dotenv, `pg` (Postgres/Supabase).
- **Инфраструктура:** Render (backend), Vercel (frontend), Supabase (Postgres).
