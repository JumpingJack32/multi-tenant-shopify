"use client";

import { AlertDialog as AlertDialogPrimitive } from "@repo/ui/base-ui";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@repo/ui/components/ui/card";
import Link from "next/link";

import { useRbac } from "@/contexts/rbac-context";
import { useTenantContext } from "@/contexts/tenant-context";
import { useProducts } from "@/features/products/hooks/use-products";

// import { MessageScroller} from "@repo/ui/shadcn-react"

const quickLinks = [
  {
    label: "Products",
    href: "/products",
    description: "Manage your product catalog",
  },
  {
    label: "Orders",
    href: "/orders",
    description: "View and manage orders",
  },
  {
    label: "Settings",
    href: "/settings",
    description: "Configure your store",
  },
];

function StatCard({
  label,
  value,
  loading,
}: {
  label: string;
  value: string | number;
  loading?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      {loading ? (
        <div className="mt-1 h-7 w-12 animate-pulse rounded bg-muted" />
      ) : (
        <p className="mt-1 text-2xl font-semibold">{value}</p>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { currentTenant } = useTenantContext();
  const { role } = useRbac();
  const { data: productsData, isLoading: productsLoading } = useProducts({});

  const productCount = productsData?.total ?? productsData?.data?.length ?? 0;

  return (
    <div className="space-y-8 p-6">
      {/* Header Section */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {currentTenant ? currentTenant.name : "Dashboard"}
        </h1>
        <p className="text-muted-foreground mt-1">
          {role === "admin"
            ? "Full access — you can manage all resources."
            : role === "member"
              ? "You can create and edit resources."
              : "View-only access."}
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Total Products"
          value={productCount}
          loading={productsLoading}
        />
        <StatCard label="Orders" value="—" />
        <StatCard
          label="Role"
          value={role.charAt(0).toUpperCase() + role.slice(1)}
        />
      </div>

      {/* Quick Links Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Quick Links</h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quickLinks.map((link) => (
            <Link key={link.href} href={link.href} className="block group">
              <Card className="h-full transition-colors group-hover:bg-accent/50 group-hover:text-accent-foreground">
                <CardHeader className="p-4">
                  <CardTitle className="text-base font-medium group-hover:text-primary">
                    {link.label}
                  </CardTitle>
                  <CardDescription className="text-sm mt-1">
                    {link.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
