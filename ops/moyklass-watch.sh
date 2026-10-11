#!/bin/bash
# Daily check of Moyklass fields and backend health; alerts the admin in Telegram only on failure.
set -uo pipefail
cd /opt/edmebot
exec 9>/var/lock/edmebot-moyklass-watch.lock
flock -n 9 || exit 0
problems=""
out=$(docker compose run --rm --no-deps -T backend npm run moyklass:check 2>&1)
code=$?
[[ $code -eq 0 ]] || problems+="Moyklass: проверка полей упала (exit $code)
$(echo "$out" | tail -8)
"
curl --fail --silent --max-time 15 https://www.edme.of.by/api/health | grep -q '"status":"ok"' \
  || problems+="Backend: /api/health не отвечает ok
"
[[ -z "$problems" ]] && exit 0
token=$(grep '^TELEGRAM_BOT_TOKEN=' back/.env.production | cut -d= -f2-)
chat=$(grep '^SEED_ADMIN_TG_ID=' back/.env.production | cut -d= -f2-)
curl --silent --show-error --max-time 20 "https://api.telegram.org/bot${token}/sendMessage" \
  --data-urlencode "chat_id=${chat}" --data-urlencode "text=⚠️ ${problems}" >/dev/null
exit 1
