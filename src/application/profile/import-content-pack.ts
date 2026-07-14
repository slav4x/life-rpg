import { eq, inArray } from "drizzle-orm";

import { getDb, type Database } from "@/db/client";
import * as schema from "@/db/schema";
import {
  DataImportError,
  type ContentPackImportOptions,
  type ContentPackPreview,
  type ContentPackSection,
  type ContentPackSelection,
  type ImportCounts,
  type ImportSummary,
} from "@/lib/import/contracts";
import {
  contentPackSchema,
  type ContentPack,
  type PackQuestV2,
  type PackTask,
  type PackTemplateV2,
} from "@/lib/validation/import-data";
import { addDaysToDate, getLocalDate } from "@/lib/dates/local-date";

const ALL_CONTENT_PACK_SECTIONS: ContentPackSelection = {
  skills: true,
  tasks: true,
  taskTemplates: true,
  quests: true,
};

const normalize = (value: string) => value.trim().toLocaleLowerCase("ru-RU");
const nullable = (value?: string | null) => value?.trim() || null;

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

