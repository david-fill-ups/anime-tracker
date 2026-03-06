import SidebarShell from "@/components/SidebarShell";
import type { Session } from "next-auth";

export default function Nav({ user }: { user: Session["user"] }) {
  return <SidebarShell user={user} />;
}
