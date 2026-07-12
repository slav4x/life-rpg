# Changelog

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/),
проект придерживается [Semantic Versioning](https://semver.org/lang/ru/).

## [Unreleased]

### Added

- PostgreSQL + Drizzle ORM: клиент, схема `users`/`sessions`, первая миграция, репозитории.
- Серверная проверка Telegram `initData` (HMAC-SHA256) с контролем свежести `auth_date`.
- Allowlist Telegram ID и запрет входа для посторонних (`403`).
- HTTP-only сессии (хранится только hash токена) и `POST /api/auth/logout`.
- Роут `POST /api/auth/telegram`: вход, установка cookie, Zod-валидация тела, проверка `Origin`.
- Клиентский вход через Telegram WebApp SDK на экране «Сегодня».
- Dev-обход авторизации (`DEV_AUTH_BYPASS`) для запуска в браузере без Telegram; активен только вне production.
- Тестовые фикстуры подписи `initData`; unit- и integration-тесты авторизации.
- Скрипты Drizzle: `db:generate`, `db:migrate`, `db:push`, `db:studio`.
- Каркас Next.js 16 (App Router) на TypeScript в strict-режиме.
- Tailwind CSS v4 и shadcn/ui (Radix, neutral-палитра) с Lucide-иконками.
- Корневой layout с настройкой viewport и safe-area под Telegram, светлая/тёмная темы.
- Оболочка Mini App `(mini-app)` и стартовый экран-заглушка.
- Healthcheck `GET /api/health`.
- Типизированная проверка окружения через Zod (`src/lib/env.ts`).
- Тулчейн тестов: Vitest + Testing Library (unit/integration) и Playwright (e2e) с базовыми тестами.
- ESLint и проверка типов; скрипты `lint`, `typecheck`, `test`, `test:e2e`.
- Docker (multi-stage, standalone, non-root, HEALTHCHECK), Docker Compose (app/postgres/caddy), Caddyfile.
- `.env.example` и документация: README, CHANGELOG, TASKS.
