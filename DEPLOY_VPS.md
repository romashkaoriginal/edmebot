# Деплой edmebot на VPS (Edmepets)

## 1. Подключение к серверу

Сервер: `178.172.244.114`, hoster.by, Ubuntu 26.04, пользователь `root`.

Short-имя настроено в `~/.ssh/config`:

```
Host Edmepets
    HostName 178.172.244.114
    User root
    IdentityFile C:\Users\trank\.ssh\id_ed25519_edmepets
```

Подключение:

```bash
ssh Edmepets
```

Вход по паролю отключён (только по ключу). Если ключ утерян — доступ через
консоль в панели hoster.by (иконка "Консоль" рядом с сервером в списке
"Виртуальные серверы").

---

## 2. Структура на сервере

Проект лежит в `/opt/edmebot` — это git-клон
[github.com/romashkaoriginal/edmebot](https://github.com/romashkaoriginal/edmebot).

Сервисы подняты через Docker Compose (`docker-compose.yml` в корне):

| Сервис     | Контейнер            | Что делает                              |
|------------|-----------------------|------------------------------------------|
| `db`       | `edmebot-db-1`        | Postgres 16, свой SSL-сертификат          |
| `backend`  | `edmebot-backend-1`   | Node/Express на 3001 (наружу не торчит)   |
| `frontend` | `edmebot-frontend-1`  | nginx: отдаёт React-сборку, проксирует `/api` → backend, TLS-терминация |

Секреты **не в git**, лежат прямо на сервере:
- `/opt/edmebot/.env` — пароль Postgres для docker-compose
- `/opt/edmebot/back/.env.production` — токен бота, DATABASE_URL, APP_URL и т.д.

---

## 3. Обычный деплой (внести фикс и выкатить)

Стандартный цикл — правишь код локально, коммитишь, пушишь, подтягиваешь на
сервере и пересобираешь:

```bash
# локально
git add <файлы>
git commit -m "..."
git push origin main
```

```bash
# на сервере
ssh Edmepets
cd /opt/edmebot
git pull origin main
docker compose up -d --build
```

`docker compose up -d --build` пересобирает только те образы, чьи файлы
изменились (Docker кеширует слои), и перезапускает контейнеры с новым кодом.
Если правил только один сервис — можно пересобрать точечно:

```bash
docker compose up -d --build backend   # только backend
docker compose up -d --build frontend  # только frontend
```

---

## 4. Проверка после деплоя

```bash
# статус контейнеров
docker compose ps

# логи (последние 50 строк, добавь -f чтобы следить в реальном времени)
docker compose logs backend --tail=50
docker compose logs frontend --tail=50
docker compose logs db --tail=50
```

Снаружи:

```bash
curl -s https://www.edme.of.by/api/health
# должно вернуть {"status":"ok"}
```

Плюс — открой бота в Telegram и проверь Mini App вручную (сборка фронта
кешируется в Telegram WebView, иногда нужно закрыть/открыть чат заново).

---

## 5. Секреты — если нужно поменять токен/пароль

Секретные `.env`-файлы не синхронизируются через git. Правишь напрямую на
сервере или копируешь новую версию с локальной машины:

```bash
# с локальной машины
scp back/.env.production Edmepets:/opt/edmebot/back/.env.production
```

После смены — пересобрать/перезапустить backend, чтобы подхватил новые
переменные:

```bash
ssh Edmepets "cd /opt/edmebot && docker compose up -d backend"
```

---

## 6. База данных

Подключиться к Postgres внутри контейнера:

```bash
ssh Edmepets
docker exec -it edmebot-db-1 psql -U edmepets -d edmepets
```

Сделать бэкап (на сервере, потом скачать локально):

```bash
ssh Edmepets "docker exec edmebot-db-1 pg_dump -U edmepets edmepets" > backup.sql
```

Восстановить из бэкапа (осторожно — перезаписывает данные):

```bash
cat backup.sql | ssh Edmepets "docker exec -i edmebot-db-1 psql -U edmepets -d edmepets"
```

---

## 7. Полный передеплой с нуля (если что-то сломалось)

```bash
ssh Edmepets
cd /opt/edmebot
docker compose down          # остановить всё, БД (volume) не трогает
docker compose up -d --build # пересобрать и поднять заново
```

Если нужно снести и данные БД (например, схема сломалась и надо начать
начисто — **удаляет все данные**):

```bash
docker compose down -v
docker compose up -d --build
```

---

## 8. HTTPS / сертификат

Сертификат Let's Encrypt для `www.edme.of.by`, автопродление настроено через
systemd-таймер certbot (`certbot.timer`), ничего вручную делать не нужно.

Проверить срок действия:

```bash
ssh Edmepets "certbot certificates"
```

Принудительно обновить (обычно не требуется):

```bash
ssh Edmepets "certbot renew && docker compose -f /opt/edmebot/docker-compose.yml restart frontend"
```

---

## 9. Домен

- `www.edme.of.by` → `178.172.244.114` — рабочий, используется как APP_URL
- `edme.of.by` (без www) — пока не резолвится стабильно, не используется

Если понадобится добавить apex-домен в сертификат позже:

```bash
ssh Edmepets "certbot certonly --webroot -w /var/www/certbot -d www.edme.of.by -d edme.of.by --expand"
```

(и добавить `edme.of.by` обратно в `server_name` в `front/nginx.conf`, если
уберут `www`-редирект).
