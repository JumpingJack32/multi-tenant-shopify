"use client";

import { Badge } from "@repo/ui/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import { Skeleton } from "@repo/ui/components/ui/skeleton";

import { ErrorBanner } from "@/components/ui/error-banner";
import { useTenantContext } from "@/contexts/tenant-context";
import { useDashboard } from "@/features/dashboard/hooks/use-dashboard";

function formatPence(n: number): string {
  return `\u00A3${(n / 100).toFixed(2)}`;
}

function StatCard({
  label,
  value,
  prev,
  format,
}: {
  label: string;
  value: number;
  prev: number;
  format: (n: number) => string;
}) {
  const delta = prev > 0 ? ((value - prev) / prev) * 100 : 0;
  const arrow = delta >= 0 ? "\u2191" : "\u2193";
  const color = delta >= 0 ? "text-green-600" : "text-red-600";
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="font-mono text-2xl">{format(value)}</CardTitle>
        <p className={`text-xs font-mono ${color}`}>
          {arrow} {Math.abs(delta).toFixed(1)}% vs previous period
        </p>
      </CardHeader>
    </Card>
  );
}

const statusColors: Record<string, string> = {
  unfulfilled: "bg-amber-100 text-amber-800",
  processing: "bg-blue-100 text-blue-800",
  shipped: "bg-purple-100 text-purple-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

export default function DashboardPage() {
  const { currentTenantId, isLoading: tenantLoading } = useTenantContext();
  const dashboardQuery = useDashboard(currentTenantId);

  if (tenantLoading || dashboardQuery.isPending) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-28 mt-2" />
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (dashboardQuery.isError) {
    return (
      <ErrorBanner
        message="Failed to load dashboard"
        onRetry={() => dashboardQuery.refetch()}
      />
    );
  }

  const { data } = dashboardQuery;

  return (
    <div className="p-6 space-y-6">
      {/* Header + Refresh */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <button
          onClick={() => dashboardQuery.refetch()}
          className="text-sm text-primary hover:underline"
        >
          Refresh
        </button>
      </div>

      {/* Big Four KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Revenue (MTD)"
          value={data.revenue_mtd}
          prev={data.revenue_prev_mtd}
          format={formatPence}
        />
        <StatCard
          label="Orders (MTD)"
          value={data.orders_mtd}
          prev={data.orders_prev_mtd}
          format={(n) => n.toString()}
        />
        <StatCard label="AOV" value={data.aov} prev={0} format={formatPence} />
        <StatCard
          label="Active Customers"
          value={data.active_customers}
          prev={data.active_customers_prev}
          format={(n) => n.toString()}
        />
      </div>

      {/* Fulfillment Pipeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Fulfillment Pipeline</CardTitle>
        </CardHeader>
        <div className="px-6 pb-4 flex gap-3">
          {Object.entries(data.fulfillment).map(([key, count]) => (
            <Badge key={key} className={statusColors[key] ?? ""}>
              {key}: {count as number}
            </Badge>
          ))}
        </div>
      </Card>

      {/* Low Stock Alerts */}
      {data.low_stock.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Low Stock Alerts</CardTitle>
          </CardHeader>
          <div className="px-6 pb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="pb-2">Product</th>
                  <th className="pb-2">SKU</th>
                  <th className="pb-2 text-right">Qty</th>
                </tr>
              </thead>
              <tbody>
                {data.low_stock.map((item: any) => (
                  <tr key={item.variant_id} className="border-t">
                    <td className="py-1.5">{item.product_name}</td>
                    <td className="py-1.5 font-mono text-muted-foreground">
                      {item.sku}
                    </td>
                    <td
                      className={`py-1.5 text-right font-mono ${item.quantity <= 0 ? "text-red-600 font-bold" : ""}`}
                    >
                      {item.quantity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Recent Orders */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Recent Orders</CardTitle>
        </CardHeader>
        <div className="px-6 pb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="pb-2">Order</th>
                <th className="pb-2">Customer</th>
                <th className="pb-2 text-right">Total</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.recent_orders.map((order: any) => (
                <tr key={order.id} className="border-t">
                  <td className="py-1.5">{order.order_number}</td>
                  <td className="py-1.5">{order.customer_name || "\u2014"}</td>
                  <td className="py-1.5 text-right font-mono">
                    {formatPence(order.total)}
                  </td>
                  <td className="py-1.5">
                    <Badge className={statusColors[order.status] ?? ""}>
                      {order.status}
                    </Badge>
                  </td>
                </tr>
              ))}
              {data.recent_orders.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="py-4 text-center text-muted-foreground"
                  >
                    No orders yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
