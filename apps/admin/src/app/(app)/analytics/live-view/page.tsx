// apps/admin/src/app/(app)/analytics/live-view/page.tsx
"use client";

import { Badge } from "@repo/ui/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { ShoppingCartIcon, ReceiptIcon, ActivityIcon } from "@repo/ui/icons";

import { useTenantContext } from "@/contexts/tenant-context";
import { useLiveView } from "@/features/analytics/hooks/use-analytics";

function formatPence(n: number): string {
  return `\u00A3 ${(n / 100).toFixed(2)}`;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  paid: "bg-green-100 text-green-800",
  processing: "bg-purple-100 text-purple-800",
  shipped: "bg-indigo-100 text-indigo-800",
  delivered: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-red-100 text-red-800",
  refunded: "bg-gray-100 text-gray-800",
  active: "bg-green-100 text-green-800",
  abandoned: "bg-red-100 text-red-800",
  completed: "bg-blue-100 text-blue-800",
};

export default function LiveViewPage() {
  const { currentTenantId } = useTenantContext();
  const { data, isPending } = useLiveView(currentTenantId);
  const d = data as Record<string, unknown> | undefined;
  const activity = (d?.recent_activity ?? []) as Array<Record<string, unknown>>;

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold">Live View</h1>

      {/* Key Performance Indicators (KPI) strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Active Carts</CardDescription>
            <ShoppingCartIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isPending ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <CardTitle className="text-3xl">{Number(d?.active_carts ?? 0)}</CardTitle>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Today's Revenue</CardDescription>
            <ReceiptIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isPending ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <CardTitle className="text-3xl">{formatPence(Number(d?.today_revenue ?? 0))}</CardTitle>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Today's Orders</CardDescription>
            <ActivityIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isPending ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <CardTitle className="text-3xl">{Number(d?.today_orders ?? 0)}</CardTitle>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {isPending ? (
            <Skeleton className="h-48" />
          ) : activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent activity</p>
          ) : (
            <div className="space-y-2">
              {activity.map((a, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  {String(a.type) === "order" ? (
                    <ReceiptIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ShoppingCartIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <span className="capitalize">{String(a.type)}</span>
                  <span className="text-muted-foreground text-xs">
                    {String(a.ts).slice(11, 19)}
                  </span>
                  <Badge
                    variant="outline"
                    className={`text-xs ${STATUS_COLORS[String(a.label)] ?? ""}`}
                  >
                    {String(a.label)}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
