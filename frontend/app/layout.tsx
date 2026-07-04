import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

// Display face for English headings — dashboard, labels, UI chrome.
const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "700", "800"],
});

export const metadata: Metadata = {
  title: "People's Priorities — Constituency Development",
  description:
    "Submit development needs in your language. Every voice becomes evidence.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/*
          Noto Sans + per-script Noto families loaded directly (not via
          next/font) because next/font/google can't bundle multiple Indic
          script families under one variable cleanly. This link covers
          Devanagari (Hindi/Marathi), Tamil, Telugu, Bengali, Kannada —
          the raw + translated text on both surfaces render correctly
          regardless of which language a citizen submitted in.
        */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700&family=Noto+Sans+Devanagari:wght@400;500;600&family=Noto+Sans+Tamil:wght@400;500;600&family=Noto+Sans+Telugu:wght@400;500;600&family=Noto+Sans+Bengali:wght@400;500;600&family=Noto+Sans+Kannada:wght@400;500;600&display=swap"
        />
      </head>
      <body className={`${manrope.variable} font-body bg-paper text-ink-900`}>
        {children}
      </body>
    </html>
  );
}
