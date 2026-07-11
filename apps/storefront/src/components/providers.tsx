"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useMemo, type ReactNode } from "react";

import { KeyboardThemeToggle } from "./keyboard-theme-toggle";

export function Providers({ children }: { children: ReactNode }) {
  const queryClient = useMemo(() => new QueryClient(), []);

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <KeyboardThemeToggle />
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ThemeProvider>
  );
}
