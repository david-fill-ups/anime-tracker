import { auth } from "@/auth";
import { redirect } from "next/navigation";
import ApiDocsViewer from "@/components/ApiDocsViewer";

export default async function DocsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return <ApiDocsViewer />;
}
