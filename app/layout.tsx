import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

export const metadata: Metadata = {
  title: "Anime Tracker",
  description: "Personal anime tracking",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className={`${geist.variable} font-sans bg-slate-950 text-slate-100 antialiased`}>
        <div className="flex min-h-screen">
          <Nav />
          <main className="flex-1 ml-56 p-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
