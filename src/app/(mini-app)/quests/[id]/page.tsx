import { notFound } from "next/navigation";

import { getAuthenticatedUser } from "@/application/auth/session";
import { GameError } from "@/application/game/errors";
import {
  getUserQuest,
  listQuestAttributes,
} from "@/application/quests/manage-quests";
import { QuestDetail } from "@/components/quests/quest-detail";
import type { StepVM } from "@/components/quests/types";
import { listActiveSkills } from "@/db/repositories/skills";
import { getDb } from "@/db/client";
import { getLocalDate } from "@/lib/dates/local-date";

export default async function QuestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const user = await getAuthenticatedUser();
  if (!user) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Откройте приложение в Telegram, чтобы увидеть квест.
      </p>
    );
  }

  let quest;
  let steps;
  let taskLinks;
  try {
    ({ quest, steps, taskLinks } = await getUserQuest(user.id, id));
  } catch (error) {
    if (error instanceof GameError) notFound();
    throw error;
  }

  const [attributes, skills] = await Promise.all([
    listQuestAttributes(),
    listActiveSkills(getDb(), user.id),
  ]);
  const attribute = attributes.find((item) => item.id === quest.attributeId);
  const taskByStepId = new Map(taskLinks.map((task) => [task.stepId, task]));

  const stepVMs: StepVM[] = steps.map((s) => {
    const task = taskByStepId.get(s.id);
    return {
      id: s.id,
      title: s.title,
      description: s.description,
      isRequired: s.isRequired,
      completed: s.completedAt !== null,
      task: task
        ? { id: task.taskId, status: task.status, localDate: task.localDate }
        : null,
    };
  });

  return (
    <QuestDetail
      quest={{
        id: quest.id,
        title: quest.title,
        description: quest.description,
        type: quest.type,
        status: quest.status,
        rewardXp: quest.rewardXp,
        attributeId: quest.attributeId,
        attributeName: attribute?.name ?? null,
        dueDate: quest.dueDate,
        manualCompletion: quest.manualCompletion,
      }}
      steps={stepVMs}
      attributes={attributes.map((item) => ({ id: item.id, name: item.name }))}
      skills={skills.map((skill) => ({
        id: skill.id,
        name: skill.name,
        attributeId: skill.attributeId,
      }))}
      today={getLocalDate(user.timezone)}
    />
  );
}
