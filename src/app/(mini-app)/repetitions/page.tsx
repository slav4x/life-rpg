import { getAuthenticatedUser } from "@/application/auth/session";
import { getRepetitionsData } from "@/application/templates/get-repetitions";
import { RepetitionsScreen } from "@/components/profile/repetitions-screen";

export default async function RepetitionsPage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Откройте приложение в Telegram, чтобы управлять повторениями.
      </p>
    );
  }

  const data = await getRepetitionsData(user.id);

  return <RepetitionsScreen templates={data.templates} skills={data.skills} />;
}
