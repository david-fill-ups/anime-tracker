import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";
import { authConfig } from "./auth.config";

// Full auth config — includes Prisma adapter for user/account persistence.
// NOT safe to import in Edge runtime (proxy.ts). Use authConfig there instead.
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db),
});
