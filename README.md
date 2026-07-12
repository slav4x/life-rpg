# Life RPG

Персональный Telegram Mini App, который превращает реальные действия в систему
развития: задачи, опыт, уровни, навыки, характеристики, квесты и достижения.
Полная продуктовая и техническая спецификация — в [`SPEC.md`](./SPEC.md).

> Статус: **Этап 0 — фундамент проекта**. Реализован каркас приложения,
> тулчейн и инфраструктура. Игровая логика и Telegram-авторизация появятся на
> следующих этапах (см. [`TASKS.md`](./TASKS.md)).

## Стек

- **Next.js 16** (App Router) + **React 19**, TypeScript в strict-режиме
- **Tailwind CSS v4** + **shadcn/ui** (Radix, neutral-палитра), **Lucide** иконки
- **Zod** — типизированная проверка окружения и валидация
- **Vitest** + Testing Library (unit/integration), **Playwright** (e2e)
- **PostgreSQL** + Drizzle ORM (подключаются на Этапе 1)
- **Docker Compose** + **Caddy** для self-hosted деплоя

## Требования

- Node.js `>=20.19` (рекомендуется 22.13+ или 24 LTS; в Docker используется `node:24-alpine`)
- npm 10+
- Docker / Docker Compose — для контейнерного запуска

## Локальный запуск

```bash
npm install
cp .env.example .env      # заполнить значения
npm run dev               # http://localhost:3000
```

Healthcheck: [`http://localhost:3000/api/health`](http://localhost:3000/api/health).

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

Перед первым запуском Playwright установите браузеры: `npx playwright install`.

## Запуск в Docker

```bash
cp .env.example .env      # заполнить значения, задать APP_DOMAIN
docker compose build
docker compose up -d
```

Сервисы: `app` (Next.js standalone), `postgres` (17-alpine, наружу не
публикуется), `caddy` (reverse proxy, HTTPS). Порт приложения проксируется
через Caddy; PostgreSQL доступен только внутри сети compose.

Проверить работоспособность контейнера напрямую:

```bash
docker build -t life-rpg .
docker run --rm -p 3000:3000 -e SKIP_ENV_VALIDATION=1 life-rpg
curl http://localhost:3000/api/health
```

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
│   ├── api/health/        # healthcheck
│   ├── layout.tsx         # корневой layout, viewport, темы
│   └── globals.css        # Tailwind + токены темы shadcn
├── components/ui/         # компоненты shadcn/ui
├── lib/                   # env, утилиты (auth/telegram/dates — далее)
├── application/           # сервисы приложения (далее)
├── domain/game/           # доменные правила XP/уровней/серий (далее)
└── db/                    # схема, миграции, репозитории (далее)
tests/{unit,integration,e2e}/
```

Полная целевая структура и границы модулей — в `SPEC.md` §14 и §8.3.

## Дальше

Роадмап и прогресс по этапам — в [`TASKS.md`](./TASKS.md). Изменения — в
[`CHANGELOG.md`](./CHANGELOG.md).
