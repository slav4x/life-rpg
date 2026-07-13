import { GameError } from "@/application/game/errors";
import { getDb } from "@/db/client";
import { updateUser } from "@/db/repositories/users";
import { isValidTimeZone } from "@/lib/dates/local-date";

export interface UpdateProfileCommand {
  theme?: string;
  timezone?: string;
}

export async function updateUserProfile(
  userId: string,
  cmd: UpdateProfileCommand,
): Promise<void> {
  if (cmd.timezone && !isValidTimeZone(cmd.timezone)) {
    throw new GameError("invalid_input", "Invalid timezone");
  }
  await updateUser(getDb(), userId, {
    theme: cmd.theme,
    timezone: cmd.timezone,
  });
}
