"use client";

import { useTheme } from "next-themes";
import { useEffect } from "react";

export function KeyboardThemeToggle() {
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.metaKey && e.key === "d") {
        e.preventDefault();
        setTheme(theme === "dark" ? "light" : "dark");
      }
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [theme, setTheme]);

  return null;
}
