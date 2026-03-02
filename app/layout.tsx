import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import { auth } from "@/auth";
import { db } from "@/lib/db";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

export const metadata: Metadata = {
  title: "Anime Tracker",
  description: "Personal anime tracking",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();

  // Minimal shell for unauthenticated pages (login)
  if (!session) {
    return (
      <html lang="en" className="dark">
        <body className={`${geist.variable} font-sans bg-slate-950 text-slate-100 antialiased`}>
          {children}
        </body>
      </html>
    );
  }

  const recentEntry = await db.userEntry.findFirst({
    where: {
      userId: session.user.id,
      watchStatus: "COMPLETED",
      anime: { coverImageUrl: { not: null } },
    },
    orderBy: { completedAt: "desc" },
    select: {
      score: true,
      anime: {
        select: { titleEnglish: true, titleRomaji: true, coverImageUrl: true },
      },
    },
  });

  const recentAnime = recentEntry
    ? {
        coverImageUrl: recentEntry.anime.coverImageUrl!,
        title: recentEntry.anime.titleEnglish ?? recentEntry.anime.titleRomaji,
        score: recentEntry.score ?? null,
      }
    : null;

  return (
    <html lang="en" className="dark">
      <body className={`${geist.variable} font-sans bg-slate-950 text-slate-100 antialiased`}>
        <div className="flex min-h-screen">
          <Nav user={session.user} recentAnime={recentAnime} />
          <main className="flex-1 ml-56 p-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
