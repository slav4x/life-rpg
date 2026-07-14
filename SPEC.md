# Life RPG — спецификация Telegram Mini App

## 1. Назначение документа

Этот документ описывает первую версию персонального Telegram Mini App, который превращает реальные действия пользователя в понятную систему развития: задачи, опыт, уровни, навыки, характеристики, квесты и достижения.

Документ должен использоваться как:

- продуктовая спецификация;
- техническое задание;
- исходный контекст для AI-ассистента при разработке;
- чек-лист реализации MVP.

Рабочее название проекта: **Life RPG**.

## 2. Концепция продукта

Life RPG — личный интерфейс учёта прогресса, оформленный как минималистичная RPG. Пользователь сам открывает приложение, добавляет или выбирает реальные действия и отмечает их выполнение. Система начисляет опыт, развивает связанные навыки и характеристики, показывает прогресс и открывает достижения.

Приложение не должно выглядеть как компьютерная игра. Визуальный язык — спокойный, минималистичный интерфейс в стилистике `shadcn/ui`: нейтральный фон, типографика, тонкие границы, компактные карточки, один акцентный цвет и умеренные анимации.

### Основная ценность

Пользователь видит не только список выполненных дел, но и накопительный результат:

```text
реальное действие
→ выполнение
→ XP
→ развитие навыка
→ развитие характеристики
→ новый уровень
→ достижение или открытие
```

### Принципы продукта

1. **Сначала реальная польза, затем игровая оболочка.** Механики не должны стимулировать бессмысленный набор XP.
2. **Минимум ручного ввода.** Повторяющиеся действия создаются из шаблонов.
3. **Прозрачное начисление.** Пользователь всегда понимает, за что и сколько XP получено.
4. **Один источник истины.** История опыта хранится как неизменяемый журнал транзакций.
5. **Без наказания за жизнь.** Пропуск не отнимает ранее заработанный прогресс.
6. **Без искусственной сложности.** Карта мира, инвентарь, экономика, NPC и сложные синергии не входят в MVP.
7. **Личный режим.** Первая версия рассчитана на одного владельца, но модель данных не должна блокировать добавление других пользователей в будущем.

## 3. Границы первой версии

### В MVP входит

- запуск внутри Telegram как Mini App;
- безопасная авторизация через Telegram `initData`;
- ограничение доступа списком разрешённых Telegram ID;
- профиль персонажа;
- общий XP и уровень;
- фиксированный набор характеристик;
- пользовательские навыки и их уровни;
- задачи на сегодня;
- шаблоны повторяющихся задач;
- ручное добавление разового действия;
- завершение и отмена завершения задачи;
- квесты и шаги квестов;
- серии выполнения;
- журнал XP;
- базовые достижения;
- простой экран статистики;
- светлая и тёмная темы с учётом темы Telegram;
- адаптация под мобильный viewport и safe area Telegram;
- самостоятельный хостинг через Docker Compose и Caddy;
- резервное копирование PostgreSQL.

### В MVP не входит

- команды Telegram-бота;
- сообщения и напоминания от бота;
- webhook для обработки команд бота;
- cron-задачи;
- Redis;
- очереди и фоновые воркеры;
- совместные челленджи и рейтинги;
- социальные функции;
- внешняя регистрация и пароль;
- отдельная административная панель;
- AI-наставник;
- карта мира и локации;
- предметы и полноценный инвентарь;
- внутренняя валюта;
- сложные баффы, дебаффы и синергии;
- отдельный backend или микросервисы;
- Kubernetes;
- пользовательская загрузка файлов.

Telegram-бот нужен только для создания Mini App через BotFather и размещения кнопки **«Открыть приложение»**.

## 4. Пользовательский сценарий

Основной ежедневный сценарий:

1. Пользователь открывает бота в Telegram.
2. Нажимает кнопку открытия Mini App.
3. Приложение проверяет Telegram `initData` и создаёт серверную сессию.
4. При первом открытии за локальный день приложение создаёт задачи из активных шаблонов.
5. Пользователь видит задачи на сегодня и прогресс дня.
6. Нажимает на задачу, чтобы отметить выполнение.
7. Сервер в одной транзакции:
   - фиксирует выполнение;
   - рассчитывает XP;
   - создаёт XP-транзакции;
   - обновляет прогресс навыка и характеристики;
   - обновляет серию;
   - проверяет уровень и достижения.
8. Интерфейс показывает результат: полученный XP, изменившийся прогресс и новые открытия.

Дополнительный сценарий:

1. Пользователь нажимает **«Добавить действие»**.
2. Указывает название, категорию, навык, сложность, XP, дату и повторение.
3. Разовое действие добавляется на выбранную дату, повторяющееся — также сохраняется как шаблон.

## 5. Игровая модель

### 5.1 Общий уровень

Общий уровень отражает суммарный подтверждённый XP пользователя.

Для MVP используется простая возрастающая формула:

```ts
xpRequiredForLevel(level) = 100 * level ** 2;
```

Здесь результат функции — суммарный XP, необходимый для достижения указанного уровня.

Примеры:

| Уровень | Суммарный XP |
| ------: | -----------: |
|       1 |            0 |
|       2 |          400 |
|       3 |          900 |
|       5 |        2 500 |
|      10 |       10 000 |

Формулу хранить в доменном модуле, а не размазывать по интерфейсу и API. При изменении формулы текущий уровень должен вычисляться из журнала XP.

### 5.2 Характеристики

Характеристики — крупные и медленно развивающиеся направления жизни. В MVP набор фиксирован:

| Код          | Название   | Что отражает                                        |
| ------------ | ---------- | --------------------------------------------------- |
| `body`       | Тело       | здоровье, сила, выносливость, восстановление        |
| `mind`       | Разум      | обучение, мышление, профессиональные знания         |
| `resources`  | Ресурсы    | доход, накопления, продажи, управление деньгами     |
| `social`     | Социум     | отношения, общение, переговоры, лидерство           |
| `discipline` | Дисциплина | последовательность, фокус, выполнение обещаний себе |
| `creation`   | Созидание  | код, дизайн, тексты, фото, видео и проекты          |

Каждый навык относится к одной основной характеристике. При выполнении действия XP начисляется:

- в общий прогресс пользователя;
- в выбранный навык;
- в связанную характеристику.

Рекомендуемое распределение для MVP:

```text
100% XP → общий уровень
100% XP → выбранный навык
25% XP  → характеристика навыка
```

Коэффициент характеристики должен храниться в конфигурации домена.

### 5.3 Навыки

Навык — конкретная развиваемая область. Пользователь может создавать, архивировать,
восстанавливать и редактировать навыки. Восстановление сохраняет XP и историю.

Стартовые примеры:

| Характеристика | Навыки                                                |
| -------------- | ----------------------------------------------------- |
| Тело           | Силовые тренировки, Кардио, Сон, Питание, Мобильность |
| Разум          | Frontend, TypeScript, AI, Английский, Чтение          |
| Ресурсы        | Продажи, Переговоры, Финансы, Бизнес                  |
| Социум         | Общение, Эмпатия, Нетворкинг, Лидерство               |
| Дисциплина     | Фокус, Планирование, Режим                            |
| Созидание      | Код, Дизайн, Фото, Видео, Письмо                      |

Навык содержит:

- название;
- описание;
- характеристику;
- текущий подтверждённый XP;
- вычисляемый уровень;
- цвет или иконку из допустимого набора;
- статус `active` / `archived`.

### 5.4 Задачи и действия

Задача — конкретное действие, назначенное на дату.

Типы задач:

- разовая;
- созданная из повторяющегося шаблона;
- связанная с шагом квеста.

Поля задачи:

- название;
- необязательное описание;
- дата;
- связанный навык;
- сложность;
- базовый XP;
- статус;
- источник создания;
- необязательная оценка длительности;
- необязательная позиция `1..3` в фокусе назначенного дня.

Сложности:

| Сложность | Множитель | Типичный пример                           |
| --------- | --------: | ----------------------------------------- |
| Лёгкая    |     `0.8` | 10 минут чтения, короткая прогулка        |
| Обычная   |     `1.0` | рабочая задача, стандартная тренировка    |
| Сложная   |     `1.3` | неприятный разговор, трудный этап проекта |
| Эпическая |     `1.5` | крупный результат или редкое испытание    |

Рекомендуемые базовые значения XP:

```text
малое действие:      10–20 XP
обычное действие:    25–50 XP
сложное действие:    60–100 XP
шаг большого квеста: 100–250 XP
завершение квеста:   250–1000 XP
```

Пользователь может вручную изменить базовый XP, но интерфейс должен показывать рекомендуемый диапазон.

### 5.5 Расчёт XP

Формула первой версии:

```ts
finalXp = Math.round(baseXp * difficultyMultiplier);
```

В MVP серия не увеличивает XP. Это исключает экспоненциальный рост и наказание за потерю серии. Позднее бонусы можно добавить как отдельные прозрачные модификаторы с верхним пределом общего множителя `2.0`.

Каждое начисление создаёт отдельную запись в `xp_transactions`. Итоговые значения нельзя менять без записи компенсирующей транзакции.

### 5.6 Серии

Серия считается по выполнению конкретного шаблона задачи.

Алгоритм при завершении:

```text
последнее выполнение сегодня → серия не меняется
последнее выполнение вчера   → серия + 1
последнее выполнение раньше  → серия = 1
первое выполнение            → серия = 1
```

Расчёт ведётся по локальной дате пользователя, а timestamps хранятся в UTC.

Серия не требует cron. Актуальное значение проверяется при чтении и обновляется при выполнении.

### 5.7 Квесты

Квест — цель, состоящая из одного или нескольких измеримых шагов.

Типы:

- основной;
- побочный;
- долгосрочный.

Статусы:

```text
draft → active → completed
  │       │          │
  └───────┴──────────┴→ archived
```

Черновик создаётся отдельным действием и активируется после проверки. Квест любого рабочего
статуса можно архивировать. Архивированный завершённый квест восстанавливается в завершённые,
остальные — в активные. Архивирование не отменяет награду и не удаляет историю завершения.

Квест содержит:

- название и описание;
- тип;
- связанное направление;
- шаги с чекбоксами;
- награду XP за завершение;
- необязательный дедлайн;
- прогресс в процентах.

Завершение последнего обязательного шага не должно автоматически закрывать квест без подтверждения, если у квеста включено ручное завершение.

### 5.8 Достижения

В MVP достижения основаны только на объективных данных системы.

Примеры:

- выполнить первое действие;
- заработать 1 000 общего XP;
- достичь общего уровня 5;
- выполнить 10 задач;
- поддерживать серию 7 дней;
- завершить первый квест;
- достичь уровня 5 в одном навыке;
- развивать все шесть характеристик.

Достижение выдаётся один раз. Проверка выполняется синхронно после завершения действия или квеста.

### 5.9 Будущие механики

Не реализовывать в MVP, но сохранить как направления развития:

- главы жизни и боссы;
- титулы по направлениям;
- перки за достижения;
- временные эффекты;
- предметы как реальные инструменты;
- синергии полезных действий;
- AI-предложения квестов;
- импорт данных из Health, календарей и финансовых сервисов.

## 6. Экраны приложения

### 6.1 Общая навигация

Нижняя панель на пять разделов:

```text
Сегодня | Квесты | Навыки | Прогресс | Профиль
```

На небольших экранах учитывать `safeAreaInsetBottom`. Переходы должны сохранять выбранную дату и позицию списков там, где это ожидаемо.

### 6.2 Сегодня

Главный и стартовый экран.

Содержимое:

- приветствие и текущая дата;
- общий уровень и компактный progress bar до следующего уровня;
- количество XP за день;
- прогресс выполненных задач `3 / 5`;
- список задач, сгруппированный по статусу;
- XP и навык у каждой задачи;
- приоритет `высокий / обычный / низкий`, определяющий порядок задач дня;
- отдельный фокус дня до трёх pending-задач, не зависящий от приоритета;
- суммарная плановая длительность pending-задач и длительность фокуса;
- запоминаемый на клиенте переключатель показа завершённых задач;
- кнопка завершения;
- действие отмены последнего завершения;
- кнопка **«Добавить действие»**;
- обзор просроченных задач, сегодняшнего дня и ближайших семи дней;
- единый список просроченных с переносом на сегодня/выбранную дату, пропуском повторения,
  удалением разовой задачи и атомарными массовыми действиями до 100 записей;
- быстрый переход к произвольной календарной дате;
- свёрнутое по умолчанию планирование на сегодняшней дате без просроченных задач;
- пустое состояние, если задач нет.

После выполнения показывать небольшой результат в toast или bottom sheet:

```text
+40 XP
Навык «Чтение»: +40 XP
Разум: +10 XP
```

### 6.3 Добавление и редактирование действия

Открывается как `Drawer` или `Sheet`.

Поля:

- название;
- дата;
- навык;
- сложность;
- базовый XP;
- необязательная длительность в минутах;
- приоритет задачи и будущих задач повторения;
- повторение: нет / ежедневно / выбранные дни недели;
- для повторения: дата начала и необязательная дата окончания;
- необязательное описание.

При выборе повторения создаются шаблон и задача на текущую дату. При редактировании задачи из шаблона интерфейс должен спросить: изменить только эту задачу или будущие задачи шаблона.

### 6.4 Квесты

Содержимое:

- вкладки `Активные`, `Завершённые`, `Архив`;
- фильтр по типу;
- поиск и фильтр по характеристике;
- карточки с названием, типом, прогрессом и наградой;
- создание и редактирование квеста;
- экран деталей со списком шагов;
- подтверждение завершения.

Выбранные вкладка и фильтр хранятся в URL. Активные квесты с дедлайном сортируются от
ближайшего к дальнему, затем идут квесты без дедлайна и черновики. Просроченный активный квест
выделяется в списке и деталях, но его шаги и завершение остаются доступны.

### 6.5 Навыки

Содержимое:

- группировка по характеристикам;
- поиск и фильтр по характеристике;
- карточка или строка каждого навыка;
- уровень, текущий XP и прогресс до следующего уровня;
- создание, редактирование и архивирование навыка;
- блок архивных навыков с восстановлением;
- экран навыка с историей XP и связанными действиями.

### 6.6 Прогресс

Содержимое:

- суммарный XP за выбранный период;
- выполненные задачи;
- текущие и лучшие серии;
- изменение серии от состояния на начало недели, текущая и лучшая серия по каждому шаблону;
- сравнение текущей и предыдущей календарных недель по XP, выполненным и пропущенным задачам,
  завершённым квестам и активным сериям без оценочных формулировок;
- пропуски: прошедшие pending- и явно отменённые/пропущенные задачи;
- зависшие квесты: просроченные либо активные не менее 14 дней без прогресса обязательных шагов;
- повторения с минимум двумя пропусками и долей пропусков от 40% за последние 28 дней;
- действия разбора долгов, квестов и повторений прямо из обзора;
- фокус следующей недели и создание задачи, повторения или квеста из review;
- XP по дням в виде простого графика;
- распределение XP по характеристикам;
- последние XP-транзакции;
- фильтр: 7 дней / 30 дней / всё время.

Для MVP достаточно одного линейного или столбчатого графика. Остальные данные можно показать через progress bars и списки.

### 6.7 Профиль

Содержимое:

- имя и Telegram-аватар;
- общий уровень и суммарный XP;
- шесть характеристик;
- достижения;
- настройки темы;
- часовой пояс;
- управление шаблонами задач;
- поиск и фильтр шаблонов по навыку;
- архив шаблонов с расписанием, связанным навыком и восстановлением;
- экспорт данных в JSON;
- выход из серверной сессии.

Импорт контент-пака выполняется в два шага: read-only предпросмотр и отдельное подтверждение.
Предпросмотр показывает создаваемые, идентичные и конфликтующие записи по навыкам, разовым
задачам, повторениям и квестам. Пользователь может исключить разделы; сервер повторно проверяет
зависимости, поэтому задачу или повторение нельзя импортировать без доступного навыка.
Подтверждённые разделы записываются одной транзакцией. Формат v2 использует относительные
`scheduledInDays`, `startsInDays`, `endsInDays`, `dueInDays`; v1 остаётся совместимым.

## 7. Визуальный стиль

### Основа

- `shadcn/ui` как база компонентов;
- Tailwind CSS для оформления;
- Lucide React для иконок;
- системный или Geist-подобный sans-serif шрифт;
- neutral/slate palette;
- один настраиваемый акцентный цвет;
- радиус элементов `12–16px`;
- тонкие границы;
- минимальные тени;
- анимации `150–250ms` только для обратной связи.

### Правила

- не использовать игровые текстуры, неон, фэнтезийные рамки и крупные эмодзи;
- не превращать каждый блок в отдельную карточку;
- использовать плотную мобильную компоновку;
- критичные действия подтверждать через `AlertDialog`;
- формы открывать в `Drawer` на мобильном экране;
- использовать skeleton только там, где загрузка заметна;
- поддерживать `prefers-reduced-motion`;
- минимальный размер интерактивной области — `44 × 44px`.

### Основные компоненты shadcn/ui

```text
Button
Card
Progress
Tabs
Badge
Checkbox
Drawer
Sheet
Dialog
AlertDialog
DropdownMenu
Select
Input
Textarea
Calendar
Popover
Tooltip
Skeleton
Sonner
```

## 8. Техническая архитектура

### 8.1 Итоговый стек

| Слой          | Технология                                |
| ------------- | ----------------------------------------- |
| Framework     | Next.js, App Router                       |
| Язык          | TypeScript в strict-режиме                |
| UI            | React, shadcn/ui                          |
| Стили         | Tailwind CSS                              |
| Иконки        | Lucide React                              |
| Графики       | Recharts                                  |
| Формы         | React Hook Form                           |
| Валидация     | Zod                                       |
| ORM           | Drizzle ORM                               |
| База          | PostgreSQL                                |
| Тесты         | Vitest, React Testing Library, Playwright |
| Контейнеры    | Docker, Docker Compose                    |
| Reverse proxy | Caddy                                     |
| Хостинг       | собственный Ubuntu-сервер                 |

Для серверных данных в MVP использовать Server Components, Route Handlers и локальную ревалидацию Next.js. TanStack Query и Zustand не добавлять, пока не появится реальная потребность в сложном клиентском кэше или глобальном UI-состоянии.

### 8.2 Схема развёртывания

```text
Telegram
   ↓ HTTPS
Caddy
   ↓ reverse_proxy
Next.js monolith
├── Mini App UI
├── Route Handlers
├── Telegram auth
└── game domain
   ↓
PostgreSQL
```

В Docker Compose достаточно трёх сервисов:

```text
app
postgres
caddy
```

### 8.3 Границы модулей

```text
UI / routes
    ↓
application services
    ↓
domain/game
    ↓
repositories
    ↓
Drizzle / PostgreSQL
```

Правила XP, уровней, серий и достижений нельзя реализовывать непосредственно в React-компонентах или Route Handlers.

### 8.4 Серверное время

- все timestamps в PostgreSQL хранить как `timestamptz` в UTC;
- локальную дату пользователя вычислять по `users.timezone`;
- значение по умолчанию: `Asia/Novosibirsk`;
- ежедневные задачи уникальны по `user_id + local_date + template_id`;
- смена часового пояса не должна дублировать уже созданные задачи.

## 9. Telegram-интеграция и безопасность

### 9.1 Авторизация

Клиент передаёт на сервер необработанную строку:

```ts
window.Telegram.WebApp.initData;
```

Endpoint:

```text
POST /api/auth/telegram
```

Сервер обязан:

1. разобрать `initData`;
2. проверить HMAC-подпись с использованием bot token;
3. проверить свежесть `auth_date`;
4. получить Telegram user ID только из проверенных данных;
5. проверить ID по `ALLOWED_TELEGRAM_USER_IDS`;
6. создать или обновить пользователя;
7. создать случайный session token;
8. сохранить только hash токена;
9. установить cookie `HttpOnly`, `Secure`, `SameSite=Lax`.

Нельзя доверять:

- `initDataUnsafe`;
- Telegram ID из JSON, присланного клиентом;
- скрытой ссылке на приложение как механизму защиты.

### 9.2 Сессия

Сессии хранятся в PostgreSQL.

Рекомендуемый срок жизни: 30 дней. При использовании обновлять `last_used_at` не чаще одного раза в час, чтобы не создавать лишние записи.

### 9.3 Дополнительные меры

- проверять `Origin` для изменяющих запросов;
- использовать Zod для всех входных данных;
- все запросы фильтровать по `user_id` текущей сессии;
- не принимать от клиента итоговый XP;
- использовать idempotency key для операции завершения;
- ограничить размер текстовых полей;
- не выводить секреты и Telegram `initData` в логи;
- добавить security headers в Next.js или Caddy;
- не публиковать PostgreSQL наружу.

## 10. Модель данных

Все основные таблицы используют UUID. Для денежных значений в будущих версиях использовать integer в минимальных единицах, но финансовый учёт не входит в MVP.

### `users`

```text
id                    uuid primary key
telegram_id           bigint unique not null
telegram_username     text null
first_name            text not null
last_name             text null
photo_url              text null
timezone              text not null default 'Asia/Novosibirsk'
theme                 text not null default 'system'
created_at            timestamptz not null
updated_at            timestamptz not null
```

Допустимые темы: `light`, `dark`, `system`.

### `sessions`

```text
id                    uuid primary key
user_id               uuid references users(id) on delete cascade
token_hash            text unique not null
expires_at            timestamptz not null
last_used_at          timestamptz not null
created_at            timestamptz not null
```

### `attributes`

Справочник из шести системных характеристик.

```text
id                    uuid primary key
code                  text unique not null
name                  text not null
description           text null
sort_order            integer not null
```

### `user_attributes`

Кэшированный прогресс. Источником истины остаются XP-транзакции.

```text
user_id               uuid references users(id) on delete cascade
attribute_id          uuid references attributes(id) on delete cascade
xp                    integer not null default 0
updated_at            timestamptz not null
primary key (user_id, attribute_id)
```

### `skills`

```text
id                    uuid primary key
user_id               uuid references users(id) on delete cascade
attribute_id          uuid references attributes(id)
name                  text not null
description           text null
icon                  text null
color                 text null
status                text not null default 'active'
created_at            timestamptz not null
updated_at            timestamptz not null
archived_at           timestamptz null
```

Допустимые статусы: `active`, `archived`. Среди активных навыков одного
пользователя название уникально без учёта регистра и пробелов по краям. После
архивирования название можно использовать повторно.

### `user_skills`

Кэшированный прогресс навыка.

```text
user_id               uuid references users(id) on delete cascade
skill_id              uuid references skills(id) on delete cascade
xp                    integer not null default 0
updated_at            timestamptz not null
primary key (user_id, skill_id)
```

### `task_templates`

```text
id                    uuid primary key
user_id               uuid references users(id) on delete cascade
skill_id              uuid references skills(id)
title                 text not null
description           text null
base_xp               integer not null
difficulty            text not null
recurrence_type       text not null
weekdays              smallint[] null
estimated_minutes     integer null
starts_on             date not null
ends_on               date null
is_active             boolean not null default true
created_at            timestamptz not null
updated_at            timestamptz not null
archived_at           timestamptz null
```

Допустимые `recurrence_type`:

```text
daily
weekdays
```

`base_xp` ограничен диапазоном `5–250`, `difficulty` — значениями `easy`,
`normal`, `hard`, `epic`. Для `daily` поле `weekdays` должно быть `null`, для
`weekdays` — содержать от 1 до 7 ISO-дней из диапазона `1–7`. Название неархивного
шаблона уникально для пользователя без учёта регистра и пробелов по краям.
`estimated_minutes`, если задано, ограничено диапазоном `1–1440` и переносится
в каждую материализованную задачу. `ends_on` не может быть раньше `starts_on`;
шаблон материализуется только внутри этого диапазона включительно.

### `tasks`

```text
id                    uuid primary key
user_id               uuid references users(id) on delete cascade
template_id           uuid null references task_templates(id) on delete set null
quest_step_id         uuid null references quest_steps(id) on delete set null
skill_id              uuid references skills(id)
title                 text not null
description           text null
local_date            date not null
base_xp               integer not null
difficulty            text not null
priority              text not null default 'normal'
status                text not null default 'pending'
estimated_minutes     integer null
focus_position        integer null
created_at            timestamptz not null
updated_at            timestamptz not null
```

Статусы:

```text
pending
completed
cancelled
```

Для `base_xp`, `difficulty` и `estimated_minutes` действуют те же ограничения,
что в формах: `5–250`, `easy|normal|hard|epic`, `1–1440` минут.

Для задач из шаблонов нужен уникальный индекс:

```text
(user_id, local_date, template_id) where template_id is not null
```

Отмена задачи переводит её в `cancelled`, а не удаляет физически: запись нужна для истории
и недельного review. `focus_position` ограничена диапазоном `1–3` и уникальна для pending-задач
пользователя на одну локальную дату.

### `weekly_focuses`

```text
id                    uuid primary key
user_id               uuid references users(id) on delete cascade
week_start            date not null
focus                 text not null
created_at            timestamptz not null
updated_at            timestamptz not null
unique (user_id, week_start)
```

### `task_completions`

```text
id                    uuid primary key
user_id               uuid references users(id) on delete cascade
task_id               uuid references tasks(id) on delete cascade
idempotency_key       text not null
completed_at          timestamptz not null
local_date            date not null
final_xp              integer not null
reverted_at           timestamptz null
created_at            timestamptz not null
unique (user_id, task_id) where reverted_at is null
unique (user_id, idempotency_key)
```

### `quests`

```text
id                    uuid primary key
user_id               uuid references users(id) on delete cascade
attribute_id          uuid null references attributes(id)
title                 text not null
description           text null
type                  text not null
status                text not null default 'draft'
reward_xp             integer not null default 0
due_date              date null
manual_completion     boolean not null default true
completed_at          timestamptz null
created_at            timestamptz not null
updated_at            timestamptz not null
```

Допустимые типы квеста: `main`, `side`, `long_term`; статусы: `draft`, `active`,
`completed`, `archived`; награда ограничена диапазоном `0–10000 XP`.

### `quest_completions`

```text
id                    uuid primary key
user_id               uuid references users(id) on delete cascade
quest_id              uuid references quests(id) on delete cascade
reward_xp             integer not null
completed_at          timestamptz not null
reverted_at           timestamptz null
created_at            timestamptz not null
unique (user_id, quest_id) where reverted_at is null
```

Завершения квестов хранятся отдельно от текущего статуса квеста. Это позволяет
идемпотентно отменять завершение и повторно завершать тот же квест без удаления истории.

### `quest_steps`

```text
id                    uuid primary key
quest_id              uuid references quests(id) on delete cascade
title                 text not null
description           text null
is_required           boolean not null default true
sort_order            integer not null
completed_at          timestamptz null
created_at            timestamptz not null
updated_at            timestamptz not null
```

### `xp_transactions`

Главный журнал опыта.

```text
id                    uuid primary key
user_id               uuid references users(id) on delete cascade
amount                integer not null
scope                 text not null
source_type           text not null
source_id             uuid not null
attribute_id          uuid null references attributes(id)
skill_id              uuid null references skills(id)
base_xp               integer not null
multiplier            numeric(5,2) not null default 1
reversal_of_id        uuid null references xp_transactions(id)
metadata              jsonb not null default '{}'
created_at            timestamptz not null
```

`scope`:

```text
global
skill
attribute
```

`source_type`:

```text
task_completion
quest_completion
achievement
manual_adjustment
reversal
```

Идемпотентность начисления обеспечивается уникальным индексом по подходящей комбинации `user_id + scope + source_type + source_id`, кроме reversal и manual adjustment.

Инварианты перечисленных статусов, типов, сложности и XP дополнительно защищены
DB-level `CHECK`: кэшированный XP не может быть отрицательным, завершение задачи
имеет положительный `final_xp`, сумма транзакции не равна нулю, `base_xp >= 0`,
а множитель положительный. Компенсации остаются отрицательными транзакциями.

### `streaks`

```text
id                    uuid primary key
user_id               uuid references users(id) on delete cascade
template_id           uuid references task_templates(id) on delete cascade
current_count         integer not null default 0
best_count            integer not null default 0
last_completed_date   date null
updated_at            timestamptz not null
unique (user_id, template_id)
```

### `achievements`

Системный справочник.

```text
id                    uuid primary key
code                  text unique not null
name                  text not null
description           text not null
icon                  text null
rule_type             text not null
rule_config           jsonb not null
sort_order            integer not null
```

### `user_achievements`

```text
user_id               uuid references users(id) on delete cascade
achievement_id        uuid references achievements(id) on delete cascade
unlocked_at           timestamptz not null
source_id             uuid null
primary key (user_id, achievement_id)
```

## 11. Транзакционный сценарий завершения задачи

Операция `completeTask` должна выполняться в одной транзакции PostgreSQL:

1. Получить задачу с блокировкой строки.
2. Проверить принадлежность текущему пользователю.
3. Проверить статус и idempotency key.
4. Рассчитать `finalXp` только на сервере.
5. Создать `task_completion`.
6. Изменить статус задачи на `completed`.
7. Создать три XP-транзакции:
   - global;
   - skill;
   - attribute.
8. Обновить кэшированные `user_skills` и `user_attributes`.
9. Обновить серию, если задача создана из шаблона.
10. Проверить достижения.
11. Вернуть клиенту итог события.

Пример результата API:

```json
{
	"completionId": "uuid",
	"xp": {
		"global": 40,
		"skill": 40,
		"attribute": 10
	},
	"levelUp": null,
	"unlockedAchievements": [],
	"streak": {
		"current": 4,
		"best": 7
	}
}
```

Повторный запрос с тем же idempotency key должен вернуть прежний результат без повторного начисления.

### Отмена выполнения

Отмена не удаляет историю. Сервер:

1. помечает completion как отменённый;
2. возвращает задачу в `pending`;
3. создаёт отрицательные XP-транзакции со ссылками `reversal_of_id`;
4. пересчитывает серию этого шаблона по фактическим выполнениям;
5. пересчитывает кэшированные значения.

Полученные достижения в MVP можно оставить открытыми после отмены, но это поведение должно быть явно задокументировано в интерфейсе и тестах.

Эта же модель применяется к квестам: активное завершение помечается отменённым,
квест возвращается в `active`, а награда компенсируется отрицательной XP-транзакцией.
Шаги и уже открытые достижения сохраняются.

### Политика дат выполнения

Будущую задачу нельзя завершить заранее. Выполнение задним числом разрешено для
сегодняшней даты и семи предыдущих локальных календарных дней пользователя. XP,
история дня и серия учитывают исходную `local_date` задачи. Статистика дополнительно
ограничивается текущей локальной датой, чтобы старые некорректные записи из будущего
не попадали в итог периода.

## 12. Создание ежедневных задач без cron

При запросе экрана **«Сегодня»** сервер выполняет `ensureTasksForDate(userId, localDate)`.

Алгоритм:

1. Найти активные шаблоны пользователя.
2. Проверить `starts_on`/`ends_on` и применимость шаблона к указанному дню недели.
3. Вставить отсутствующие задачи через `insert ... on conflict do nothing`.
4. Вернуть актуальный список.

Операция должна быть безопасна при нескольких одновременных запросах.

При открытии «Сегодня» материализуются текущий и шесть следующих дней. При переходе
к более поздней будущей дате она материализуется отдельно. Прошлые дни ретроспективно
не создаются. Просроченные задачи не переносятся автоматически: они остаются привязаны
к исходной дате и доступны в обзоре.

## 13. API

Route Handlers должны быть тонкими: авторизация, валидация, вызов application service, формирование ответа.

Страница «Сегодня» получает данные на сервере и вызывает `ensureTasksForDate`/application
services напрямую, а интерактивный экран работает как Client Component. Отдельного
`GET /api/today` в текущей архитектуре нет.

```text
POST   /api/auth/telegram
POST   /api/auth/dev-login        # только development
POST   /api/auth/logout

GET    /api/health
GET    /api/ready

GET    /api/profile
PATCH  /api/profile

POST   /api/tasks
POST   /api/tasks/overdue         # перенос/пропуск просроченных задач
PATCH  /api/tasks/:id              # редактирование и включение/исключение из фокуса дня
DELETE /api/tasks/:id
POST   /api/tasks/:id/complete
POST   /api/tasks/:id/revert

GET    /api/task-templates
POST   /api/task-templates
PATCH  /api/task-templates/:id
DELETE /api/task-templates/:id

GET    /api/skills
POST   /api/skills
GET    /api/skills/:id
PATCH  /api/skills/:id
DELETE /api/skills/:id

GET    /api/quests
POST   /api/quests
GET    /api/quests/:id
PATCH  /api/quests/:id
POST   /api/quests/:id/complete
POST   /api/quests/:id/revert
POST   /api/quest-steps/:id/toggle

GET    /api/progress?period=7d|30d|all
PUT    /api/progress/weekly-focus
GET    /api/xp-transactions
GET    /api/achievements
GET    /api/export
POST   /api/import
```

`POST /api/tasks/overdue` принимает `reschedule` с новой локальной датой либо `dismiss`
со scope `this|future`. Операция блокирует выбранные строки и выполняется одной транзакцией.
Перенос экземпляра повторения отвязывает только его от шаблона: будущий график и серия не
переписываются. `future` доступен для пропуска повторения, ставит шаблон на паузу и отменяет
его pending-задачи начиная с выбранного экземпляра; completed/cancelled не меняются.

Удаление навыка или шаблона с историей должно быть логическим архивированием, а не физическим
удалением. Архивирование навыка архивирует его шаблоны. Восстановление навыка не активирует
их автоматически: каждый шаблон восстанавливается отдельно. Шаблон нельзя восстановить с
архивным навыком. Если нормализованное название уже занято, восстановление возможно только
после переименования; до успешной операции запись остаётся в архиве.

## 14. Структура проекта

```text
life-rpg/
├── src/
│   ├── app/
│   │   ├── (mini-app)/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   ├── quests/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── skills/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── progress/page.tsx
│   │   │   └── profile/page.tsx
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   ├── tasks/
│   │   │   ├── task-templates/
│   │   │   ├── skills/
│   │   │   ├── quests/
│   │   │   ├── progress/
│   │   │   └── export/
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/
│   │   ├── layout/
│   │   ├── tasks/
│   │   ├── quests/
│   │   ├── skills/
│   │   └── progress/
│   ├── application/
│   │   ├── tasks/
│   │   ├── quests/
│   │   ├── skills/
│   │   └── progress/
│   ├── domain/
│   │   └── game/
│   │       ├── calculate-level.ts
│   │       ├── calculate-xp.ts
│   │       ├── complete-task.ts
│   │       ├── revert-task.ts
│   │       ├── ensure-daily-tasks.ts
│   │       ├── update-streak.ts
│   │       ├── complete-quest.ts
│   │       ├── check-achievements.ts
│   │       ├── constants.ts
│   │       └── types.ts
│   ├── db/
│   │   ├── schema/
│   │   ├── migrations/
│   │   ├── repositories/
│   │   ├── seed.ts
│   │   └── client.ts
│   ├── lib/
│   │   ├── auth/
│   │   ├── telegram/
│   │   ├── validation/
│   │   ├── dates/
│   │   └── env.ts
│   └── middleware.ts
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── drizzle/
├── public/
├── scripts/
│   ├── backup.sh
│   └── restore.sh
├── Caddyfile
├── Dockerfile
├── docker-compose.yml
├── drizzle.config.ts
├── next.config.ts
├── package.json
├── .env.example
├── README.md
├── CHANGELOG.md
└── TASKS.md
```

## 15. Конфигурация окружения

Пример `.env.example`:

```env
NODE_ENV=production
APP_URL=https://life.example.com

DATABASE_URL=postgresql://life_user:change-me@postgres:5432/life_rpg
POSTGRES_DB=life_rpg
POSTGRES_USER=life_user
POSTGRES_PASSWORD=change-me

TELEGRAM_BOT_TOKEN=
ALLOWED_TELEGRAM_USER_IDS=123456789
TELEGRAM_AUTH_MAX_AGE_SECONDS=86400

SESSION_COOKIE_NAME=life_rpg_session
SESSION_TTL_DAYS=30

DEFAULT_TIMEZONE=Asia/Novosibirsk
```

Секреты не хранить в репозитории. Production `.env` должен находиться только на сервере с ограниченными правами доступа.

## 16. Docker и деплой

### Dockerfile

- multi-stage build;
- сборка Next.js в `output: 'standalone'`;
- запуск от непривилегированного пользователя;
- production image без dev-зависимостей;
- healthcheck endpoint `/api/health`.

### Docker Compose

Сервисы:

```yaml
services:
  app:
    build: .
    restart: unless-stopped
    env_file: .env
    depends_on:
      postgres:
        condition: service_healthy

  postgres:
    image: postgres:17-alpine
    restart: unless-stopped
    env_file: .env
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}']
      interval: 5s
      timeout: 5s
      retries: 10

  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - '80:80'
      - '443:443'
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - app

volumes:
  postgres_data:
  caddy_data:
  caddy_config:
```

### Caddyfile

```caddyfile
life.example.com {
    encode zstd gzip
    reverse_proxy app:3000
}
```

### Порядок деплоя

```text
1. Получить код на сервере.
2. Создать production .env.
3. Выполнить docker compose build.
4. Поднять PostgreSQL.
5. Применить Drizzle migrations отдельной одноразовой командой.
6. Поднять app и Caddy.
7. Проверить /api/health.
8. Указать HTTPS URL в настройках Mini App через BotFather.
9. Проверить вход из реального Telegram-клиента.
```

Миграции не должны запускаться конкурентно каждым экземпляром приложения при старте.

## 17. Резервное копирование

Хотя в приложении нет cron, инфраструктурный backup PostgreSQL обязателен. Его можно настроить системным timer/cron на сервере независимо от приложения.

Политика хранения:

```text
7 ежедневных копий
4 недельные копии
6 месячных копий
```

Минимум одна копия должна храниться вне основного сервера. Периодически выполнять тестовое восстановление в отдельную базу.

Пользовательский экспорт JSON не заменяет резервную копию PostgreSQL.

## 18. Тестирование

### Unit-тесты

Покрыть:

- формулу общего и навыкового уровня;
- множители сложности;
- округление XP;
- начисление XP характеристике;
- расчёт серии на границах дат;
- правила применимости шаблона по дням недели;
- условия достижений;
- локальную дату в часовом поясе пользователя.

### Интеграционные тесты

Покрыть с реальной тестовой PostgreSQL:

- завершение задачи одной транзакцией;
- повторный запрос с тем же idempotency key;
- конкурентное завершение одной задачи;
- отмену выполнения и компенсирующие транзакции;
- создание ежедневных задач без дублей;
- выдачу достижения только один раз;
- невозможность доступа к данным другого пользователя;
- архивирование навыка с историей.

### E2E-тесты

Основные сценарии Playwright:

1. Вход с валидным Telegram fixture.
2. Запрет входа для неизвестного Telegram ID.
3. Создание навыка.
4. Создание повторяющейся задачи.
5. Завершение задачи и отображение XP.
6. Отмена выполнения.
7. Создание и завершение квеста.
8. Просмотр статистики.

### Обязательные негативные сценарии

- подделанный `initData`;
- просроченный `auth_date`;
- повторное выполнение задачи;
- неверное значение XP с клиента;
- удалённый или архивный навык;
- невалидный часовой пояс;
- запрос к чужому объекту по UUID.

## 19. Нефункциональные требования

- первый полезный экран должен открываться без лишнего onboarding;
- интерфейс оптимизирован в первую очередь для Telegram на мобильном устройстве;
- отсутствие горизонтального скролла при ширине от 320 px;
- базовые операции должны отвечать менее чем за 500 ms при обычной нагрузке на одном сервере;
- все изменяющие операции должны иметь понятное состояние загрузки;
- ошибки не должны оставлять интерфейс в ложном состоянии завершённой задачи;
- приложение должно корректно переживать повторное открытие после потери сети;
- доменная логика должна быть независимо тестируемой;
- миграции должны быть обратимо спроектированы, даже если автоматический down migration не используется;
- логирование должно быть структурированным и не содержать секретов.

## 20. Roadmap реализации

Все этапы MVP завершены. Подробный актуальный статус, проверки и принятые
trade-off ведутся в `TASKS.md`; этот раздел остаётся кратким roadmap-снимком.

### Этап 0 — фундамент проекта

- [x] Инициализировать Next.js с TypeScript strict.
- [x] Подключить Tailwind CSS и shadcn/ui.
- [x] Настроить lint, typecheck, Vitest и Playwright.
- [x] Добавить Dockerfile, Docker Compose и Caddyfile.
- [x] Настроить `.env.example` и типизированную проверку окружения.
- [x] Создать `README.md`, `CHANGELOG.md` и `TASKS.md`.

**Результат:** приложение собирается локально и в Docker, healthcheck отвечает успешно.

### Этап 1 — база и Telegram auth

- [x] Подключить PostgreSQL и Drizzle.
- [x] Создать таблицы пользователей и сессий.
- [x] Реализовать проверку Telegram `initData`.
- [x] Добавить allowlist Telegram ID.
- [x] Реализовать HTTP-only сессию и logout.
- [x] Добавить auth fixture для тестов.

**Результат:** владелец входит из Telegram, посторонний пользователь получает `403`.

### Этап 2 — вертикальный игровой цикл

- [x] Добавить справочник характеристик.
- [x] Реализовать навыки.
- [x] Реализовать разовые задачи.
- [x] Реализовать завершение в транзакции.
- [x] Добавить XP-журнал и формулу уровней.
- [x] Собрать экран **«Сегодня»**.
- [x] Показать результат начисления XP.

**Результат:** пользователь создаёт действие, завершает его и видит изменение общего уровня, навыка и характеристики.

### Этап 3 — повторения и серии

- [x] Добавить шаблоны задач.
- [x] Реализовать ежедневное и недельное повторение.
- [x] Реализовать ленивое создание задач дня.
- [x] Реализовать серии.
- [x] Реализовать отмену выполнения.
- [x] Проверить конкурентные запросы и идемпотентность.

**Результат:** ежедневный список создаётся автоматически при открытии без cron и дублей.

### Этап 4 — квесты и достижения

- [x] Реализовать CRUD квестов.
- [x] Добавить шаги и прогресс.
- [x] Реализовать завершение и XP-награду.
- [x] Добавить стартовый набор достижений.
- [x] Показывать новые достижения после действия.

**Результат:** долгосрочная цель проходит путь от создания до завершения и награды.

### Этап 5 — статистика и профиль

- [x] Собрать экран навыков.
- [x] Добавить историю XP.
- [x] Реализовать статистику за 7/30 дней и всё время.
- [x] Добавить экран профиля и характеристик.
- [x] Добавить настройки темы и часового пояса.
- [x] Реализовать экспорт JSON.

**Результат:** пользователь видит накопительный прогресс и может выгрузить свои данные.

### Этап 6 — production readiness

- [x] Завершить unit, integration и E2E тесты.
- [x] Проверить mobile viewport и Telegram safe areas.
- [x] Добавить security headers.
- [x] Настроить production deploy.
- [x] Настроить внешний backup PostgreSQL.
- [x] Выполнить тестовое восстановление.
- [x] Проверить реальный запуск через BotFather.

**Результат:** стабильный персональный MVP работает на собственном сервере.

## 21. Критерии готовности MVP

MVP считается готовым, когда:

- владелец безопасно входит через Telegram;
- неизвестный Telegram ID не получает доступ;
- пользователь может создать навык;
- пользователь может создать разовую и повторяющуюся задачу;
- задачи дня создаются без cron и без дублей;
- задачу можно выполнить и отменить;
- повторный запрос не начисляет XP дважды;
- общий, навыковый и атрибутный XP рассчитываются на сервере;
- история XP объясняет текущее состояние прогресса;
- серии корректны на границах локальных дат;
- квест можно создать, пройти и завершить;
- достижение выдаётся только один раз;
- доступны экраны Сегодня, Квесты, Навыки, Прогресс и Профиль;
- интерфейс корректно работает внутри Telegram на мобильном устройстве;
- приложение разворачивается через Docker Compose за документированный набор шагов;
- PostgreSQL не доступен из интернета;
- backup создан и хотя бы один раз успешно восстановлен;
- lint, typecheck, unit, integration и основные E2E тесты проходят.

## 22. Порядок вайбкодинга

При передаче спецификации AI-ассистенту не просить реализовать весь проект одним запросом. Работать по этапам roadmap.

Для каждого этапа:

1. Сначала изучить текущую структуру и уже реализованные паттерны.
2. Обновить `TASKS.md` и отметить текущий этап.
3. Реализовать минимальный вертикальный срез.
4. Добавить миграции и тесты одновременно с поведением.
5. Выполнить lint, typecheck и релевантные тесты.
6. Обновить README при изменении запуска, конфигурации или архитектуры.
7. Обновить CHANGELOG для значимых пользовательских изменений.
8. Не добавлять следующий игровой слой, пока текущий цикл не проверен вручную.

Рекомендуемый первый промпт:

> Изучи `SPEC.md`. Реализуй только «Этап 0 — фундамент проекта». Следуй структуре и ограничениям спецификации. Не переходи к Telegram auth и игровой логике. Создай или обнови `TASKS.md`, проверь сборку, lint и typecheck. Не запускай установку npm-пакетов: перечисли необходимые пакеты и дай полную команду установки.

После завершения этапа использовать следующий промпт с тем же принципом: реализовать только один этап и не расширять scope.

## 23. Решения, которые нельзя менять без явной причины

- монолит Next.js вместо отдельного frontend/backend;
- PostgreSQL как основная база;
- Drizzle ORM;
- Docker Compose и Caddy на собственном сервере;
- серверная проверка Telegram `initData`;
- allowlist Telegram ID для личного режима;
- XP-журнал как источник истины;
- транзакционное и идемпотентное завершение задач;
- UTC для timestamps и локальный timezone для календарных дней;
- ленивое создание ежедневных задач без cron;
- отсутствие Redis, очередей и bot-команд в MVP;
- минималистичный интерфейс shadcn/ui без визуальной стилизации под видеоигру.
