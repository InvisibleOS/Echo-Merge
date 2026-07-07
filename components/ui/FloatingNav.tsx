"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Megaphone } from "lucide-react";
import clsx from "clsx";

export default function FloatingNav() {
  const pathname = usePathname();

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center bg-white/70 backdrop-blur-xl shadow-[0_12px_40px_-10px_rgba(0,0,0,0.15)] border border-white/40 rounded-full p-1.5 transition-all hover:scale-102 hover:shadow-[0_16px_48px_-8px_rgba(0,0,0,0.2)]">
      <Link
        href="/citizen"
        className={clsx(
          "flex items-center gap-2 px-5 py-2.5 rounded-full text-xs sm:text-sm font-display font-bold transition-all duration-300 active:scale-95",
          pathname === "/citizen"
            ? "bg-civic-500 text-white shadow-md shadow-civic-500/15"
            : "text-surface-700 hover:bg-surface-100 hover:text-civic-600"
        )}
      >
        <Megaphone size={15} className={pathname === "/citizen" ? "animate-pulse" : ""} />
        <span className="hidden sm:inline">Citizen Portal</span>
      </Link>
      
      <Link
        href="/dashboard"
        className={clsx(
          "flex items-center gap-2 px-5 py-2.5 rounded-full text-xs sm:text-sm font-display font-bold transition-all duration-300 active:scale-95",
          pathname === "/dashboard"
            ? "bg-civic-500 text-white shadow-md shadow-civic-500/15"
            : "text-surface-700 hover:bg-surface-100 hover:text-civic-600"
        )}
      >
        <LayoutDashboard size={15} />
        <span className="hidden sm:inline">MP Dashboard</span>
      </Link>
    </div>
  );
}
