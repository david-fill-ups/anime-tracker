import { auth } from "@/auth";

/**
 * Returns the authenticated userId from the session.
 * Throws a 401 Response if not authenticated — Next.js App Router
 * route handlers propagate thrown Response objects as HTTP responses.
 */
export async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) {
    throw Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return session.user.id;
}
