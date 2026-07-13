import { getAuthenticatedUser } from "@/application/auth/session";
import { getSkillsOverview } from "@/application/skills/skills-overview";
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

  const groups = await getSkillsOverview(user.id);
  return <SkillsScreen groups={groups} />;
}
