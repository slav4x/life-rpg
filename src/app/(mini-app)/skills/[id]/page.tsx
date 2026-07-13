import { notFound } from "next/navigation";

import { getAuthenticatedUser } from "@/application/auth/session";
import { GameError } from "@/application/game/errors";
import { getSkillDetail } from "@/application/skills/skill-detail";
import { SkillDetailView } from "@/components/skills/skill-detail-view";

export default async function SkillPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const user = await getAuthenticatedUser();
  if (!user) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Откройте приложение в Telegram, чтобы увидеть навык.
      </p>
    );
  }

  let detail;
  try {
    detail = await getSkillDetail(user.id, id);
  } catch (error) {
    if (error instanceof GameError) notFound();
    throw error;
  }

  return <SkillDetailView detail={detail} />;
}
