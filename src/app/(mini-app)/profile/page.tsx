import { getAuthenticatedUser } from "@/application/auth/session";
import { getProfileData } from "@/application/profile/get-profile";
import { ProfileScreen } from "@/components/profile/profile-screen";

export default async function ProfilePage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Откройте приложение в Telegram, чтобы увидеть профиль.
      </p>
    );
  }

  const data = await getProfileData(user.id);
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ");

  return (
    <ProfileScreen
      name={name}
      photoUrl={user.photoUrl}
      username={user.telegramUsername}
      timezone={user.timezone}
      data={data}
    />
  );
}
