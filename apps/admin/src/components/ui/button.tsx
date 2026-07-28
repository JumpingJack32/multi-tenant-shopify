"use client";

import { cn } from "@repo/shared-utils/cn";
import { Button as BaseButton } from "@repo/ui/base-ui";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "ghost" | "icon-ghost";
  size?: "sm" | "md" | "lg";
}

export function Button({
  className,
  variant = "default",
  size = "md",
  ...props
}: ButtonProps) {
  const isIconGhost = variant === "icon-ghost";
  return (
    <BaseButton
      className={cn(
        "inline-flex items-center justify-center rounded-md font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:pointer-events-none disabled:opacity-50",
        // Force shrink-0 and aspect-square so flex containers can't deform the circle
        isIconGhost ? "rounded-full shrink-0 aspect-square" : "rounded-md",
        {
          "bg-primary text-primary-foreground hover:bg-primary/90": variant === "default",
          "bg-destructive text-destructive-foreground hover:bg-destructive/90": variant === "destructive",
          "border border-input bg-background hover:bg-accent": variant === "outline",
          // "hover:bg-accent hover:text-accent-foreground": variant === "ghost",
          // Both ghost and icon-ghost share the same background hover styles
          "hover:bg-accent hover:text-accent-foreground": variant === "ghost" || isIconGhost,
        },
        {
          // Small: square 36px (h-9 w-9) and no padding for icon-ghost
          "h-9 text-sm": size === "sm",
          "px-3": size === "sm" && !isIconGhost,
          "w-9 p-0": size === "sm" && isIconGhost,
          // Medium: square 40px (h-10 w-10) and no padding for icon-ghost
          "h-10": size === "md",
          "px-4": size === "md" && !isIconGhost,
          "w-10 p-0": size === "md" && isIconGhost,
          // Large: square 44px (h-11 w-11) and no padding for icon-ghost
          "h-11 text-lg": size === "lg",
          "px-8": size === "lg" && !isIconGhost,
          "w-11 p-0": size === "lg" && isIconGhost,
        },
        className,
      )}
      {...props}
    />
  );
}
