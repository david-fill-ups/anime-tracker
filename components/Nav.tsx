import SidebarShell from "@/components/SidebarShell";
import type { Session } from "next-auth";

type RecentAnime = { coverImageUrl: string; title: string; score: number | null };

type Props = {
  user: Session["user"];
  recentAnime: RecentAnime | null;
};

export default function Nav({ user, recentAnime }: Props) {
  return <SidebarShell user={user} initial={recentAnime} />;
}
