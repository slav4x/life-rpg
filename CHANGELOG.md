# Changelog

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/),
проект придерживается [Semantic Versioning](https://semver.org/lang/ru/).

## [Unreleased]

### Added

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
