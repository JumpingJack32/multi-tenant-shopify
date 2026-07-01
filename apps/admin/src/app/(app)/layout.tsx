import { AppShell } from "@/components/layout/app-shell";
import "@repo/ui/globals.css"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
