import { notFound } from "next/navigation";

import { getAuthenticatedUser } from "@/application/auth/session";
import { GameError } from "@/application/game/errors";
import { getUserQuest } from "@/application/quests/manage-quests";
import { QuestDetail } from "@/components/quests/quest-detail";
import type { StepVM } from "@/components/quests/types";

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
  try {
    ({ quest, steps } = await getUserQuest(user.id, id));
  } catch (error) {
    if (error instanceof GameError) notFound();
    throw error;
  }

  const stepVMs: StepVM[] = steps.map((s) => ({
    id: s.id,
    title: s.title,
    description: s.description,
    isRequired: s.isRequired,
    completed: s.completedAt !== null,
  }));

  return (
    <QuestDetail
      quest={{
        id: quest.id,
        title: quest.title,
        description: quest.description,
        type: quest.type,
        status: quest.status,
        rewardXp: quest.rewardXp,
      }}
      steps={stepVMs}
    />
  );
}
