import type { Metadata } from "next";
import { Work_Sans, Space_Mono, Playfair_Display } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { MODELS } from "@/lib/models";
import { faviconMetadata } from "../lib/favicon.mjs";
import "./globals.css";

const workSans = Work_Sans({
  variable: "--font-work-sans",
  subsets: ["latin"],
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const playfairDisplay = Playfair_Display({
  variable: "--font-playfair-display",
  subsets: ["latin"],
});

const title = "Agentic Coding Arena by Logic";
const description = `A coding benchmark for engineers and practitioners. Compare ${MODELS.length} AI models on identical tasks, with unedited implementations, generation time, token usage, and cost.`;

export const metadata: Metadata = {
  metadataBase: new URL("https://arena.logic.inc"),
  title,
  description,
  ...faviconMetadata,
  openGraph: {
    title,
    description,
    type: "website",
    url: "https://arena.logic.inc",
    siteName: "Logic's Agentic Coding Arena",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${workSans.variable} ${spaceMono.variable} ${playfairDisplay.variable} antialiased`}
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}
