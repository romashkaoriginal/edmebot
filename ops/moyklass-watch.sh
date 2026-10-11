#!/bin/bash
# Daily Moyklass field check; alerts the admin in Telegram only on failure.
set -uo pipefail
cd /opt/edmebot
exec 9>/var/lock/edmebot-moyklass-watch.lock
flock -n 9 || exit 0
out=$(docker compose run --rm --no-deps -T backend npm run moyklass:check 2>&1)
code=$?
[[ $code -eq 0 ]] && exit 0
token=$(grep '^TELEGRAM_BOT_TOKEN=' back/.env.production | cut -d= -f2-)
chat=$(grep '^SEED_ADMIN_TG_ID=' back/.env.production | cut -d= -f2-)
text="⚠️ Moyklass: проверка полей упала (exit $code)
$(echo "$out" | tail -8)"
curl --silent --show-error --max-time 20 "https://api.telegram.org/bot${token}/sendMessage" \
  --data-urlencode "chat_id=${chat}" --data-urlencode "text=${text}" >/dev/null
exit $code
