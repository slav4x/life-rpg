import { toast } from "sonner";

export interface UnlockedAchievementVM {
  code: string;
  name: string;
  icon: string | null;
}

/** Show a toast for each newly unlocked achievement (SPEC §5.8). */
export function showAchievementToasts(unlocked: UnlockedAchievementVM[]): void {
  for (const achievement of unlocked) {
    toast(`${achievement.icon ?? "🏅"} ${achievement.name}`, {
      description: "Достижение получено",
    });
  }
}
