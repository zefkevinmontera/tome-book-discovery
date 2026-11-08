import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AmbientParticles from "@/app/components/AmbientParticles";
import CursorSpotlight from "@/app/components/CursorSpotlight";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tome | Discover your next journey",
  description: "A magical library for discovering and binding your next favorite book.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}

        {/*
          Layering: the particle canvas is z-[-1], the same layer as each page's
          hero image. Equal z-index falls back to DOM order, so it must come AFTER
          {children} to paint above the hero image and still below all content.
          The html element (#130d08) is the dark base underneath.
        */}
        <AmbientParticles />
        <CursorSpotlight />
      </body>
    </html>
  );
}
