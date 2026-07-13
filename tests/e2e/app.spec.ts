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

test("imports a content pack and reports conflicts", async ({ page }) => {
  const suffix = Date.now();
  const skillName = `E2E контент ${suffix}`;
  const questTitle = `E2E цель ${suffix}`;
  const pack = {
    format: "life-rpg-content-pack",
    formatVersion: 1,
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
    taskTemplates: [
      {
        title: `E2E повторение ${suffix}`,
        skillKey: `content-${suffix}`,
        baseXp: 20,
        difficulty: "normal",
        recurrenceType: "daily",
      },
    ],
    quests: [
      {
        title: questTitle,
        type: "side",
        attributeCode: "discipline",
        rewardXp: 100,
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
  await expect(page.getByText("Данные импортированы")).toBeVisible();

  await page.getByRole("link", { name: "Навыки" }).click();
  await expect(page.getByText(skillName)).toBeVisible();
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
  await expect(page.getByText("Импорт остановлен")).toBeVisible();
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
