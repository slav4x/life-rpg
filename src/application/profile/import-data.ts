import { and, eq, inArray, ne } from "drizzle-orm";

import { getDb, type Database, type DbClient } from "@/db/client";
import * as schema from "@/db/schema";
import {
  backupImportSchema,
  contentPackSchema,
  type BackupImport,
  type ContentPack,
} from "@/lib/validation/import-data";

export class DataImportError extends Error {
  constructor(
    readonly code: "invalid_format" | "account_not_empty" | "conflict",
    message: string,
    readonly conflicts: string[] = [],
  ) {
    super(message);
    this.name = "DataImportError";
  }

  get status(): number {
    return this.code === "invalid_format" ? 400 : 409;
  }
}

export interface ImportSummary {
  created: { skills: number; taskTemplates: number; quests: number };
  skipped: { skills: number; taskTemplates: number; quests: number };
}

const normalize = (value: string) => value.trim().toLocaleLowerCase("ru-RU");
const nullable = (value?: string | null) => value?.trim() || null;

function duplicateIds(rows: { id: string }[], label: string): string[] {
  const seen = new Set<string>();
  const conflicts: string[] = [];
  for (const row of rows) {
    if (seen.has(row.id)) conflicts.push(`${label}: повторяется id ${row.id}`);
    seen.add(row.id);
  }
  return conflicts;
}

async function hasUserData(db: DbClient, userId: string): Promise<boolean> {
  const [skills, tasks, quests, transactions] = await Promise.all([
    db.select({ id: schema.skills.id }).from(schema.skills).where(eq(schema.skills.userId, userId)).limit(1),
    db.select({ id: schema.tasks.id }).from(schema.tasks).where(eq(schema.tasks.userId, userId)).limit(1),
    db.select({ id: schema.quests.id }).from(schema.quests).where(eq(schema.quests.userId, userId)).limit(1),
    db.select({ id: schema.xpTransactions.id }).from(schema.xpTransactions).where(eq(schema.xpTransactions.userId, userId)).limit(1),
  ]);
  return skills.length + tasks.length + quests.length + transactions.length > 0;
}

async function foreignIdConflicts(
  db: DbClient,
  userId: string,
  backup: BackupImport,
): Promise<string[]> {
  const checks: Promise<{ label: string; count: number }>[] = [];

  function addCheck(
    label: string,
    ids: string[],
    query: () => Promise<unknown[]>,
  ) {
    if (ids.length === 0) return;
    checks.push(query().then((rows) => ({ label, count: rows.length })));
  }

  addCheck("Навыки", backup.skills.map((row) => row.id), () =>
    db.select({ id: schema.skills.id }).from(schema.skills).where(
      and(inArray(schema.skills.id, backup.skills.map((row) => row.id)), ne(schema.skills.userId, userId)),
    ),
  );
  addCheck("Шаблоны", backup.taskTemplates.map((row) => row.id), () =>
    db.select({ id: schema.taskTemplates.id }).from(schema.taskTemplates).where(
      and(inArray(schema.taskTemplates.id, backup.taskTemplates.map((row) => row.id)), ne(schema.taskTemplates.userId, userId)),
    ),
  );
  addCheck("Задачи", backup.tasks.map((row) => row.id), () =>
    db.select({ id: schema.tasks.id }).from(schema.tasks).where(
      and(inArray(schema.tasks.id, backup.tasks.map((row) => row.id)), ne(schema.tasks.userId, userId)),
    ),
  );
  addCheck("Квесты", backup.quests.map((row) => row.id), () =>
    db.select({ id: schema.quests.id }).from(schema.quests).where(
      and(inArray(schema.quests.id, backup.quests.map((row) => row.id)), ne(schema.quests.userId, userId)),
    ),
  );
  addCheck("Шаги квестов", backup.questSteps.map((row) => row.id), () =>
    db
      .select({ id: schema.questSteps.id })
      .from(schema.questSteps)
      .innerJoin(schema.quests, eq(schema.quests.id, schema.questSteps.questId))
      .where(
        and(
          inArray(schema.questSteps.id, backup.questSteps.map((row) => row.id)),
          ne(schema.quests.userId, userId),
        ),
      ),
  );
  addCheck("Завершения", backup.taskCompletions.map((row) => row.id), () =>
    db.select({ id: schema.taskCompletions.id }).from(schema.taskCompletions).where(
      and(inArray(schema.taskCompletions.id, backup.taskCompletions.map((row) => row.id)), ne(schema.taskCompletions.userId, userId)),
    ),
  );
  addCheck("XP", backup.xpTransactions.map((row) => row.id), () =>
    db.select({ id: schema.xpTransactions.id }).from(schema.xpTransactions).where(
      and(inArray(schema.xpTransactions.id, backup.xpTransactions.map((row) => row.id)), ne(schema.xpTransactions.userId, userId)),
    ),
  );

  return (await Promise.all(checks))
    .filter((check) => check.count > 0)
    .map((check) => `${check.label}: ${check.count} id уже принадлежат другому пользователю`);
}

function validateBackupReferences(backup: BackupImport): string[] {
  const conflicts = [
    ...duplicateIds(backup.skills, "Навыки"),
    ...duplicateIds(backup.taskTemplates, "Шаблоны"),
    ...duplicateIds(backup.tasks, "Задачи"),
    ...duplicateIds(backup.taskCompletions, "Завершения"),
    ...duplicateIds(backup.xpTransactions, "XP"),
    ...duplicateIds(backup.quests, "Квесты"),
    ...duplicateIds(backup.questSteps, "Шаги квестов"),
    ...duplicateIds(backup.streaks, "Серии"),
  ];
  const attributeIds = new Set(backup.attributes.map((row) => row.id));
  const skillIds = new Set(backup.skills.map((row) => row.id));
  const templateIds = new Set(backup.taskTemplates.map((row) => row.id));
  const questIds = new Set(backup.quests.map((row) => row.id));
  const stepIds = new Set(backup.questSteps.map((row) => row.id));
  const taskIds = new Set(backup.tasks.map((row) => row.id));
  const transactionIds = new Set(backup.xpTransactions.map((row) => row.id));
  const achievementIds = new Set(backup.achievementCatalog.map((row) => row.id));

  for (const row of backup.skills) {
    if (!attributeIds.has(row.attributeId)) conflicts.push(`Навык «${row.name}»: неизвестная характеристика`);
  }
  for (const row of backup.taskTemplates) {
    if (!skillIds.has(row.skillId)) conflicts.push(`Шаблон «${row.title}»: неизвестный навык`);
  }
  for (const row of backup.quests) {
    if (row.attributeId && !attributeIds.has(row.attributeId)) conflicts.push(`Квест «${row.title}»: неизвестная характеристика`);
  }
  for (const row of backup.questSteps) {
    if (!questIds.has(row.questId)) conflicts.push(`Шаг «${row.title}»: неизвестный квест`);
  }
  for (const row of backup.tasks) {
    if (!skillIds.has(row.skillId)) conflicts.push(`Задача «${row.title}»: неизвестный навык`);
    if (row.templateId && !templateIds.has(row.templateId)) conflicts.push(`Задача «${row.title}»: неизвестный шаблон`);
    if (row.questStepId && !stepIds.has(row.questStepId)) conflicts.push(`Задача «${row.title}»: неизвестный шаг квеста`);
  }
  for (const row of backup.taskCompletions) {
    if (!taskIds.has(row.taskId)) conflicts.push(`Завершение ${row.id}: неизвестная задача`);
  }
  for (const row of backup.xpTransactions) {
    if (row.skillId && !skillIds.has(row.skillId)) conflicts.push(`XP ${row.id}: неизвестный навык`);
    if (row.attributeId && !attributeIds.has(row.attributeId)) conflicts.push(`XP ${row.id}: неизвестная характеристика`);
    if (row.reversalOfId && !transactionIds.has(row.reversalOfId)) conflicts.push(`XP ${row.id}: неизвестная исходная транзакция`);
  }
  for (const row of backup.userAchievements) {
    if (!achievementIds.has(row.achievementId)) conflicts.push(`Достижение ${row.achievementId}: нет в каталоге экспорта`);
  }
  return conflicts;
}

async function clearUserData(db: DbClient, userId: string): Promise<void> {
  await db.delete(schema.userAchievements).where(eq(schema.userAchievements.userId, userId));
  await db.delete(schema.xpTransactions).where(eq(schema.xpTransactions.userId, userId));
  await db.delete(schema.taskCompletions).where(eq(schema.taskCompletions.userId, userId));
  await db.delete(schema.tasks).where(eq(schema.tasks.userId, userId));
  await db.delete(schema.streaks).where(eq(schema.streaks.userId, userId));
  await db.delete(schema.taskTemplates).where(eq(schema.taskTemplates.userId, userId));
  await db.delete(schema.quests).where(eq(schema.quests.userId, userId));
  await db.delete(schema.userSkills).where(eq(schema.userSkills.userId, userId));
  await db.delete(schema.userAttributes).where(eq(schema.userAttributes.userId, userId));
  await db.delete(schema.skills).where(eq(schema.skills.userId, userId));
}

export async function importBackup(
  userId: string,
  input: unknown,
  replace: boolean,
  db: Database = getDb(),
): Promise<ImportSummary> {
  const parsed = backupImportSchema.safeParse(input);
  if (!parsed.success) {
    throw new DataImportError("invalid_format", "Неподдерживаемый формат экспорта");
  }
  const backup = parsed.data;
  if (!replace && (await hasUserData(db, userId))) {
    throw new DataImportError("account_not_empty", "В профиле уже есть данные");
  }

  const conflicts = [
    ...validateBackupReferences(backup),
    ...(await foreignIdConflicts(db, userId, backup)),
  ];
  const currentAttributes = await db.select().from(schema.attributes);
  const currentAchievements = await db.select().from(schema.achievements);
  const oldAttributeCode = new Map(backup.attributes.map((row) => [row.id, row.code]));
  const attributeByCode = new Map(currentAttributes.map((row) => [row.code, row.id]));
  const oldAchievementCode = new Map(
    backup.achievementCatalog.map((row) => [row.id, row.code]),
  );
  const achievementByCode = new Map(
    currentAchievements.map((row) => [row.code, row.id]),
  );
  const mapAttribute = (oldId: string) => {
    const mapped = attributeByCode.get(oldAttributeCode.get(oldId) ?? "");
    if (!mapped) conflicts.push(`Характеристика ${oldId} отсутствует в текущей версии`);
    return mapped ?? oldId;
  };
  const mapAchievement = (oldId: string) => {
    const mapped = achievementByCode.get(oldAchievementCode.get(oldId) ?? "");
    if (!mapped) conflicts.push(`Достижение ${oldId} отсутствует в текущей версии`);
    return mapped ?? oldId;
  };
  for (const row of backup.skills) mapAttribute(row.attributeId);
  for (const row of backup.quests) if (row.attributeId) mapAttribute(row.attributeId);
  for (const row of backup.userAttributes) mapAttribute(row.attributeId);
  for (const row of backup.userAchievements) mapAchievement(row.achievementId);
  if (conflicts.length > 0) {
    throw new DataImportError("conflict", "Экспорт содержит конфликты", conflicts);
  }

  await db.transaction(async (tx) => {
    if (replace) await clearUserData(tx, userId);

    if (backup.skills.length > 0) {
      await tx.insert(schema.skills).values(
        backup.skills.map((row) => ({
          ...row,
          userId,
          attributeId: mapAttribute(row.attributeId),
        })),
      );
    }
    if (backup.quests.length > 0) {
      await tx.insert(schema.quests).values(
        backup.quests.map((row) => ({
          ...row,
          userId,
          attributeId: row.attributeId ? mapAttribute(row.attributeId) : null,
        })),
      );
    }
    if (backup.questSteps.length > 0) await tx.insert(schema.questSteps).values(backup.questSteps);
    if (backup.taskTemplates.length > 0) {
      await tx.insert(schema.taskTemplates).values(
        backup.taskTemplates.map((row) => ({ ...row, userId })),
      );
    }
    if (backup.tasks.length > 0) {
      await tx.insert(schema.tasks).values(
        backup.tasks.map((row) => ({ ...row, userId })),
      );
    }
    if (backup.taskCompletions.length > 0) {
      await tx.insert(schema.taskCompletions).values(
        backup.taskCompletions.map((row) => ({ ...row, userId })),
      );
    }
    const originalTransactions = backup.xpTransactions.filter((row) => !row.reversalOfId);
    const reversalTransactions = backup.xpTransactions.filter((row) => row.reversalOfId);
    for (const rows of [originalTransactions, reversalTransactions]) {
      if (rows.length === 0) continue;
      await tx.insert(schema.xpTransactions).values(
        rows.map((row) => ({
          ...row,
          userId,
          attributeId: row.attributeId ? mapAttribute(row.attributeId) : null,
        })),
      );
    }
    if (backup.streaks.length > 0) {
      await tx.insert(schema.streaks).values(
        backup.streaks.map((row) => ({ ...row, userId })),
      );
    }
    if (backup.userSkills.length > 0) {
      await tx.insert(schema.userSkills).values(
        backup.userSkills.map((row) => ({ ...row, userId })),
      );
    }
    if (backup.userAttributes.length > 0) {
      await tx.insert(schema.userAttributes).values(
        backup.userAttributes.map((row) => ({
          ...row,
          userId,
          attributeId: mapAttribute(row.attributeId),
        })),
      );
    }
    if (backup.userAchievements.length > 0) {
      await tx.insert(schema.userAchievements).values(
        backup.userAchievements.map((row) => ({
          ...row,
          userId,
          achievementId: mapAchievement(row.achievementId),
        })),
      );
    }
    if (backup.user) {
      await tx
        .update(schema.users)
        .set({
          timezone: backup.user.timezone,
          theme: backup.user.theme,
          updatedAt: new Date(),
        })
        .where(eq(schema.users.id, userId));
    }
  });

  return {
    created: {
      skills: backup.skills.length,
      taskTemplates: backup.taskTemplates.length,
      quests: backup.quests.length,
    },
    skipped: { skills: 0, taskTemplates: 0, quests: 0 },
  };
}

function sameArray(a: number[] | null, b?: number[]): boolean {
  return JSON.stringify([...(a ?? [])].sort()) === JSON.stringify([...(b ?? [])].sort());
}

export async function importContentPack(
  userId: string,
  input: unknown,
  db: Database = getDb(),
): Promise<ImportSummary> {
  const parsed = contentPackSchema.safeParse(input);
  if (!parsed.success) {
    throw new DataImportError("invalid_format", "Неподдерживаемый формат контент-пака");
  }
  const pack: ContentPack = parsed.data;
  const [attributes, existingSkills, existingTemplates, existingQuests] =
    await Promise.all([
      db.select().from(schema.attributes),
      db.select().from(schema.skills).where(eq(schema.skills.userId, userId)),
      db.select().from(schema.taskTemplates).where(eq(schema.taskTemplates.userId, userId)),
      db.select().from(schema.quests).where(eq(schema.quests.userId, userId)),
    ]);
  const existingQuestIds = existingQuests.map((quest) => quest.id);
  const existingSteps =
    existingQuestIds.length > 0
      ? await db
          .select()
          .from(schema.questSteps)
          .where(inArray(schema.questSteps.questId, existingQuestIds))
      : [];

  const attributeByCode = new Map(attributes.map((row) => [row.code, row.id]));
  const skillByName = new Map(existingSkills.map((row) => [normalize(row.name), row]));
  const templateByName = new Map(
    existingTemplates.map((row) => [normalize(row.title), row]),
  );
  const questByName = new Map(existingQuests.map((row) => [normalize(row.title), row]));
  const conflicts: string[] = [];
  const skillIdByKey = new Map<string, string>();
  const newSkills: ContentPack["skills"] = [];
  let skippedSkills = 0;

  for (const skill of pack.skills) {
    const attributeId = attributeByCode.get(skill.attributeCode);
    const existing = skillByName.get(normalize(skill.name));
    if (!attributeId) {
      conflicts.push(`Навык «${skill.name}»: неизвестная характеристика`);
    } else if (!existing) {
      newSkills.push(skill);
    } else if (
      existing.attributeId === attributeId &&
      nullable(existing.description) === nullable(skill.description) &&
      existing.icon === (skill.icon ?? null) &&
      existing.color === (skill.color ?? null) &&
      existing.status === "active"
    ) {
      skillIdByKey.set(skill.key, existing.id);
      skippedSkills += 1;
    } else {
      conflicts.push(`Навык «${skill.name}» уже существует с другими параметрами`);
    }
  }

  const duplicateTemplateNames = new Set<string>();
  const seenTemplateNames = new Set<string>();
  for (const template of pack.taskTemplates) {
    const name = normalize(template.title);
    if (seenTemplateNames.has(name)) duplicateTemplateNames.add(name);
    seenTemplateNames.add(name);
  }
  for (const name of duplicateTemplateNames) conflicts.push(`Шаблон «${name}» повторяется в паке`);

  const duplicateQuestNames = new Set<string>();
  const seenQuestNames = new Set<string>();
  for (const quest of pack.quests) {
    const name = normalize(quest.title);
    if (seenQuestNames.has(name)) duplicateQuestNames.add(name);
    seenQuestNames.add(name);
  }
  for (const name of duplicateQuestNames) conflicts.push(`Квест «${name}» повторяется в паке`);

  const templatesToCreate: ContentPack["taskTemplates"] = [];
  let skippedTemplates = 0;
  for (const template of pack.taskTemplates) {
    const existing = templateByName.get(normalize(template.title));
    if (!existing) {
      templatesToCreate.push(template);
      continue;
    }
    const skillId = skillIdByKey.get(template.skillKey);
    if (
      skillId &&
      existing.skillId === skillId &&
      nullable(existing.description) === nullable(template.description) &&
      existing.baseXp === template.baseXp &&
      existing.difficulty === template.difficulty &&
      existing.recurrenceType === template.recurrenceType &&
      sameArray(existing.weekdays, template.weekdays) &&
      existing.archivedAt === null
    ) {
      skippedTemplates += 1;
    } else {
      conflicts.push(`Шаблон «${template.title}» уже существует с другими параметрами`);
    }
  }

  const questsToCreate: ContentPack["quests"] = [];
  let skippedQuests = 0;
  for (const quest of pack.quests) {
    const existing = questByName.get(normalize(quest.title));
    if (!existing) {
      questsToCreate.push(quest);
      continue;
    }
    const attributeId = quest.attributeCode
      ? attributeByCode.get(quest.attributeCode)
      : undefined;
    const steps = existingSteps
      .filter((step) => step.questId === existing.id)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const sameSteps =
      steps.length === quest.steps.length &&
      steps.every((step, index) => {
        const desired = quest.steps[index];
        return (
          step.title === desired.title &&
          nullable(step.description) === nullable(desired.description) &&
          step.isRequired === (desired.isRequired ?? true)
        );
      });
    if (
      existing.type === quest.type &&
      existing.attributeId === (attributeId ?? null) &&
      nullable(existing.description) === nullable(quest.description) &&
      existing.rewardXp === quest.rewardXp &&
      existing.dueDate === (quest.dueDate ?? null) &&
      existing.manualCompletion === (quest.manualCompletion ?? true) &&
      existing.status === "active" &&
      sameSteps
    ) {
      skippedQuests += 1;
    } else {
      conflicts.push(`Квест «${quest.title}» уже существует с другими параметрами`);
    }
  }

  if (conflicts.length > 0) {
    throw new DataImportError("conflict", "Контент-пак содержит конфликты", conflicts);
  }

  await db.transaction(async (tx) => {
    for (const skill of newSkills) {
      const [created] = await tx
        .insert(schema.skills)
        .values({
          userId,
          attributeId: attributeByCode.get(skill.attributeCode)!,
          name: skill.name,
          description: skill.description ?? null,
          icon: skill.icon ?? null,
          color: skill.color ?? null,
        })
        .returning({ id: schema.skills.id });
      skillIdByKey.set(skill.key, created.id);
    }
    for (const template of templatesToCreate) {
      await tx.insert(schema.taskTemplates).values({
        userId,
        skillId: skillIdByKey.get(template.skillKey)!,
        title: template.title,
        description: template.description ?? null,
        baseXp: template.baseXp,
        difficulty: template.difficulty,
        recurrenceType: template.recurrenceType,
        weekdays: template.recurrenceType === "weekdays" ? template.weekdays : null,
      });
    }
    for (const quest of questsToCreate) {
      const [created] = await tx
        .insert(schema.quests)
        .values({
          userId,
          attributeId: quest.attributeCode
            ? attributeByCode.get(quest.attributeCode)
            : null,
          title: quest.title,
          description: quest.description ?? null,
          type: quest.type,
          status: "active",
          rewardXp: quest.rewardXp,
          dueDate: quest.dueDate ?? null,
          manualCompletion: quest.manualCompletion ?? true,
        })
        .returning({ id: schema.quests.id });
      await tx.insert(schema.questSteps).values(
        quest.steps.map((step, sortOrder) => ({
          questId: created.id,
          title: step.title,
          description: step.description ?? null,
          isRequired: step.isRequired ?? true,
          sortOrder,
        })),
      );
    }
  });

  return {
    created: {
      skills: newSkills.length,
      taskTemplates: templatesToCreate.length,
      quests: questsToCreate.length,
    },
    skipped: {
      skills: skippedSkills,
      taskTemplates: skippedTemplates,
      quests: skippedQuests,
    },
  };
}
