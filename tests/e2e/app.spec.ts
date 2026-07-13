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
  await page.getByRole("button", { name: "Добавить действие" }).click();

  await expect(page.getByText("E2E пробежка")).toBeVisible();
});
