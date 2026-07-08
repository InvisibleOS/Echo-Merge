import type { Metadata } from "next";
import FloatingNav from "@/components/ui/FloatingNav";
import { Manrope, Noto_Sans } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["500", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

const notoSans = Noto_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-sans",
  display: "swap",
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
      <body className={`${manrope.variable} ${notoSans.variable} font-body bg-paper text-ink-900`}>
        {children}
        <FloatingNav />
      </body>
    </html>
  );
}
