import { getDb, type DbClient } from "@/db/client";
import { listSkills } from "@/db/repositories/skills";
import { listTemplates } from "@/db/repositories/task-templates";

export interface RepetitionTemplate {
  id: string;
  title: string;
  skillId: string;
  baseXp: number;
  difficulty: string;
  priority: string;
  description: string | null;
  recurrenceType: string;
  weekdays: number[] | null;
  estimatedMinutes: number | null;
  startsOn: string;
  endsOn: string | null;
  isActive: boolean;
  archived: boolean;
  skillName: string;
  skillArchived: boolean;
}

export interface RepetitionSkillOption {
  id: string;
  name: string;
}

export interface RepetitionsData {
  templates: RepetitionTemplate[];
  skills: RepetitionSkillOption[];
}

export async function getRepetitionsData(
  userId: string,
  db: DbClient = getDb(),
): Promise<RepetitionsData> {
  const [templates, allSkills] = await Promise.all([
    listTemplates(db, userId),
    listSkills(db, userId),
  ]);
  const skillsById = new Map(allSkills.map((skill) => [skill.id, skill]));

  return {
    templates: templates.map((template) => {
      const skill = skillsById.get(template.skillId);
      return {
        id: template.id,
        title: template.title,
        skillId: template.skillId,
        baseXp: template.baseXp,
        difficulty: template.difficulty,
        priority: template.priority,
        description: template.description,
        recurrenceType: template.recurrenceType,
        weekdays: template.weekdays,
        estimatedMinutes: template.estimatedMinutes,
        startsOn: template.startsOn,
        endsOn: template.endsOn,
        isActive: template.isActive,
        archived: template.archivedAt !== null,
        skillName: skill?.name ?? "Удалённый навык",
        skillArchived: skill?.status !== "active",
      };
    }),
    skills: allSkills
      .filter((skill) => skill.status === "active")
      .map((skill) => ({ id: skill.id, name: skill.name })),
  };
}
