import { GameError } from "@/application/game/errors";
import { getDb } from "@/db/client";
import { listAttributes } from "@/db/repositories/attributes";
import { getSkillById } from "@/db/repositories/skills";
import { listRecentTasksBySkill } from "@/db/repositories/tasks";
import {
  getUserSkillXp,
  hasSkillXpHistory,
  listSkillTransactions,
} from "@/db/repositories/xp";
import { levelProgress, type LevelProgress } from "@/domain/game/calculate-level";

export interface SkillHistoryEntry {
  amount: number;
  createdAt: string;
}

export interface SkillTaskEntry {
  id: string;
  title: string;
  status: string;
  localDate: string;
}

export interface SkillDetail {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  attributeCode: string;
  attributeName: string;
  canChangeAttribute: boolean;
  xp: number;
  level: LevelProgress;
  history: SkillHistoryEntry[];
  recentTasks: SkillTaskEntry[];
}

export async function getSkillDetail(
  userId: string,
  skillId: string,
): Promise<SkillDetail> {
  const db = getDb();
  const skill = await getSkillById(db, userId, skillId);
  if (!skill) throw new GameError("skill_not_found", "Skill not found");

  const [attrs, xp, transactions, tasks, hasXpHistory] = await Promise.all([
    listAttributes(db),
    getUserSkillXp(db, userId, skillId),
    listSkillTransactions(db, userId, skillId, 20),
    listRecentTasksBySkill(db, userId, skillId, 10),
    hasSkillXpHistory(db, userId, skillId),
  ]);

  const attribute = attrs.find((a) => a.id === skill.attributeId);

  return {
    id: skill.id,
    name: skill.name,
    description: skill.description,
    icon: skill.icon,
    color: skill.color,
    attributeCode: attribute?.code ?? "body",
    attributeName: attribute?.name ?? "",
    canChangeAttribute: !hasXpHistory,
    xp,
    level: levelProgress(xp),
    history: transactions.map((t) => ({
      amount: t.amount,
      createdAt: t.createdAt.toISOString(),
    })),
    recentTasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      localDate: t.localDate,
    })),
  };
}
