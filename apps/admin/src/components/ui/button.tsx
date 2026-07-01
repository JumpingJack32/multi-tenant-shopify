"use client";

import { cn } from "@repo/shared-utils/cn";
import { Button as BaseButton } from "@repo/ui/base-ui";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
}

export function Button({
  className,
  variant = "default",
  size = "md",
  ...props
}: ButtonProps) {
  return (
    <BaseButton
      className={cn(
        "inline-flex items-center justify-center rounded-md font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:pointer-events-none disabled:opacity-50",
        {
          "bg-primary text-primary-foreground hover:bg-primary/90": variant === "default",
          "bg-destructive text-destructive-foreground hover:bg-destructive/90": variant === "destructive",
          "border border-input bg-background hover:bg-accent": variant === "outline",
          "hover:bg-accent hover:text-accent-foreground": variant === "ghost",
        },
        {
          "h-9 px-3 text-sm": size === "sm",
          "h-10 px-4": size === "md",
          "h-11 px-8 text-lg": size === "lg",
        },
        className,
      )}
      {...props}
    />
  );
}
