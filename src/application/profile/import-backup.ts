import { and, eq, inArray, ne } from "drizzle-orm";

import { getDb, type Database, type DbClient } from "@/db/client";
import * as schema from "@/db/schema";
import {
  DataImportError,
  type ImportSummary,
} from "@/lib/import/contracts";
import {
  backupImportSchema,
  type BackupImport,
} from "@/lib/validation/import-data";

const normalize = (value: string) => value.trim().toLocaleLowerCase("ru-RU");

function duplicateIds(rows: { id: string }[], label: string): string[] {
  const seen = new Set<string>();
  const conflicts: string[] = [];
  for (const row of rows) {
    if (seen.has(row.id)) conflicts.push(`${label}: повторяется id ${row.id}`);
    seen.add(row.id);
  }
  return conflicts;
}

function duplicateNames(
  rows: { name: string }[],
  label: string,
): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const row of rows) {
    const name = normalize(row.name);
    if (seen.has(name)) duplicates.add(row.name.trim());
    seen.add(name);
  }
  return [...duplicates].map((name) => `${label} «${name}»: название повторяется`);
}

async function hasUserData(db: DbClient, userId: string): Promise<boolean> {
  const [skills, tasks, quests, transactions, weeklyFocuses] = await Promise.all([
    db.select({ id: schema.skills.id }).from(schema.skills).where(eq(schema.skills.userId, userId)).limit(1),
    db.select({ id: schema.tasks.id }).from(schema.tasks).where(eq(schema.tasks.userId, userId)).limit(1),
    db.select({ id: schema.quests.id }).from(schema.quests).where(eq(schema.quests.userId, userId)).limit(1),
    db.select({ id: schema.xpTransactions.id }).from(schema.xpTransactions).where(eq(schema.xpTransactions.userId, userId)).limit(1),
    db.select({ id: schema.weeklyFocuses.id }).from(schema.weeklyFocuses).where(eq(schema.weeklyFocuses.userId, userId)).limit(1),
  ]);
  return skills.length + tasks.length + quests.length + transactions.length + weeklyFocuses.length > 0;
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
  addCheck("Завершения квестов", backup.questCompletions.map((row) => row.id), () =>
    db.select({ id: schema.questCompletions.id }).from(schema.questCompletions).where(
      and(inArray(schema.questCompletions.id, backup.questCompletions.map((row) => row.id)), ne(schema.questCompletions.userId, userId)),
    ),
  );
  addCheck("XP", backup.xpTransactions.map((row) => row.id), () =>
    db.select({ id: schema.xpTransactions.id }).from(schema.xpTransactions).where(
      and(inArray(schema.xpTransactions.id, backup.xpTransactions.map((row) => row.id)), ne(schema.xpTransactions.userId, userId)),
    ),
  );
  addCheck("Недельные фокусы", backup.weeklyFocuses.map((row) => row.id), () =>
    db.select({ id: schema.weeklyFocuses.id }).from(schema.weeklyFocuses).where(
      and(inArray(schema.weeklyFocuses.id, backup.weeklyFocuses.map((row) => row.id)), ne(schema.weeklyFocuses.userId, userId)),
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
    ...duplicateIds(backup.questCompletions, "Завершения квестов"),
    ...duplicateIds(backup.questSteps, "Шаги квестов"),
    ...duplicateIds(backup.streaks, "Серии"),
    ...duplicateIds(backup.weeklyFocuses, "Недельные фокусы"),
    ...duplicateNames(
      backup.skills.filter((row) => row.status === "active"),
      "Навык",
    ),
    ...duplicateNames(
      backup.taskTemplates
        .filter((row) => row.archivedAt === null)
        .map((row) => ({ name: row.title })),
      "Шаблон",
    ),
  ];
  const attributeIds = new Set(backup.attributes.map((row) => row.id));
  const skillIds = new Set(backup.skills.map((row) => row.id));
  const templateIds = new Set(backup.taskTemplates.map((row) => row.id));
  const questIds = new Set(backup.quests.map((row) => row.id));
  const stepIds = new Set(backup.questSteps.map((row) => row.id));
  const taskIds = new Set(backup.tasks.map((row) => row.id));
  const taskCompletionIds = new Set(
    backup.taskCompletions.map((row) => row.id),
  );
  const questCompletionIds = new Set(
    backup.questCompletions.map((row) => row.id),
  );
  const transactionIds = new Set(backup.xpTransactions.map((row) => row.id));
  const achievementIds = new Set(backup.achievementCatalog.map((row) => row.id));
  const weeklyFocusWeeks = new Set<string>();

  for (const row of backup.weeklyFocuses) {
    if (weeklyFocusWeeks.has(row.weekStart)) {
      conflicts.push(`Недельный фокус: повторяется неделя ${row.weekStart}`);
    }
    weeklyFocusWeeks.add(row.weekStart);
  }

  for (const row of backup.skills) {
    if (!attributeIds.has(row.attributeId)) conflicts.push(`Навык «${row.name}»: неизвестная характеристика`);
  }
  for (const row of backup.taskTemplates) {
    if (!skillIds.has(row.skillId)) conflicts.push(`Шаблон «${row.title}»: неизвестный навык`);
  }
  for (const row of backup.userSkills) {
    if (!skillIds.has(row.skillId)) {
      conflicts.push(`Прогресс навыка ${row.skillId}: неизвестный навык`);
    }
  }
  for (const row of backup.quests) {
    if (row.attributeId && !attributeIds.has(row.attributeId)) conflicts.push(`Квест «${row.title}»: неизвестная характеристика`);
  }
  for (const row of backup.questSteps) {
    if (!questIds.has(row.questId)) conflicts.push(`Шаг «${row.title}»: неизвестный квест`);
  }
  for (const row of backup.questCompletions) {
    if (!questIds.has(row.questId)) {
      conflicts.push(`Завершение квеста ${row.id}: неизвестный квест`);
    }
  }
  for (const row of backup.tasks) {
    if (!skillIds.has(row.skillId)) conflicts.push(`Задача «${row.title}»: неизвестный навык`);
    if (row.templateId && !templateIds.has(row.templateId)) conflicts.push(`Задача «${row.title}»: неизвестный шаблон`);
    if (row.questStepId && !stepIds.has(row.questStepId)) conflicts.push(`Задача «${row.title}»: неизвестный шаг квеста`);
  }
  for (const row of backup.taskCompletions) {
    if (!taskIds.has(row.taskId)) conflicts.push(`Завершение ${row.id}: неизвестная задача`);
  }
  for (const row of backup.streaks) {
    if (!templateIds.has(row.templateId)) {
      conflicts.push(`Серия ${row.id}: неизвестный шаблон`);
    }
  }
  for (const row of backup.xpTransactions) {
    if (row.skillId && !skillIds.has(row.skillId)) conflicts.push(`XP ${row.id}: неизвестный навык`);
    if (row.attributeId && !attributeIds.has(row.attributeId)) conflicts.push(`XP ${row.id}: неизвестная характеристика`);
    if (row.reversalOfId && !transactionIds.has(row.reversalOfId)) conflicts.push(`XP ${row.id}: неизвестная исходная транзакция`);
    if (
      row.sourceType === "task_completion" &&
      !taskCompletionIds.has(row.sourceId)
    ) {
      conflicts.push(`XP ${row.id}: неизвестное завершение задачи`);
    }
    if (
      row.sourceType === "quest_completion" &&
      !questCompletionIds.has(row.sourceId)
    ) {
      conflicts.push(`XP ${row.id}: неизвестное завершение квеста`);
    }
    if (row.sourceType === "reversal" && !transactionIds.has(row.sourceId)) {
      conflicts.push(`XP ${row.id}: неизвестная отменяемая транзакция`);
    }
  }
  for (const row of backup.userAchievements) {
    if (!achievementIds.has(row.achievementId)) conflicts.push(`Достижение ${row.achievementId}: нет в каталоге экспорта`);
  }
  return conflicts;
}

async function clearUserData(db: DbClient, userId: string): Promise<void> {
  await db.delete(schema.weeklyFocuses).where(eq(schema.weeklyFocuses.userId, userId));
  await db.delete(schema.userAchievements).where(eq(schema.userAchievements.userId, userId));
  await db.delete(schema.xpTransactions).where(eq(schema.xpTransactions.userId, userId));
  await db.delete(schema.questCompletions).where(eq(schema.questCompletions.userId, userId));
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
  if (backup.questCompletions.length === 0) {
    backup.questCompletions = backup.quests
      .filter((quest) => quest.status === "completed")
      .map((quest) => ({
        id: quest.id,
        userId: quest.userId,
        questId: quest.id,
        rewardXp: quest.rewardXp,
        completedAt: quest.completedAt ?? quest.updatedAt,
        revertedAt: null,
        createdAt: quest.completedAt ?? quest.updatedAt,
      }));
  }
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
    if (backup.questCompletions.length > 0) {
      await tx.insert(schema.questCompletions).values(
        backup.questCompletions.map((row) => ({ ...row, userId })),
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
    if (backup.weeklyFocuses.length > 0) {
      await tx.insert(schema.weeklyFocuses).values(
        backup.weeklyFocuses.map((row) => ({ ...row, userId })),
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
      tasks: backup.tasks.length,
      taskTemplates: backup.taskTemplates.length,
      quests: backup.quests.length,
    },
    skipped: { skills: 0, tasks: 0, taskTemplates: 0, quests: 0 },
  };
}


