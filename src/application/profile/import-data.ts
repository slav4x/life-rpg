import { and, eq, inArray, ne } from "drizzle-orm";

import { getDb, type Database, type DbClient } from "@/db/client";
import * as schema from "@/db/schema";
import {
  backupImportSchema,
  contentPackSchema,
  type BackupImport,
  type ContentPack,
  type PackQuestV2,
  type PackTask,
  type PackTemplateV2,
} from "@/lib/validation/import-data";
import { addDaysToDate, getLocalDate } from "@/lib/dates/local-date";

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

export interface ImportCounts {
  skills: number;
  tasks: number;
  taskTemplates: number;
  quests: number;
}

export interface ImportSummary {
  created: ImportCounts;
  skipped: ImportCounts;
}

export type ContentPackSection = keyof ImportCounts;

export interface ContentPackSelection {
  skills: boolean;
  tasks: boolean;
  taskTemplates: boolean;
  quests: boolean;
}

export interface ContentPackPreview {
  formatVersion: 1 | 2;
  name: string;
  anchorDate: string;
  selection: ContentPackSelection;
  summary: ImportSummary & { rejected: ImportCounts };
  conflicts: string[];
}

export interface ContentPackImportOptions {
  anchorDate?: string;
  selection?: Partial<ContentPackSelection>;
}

const ALL_CONTENT_PACK_SECTIONS: ContentPackSelection = {
  skills: true,
  tasks: true,
  taskTemplates: true,
  quests: true,
};

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

function sameArray(a: number[] | null, b?: number[]): boolean {
  return JSON.stringify([...(a ?? [])].sort()) === JSON.stringify([...(b ?? [])].sort());
}

type PackSkill = ContentPack["skills"][number];
type PackTemplate = ContentPack["taskTemplates"][number];
type PackQuest = ContentPack["quests"][number];

interface ResolvedPackTask {
  task: PackTask;
  localDate: string;
}

interface ResolvedPackTemplate {
  template: PackTemplate;
  startsOn: string;
  endsOn: string | null;
}

interface ResolvedPackQuest {
  quest: PackQuest;
  dueDate: string | null;
}

interface ContentPackPlan {
  preview: ContentPackPreview;
  attributeByCode: Map<string, string>;
  skillIdByKey: Map<string, string>;
  newSkills: PackSkill[];
  tasksToCreate: ResolvedPackTask[];
  templatesToCreate: ResolvedPackTemplate[];
  questsToCreate: ResolvedPackQuest[];
}

function emptyCounts(): ImportCounts {
  return { skills: 0, tasks: 0, taskTemplates: 0, quests: 0 };
}

function resolveTemplateDates(
  pack: ContentPack,
  template: PackTemplate,
  anchorDate: string,
): { startsOn: string; endsOn: string | null } {
  if (pack.formatVersion === 1) {
    return { startsOn: anchorDate, endsOn: null };
  }
  const relative = template as PackTemplateV2;
  return {
    startsOn: addDaysToDate(anchorDate, relative.startsInDays ?? 0),
    endsOn:
      relative.endsInDays === undefined
        ? null
        : addDaysToDate(anchorDate, relative.endsInDays),
  };
}

function resolveQuestDueDate(
  pack: ContentPack,
  quest: PackQuest,
  anchorDate: string,
): string | null {
  if (pack.formatVersion === 1) {
    return "dueDate" in quest ? (quest.dueDate ?? null) : null;
  }
  const relative = quest as PackQuestV2;
  return relative.dueInDays === undefined
    ? null
    : addDaysToDate(anchorDate, relative.dueInDays);
}

async function analyzeContentPack(
  userId: string,
  input: unknown,
  db: Database,
  options: ContentPackImportOptions,
): Promise<ContentPackPlan> {
  const parsed = contentPackSchema.safeParse(input);
  if (!parsed.success) {
    throw new DataImportError("invalid_format", "Неподдерживаемый формат контент-пака");
  }
  const pack: ContentPack = parsed.data;
  const selection = { ...ALL_CONTENT_PACK_SECTIONS, ...options.selection };
  const [attributes, existingSkills, existingTasks, existingTemplates, existingQuests, users] =
    await Promise.all([
      db.select().from(schema.attributes),
      db.select().from(schema.skills).where(eq(schema.skills.userId, userId)),
      db.select().from(schema.tasks).where(eq(schema.tasks.userId, userId)),
      db.select().from(schema.taskTemplates).where(eq(schema.taskTemplates.userId, userId)),
      db.select().from(schema.quests).where(eq(schema.quests.userId, userId)),
      db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1),
    ]);
  const anchorDate =
    options.anchorDate ?? getLocalDate(users[0]?.timezone ?? "UTC");
  const existingQuestIds = existingQuests.map((quest) => quest.id);
  const existingSteps =
    existingQuestIds.length > 0
      ? await db
          .select()
          .from(schema.questSteps)
          .where(inArray(schema.questSteps.questId, existingQuestIds))
      : [];

  const attributeByCode = new Map(attributes.map((row) => [row.code, row.id]));
  const skillByName = new Map(
    existingSkills
      .filter((row) => row.status === "active")
      .map((row) => [normalize(row.name), row]),
  );
  const taskByDateAndName = new Map(
    existingTasks.map((row) => [
      `${row.localDate}:${normalize(row.title)}`,
      row,
    ]),
  );
  const templateByName = new Map(
    existingTemplates
      .filter((row) => row.archivedAt === null)
      .map((row) => [normalize(row.title), row]),
  );
  const questByName = new Map(existingQuests.map((row) => [normalize(row.title), row]));
  const conflicts: string[] = [];
  const rejected = {
    skills: new Set<string>(),
    tasks: new Set<string>(),
    taskTemplates: new Set<string>(),
    quests: new Set<string>(),
  } satisfies Record<ContentPackSection, Set<string>>;
  function addConflict(
    section: ContentPackSection,
    key: string,
    message: string,
  ) {
    conflicts.push(message);
    rejected[section].add(key);
  }
  const skillIdByKey = new Map<string, string>();
  const newSkills: ContentPack["skills"] = [];
  let skippedSkills = 0;

  for (const [index, skill] of pack.skills.entries()) {
    const attributeId = attributeByCode.get(skill.attributeCode);
    const existing = skillByName.get(normalize(skill.name));
    if (!attributeId) {
      if (selection.skills) {
        addConflict(
          "skills",
          String(index),
          `Навык «${skill.name}»: неизвестная характеристика`,
        );
      }
    } else if (!existing) {
      if (selection.skills) newSkills.push(skill);
    } else if (
      existing.attributeId === attributeId &&
      nullable(existing.description) === nullable(skill.description) &&
      existing.icon === (skill.icon ?? null) &&
      existing.color === (skill.color ?? null) &&
      existing.status === "active"
    ) {
      skillIdByKey.set(skill.key, existing.id);
      if (selection.skills) skippedSkills += 1;
    } else if (selection.skills) {
      addConflict(
        "skills",
        String(index),
        `Навык «${skill.name}» уже существует с другими параметрами`,
      );
    }
  }
  const creatableSkillKeys = new Set(newSkills.map((skill) => skill.key));
  const hasResolvableSkill = (key: string) =>
    skillIdByKey.has(key) || creatableSkillKeys.has(key);

  const tasks = pack.formatVersion === 2 ? pack.tasks : [];
  const tasksToCreate: ResolvedPackTask[] = [];
  let skippedTasks = 0;
  const seenTaskKeys = new Set<string>();
  if (selection.tasks) {
    for (const [index, task] of tasks.entries()) {
      const localDate = addDaysToDate(anchorDate, task.scheduledInDays ?? 0);
      const key = `${localDate}:${normalize(task.title)}`;
      if (seenTaskKeys.has(key)) {
        addConflict(
          "tasks",
          String(index),
          `Задача «${task.title}» на ${localDate} повторяется в паке`,
        );
        continue;
      }
      seenTaskKeys.add(key);
      if (!hasResolvableSkill(task.skillKey)) {
        addConflict(
          "tasks",
          String(index),
          `Задача «${task.title}»: выберите импорт навыков или создайте связанный навык`,
        );
        continue;
      }
      const existing = taskByDateAndName.get(key);
      const skillId = skillIdByKey.get(task.skillKey);
      if (!existing) {
        tasksToCreate.push({ task, localDate });
      } else if (
        skillId &&
        existing.skillId === skillId &&
        existing.templateId === null &&
        existing.questStepId === null &&
        nullable(existing.description) === nullable(task.description) &&
        existing.baseXp === task.baseXp &&
        existing.difficulty === task.difficulty &&
        existing.priority === (task.priority ?? "normal") &&
        existing.estimatedMinutes === (task.estimatedMinutes ?? null)
      ) {
        skippedTasks += 1;
      } else {
        addConflict(
          "tasks",
          String(index),
          `Задача «${task.title}» на ${localDate} уже существует с другими параметрами`,
        );
      }
    }
  }

  const templatesToCreate: ResolvedPackTemplate[] = [];
  let skippedTemplates = 0;
  const seenTemplateNames = new Set<string>();
  if (selection.taskTemplates) {
    for (const [index, template] of pack.taskTemplates.entries()) {
      const name = normalize(template.title);
      if (seenTemplateNames.has(name)) {
        addConflict(
          "taskTemplates",
          String(index),
          `Шаблон «${template.title}» повторяется в паке`,
        );
        continue;
      }
      seenTemplateNames.add(name);
      if (!hasResolvableSkill(template.skillKey)) {
        addConflict(
          "taskTemplates",
          String(index),
          `Шаблон «${template.title}»: выберите импорт навыков или создайте связанный навык`,
        );
        continue;
      }
      const dates = resolveTemplateDates(pack, template, anchorDate);
      const existing = templateByName.get(name);
      if (!existing) {
        templatesToCreate.push({ template, ...dates });
        continue;
      }
      const skillId = skillIdByKey.get(template.skillKey);
      const sameDates =
        pack.formatVersion === 1 ||
        (existing.startsOn === dates.startsOn && existing.endsOn === dates.endsOn);
      if (
        skillId &&
        existing.skillId === skillId &&
        nullable(existing.description) === nullable(template.description) &&
        existing.baseXp === template.baseXp &&
        existing.difficulty === template.difficulty &&
        existing.priority === (template.priority ?? "normal") &&
        existing.recurrenceType === template.recurrenceType &&
        sameArray(existing.weekdays, template.weekdays) &&
        existing.estimatedMinutes === (template.estimatedMinutes ?? null) &&
        sameDates
      ) {
        skippedTemplates += 1;
      } else {
        addConflict(
          "taskTemplates",
          String(index),
          `Шаблон «${template.title}» уже существует с другими параметрами`,
        );
      }
    }
  }

  const questsToCreate: ResolvedPackQuest[] = [];
  let skippedQuests = 0;
  const seenQuestNames = new Set<string>();
  if (selection.quests) {
    for (const [index, quest] of pack.quests.entries()) {
      const name = normalize(quest.title);
      if (seenQuestNames.has(name)) {
        addConflict(
          "quests",
          String(index),
          `Квест «${quest.title}» повторяется в паке`,
        );
        continue;
      }
      seenQuestNames.add(name);
      const attributeId = quest.attributeCode
        ? attributeByCode.get(quest.attributeCode)
        : undefined;
      if (quest.attributeCode && !attributeId) {
        addConflict(
          "quests",
          String(index),
          `Квест «${quest.title}»: неизвестная характеристика`,
        );
        continue;
      }
      const dueDate = resolveQuestDueDate(pack, quest, anchorDate);
      const existing = questByName.get(name);
      if (!existing) {
        questsToCreate.push({ quest, dueDate });
        continue;
      }
      const steps = existingSteps
        .filter((step) => step.questId === existing.id)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      const sameSteps =
        steps.length === quest.steps.length &&
        steps.every((step, stepIndex) => {
          const desired = quest.steps[stepIndex];
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
        existing.dueDate === dueDate &&
        existing.manualCompletion === (quest.manualCompletion ?? true) &&
        existing.status === "active" &&
        sameSteps
      ) {
        skippedQuests += 1;
      } else {
        addConflict(
          "quests",
          String(index),
          `Квест «${quest.title}» уже существует с другими параметрами`,
        );
      }
    }
  }

  const created: ImportCounts = {
    skills: newSkills.length,
    tasks: tasksToCreate.length,
    taskTemplates: templatesToCreate.length,
    quests: questsToCreate.length,
  };
  const skipped: ImportCounts = {
    skills: skippedSkills,
    tasks: skippedTasks,
    taskTemplates: skippedTemplates,
    quests: skippedQuests,
  };
  const rejectedCounts = emptyCounts();
  for (const section of Object.keys(rejected) as ContentPackSection[]) {
    rejectedCounts[section] = rejected[section].size;
  }

  return {
    preview: {
      formatVersion: pack.formatVersion,
      name: pack.name,
      anchorDate,
      selection,
      summary: { created, skipped, rejected: rejectedCounts },
      conflicts,
    },
    attributeByCode,
    skillIdByKey,
    newSkills,
    tasksToCreate,
    templatesToCreate,
    questsToCreate,
  };
}

export async function previewContentPack(
  userId: string,
  input: unknown,
  options: ContentPackImportOptions = {},
  db: Database = getDb(),
): Promise<ContentPackPreview> {
  return (await analyzeContentPack(userId, input, db, options)).preview;
}

export async function importContentPack(
  userId: string,
  input: unknown,
  db: Database = getDb(),
  options: ContentPackImportOptions = {},
): Promise<ImportSummary> {
  const plan = await analyzeContentPack(userId, input, db, options);
  if (plan.preview.conflicts.length > 0) {
    throw new DataImportError(
      "conflict",
      "Контент-пак содержит конфликты",
      plan.preview.conflicts,
    );
  }

  await db.transaction(async (tx) => {
    for (const skill of plan.newSkills) {
      const [created] = await tx
        .insert(schema.skills)
        .values({
          userId,
          attributeId: plan.attributeByCode.get(skill.attributeCode)!,
          name: skill.name,
          description: skill.description ?? null,
          icon: skill.icon ?? null,
          color: skill.color ?? null,
        })
        .returning({ id: schema.skills.id });
      plan.skillIdByKey.set(skill.key, created.id);
    }
    for (const { task, localDate } of plan.tasksToCreate) {
      await tx.insert(schema.tasks).values({
        userId,
        skillId: plan.skillIdByKey.get(task.skillKey)!,
        title: task.title,
        description: task.description ?? null,
        localDate,
        baseXp: task.baseXp,
        difficulty: task.difficulty,
        priority: task.priority ?? "normal",
        estimatedMinutes: task.estimatedMinutes ?? null,
      });
    }
    for (const { template, startsOn, endsOn } of plan.templatesToCreate) {
      await tx.insert(schema.taskTemplates).values({
        userId,
        skillId: plan.skillIdByKey.get(template.skillKey)!,
        title: template.title,
        description: template.description ?? null,
        baseXp: template.baseXp,
        difficulty: template.difficulty,
        priority: template.priority ?? "normal",
        recurrenceType: template.recurrenceType,
        weekdays: template.recurrenceType === "weekdays" ? template.weekdays : null,
        estimatedMinutes: template.estimatedMinutes ?? null,
        startsOn,
        endsOn,
      });
    }
    for (const { quest, dueDate } of plan.questsToCreate) {
      const [created] = await tx
        .insert(schema.quests)
        .values({
          userId,
          attributeId: quest.attributeCode
            ? plan.attributeByCode.get(quest.attributeCode)
            : null,
          title: quest.title,
          description: quest.description ?? null,
          type: quest.type,
          status: "active",
          rewardXp: quest.rewardXp,
          dueDate,
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
    created: plan.preview.summary.created,
    skipped: plan.preview.summary.skipped,
  };
}
