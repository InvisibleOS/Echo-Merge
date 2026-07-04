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
        "font-display font-semibold rounded-md px-5 py-3 transition-colors text-sm",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        fullWidth && "w-full",
        variant === "primary" &&
          "bg-civic-500 text-white hover:bg-civic-600",
        variant === "secondary" &&
          "bg-white border border-ink-900/15 text-ink-900 hover:bg-ink-900/5",
        variant === "danger" &&
          "bg-signal-red text-white hover:bg-red-700",
        variant === "ghost" &&
          "bg-transparent text-civic-600 hover:bg-civic-50",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
