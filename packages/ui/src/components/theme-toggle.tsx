"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@repo/ui/components/ui/button";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <Button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      aria-label={
        theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
      }
    >
      {theme === "dark" ? (
        <Sun className="h-4 w-4" strokeWidth={1.5} />
      ) : (
        <Moon className="h-4 w-4" strokeWidth={1.5} />
      )}
    </Button>
  );
}
