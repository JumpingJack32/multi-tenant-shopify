"use client";

import { Badge } from "@repo/ui/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";

import { ErrorBanner } from "@/components/ui/error-banner";
import { useTenantContext } from "@/contexts/tenant-context";
import {
  SectionCards,
  SectionCardsSkeleton,
} from "@/features/dashboard/components/section-cards";
import { useDashboard } from "@/features/dashboard/hooks/use-dashboard";

function formatPence(n: number): string {
  return `\u00A3${(n / 100).toFixed(2)}`;
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
        <SectionCardsSkeleton />
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

      <SectionCards
        revenue_mtd={data.revenue_mtd}
        revenue_prev_mtd={data.revenue_prev_mtd}
        orders_mtd={data.orders_mtd}
        orders_prev_mtd={data.orders_prev_mtd}
        aov={data.aov}
        active_customers={data.active_customers}
        active_customers_prev={data.active_customers_prev}
      />

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
                {data.low_stock.map((item) => (
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
              {data.recent_orders.map((order) => (
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
