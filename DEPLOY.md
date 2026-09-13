# Деплой на Amvera

Проект состоит из двух сервисов на Amvera — фронтенд и бэкенд. Каждый деплоится
из своей подпапки (`front/`, `back/`) в свой remote отдельным `git subtree`.

## Remotes

```
amvera-front  https://git.waw0.amvera.ru/eduardsuroviy13/edmepetsfron
amvera-back   https://git.waw0.amvera.ru/eduardsuroviy13/edmepetsback
```

Проверить, что они настроены: `git remote -v`.

## Деплой фронтенда

```bash
git subtree split --prefix=front -b amvera-front-deploy --onto amvera-front-deploy
git push amvera-front amvera-front-deploy:master
```

## Деплой бэкенда

```bash
git subtree split --prefix=back -b amvera-back-deploy --onto amvera-back-deploy
git push amvera-back amvera-back-deploy:master
```

## Что происходит

- `git subtree split --prefix=<dir> -b <branch> --onto <branch>` берёт только
  историю коммитов, затрагивающих `<dir>`, и обновляет локальную
  служебную ветку `<branch>` этой историей (файлы лежат в корне ветки,
  без префикса `<dir>/`).
- `git push <remote> <branch>:master` заливает эту ветку в `master`
  удалённого репозитория Amvera. Amvera слушает `master` и сама запускает
  билд и редеплой при любом пуше в него (в выводе команды это видно как
  `Detected changes in master branch`).

## Важно

- Пуш **всегда уходит в прод** — Amvera редеплоит сразу после `git push`.
  Не пушить непроверенные/незакоммиченные локально правки.
- Служебные ветки `amvera-front-deploy` / `amvera-back-deploy` — это только
  техническая прослойка для subtree split, не рабочие ветки. Их не нужно
  создавать заново — команды выше их переиспользуют (`--onto`).
- Деплоить нужно раздельно: если менялся только `front/`, пушить только
  фронтенд; если только `back/` — только бэкенд.
