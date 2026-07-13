import { expect, test } from "@playwright/test";

// These flows rely on the development auth bypass (DEV_AUTH_BYPASS=1 in .env),
// which auto-authenticates a mock user in a plain browser. Run against a dev
// server with a database available: `npx playwright install && npm run test:e2e`.

test("logs in via dev bypass and shows the Today screen", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Привет/ })).toBeVisible({
    timeout: 15000,
  });
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
});

test("creates a one-off action", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Привет/ })).toBeVisible({
    timeout: 15000,
  });

  await page.getByRole("button", { name: "Добавить" }).click();
  await page.getByLabel("Название").fill("E2E пробежка");
  await page
    .getByRole("dialog", { name: "Новое действие" })
    .getByRole("button", { name: "Добавить", exact: true })
    .click();

  await expect(page.getByText("E2E пробежка")).toBeVisible();
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
  await page.getByRole("button", { name: "Вернуть в активные" }).click();
  await expect(page.getByRole("button", { name: "Изменить" })).toBeVisible();
});
