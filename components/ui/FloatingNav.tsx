"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Megaphone } from "lucide-react";
import clsx from "clsx";

export default function FloatingNav() {
  const pathname = usePathname();

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center bg-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-ink-900/10 rounded-full p-1.5 backdrop-blur-md">
      <Link
        href="/citizen"
        className={clsx(
          "flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-300",
          pathname === "/citizen"
            ? "bg-civic-500 text-white shadow-sm"
            : "text-ink-800 hover:bg-ink-900/5 hover:text-civic-600"
        )}
      >
        <Megaphone size={16} className={pathname === "/citizen" ? "animate-pulse" : ""} />
        <span className="hidden sm:inline">Citizen Portal</span>
      </Link>
      
      <Link
        href="/dashboard"
        className={clsx(
          "flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-300",
          pathname === "/dashboard"
            ? "bg-civic-500 text-white shadow-sm"
            : "text-ink-800 hover:bg-ink-900/5 hover:text-civic-600"
        )}
      >
        <LayoutDashboard size={16} />
        <span className="hidden sm:inline">MP Dashboard</span>
      </Link>
    </div>
  );
}
