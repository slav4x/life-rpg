import { getAuthenticatedUser } from "@/application/auth/session";
import {
  listQuestAttributes,
  listUserQuestsWithProgress,
} from "@/application/quests/manage-quests";
import { QuestsScreen } from "@/components/quests/quests-screen";
import type { QuestVM } from "@/components/quests/types";
import { getLocalDate } from "@/lib/dates/local-date";

export default async function QuestsPage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Откройте приложение в Telegram, чтобы увидеть квесты.
      </p>
    );
  }

  const [items, attributes] = await Promise.all([
    listUserQuestsWithProgress(user.id),
    listQuestAttributes(),
  ]);
  const quests: QuestVM[] = items.map(
    ({ quest, total, completed, requiredTotal, requiredCompleted, attribute }) => ({
    id: quest.id,
    title: quest.title,
    type: quest.type,
    status: quest.status,
    rewardXp: quest.rewardXp,
    total,
    completed,
    requiredTotal,
    requiredCompleted,
    percent:
      requiredTotal === 0
        ? total === 0
          ? 0
          : Math.round((completed / total) * 100)
        : Math.round((requiredCompleted / requiredTotal) * 100),
    attributeName: attribute?.name ?? null,
    dueDate: quest.dueDate,
    completedAt: quest.completedAt?.toISOString() ?? null,
  }),
  );

  return (
    <QuestsScreen
      quests={quests}
      today={getLocalDate(user.timezone)}
      attributes={attributes.map((attribute) => ({
        id: attribute.id,
        name: attribute.name,
      }))}
    />
  );
}
