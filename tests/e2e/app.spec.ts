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
    .getByRole("button", { name: "Добавить", exact: true })
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
  await expect(page.locator("nav").getByRole("link")).toHaveCount(5);
  await page.getByRole("link", { name: /^Повторения/ }).click();
  await expect(page.getByRole("heading", { name: "Повторения" })).toBeVisible();
  await expect(page.locator("nav").getByRole("link")).toHaveCount(5);
  await expect(
    page.locator("nav").getByRole("link", { name: "Профиль" }).locator("span"),
  ).toHaveClass(/text-foreground/);
});

test("read API keeps its documented response contract", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Привет/ })).toBeVisible({
    timeout: 15000,
  });

  const responses = await page.evaluate(async () => {
    const endpoints = [
      "/api/profile",
      "/api/skills",
      "/api/quests",
      "/api/task-templates",
      "/api/progress?period=7d",
      "/api/xp-transactions?limit=5",
      "/api/achievements",
    ];
    return Promise.all(
      endpoints.map(async (endpoint) => {
        const response = await fetch(endpoint);
        return {
          endpoint,
          status: response.status,
          body: (await response.json()) as Record<string, unknown>,
        };
      }),
    );
  });

  for (const response of responses) {
    expect(response.status, response.endpoint).toBe(200);
  }
  expect(responses.find(({ endpoint }) => endpoint === "/api/profile")?.body)
    .toHaveProperty("user");
  expect(responses.find(({ endpoint }) => endpoint === "/api/skills")?.body)
    .toHaveProperty("skills");
  expect(responses.find(({ endpoint }) => endpoint === "/api/quests")?.body)
    .toHaveProperty("quests");
  expect(
    responses.find(({ endpoint }) => endpoint === "/api/task-templates")?.body,
  ).toHaveProperty("templates");
  expect(
    responses.find(({ endpoint }) => endpoint.startsWith("/api/progress?"))?.body,
  ).toHaveProperty("week");
  expect(
    responses.find(({ endpoint }) =>
      endpoint.startsWith("/api/xp-transactions?"),
    )?.body,
  ).toHaveProperty("events");
  expect(
    responses.find(({ endpoint }) => endpoint === "/api/achievements")?.body,
  ).toHaveProperty("achievements");
});

test("saves next-week focus from the weekly review", async ({ page }) => {
  const focus = `E2E фокус недели ${Date.now()}`;

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Привет/ })).toBeVisible({
    timeout: 15000,
  });
  await page.getByRole("link", { name: "Прогресс" }).click();
  await expect(page.getByRole("heading", { name: "Недельный обзор" })).toBeVisible({
    timeout: 15000,
  });
  await page.getByLabel("Фокус следующей недели").fill(focus);
  await page.getByRole("button", { name: "Сохранить фокус" }).click();
  await expect(page.getByText("Фокус следующей недели сохранён")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Фокус следующей недели")).toHaveValue(focus);
  await expect(page.getByRole("button", { name: "Задача", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Повторение", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Квест", exact: true })).toBeVisible();
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

  await page.getByRole("button", { name: "Добавить", exact: true }).click();
  await page.getByLabel("Название").fill(title);
  await page
    .getByRole("dialog", { name: "Новое действие" })
    .getByRole("button", { name: "Добавить", exact: true })
    .click();

  const task = page.getByRole("listitem").filter({ hasText: title });
  await expect(task).toBeVisible();
  await task.getByRole("button", { name: "Готово" }).click();
  await page.getByLabel("Показывать завершённые задачи").click();
  await task.getByRole("button", { name: "Отменить" }).click();
  await expect(
    page.getByText("Уже открытые достижения останутся полученными."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Назад" }).click();
  await page.reload();
  await expect(page.getByLabel("Показывать завершённые задачи")).toBeChecked();
  await expect(task).toBeVisible();
  await page.getByRole("link", { name: "Прогресс" }).click();
  await expect(page.getByText(title)).toBeVisible();
  await expect(page.getByText(/^Действие ·/).first()).toBeVisible();
});

test("selects up to three focus tasks and shows planned duration", async ({
  page,
}) => {
  const base = new Date("2030-01-01T00:00:00Z");
  base.setUTCDate(base.getUTCDate() + (Date.now() % 2_000_000));
  const date = base.toISOString().slice(0, 10);
  const suffix = Date.now();
  const titles = [0, 1, 2, 3].map((index) => `E2E фокус ${index} ${suffix}`);

  await page.goto(`/?date=${date}`);
  await expect(page.getByRole("heading", { name: "Планирование" })).toBeVisible({
    timeout: 15000,
  });
  const taskIds = await page.evaluate(
    async ({ titles, date }) => {
      const skillsResponse = await fetch("/api/skills");
      const skills = (await skillsResponse.json()) as {
        skills: Array<{ id: string }>;
      };
      const skillId = skills.skills[0]?.id;
      if (!skillId) throw new Error("No active skill for focus E2E");
      const ids: string[] = [];
      for (const [index, title] of titles.entries()) {
        const response = await fetch("/api/tasks", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            title,
            skillId,
            localDate: date,
            baseXp: 20,
            difficulty: "normal",
            estimatedMinutes: 15 + index * 5,
          }),
        });
        if (!response.ok) throw new Error(`Task create failed: ${response.status}`);
        const result = (await response.json()) as { task: { id: string } };
        ids.push(result.task.id);
      }
      return ids;
    },
    { titles, date },
  );

  await page.reload();
  await expect(page.getByText(/^План: 1 ч 30 мин/)).toBeVisible();
  for (const title of titles.slice(0, 3)) {
    await page
      .getByRole("listitem")
      .filter({ hasText: title })
      .getByRole("button", { name: "Добавить в фокус дня" })
      .click();
  }
  const focusSection = page
    .getByRole("heading", { name: /Фокус дня/ })
    .locator("..").locator("..");
  await expect(page.getByRole("heading", { name: /Фокус дня 3 \/ 3/ })).toBeVisible();
  await expect(focusSection.getByText("1 ч", { exact: true })).toBeVisible();

  await page
    .getByRole("listitem")
    .filter({ hasText: titles[3] })
    .getByRole("button", { name: "Добавить в фокус дня" })
    .click();
  await expect(page.getByText("В фокусе дня уже выбраны три задачи.")).toBeVisible();

  await page.evaluate(async (ids) => {
    await Promise.all(ids.map((id) => fetch(`/api/tasks/${id}`, { method: "DELETE" })));
  }, taskIds);
});

test("sets task priority and filters long lists", async ({ page }) => {
  const title = `E2E приоритет ${Date.now()}`;

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Привет/ })).toBeVisible({
    timeout: 15000,
  });
  await page.getByRole("button", { name: "Добавить", exact: true }).click();
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

test("keeps skill and quest list context in the URL and after details", async ({
  page,
}) => {
  const suffix = Date.now();
  const skillTitle = `E2E контекст навыка ${suffix}`;
  const questTitle = `E2E контекст квеста ${suffix}`;

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Привет/ })).toBeVisible({
    timeout: 15000,
  });
  await page.evaluate(
    async ({ skillTitle, questTitle }) => {
      const skillResponse = await fetch("/api/skills", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: skillTitle,
          attributeCode: "creation",
        }),
      });
      if (!skillResponse.ok) throw new Error(`Skill create failed: ${skillResponse.status}`);
      const createdSkill = (await skillResponse.json()) as { skill: { id: string } };
      const skillsResponse = await fetch("/api/skills");
      const skills = (await skillsResponse.json()) as {
        skills: Array<{ id: string; attributeId: string }>;
      };
      const attributeId = skills.skills.find(
        (skill) => skill.id === createdSkill.skill.id,
      )?.attributeId;
      if (!attributeId) throw new Error("Created skill attribute is missing");

      const questResponse = await fetch("/api/quests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: questTitle,
          type: "side",
          attributeId,
          rewardXp: 100,
          steps: [{ title: "Проверить возврат", isRequired: true }],
        }),
      });
      if (!questResponse.ok) throw new Error(`Quest create failed: ${questResponse.status}`);
    },
    { skillTitle, questTitle },
  );

  await page.getByRole("link", { name: "Навыки" }).click();
  await page.getByLabel("Поиск навыков").fill(skillTitle);
  await page.getByLabel("Фильтр по характеристике").click();
  await page.getByRole("option", { name: "Созидание" }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("q")).toBe(skillTitle);
  expect(new URL(page.url()).searchParams.get("attribute")).toBe("creation");
  await page.reload();
  await expect(page.getByLabel("Поиск навыков")).toHaveValue(skillTitle);
  await page.getByRole("link", { name: new RegExp(skillTitle) }).click();
  await page.getByRole("button", { name: "Навыки" }).click();
  await expect(page.getByLabel("Поиск навыков")).toHaveValue(skillTitle);
  expect(new URL(page.url()).searchParams.get("attribute")).toBe("creation");

  await page.getByRole("link", { name: "Квесты" }).click();
  await page.getByLabel("Поиск квестов").fill(questTitle);
  await page.getByLabel("Фильтр по типу квеста").click();
  await page.getByRole("option", { name: "Побочный" }).click();
  await page.getByLabel("Фильтр квестов по характеристике").click();
  await page.getByRole("option", { name: "Созидание" }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("q")).toBe(questTitle);
  expect(new URL(page.url()).searchParams.get("type")).toBe("side");
  expect(new URL(page.url()).searchParams.get("attribute")).toBe("Созидание");
  await page.reload();
  await expect(page.getByLabel("Поиск квестов")).toHaveValue(questTitle);
  await page.getByRole("link", { name: new RegExp(questTitle) }).click();
  await page.getByRole("button", { name: "Квесты" }).click();
  await expect(page.getByLabel("Поиск квестов")).toHaveValue(questTitle);
  expect(new URL(page.url()).searchParams.get("type")).toBe("side");
  expect(new URL(page.url()).searchParams.get("attribute")).toBe("Созидание");
});

test("bulk-reschedules overdue tasks and pauses a recurring debt", async ({
  page,
}) => {
  const suffix = Date.now();
  const firstTitle = `E2E долг A ${suffix}`;
  const secondTitle = `E2E долг B ${suffix}`;
  const recurringTitle = `E2E повтор-долг ${suffix}`;

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Привет/ })).toBeVisible({
    timeout: 15000,
  });
  const dateInput = page.getByLabel("Перейти к дате");
  if (!(await dateInput.isVisible())) {
    await page.getByRole("button", { name: /^Планирование/ }).click();
  }
  const today = await dateInput.inputValue();
  const yesterdayDate = new Date(`${today}T00:00:00Z`);
  yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
  const yesterday = yesterdayDate.toISOString().slice(0, 10);

  const templateId = await page.evaluate(
    async ({ firstTitle, secondTitle, recurringTitle, yesterday }) => {
      const skillsResponse = await fetch("/api/skills");
      const skills = (await skillsResponse.json()) as {
        skills: Array<{ id: string }>;
      };
      const skillId = skills.skills[0]?.id;
      if (!skillId) throw new Error("No active skill for overdue E2E");
      for (const title of [firstTitle, secondTitle]) {
        const response = await fetch("/api/tasks", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            title,
            skillId,
            localDate: yesterday,
            baseXp: 20,
            difficulty: "normal",
          }),
        });
        if (!response.ok) throw new Error(`Task create failed: ${response.status}`);
      }
      const templateResponse = await fetch("/api/task-templates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: recurringTitle,
          skillId,
          localDate: yesterday,
          baseXp: 20,
          difficulty: "normal",
          recurrenceType: "daily",
        }),
      });
      if (!templateResponse.ok) {
        throw new Error(`Template create failed: ${templateResponse.status}`);
      }
      const created = (await templateResponse.json()) as {
        template: { id: string };
      };
      return created.template.id;
    },
    { firstTitle, secondTitle, recurringTitle, yesterday },
  );

  await page.reload();
  const overdue = page.locator("#overdue");
  await expect(overdue.getByText(firstTitle, { exact: true })).toBeVisible();
  await overdue.getByLabel(`Выбрать задачу ${firstTitle}`).click();
  await overdue.getByLabel(`Выбрать задачу ${secondTitle}`).click();
  await overdue.getByRole("button", { name: "Перенести", exact: true }).click();
  await expect(page.getByText("Перенесено задач: 2")).toBeVisible();
  await expect(overdue.getByText(firstTitle, { exact: true })).not.toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: firstTitle })).toBeVisible();

  const recurringCard = overdue
    .locator("[data-overdue-task]")
    .filter({ hasText: recurringTitle });
  await recurringCard.getByRole("button", { name: "Эта и будущие" }).click();
  await page.getByRole("button", { name: "Подтвердить" }).click();
  await expect(page.getByText("Повторение поставлено на паузу")).toBeVisible();
  await expect(recurringCard).not.toBeVisible();

  const templateActive = await page.evaluate(async (id) => {
    const response = await fetch("/api/task-templates");
    const data = (await response.json()) as {
      templates: Array<{ id: string; isActive: boolean }>;
    };
    return data.templates.find((template) => template.id === id)?.isActive;
  }, templateId);
  expect(templateActive).toBe(false);
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
  await page.getByRole("link", { name: /^Повторения/ }).click();
  await page.getByLabel("Поиск повторений").fill(title);
  await expect.poll(() => new URL(page.url()).searchParams.get("q")).toBe(title);
  await page.reload();
  await expect(page.getByLabel("Поиск повторений")).toHaveValue(title);
  await page.locator("summary").filter({ hasText: "Архив" }).click();
  const archivedCard = page
    .locator("[data-archived-template]")
    .filter({ hasText: title });
  await archivedCard.getByRole("button", { name: "Восстановить" }).click();
  await expect(
    archivedCard.getByText("Неархивное повторение с таким названием уже существует."),
  ).toBeVisible();
  await archivedCard
    .getByLabel(`Новое название повторения ${title}`)
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
  await page.getByRole("button", { name: "Добавить", exact: true }).click();
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
  await expect.poll(() => new URL(page.url()).searchParams.get("tab")).toBe("completed");
  expect(new URL(page.url()).searchParams.get("type")).toBe("main");
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
