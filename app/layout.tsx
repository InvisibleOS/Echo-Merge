import type { Metadata } from "next";
import FloatingNav from "@/components/ui/FloatingNav";
import "./globals.css";

// Display face for English headings — dashboard, labels, UI chrome.
// Bypassed next/font/google to prevent sandboxed build network failures.
const manrope = {
  variable: "font-sans",
};

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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700&family=Noto+Sans+Devanagari:wght@400;500;600&family=Noto+Sans+Tamil:wght@400;500;600&family=Noto+Sans+Telugu:wght@400;500;600&family=Noto+Sans+Bengali:wght@400;500;600&family=Noto+Sans+Kannada:wght@400;500;600&family=Manrope:wght@500;700;800&display=swap"
        />
      </head>
      <body className={`${manrope.variable} font-body bg-paper text-ink-900 pb-20`}>
        {children}
        <FloatingNav />
      </body>
    </html>
  );
}
