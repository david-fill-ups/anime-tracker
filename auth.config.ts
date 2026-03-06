import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

// Edge-compatible auth config — no Prisma/DB imports allowed here.
// Used by proxy.ts (Edge runtime) for session verification.
export const authConfig = {
  providers: [Google],
  pages: { signIn: "/login" },
  session: { strategy: "jwt" as const },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      if (auth?.user) return true;
      // Return 401 JSON for unauthenticated API requests
      if (
        nextUrl.pathname.startsWith("/api/") &&
        !nextUrl.pathname.startsWith("/api/auth")
      ) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
      return Response.redirect(new URL("/login", nextUrl)); // redirect without callbackUrl
    },
    jwt({ token, user }) {
      if (user?.id) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id as string;
      return session;
    },
  },
} satisfies NextAuthConfig;
