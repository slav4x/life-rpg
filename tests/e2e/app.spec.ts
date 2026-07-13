import { expect, test } from "@playwright/test";

// These flows rely on the development auth bypass (DEV_AUTH_BYPASS=1 in .env),
// which auto-authenticates a mock user in a plain browser. Run against a dev
// server with a database available: `npx playwright install && npm run test:e2e`.

test("logs in via dev bypass and shows the Today screen", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Привет/ })).toBeVisible({
    timeout: 15000,
  });

  const viewport = await page
    .locator('meta[name="viewport"]')
    .getAttribute("content");
  expect(viewport).not.toContain("user-scalable=no");
  expect(viewport).not.toContain("maximum-scale=1");

  const addButton = await page
    .getByRole("button", { name: "Добавить" })
    .boundingBox();
  expect(addButton?.width).toBeGreaterThanOrEqual(44);
  expect(addButton?.height).toBeGreaterThanOrEqual(44);
});

test("respects reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Привет/ })).toBeVisible({
    timeout: 15000,
  });

  const transitionDuration = await page
    .locator('[data-slot="progress-indicator"]')
    .first()
    .evaluate((element) => getComputedStyle(element).transitionDuration);
  expect(["0s", "0.00001s"]).toContain(transitionDuration);
});

test("bottom navigation reaches every screen", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Привет/ })).toBeVisible({
    timeout: 15000,
  });

  await page.getByRole("link", { name: "Квесты" }).click();
  await expect(page.getByRole("heading", { name: "Квесты" })).toBeVisible();

  await page.getByRole("link", { name: "Навыки" }).click();
  await expect(page.getByRole("heading", { name: "Навыки" })).toBeVisible();

  await page.getByRole("link", { name: "Прогресс" }).click();
  await expect(page.getByRole("heading", { name: "Прогресс" })).toBeVisible();

  await page.getByRole("link", { name: "Профиль" }).click();
  await expect(
    page.getByRole("heading", { name: "Характеристики" }),
  ).toBeVisible();
  await expect(page.getByText("Выполните первое действие")).toBeVisible();
});

test("keeps the selected date between sections", async ({ page }) => {
  const selectedDate = "2026-07-20";
  await page.goto(`/?date=${selectedDate}`);
  await expect(page.getByRole("heading", { name: "Планирование" })).toBeVisible({
    timeout: 15000,
  });
  await expect(page.getByLabel("Перейти к дате")).toHaveValue(selectedDate);

  await page.getByRole("link", { name: "Профиль" }).click();
  await expect(page).toHaveURL(new RegExp(`/profile\\?date=${selectedDate}$`));
  await page.getByRole("link", { name: "Сегодня" }).click();
  await expect(page).toHaveURL(new RegExp(`\\?date=${selectedDate}$`));
  await expect(page.getByLabel("Перейти к дате")).toHaveValue(selectedDate);
});

test("creates a one-off action", async ({ page }) => {
  const title = `E2E действие ${Date.now()}`;

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Привет/ })).toBeVisible({
    timeout: 15000,
  });

  await page.getByRole("button", { name: "Добавить" }).click();
  await page.getByLabel("Название").fill(title);
  await page
    .getByRole("dialog", { name: "Новое действие" })
    .getByRole("button", { name: "Добавить", exact: true })
    .click();

  const task = page.getByRole("listitem").filter({ hasText: title });
  await expect(task).toBeVisible();
  await task.getByRole("button", { name: "Готово" }).click();
  await task.getByRole("button", { name: "Отменить" }).click();
  await expect(
    page.getByText("Уже открытые достижения останутся полученными."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Назад" }).click();
  await page.getByRole("link", { name: "Прогресс" }).click();
  await expect(page.getByText(title)).toBeVisible();
  await expect(page.getByText(/^Действие ·/).first()).toBeVisible();
});

test("sets task priority and filters long lists", async ({ page }) => {
  const title = `E2E приоритет ${Date.now()}`;

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Привет/ })).toBeVisible({
    timeout: 15000,
  });
  await page.getByRole("button", { name: "Добавить" }).click();
  const dialog = page.getByRole("dialog", { name: "Новое действие" });
  await dialog.getByLabel("Название").fill(title);
  await dialog.getByLabel("Приоритет").click();
  await page.getByRole("option", { name: "Высокий" }).click();
  await dialog.getByRole("button", { name: "Добавить", exact: true }).click();
  await expect(
    page.getByRole("listitem").filter({ hasText: title }).getByText("Высокий"),
  ).toBeVisible();

  await page.getByRole("link", { name: "Навыки" }).click();
  await page.getByLabel("Поиск навыков").fill("нет-такого-навыка-e2e");
  await expect(page.getByText("По вашему запросу ничего не найдено.")).toBeVisible();

  await page.getByRole("link", { name: "Квесты" }).click();
  await page.getByLabel("Поиск квестов").fill("нет-такого-квеста-e2e");
  await expect(page.getByText("Нет активных квестов этого типа.")).toBeVisible();
});

test("creates and customizes a skill before earning XP", async ({ page }) => {
  const title = `E2E навык ${Date.now()}`;

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Привет/ })).toBeVisible({
    timeout: 15000,
  });
  await page.getByRole("link", { name: "Навыки" }).click();
  await page.getByRole("button", { name: "Навык" }).click();

  const createDialog = page.getByRole("dialog", { name: "Новый навык" });
  await createDialog.getByLabel("Название").fill(title);
  await createDialog.getByRole("button", { name: "Иконка 🧠" }).click();
  await createDialog.getByRole("button", { name: "Цвет 2" }).click();
  await createDialog.getByRole("button", { name: "Создать" }).click();

  await page.getByRole("link", { name: new RegExp(title) }).click();
  await page.getByRole("button", { name: "Изменить" }).click();
  const editDialog = page.getByRole("dialog", { name: "Изменить навык" });
  await editDialog.getByRole("combobox").click();
  await page.getByRole("option", { name: "Разум" }).click();
  await editDialog.getByRole("button", { name: "Сохранить" }).click();

  await expect(page.getByText("Разум", { exact: true })).toBeVisible();
});

test("restores an archived skill after resolving a name conflict", async ({ page }) => {
  const title = `E2E архив ${Date.now()}`;
  const restoredTitle = `${title} новый`;

  async function createSkill() {
    await page.getByRole("button", { name: "Навык" }).click();
    const dialog = page.getByRole("dialog", { name: "Новый навык" });
    await dialog.getByLabel("Название").fill(title);
    await dialog.getByRole("button", { name: "Создать" }).click();
  }

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Привет/ })).toBeVisible({
    timeout: 15000,
  });
  await page.getByRole("link", { name: "Навыки" }).click();
  await createSkill();

  await page.getByRole("link", { name: new RegExp(title) }).click();
  await page.getByRole("button", { name: "Архивировать" }).first().click();
  await page.getByRole("button", { name: "Архивировать" }).last().click();
  await expect(page.getByRole("heading", { name: "Навыки" })).toBeVisible();

  await createSkill();
  await page.locator("summary").filter({ hasText: "Архив" }).click();
  const archivedCard = page
    .locator("[data-archived-skill]")
    .filter({ hasText: title });
  await archivedCard.getByRole("button", { name: "Восстановить" }).click();
  await expect(
    archivedCard.getByText("Активный навык с таким названием уже существует."),
  ).toBeVisible();
  await archivedCard.getByLabel(`Новое название для ${title}`).fill(restoredTitle);
  await archivedCard
    .getByRole("button", { name: "Переименовать и восстановить" })
    .click();

  await expect(page.getByRole("link", { name: new RegExp(restoredTitle) })).toBeVisible();
});

test("restores an archived template after resolving a title conflict", async ({
  page,
}) => {
  const title = `E2E шаблон ${Date.now()}`;
  const restoredTitle = `${title} новый`;

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Привет/ })).toBeVisible({
    timeout: 15000,
  });
  await page.evaluate(async (templateTitle) => {
    const skillsResponse = await fetch("/api/skills");
    const skills = (await skillsResponse.json()) as { skills: Array<{ id: string }> };
    const skillId = skills.skills[0]?.id;
    if (!skillId) throw new Error("No active skill for E2E template");

    const body = {
      title: templateTitle,
      skillId,
      baseXp: 20,
      difficulty: "normal",
      recurrenceType: "daily",
      localDate: "2026-07-13",
    };
    const createdResponse = await fetch("/api/task-templates", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const created = (await createdResponse.json()) as { template: { id: string } };
    await fetch(`/api/task-templates/${created.template.id}`, { method: "DELETE" });
    await fetch("/api/task-templates", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, title: ` ${templateTitle.toUpperCase()} ` }),
    });
  }, title);

  await page.getByRole("link", { name: "Профиль" }).click();
  await page.locator("summary").filter({ hasText: "Архив" }).click();
  const archivedCard = page
    .locator("[data-archived-template]")
    .filter({ hasText: title });
  await archivedCard.getByRole("button", { name: "Восстановить" }).click();
  await expect(
    archivedCard.getByText("Неархивный шаблон с таким названием уже существует."),
  ).toBeVisible();
  await archivedCard
    .getByLabel(`Новое название шаблона ${title}`)
    .fill(restoredTitle);
  await archivedCard
    .getByRole("button", { name: "Переименовать и восстановить" })
    .click();

  await expect(page.getByText(restoredTitle, { exact: true })).toBeVisible();
});

test("imports a content pack and reports conflicts", async ({ page }) => {
  const suffix = Date.now();
  const skillName = `E2E контент ${suffix}`;
  const taskTitle = `E2E задача ${suffix}`;
  const questTitle = `E2E цель ${suffix}`;
  const pack = {
    format: "life-rpg-content-pack",
    formatVersion: 2,
    name: `E2E пак ${suffix}`,
    skills: [
      {
        key: `content-${suffix}`,
        name: skillName,
        attributeCode: "discipline",
        icon: "⚡",
        color: "#F59E0B",
      },
    ],
    tasks: [
      {
        title: taskTitle,
        skillKey: `content-${suffix}`,
        baseXp: 20,
        difficulty: "normal",
        estimatedMinutes: 15,
        scheduledInDays: 0,
      },
    ],
    taskTemplates: [
      {
        title: `E2E повторение ${suffix}`,
        skillKey: `content-${suffix}`,
        baseXp: 20,
        difficulty: "normal",
        recurrenceType: "daily",
        startsInDays: 0,
        endsInDays: 30,
      },
    ],
    quests: [
      {
        title: questTitle,
        type: "side",
        attributeCode: "discipline",
        rewardXp: 100,
        dueInDays: 14,
        steps: [{ title: "Сделать первый шаг" }],
      },
    ],
  };

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Привет/ })).toBeVisible({
    timeout: 15000,
  });
  await page.getByRole("link", { name: "Профиль" }).click();
  await expect(page.getByRole("heading", { name: "Характеристики" })).toBeVisible({
    timeout: 15000,
  });
  await page.locator("#content-pack-import").setInputFiles({
    name: "content-pack.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(pack)),
  });
  const preview = page.locator("[data-content-pack-preview]");
  await expect(preview.getByText(new RegExp(`v${pack.formatVersion}`))).toBeVisible();
  await preview.getByLabel("Квесты").click();
  await preview.getByRole("button", { name: "Подтвердить импорт" }).click();
  await expect(page.getByText("Данные импортированы")).toBeVisible();

  await page.getByRole("link", { name: "Сегодня" }).click();
  await expect(page.getByText(taskTitle)).toBeVisible();
  await page.getByRole("link", { name: "Навыки" }).click();
  await expect(page.getByRole("heading", { name: "Навыки" })).toBeVisible();
  await expect(page.getByText(skillName, { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Профиль" }).click();
  await page.locator("#content-pack-import").setInputFiles({
    name: "content-pack-conflict.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        ...pack,
        skills: [{ ...pack.skills[0], attributeCode: "body" }],
      }),
    ),
  });
  const conflictPreview = page.locator("[data-content-pack-preview]");
  await expect(conflictPreview.getByText("Импорт нельзя подтвердить:")).toBeVisible();
  await expect(
    conflictPreview.getByRole("button", { name: "Подтвердить импорт" }),
  ).toBeDisabled();
});

test("creates, edits, archives and links a quest step to a task", async ({ page }) => {
  const title = `E2E квест ${Date.now()}`;

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Привет/ })).toBeVisible({
    timeout: 15000,
  });
  await page.getByRole("link", { name: "Квесты" }).click();
  await page.getByRole("button", { name: "Квест" }).click();
  await page.getByLabel("Название").fill(title);
  await page.getByPlaceholder("Название шага").fill("Подготовить результат");
  await page.getByRole("button", { name: "Создать квест" }).click();

  await page.getByRole("link", { name: new RegExp(title) }).click();
  await page.getByRole("button", { name: "Изменить" }).click();
  await page.getByLabel("Дедлайн").fill("2026-08-01");
  await page
    .getByPlaceholder("Описание шага (необязательно)")
    .fill("Проверяем редактирование шага");
  await page.getByRole("button", { name: "Сохранить" }).click();

  await expect(page.getByText("Дедлайн: 01.08.2026")).toBeVisible();
  await expect(
    page
      .getByRole("listitem")
      .filter({ hasText: "Подготовить результат" })
      .getByText("Проверяем редактирование шага"),
  ).toBeVisible();

  await page.getByRole("button", { name: "Добавить в задачи" }).click();
  await page.getByRole("button", { name: "Добавить" }).click();
  await expect(page.getByText(/Задача на .* · в работе/)).toBeVisible();

  await page.getByRole("button", { name: "Архивировать" }).first().click();
  await page.getByRole("button", { name: "Архивировать" }).last().click();
  await expect(page.getByText("Квест находится в архиве.")).toBeVisible();

  await page.getByRole("button", { name: "Квесты" }).click();
  await page.getByRole("tab", { name: "Архив" }).click();
  await expect(page).toHaveURL(/\/quests\?tab=archived$/);
  await page.getByRole("link", { name: new RegExp(title) }).click();
  await page.getByRole("button", { name: "Квесты" }).click();
  await expect(page.getByRole("tab", { name: "Архив" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.getByRole("link", { name: new RegExp(title) }).click();
  await page.getByRole("button", { name: "Вернуть в активные" }).click();
  await expect(page.getByRole("button", { name: "Изменить" })).toBeVisible();
});

test("saves, filters and activates an overdue quest draft", async ({ page }) => {
  const title = `E2E черновик ${Date.now()}`;

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Привет/ })).toBeVisible({
    timeout: 15000,
  });
  await page.getByRole("link", { name: "Квесты" }).click();
  await page.getByRole("button", { name: "Квест" }).click();
  await page.getByLabel("Название").fill(title);
  await page.getByPlaceholder("Название шага").fill("Запустить черновик");
  await page.getByLabel("Дедлайн").fill("2020-01-01");
  await page.getByRole("button", { name: "В черновики" }).click();

  const card = page.getByRole("link", { name: new RegExp(title) });
  await expect(card.getByText("Черновик", { exact: true })).toBeVisible();
  await card.click();
  await page.getByRole("button", { name: "Активировать" }).click();
  await expect(page.getByText("Просрочен · дедлайн: 01.01.2020")).toBeVisible();
  await expect(
    page.getByText("Просроченный квест остаётся доступным для завершения."),
  ).toBeVisible();

  await page.getByRole("button", { name: "Квесты" }).click();
  await page.getByLabel("Тип").click();
  await page.getByRole("option", { name: "Основной" }).click();
  await page.getByRole("tab", { name: "Завершённые" }).click();
  await expect(page).toHaveURL(/\/quests\?tab=completed&type=main$/);
});

test("offers the full IANA timezone list and rolls theme back on API failure", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Привет/ })).toBeVisible({
    timeout: 15000,
  });
  await page.getByRole("link", { name: "Профиль" }).click();

  await expect(page.getByLabel("IANA timezone")).toBeVisible();
  expect(await page.locator("#iana-timezones option").count()).toBeGreaterThan(100);

  const wasDark = await page
    .locator("html")
    .evaluate((element) => element.classList.contains("dark"));
  await page.route("**/api/profile", async (route) => {
    if (route.request().method() === "PATCH") {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "internal_error" }),
      });
      return;
    }
    await route.continue();
  });

  await page
    .getByRole("button", { name: wasDark ? "Светлая" : "Тёмная" })
    .click();
  await expect(
    page.getByText("Сервер не смог выполнить операцию. Повторите позже."),
  ).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator("html")
        .evaluate((element) => element.classList.contains("dark")),
    )
    .toBe(wasDark);
});
