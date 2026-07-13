import { getAuthenticatedUser } from "@/application/auth/session";
import { listUserQuestsWithProgress } from "@/application/quests/manage-quests";
import { QuestsScreen } from "@/components/quests/quests-screen";
import type { QuestVM } from "@/components/quests/types";

export default async function QuestsPage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Откройте приложение в Telegram, чтобы увидеть квесты.
      </p>
    );
  }

  const items = await listUserQuestsWithProgress(user.id);
  const quests: QuestVM[] = items.map(({ quest, total, completed }) => ({
    id: quest.id,
    title: quest.title,
    type: quest.type,
    status: quest.status,
    rewardXp: quest.rewardXp,
    total,
    completed,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
  }));

  return <QuestsScreen quests={quests} />;
}
