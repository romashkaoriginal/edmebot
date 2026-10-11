#!/bin/bash
set -euo pipefail
release="${SSH_ORIGINAL_COMMAND:-${1:-}}"
[[ "$release" =~ ^[0-9a-f]{40}$ ]] || { echo "Expected a commit SHA"; exit 1; }
exec 9>/var/lock/edmebot-deploy.lock
flock -w 600 9
cd /opt/edmebot
[[ -z "$(git status --porcelain --untracked-files=no)" ]] || { echo "Tracked server files have local changes"; exit 1; }
git fetch origin main
# An older CI run must never deploy over a newer push.
[[ "$(git rev-parse origin/main)" == "$release" ]] || { echo "Superseded release; skipping"; exit 0; }
git merge --ff-only "$release"
install -m 700 ops/moyklass-watch.sh /usr/local/bin/edmebot-moyklass-watch
docker compose build backend
docker compose run --rm --no-deps backend npm run moyklass:check
docker compose up -d --build
for attempt in {1..30}; do
  if curl --fail --silent --show-error https://www.edme.of.by/api/health | grep -q '"status":"ok"'; then
    docker compose ps
    echo "Deployed $release"
    exit 0
  fi
  sleep 2
done
docker compose logs --tail=80 backend
exit 1
