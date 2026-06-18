import { resolveTenantFromRequest } from "@/lib/tenant-resolver";

export default function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenant: string }>;
}) {
  return <>{children}</>;
}
