"use client";

import { useState } from "react";

import { ProfileDataSettings } from "./profile-data-settings";
import { ProfilePreferences } from "./profile-preferences";
import { ProfileSession } from "./profile-session";

export function ProfileSettings({ timezone }: { timezone: string }) {
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex flex-col gap-5">
      <ProfilePreferences timezone={timezone} busy={busy} setBusy={setBusy} />
      <ProfileDataSettings busy={busy} setBusy={setBusy} />
      <ProfileSession busy={busy} setBusy={setBusy} />
    </div>
  );
}
