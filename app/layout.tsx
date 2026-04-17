import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import { SpotlightProvider } from "@/components/SpotlightContext";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Toaster } from "sonner";
import SuppressExtensionHydration from "@/components/SuppressExtensionHydration";

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
          <SuppressExtensionHydration />
          {children}
        </body>
      </html>
    );
  }

  const recentLink = await db.link.findFirst({
    where: {
      userId: session.user.id,
      userEntry: { is: { watchStatus: "COMPLETED" } },
      linkedAnime: { some: { order: 0, anime: { coverImageUrl: { not: null } } } },
    },
    orderBy: { userEntry: { completedAt: "desc" } },
    select: {
      userEntry: { select: { score: true } },
      linkedAnime: {
        where: { order: 0 },
        take: 1,
        select: { anime: { select: { titleEnglish: true, titleRomaji: true, coverImageUrl: true } } },
      },
    },
  });

  const recentAnimeData = recentLink?.linkedAnime[0]?.anime ?? null;
  const recentAnime = recentAnimeData
    ? {
        coverImageUrl: recentAnimeData.coverImageUrl!,
        title: recentAnimeData.titleEnglish ?? recentAnimeData.titleRomaji,
        score: recentLink?.userEntry?.score ?? null,
      }
    : null;

  return (
    <html lang="en" className="dark">
      <body className={`${geist.variable} font-sans bg-slate-950 text-slate-100 antialiased`}>
        <SuppressExtensionHydration />
        <SpotlightProvider initial={recentAnime}>
          <div className="flex min-h-screen">
            <Nav user={session.user} />
            <main className="flex-1 lg:ml-56 p-4 pt-14 lg:p-8">{children}</main>
          </div>
        </SpotlightProvider>
        <Toaster theme="dark" position="bottom-right" />
      </body>
    </html>
  );
}
