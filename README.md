# Life RPG

Персональный Telegram Mini App, который превращает реальные действия в систему
развития: задачи, опыт, уровни, навыки, характеристики, квесты и достижения.
Полная продуктовая и техническая спецификация — в [`SPEC.md`](./SPEC.md).

> Статус: **MVP готов** (Этап 6 — production readiness завершён). Реализован весь
> игровой цикл, статистика и профиль; добавлены security headers, отдельный шаг
> миграций, бэкап PostgreSQL с проверенным восстановлением и E2E-тесты.

## Стек

- **Next.js 16** (App Router) + **React 19**, TypeScript в strict-режиме
- **Tailwind CSS v4** + **shadcn/ui** (Radix, neutral-палитра), **Lucide** иконки
- **Zod** — типизированная проверка окружения и валидация
- **Vitest** + Testing Library (unit/integration), **Playwright** (e2e)
- **PostgreSQL** + **Drizzle ORM** (`postgres` драйвер, `drizzle-kit` миграции)
- **Docker Compose** + **Caddy** для self-hosted деплоя

## Требования

- Node.js `>=20.19` (рекомендуется 22.13+ или 24 LTS; в Docker используется `node:24-alpine`)
- npm 10+
- Docker / Docker Compose — для контейнерного запуска

## Локальный запуск

```bash
npm install
cp .env.example .env      # заполнить значения

# PostgreSQL (пример через Docker):
docker run -d --name life-rpg-db -p 5432:5432 \
  -e POSTGRES_USER=life_user -e POSTGRES_PASSWORD=change-me -e POSTGRES_DB=life_rpg \
  postgres:17-alpine
# в .env: DATABASE_URL=postgresql://life_user:change-me@localhost:5432/life_rpg

npm run db:migrate        # применить миграции
npm run dev               # http://localhost:3000
```

Healthcheck: [`http://localhost:3000/api/health`](http://localhost:3000/api/health).

Для рантайма нужен `DATABASE_URL`. Реальный вход через Telegram требует
`TELEGRAM_BOT_TOKEN` и `ALLOWED_TELEGRAM_USER_IDS`.

### Разработка без Telegram

Чтобы открыть приложение в обычном браузере без бота, включите dev-обход в `.env`:

```env
DEV_AUTH_BYPASS=1
DEV_FIRST_NAME=Slava   # необязательно
DEV_TELEGRAM_ID=424242 # необязательно
```

Затем `npm run dev` и откройте http://localhost:3000 — приложение автоматически
войдёт под мок-пользователем (создаётся реальная строка в БД и сессия). Обход
работает **только** в development (`npm run dev`) и полностью игнорируется в
production-сборке, поэтому в прод протечь не может. Telegram-бот для этого не нужен,
но PostgreSQL — нужен.

## Скрипты

| Команда             | Назначение                              |
| ------------------- | --------------------------------------- |
| `npm run dev`       | Дев-сервер                              |
| `npm run build`     | Production-сборка (standalone)          |
| `npm run start`     | Запуск production-сборки                |
| `npm run lint`      | ESLint                                  |
| `npm run typecheck` | Проверка типов (`tsc --noEmit`)         |
| `npm run test`      | Unit/integration тесты (Vitest)         |
| `npm run test:e2e`  | E2E тесты (Playwright)                   |
| `npm run db:generate` | Сгенерировать миграцию из схемы       |
| `npm run db:migrate`  | Применить миграции                     |
| `npm run db:studio`   | Drizzle Studio                         |

Перед первым запуском Playwright установите браузеры: `npx playwright install`.

Интеграционные тесты авторизации запускаются только при заданном `TEST_DATABASE_URL`
(указывающем на **отдельную** тестовую базу — таблицы очищаются через `truncate`):

```bash
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/life_rpg_test npm run test
```

## Запуск в Docker

```bash
cp .env.example .env      # заполнить значения, задать APP_DOMAIN
docker compose build
docker compose up -d
```

Сервисы: `app` (Next.js standalone), `postgres` (17-alpine, наружу не
публикуется), `caddy` (reverse proxy, HTTPS) и одноразовый `migrate` (применяет
миграции до старта `app`, чтобы инстансы не мигрировали конкурентно). Порт
приложения проксируется через Caddy; PostgreSQL доступен только внутри сети compose.

Проверить работоспособность контейнера напрямую:

```bash
docker build -t life-rpg .
docker run --rm -p 3000:3000 -e SKIP_ENV_VALIDATION=1 life-rpg
curl http://localhost:3000/api/health
```

### Порядок деплоя (SPEC §16)

1. Получить код на сервере, создать production `.env` (задать `APP_DOMAIN`, секреты).
2. `docker compose build`.
3. `docker compose up -d postgres` — поднять базу.
4. `docker compose up -d` — сервис `migrate` применит миграции, затем поднимутся `app` и `caddy`.
5. Проверить `/api/health` и вход из реального Telegram-клиента.
6. Указать HTTPS URL Mini App в BotFather.

### Бэкап и восстановление (SPEC §17)

`scripts/backup.sh` делает `pg_dump -Fc` с ротацией 7 дневных / 4 недельных / 6 месячных
копий; запускать systemd timer'ом или cron на хосте (минимум одна копия — off-site).
`scripts/restore.sh <dump> [target-db]` восстанавливает дамп; для тестового восстановления
указывайте **отдельную** целевую БД. Безопасность: `sessions` в экспорт не попадают,
security headers добавляются в `next.config.ts` (framing не ограничивается ради Telegram).

## Конфигурация окружения

Все переменные описаны в [`.env.example`](./.env.example) и валидируются через
[`src/lib/env.ts`](./src/lib/env.ts). Секреты в репозитории не хранятся;
production `.env` живёт только на сервере с ограниченными правами.

Для сборки без секретов (например, в CI/Docker) используется
`SKIP_ENV_VALIDATION=1`.

## Структура

```text
src/
├── app/
│   ├── (mini-app)/        # экраны Mini App (Сегодня, Квесты, Навыки, ...)
│   ├── api/
│   │   ├── auth/          # POST /api/auth/telegram, /api/auth/logout
│   │   └── health/        # healthcheck
│   ├── layout.tsx         # корневой layout, viewport, темы, Telegram SDK
│   └── globals.css        # Tailwind + токены темы shadcn
├── components/            # ui/ (shadcn), auth/, today/ (экран «Сегодня»)
├── lib/                   # env, auth, telegram, validation, http, dates
├── application/           # auth, tasks, skills, game (today, bootstrap)
├── domain/game/           # calculate-level, calculate-xp, constants
└── db/                    # client, schema, migrations, repositories
tests/{unit,integration,e2e}/  # + fixtures/
```

Границы: `UI/routes → application → domain → repositories → Drizzle/PostgreSQL`.
Правила XP/уровней/серий не пишем в React или Route Handlers. Полная целевая
структура — в `SPEC.md` §14 и §8.3.

## Авторизация

`POST /api/auth/telegram` принимает `{ initData }`, проверяет HMAC-подпись bot-token'ом,
свежесть `auth_date`, сверяет Telegram ID с `ALLOWED_TELEGRAM_USER_IDS`, upsert'ит
пользователя и открывает серверную сессию (в БД хранится только SHA-256 hash токена),
устанавливая HttpOnly-cookie. `POST /api/auth/logout` ревокует сессию и чистит cookie.
Посторонний Telegram ID получает `403`, поддельный `initData` — `401`.

## Игровой цикл (Этап 2)

Реальное действие → задача → выполнение → XP. При завершении задачи сервер в одной
транзакции считает `finalXp = round(baseXp × множитель_сложности)` и пишет три записи
в журнал `xp_transactions`: 100% в общий уровень, 100% в навык, 25% в характеристику
навыка. Кэши `user_skills` / `user_attributes` обновляются там же; общий уровень
считается из журнала по формуле `100 × level²` ([`domain/game`](./src/domain/game)).

- `POST /api/tasks` — создать разовое действие.
- `POST /api/tasks/:id/complete` — завершить (идемпотентно по `Idempotency-Key`).
- `POST /api/tasks/:id/revert` — отменить выполнение (компенсирующие транзакции).
- `GET`/`POST /api/skills` — список и создание навыков.
- `GET`/`POST /api/task-templates`, `PATCH`/`DELETE /api/task-templates/:id` — шаблоны.

Экран «Сегодня» показывает уровень с прогрессом, XP за день, список задач и результат
начисления (toast). XP с клиента не принимается — считается только на сервере.

### Повторения и серии (Этап 3)

Повторяющиеся действия хранятся как шаблоны (`ежедневно` или выбранные дни недели). Задачи
на день **создаются лениво** при открытии «Сегодня» из активных шаблонов — без cron и без
дублей (партиальный уникальный индекс `+ on conflict do nothing`, безопасно при конкуренции).
Серия считается по фактическим выполнениям шаблона и переживает отмену; просроченные задачи
не переносятся. Отмена выполнения не удаляет историю — пишутся компенсирующие XP-транзакции.

### Квесты и достижения (Этап 4)

Квест — цель из шагов с XP-наградой за завершение. Шаги отмечаются чекбоксами; завершение
подтверждается диалогом и в одной транзакции начисляет награду в общий XP, повышает уровень
и синхронно проверяет достижения (SPEC §5.8). 8 стартовых достижений засеяны и разблокируются
один раз; новые показываются в toast после завершения задачи или квеста.

- `GET`/`POST /api/quests`, `GET`/`PATCH /api/quests/:id`, `POST /api/quests/:id/complete`.
- `POST /api/quest-steps/:id/toggle`, `GET /api/achievements`.

### Статистика и профиль (Этап 5)

Экран «Навыки» группирует навыки по характеристикам с уровнем и прогрессом; в деталях —
история XP и связанные действия, редактирование и архивирование. «Прогресс» показывает
статистику за 7/30 дней и всё время: график XP по дням (recharts), распределение по
характеристикам и последние начисления. «Профиль» — характеристики, достижения, темы
(`next-themes`), часовой пояс, управление шаблонами, выход и экспорт всех данных в JSON.

- `GET`/`PATCH`/`DELETE /api/skills/:id`, `GET`/`PATCH /api/profile`.
- `GET /api/progress?period=7d|30d|all`, `GET /api/xp-transactions`, `GET /api/export`.

## Дальше

Роадмап и прогресс по этапам — в [`TASKS.md`](./TASKS.md), post-MVP доработки —
в [`BACKLOG.md`](./BACKLOG.md), изменения — в [`CHANGELOG.md`](./CHANGELOG.md).
