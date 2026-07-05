import { ThemeToggle } from "@repo/ui/components/ui";

export default function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="flex h-12 items-center justify-end border-b border-border bg-background px-6">
        <ThemeToggle />
      </header>
      {children}
    </>
  );
}
