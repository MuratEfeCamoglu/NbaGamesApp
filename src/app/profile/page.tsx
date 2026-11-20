import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { ProfileView } from "./profile-view";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.meta.profileTitle, description: t.meta.profileDescription };
}

export default function ProfilePage() {
  return (
    <section className="screen" aria-labelledby="profile-title">
      <div className="container">
        <ProfileView />
      </div>
    </section>
  );
}
