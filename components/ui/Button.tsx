"use client";

import { ButtonHTMLAttributes, ReactNode } from "react";
import clsx from "clsx";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  fullWidth?: boolean;
}

export default function Button({
  children,
  variant = "primary",
  fullWidth = false,
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled}
      className={clsx(
        "font-display font-bold rounded-xl px-5 py-3 transition-all duration-200 text-sm active:scale-[0.97] inline-flex items-center justify-center gap-2 shadow-sm",
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100",
        fullWidth && "w-full",
        variant === "primary" &&
          "bg-civic-500 text-white hover:bg-civic-600 hover:shadow-md hover:shadow-civic-500/15 active:bg-civic-700",
        variant === "secondary" &&
          "bg-white border border-surface-200 text-surface-800 hover:bg-surface-50 hover:border-surface-300",
        variant === "danger" &&
          "bg-signal-red text-white hover:bg-red-700 hover:shadow-md hover:shadow-red-500/15",
        variant === "ghost" &&
          "bg-transparent text-civic-500 hover:bg-civic-50/50 hover:text-civic-600",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
