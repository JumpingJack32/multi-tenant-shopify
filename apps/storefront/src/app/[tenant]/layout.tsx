import { ThemeToggle } from "@repo/ui";

import { resolveTenantFromRequest } from "@/lib/tenant-resolver";

export default function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenant: string }>;
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
