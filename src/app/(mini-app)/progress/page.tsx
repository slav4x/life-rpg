import { getAuthenticatedUser } from "@/application/auth/session";
import {
  getProgressData,
  isProgressPeriod,
} from "@/application/progress/get-progress";
import { ProgressScreen } from "@/components/progress/progress-screen";

export default async function ProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Откройте приложение в Telegram, чтобы увидеть прогресс.
      </p>
    );
  }

  const { period: raw } = await searchParams;
  const period = raw && isProgressPeriod(raw) ? raw : "7d";
  const data = await getProgressData(user.id, period, user.timezone);

  return <ProgressScreen data={data} />;
}
