import { getAuthenticatedUser } from "@/application/auth/session";
import {
  getArchivedSkillsOverview,
  getSkillsOverview,
} from "@/application/skills/skills-overview";
import { SkillsScreen } from "@/components/skills/skills-screen";

export default async function SkillsPage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Откройте приложение в Telegram, чтобы увидеть навыки.
      </p>
    );
  }

  const [groups, archived] = await Promise.all([
    getSkillsOverview(user.id),
    getArchivedSkillsOverview(user.id),
  ]);
  return <SkillsScreen groups={groups} archived={archived} />;
}
