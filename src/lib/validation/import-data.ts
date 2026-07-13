import { z } from "zod";

import {
  SKILL_COLORS,
  SKILL_ICONS,
} from "@/domain/game/constants";

import { isoDateSchema } from "./common";

const uuid = z.uuid();
const timestamp = z.coerce.date();
const nullableTimestamp = timestamp.nullable();
const attributeCode = z.enum([
  "body",
  "mind",
  "resources",
  "social",
  "discipline",
  "creation",
]);
const difficulty = z.enum(["easy", "normal", "hard", "epic"]);
const recurrenceType = z.enum(["daily", "weekdays"]);
const questType = z.enum(["main", "side", "long_term"]);

const skillRow = z.object({
  id: uuid,
  userId: uuid,
  attributeId: uuid,
  name: z.string().min(1).max(80),
  description: z.string().max(1000).nullable(),
  icon: z.string().nullable(),
  color: z.string().nullable(),
  status: z.string(),
  createdAt: timestamp,
  updatedAt: timestamp,
  archivedAt: nullableTimestamp,
});

const templateRow = z.object({
  id: uuid,
  userId: uuid,
  skillId: uuid,
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable(),
  baseXp: z.number().int(),
  difficulty: z.string(),
  recurrenceType: z.string(),
  weekdays: z.array(z.number().int()).nullable(),
  estimatedMinutes: z.number().int().min(1).max(1440).nullable().default(null),
  startsOn: isoDateSchema.default("1970-01-01"),
  endsOn: isoDateSchema.nullable().default(null),
  isActive: z.boolean(),
  createdAt: timestamp,
  updatedAt: timestamp,
  archivedAt: nullableTimestamp,
});

const taskRow = z.object({
  id: uuid,
  userId: uuid,
  templateId: uuid.nullable(),
  questStepId: uuid.nullable(),
  skillId: uuid,
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable(),
  localDate: isoDateSchema,
  baseXp: z.number().int(),
  difficulty: z.string(),
  status: z.string(),
  estimatedMinutes: z.number().int().nullable(),
  createdAt: timestamp,
  updatedAt: timestamp,
});

const completionRow = z.object({
  id: uuid,
  userId: uuid,
  taskId: uuid,
  idempotencyKey: z.string(),
  completedAt: timestamp,
  localDate: isoDateSchema,
  finalXp: z.number().int(),
  revertedAt: nullableTimestamp,
  createdAt: timestamp,
});

const xpRow = z.object({
  id: uuid,
  userId: uuid,
  amount: z.number().int(),
  scope: z.string(),
  sourceType: z.string(),
  sourceId: uuid,
  attributeId: uuid.nullable(),
  skillId: uuid.nullable(),
  baseXp: z.number().int(),
  multiplier: z.union([z.string(), z.number()]).transform(String),
  reversalOfId: uuid.nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: timestamp,
});

const questRow = z.object({
  id: uuid,
  userId: uuid,
  attributeId: uuid.nullable(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable(),
  type: z.string(),
  status: z.string(),
  rewardXp: z.number().int(),
  dueDate: isoDateSchema.nullable(),
  manualCompletion: z.boolean(),
  completedAt: nullableTimestamp,
  createdAt: timestamp,
  updatedAt: timestamp,
});

const questStepRow = z.object({
  id: uuid,
  questId: uuid,
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable(),
  isRequired: z.boolean(),
  sortOrder: z.number().int(),
  completedAt: nullableTimestamp,
  createdAt: timestamp,
  updatedAt: timestamp,
});

const questCompletionRow = z.object({
  id: uuid,
  userId: uuid,
  questId: uuid,
  rewardXp: z.number().int().min(0),
  completedAt: timestamp,
  revertedAt: nullableTimestamp,
  createdAt: timestamp,
});

const streakRow = z.object({
  id: uuid,
  userId: uuid,
  templateId: uuid,
  currentCount: z.number().int(),
  bestCount: z.number().int(),
  lastCompletedDate: isoDateSchema.nullable(),
  updatedAt: timestamp,
});

export const backupImportSchema = z.object({
  format: z.literal("life-rpg-export"),
  formatVersion: z.literal(1),
  exportedAt: z.string(),
  user: z
    .object({
      timezone: z.string().min(1).max(64),
      theme: z.enum(["light", "dark", "system"]),
    })
    .passthrough()
    .nullable(),
  attributes: z.array(z.object({ id: uuid, code: attributeCode })),
  achievementCatalog: z.array(z.object({ id: uuid, code: z.string() })),
  skills: z.array(skillRow).max(1000),
  userSkills: z.array(
    z.object({ userId: uuid, skillId: uuid, xp: z.number().int(), updatedAt: timestamp }),
  ),
  userAttributes: z.array(
    z.object({ userId: uuid, attributeId: uuid, xp: z.number().int(), updatedAt: timestamp }),
  ),
  taskTemplates: z.array(templateRow).max(5000),
  tasks: z.array(taskRow).max(50000),
  taskCompletions: z.array(completionRow).max(50000),
  xpTransactions: z.array(xpRow).max(150000),
  quests: z.array(questRow).max(5000),
  questCompletions: z.array(questCompletionRow).max(50000).default([]),
  questSteps: z.array(questStepRow).max(50000),
  streaks: z.array(streakRow).max(5000),
  userAchievements: z.array(
    z.object({
      userId: uuid,
      achievementId: uuid,
      unlockedAt: timestamp,
      sourceId: uuid.nullable(),
    }),
  ),
});

const packSkill = z.object({
  key: z.string().min(1).max(80).regex(/^[a-z0-9_-]+$/i),
  name: z.string().min(1).max(80),
  attributeCode,
  description: z.string().max(1000).optional(),
  icon: z.enum(SKILL_ICONS).optional(),
  color: z.enum(SKILL_COLORS).optional(),
});

const packTemplate = z
  .object({
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    skillKey: z.string().min(1).max(80),
    baseXp: z.number().int().min(5).max(250),
    difficulty,
    recurrenceType,
    weekdays: z.array(z.number().int().min(1).max(7)).min(1).max(7).optional(),
    estimatedMinutes: z.number().int().min(1).max(1440).optional(),
  })
  .refine(
    (value) => value.recurrenceType !== "weekdays" || Boolean(value.weekdays),
    { path: ["weekdays"], message: "weekdays are required" },
  );

const packQuest = z
  .object({
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    type: questType,
    attributeCode: attributeCode.optional(),
    rewardXp: z.number().int().min(0).max(10000),
    dueDate: isoDateSchema.optional(),
    manualCompletion: z.boolean().optional(),
    steps: z
      .array(
        z.object({
          title: z.string().min(1).max(200),
          description: z.string().max(2000).optional(),
          isRequired: z.boolean().optional(),
        }),
      )
      .min(1)
      .max(30),
  })
  .refine((quest) => quest.steps.some((step) => step.isRequired !== false), {
    path: ["steps"],
    message: "at least one required step is needed",
  });

export const contentPackSchema = z
  .object({
    format: z.literal("life-rpg-content-pack"),
    formatVersion: z.literal(1),
    name: z.string().min(1).max(200),
    skills: z.array(packSkill).max(100),
    taskTemplates: z.array(packTemplate).max(500),
    quests: z.array(packQuest).max(200),
  })
  .superRefine((pack, context) => {
    const keys = new Set<string>();
    const names = new Set<string>();
    for (const [index, skill] of pack.skills.entries()) {
      const name = skill.name.trim().toLocaleLowerCase("ru-RU");
      if (keys.has(skill.key)) {
        context.addIssue({
          code: "custom",
          path: ["skills", index, "key"],
          message: "duplicate skill key",
        });
      }
      if (names.has(name)) {
        context.addIssue({
          code: "custom",
          path: ["skills", index, "name"],
          message: "duplicate skill name",
        });
      }
      keys.add(skill.key);
      names.add(name);
    }
    for (const [index, template] of pack.taskTemplates.entries()) {
      if (!keys.has(template.skillKey)) {
        context.addIssue({
          code: "custom",
          path: ["taskTemplates", index, "skillKey"],
          message: "unknown skill key",
        });
      }
    }
  });

export type BackupImport = z.infer<typeof backupImportSchema>;
export type ContentPack = z.infer<typeof contentPackSchema>;
