import type { Metadata } from "next";
import { ProfileView } from "./profile-view";

export const metadata: Metadata = {
  title: "Profile",
  description: "Your points, streaks, badges and game history.",
};

export default function ProfilePage() {
  return (
    <section className="screen" aria-labelledby="profile-title">
      <div className="container">
        <ProfileView />
      </div>
    </section>
  );
}
