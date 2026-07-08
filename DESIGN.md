# Design

## Overview

Игровой, но аккуратный интерфейс для школьников 5–11 классов. Идентичность построена на двух
брендовых цветах из логотипа EDme: **насыщенный королевский синий** и **тёплый оранжевый**.
Стратегия цвета — **Committed**: синий несёт основную структуру и действия, оранжевый —
энергию, награды и геймификацию. Поверхность светлая (чистый холодновато-белый), чтобы
цвет и питомец «пели», а текст оставался читаемым.

## Color

OKLCH throughout. Committed strategy: brand blue + brand orange do the identity work on a
near-pure surface.

### Light theme (default)

| Role | OKLCH | Use |
| --- | --- | --- |
| `--bg` | `oklch(0.985 0.004 250)` | App background, барели-tinted к синему |
| `--surface` | `oklch(1 0 0)` | Карточки, панели (чистый белый, приподнят над bg) |
| `--surface-2` | `oklch(0.965 0.006 250)` | Вложенные панели, поля ввода, hover-фон |
| `--ink` | `oklch(0.22 0.03 260)` | Основной текст (контраст к bg ~11:1) |
| `--muted` | `oklch(0.52 0.02 260)` | Вторичный текст (контраст ~4.6:1) |
| `--line` | `oklch(0.91 0.008 255)` | Границы, разделители |
| `--primary` | `oklch(0.50 0.19 262)` | Брендовый синий: кнопки, ссылки, выбор |
| `--primary-strong` | `oklch(0.43 0.19 263)` | Hover/active синего, крупный текст-акцент |
| `--primary-soft` | `oklch(0.94 0.03 258)` | Фон-заливка синего (badges, выделения) |
| `--accent` | `oklch(0.72 0.17 55)` | Брендовый оранжевый: XP, награды, стрик, CTA-энергия |
| `--accent-strong` | `oklch(0.64 0.17 48)` | Hover оранжевого, текст оранжевого на светлом |
| `--accent-soft` | `oklch(0.95 0.045 70)` | Фон-заливка оранжевого |

### Semantic (карта знаний + состояния)

| Role | OKLCH | Use |
| --- | --- | --- |
| `--success` | `oklch(0.62 0.15 150)` | Зелёный — сильные темы, верный ответ |
| `--success-soft` | `oklch(0.95 0.05 150)` | Фон success |
| `--warning` | `oklch(0.76 0.15 75)` | Жёлтый — нужно повторить |
| `--warning-soft` | `oklch(0.96 0.06 85)` | Фон warning |
| `--danger` | `oklch(0.58 0.20 25)` | Красный — слабые темы, неверный ответ |
| `--danger-soft` | `oklch(0.95 0.04 25)` | Фон danger |

Карта знаний НЕ полагается только на цвет: зелёный/жёлтый/красный всегда с иконкой + подписью.

Text-on-fill: белый текст на `--primary`, `--accent`, `--success`, `--danger` (насыщенные
mid-luminance по Helmholtz-Kohlrausch). Тёмный `--ink` на `--warning` и всех `-soft` заливках.

## Typography

Одна семья с двумя ролями через вес, плюс округлый дисплейный шрифт для игровых чисел/заголовков.

- **UI / body:** `Nunito` (гуманистический, дружелюбный, отличная кириллица) — 400/600/700/800.
- **Display / игровые числа (XP, уровень, стрик):** `Baloo 2` — округлый, «сочный», для крупных
  геймификационных акцентов. Контраст-ось: humanist sans + rounded display (не два похожих sans).
- Fallback: `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`.

Scale (fixed rem, product register — не fluid): 0.75 / 0.875 / 1 / 1.125 / 1.375 / 1.75 / 2.25 rem.
Ratio ~1.2. Display-числа могут крупнее (до ~3rem), letter-spacing display ≥ -0.02em.
Body line-length 60–70ch. `text-wrap: balance` на заголовках.

## Motion

- Кривые: `--ease-out: cubic-bezier(0.23,1,0.32,1)`, `--ease-in-out: cubic-bezier(0.77,0,0.175,1)`,
  `--ease-spring` для игровых наград (лёгкий bounce ТОЛЬКО на редких celebration-моментах: level-up,
  начисление XP, реакция питомца).
- Длительности: press-feedback 120ms, tooltip/popover 160ms, dropdown 200ms, modal/drawer 260ms.
- Кнопки: `scale(0.97)` на `:active`. Enter-анимации от `scale(0.95)+opacity`, не от `scale(0)`.
- Награды (XP-пилюля, level-up, конфетти) — celebration-класс, редкие → можно delight/spring.
- Обычные переходы состояний практики — быстрые, без хореографии.
- Полный `prefers-reduced-motion`: остаётся crossfade/opacity, убираются движение и bounce.

## Radii & Elevation

- Radii: `--r-sm: 8px`, `--r-md: 12px`, `--r-lg: 16px`, `--r-xl: 20px`, `--r-pill: 999px`.
  Карточки 12–16px (игровое, но не «insanely rounded»). Пилюли/бейджи/аватар питомца — pill.
- Тени определённые, ≤8px blur как основной уровень: `--shadow-sm`, `--shadow-md`, `--shadow-lg`.
  Не сочетать 1px border + широкая мягкая тень на одном элементе.

## Layout

- Desktop: левый сайдбар-навигация + контент. Mobile (основной кейс): нижний таб-бар + шапка
  со стриком/XP. Респонсив структурный (сайдбар → таб-бар по брейкпоинту, не fluid-типографика).
- z-index шкала: dropdown 100 → sticky 200 → drawer-backdrop 300 → drawer 310 → modal-backdrop 400
  → modal 410 → toast 500 → tooltip 600.
- Content max-width ~960–1100px; сетки без брейкпоинтов через `repeat(auto-fit, minmax(...,1fr))`.

## Components

Каждый интерактивный компонент имеет: default / hover / focus-visible / active / disabled /
loading / error. Skeleton вместо спиннеров в контенте. Пустые состояния обучают интерфейсу.
Единый словарь: одна форма кнопки, один стиль полей, один набор иконок (Lucide, outline).
