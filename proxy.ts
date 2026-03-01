import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Only imports edge-compatible authConfig (no Prisma/node:path).
// Session is verified via JWT cookie using AUTH_SECRET.
const { auth } = NextAuth(authConfig);
export default auth;

export const config = {
  matcher: ["/((?!api/auth|login|_next/static|_next/image|favicon.ico).*)"],
};
