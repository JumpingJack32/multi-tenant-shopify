"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@repo/ui/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@repo/ui/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";

import { ErrorBanner } from "@/components/ui/error-banner";
import { useTenantContext } from "@/contexts/tenant-context";
import {
  useTopProducts,
  useCategoryBreakdown,
} from "@/features/analytics/hooks/use-analytics";
import {
  SectionCards,
  SectionCardsSkeleton,
} from "@/features/dashboard/components/section-cards";
import { useDashboard } from "@/features/dashboard/hooks/use-dashboard";

function formatPence(n: number): string {
  return `\u00A3 ${(n / 100).toFixed(2)}`;
}

const statusColors: Record<string, string> = {
  unfulfilled: "bg-amber-100 text-amber-800",
  processing: "bg-blue-100 text-blue-800",
  shipped: "bg-purple-100 text-purple-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

const PERIODS = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "12m", label: "Last 12 months" },
];

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const period = searchParams.get("period") || "30d";
  const { currentTenantId, isLoading: tenantLoading } = useTenantContext();
  const dashboardQuery = useDashboard(currentTenantId, period);

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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Select
          value={period}
          onValueChange={(v) => router.push(`/dashboard?period=${v}`)}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <SectionCards
        revenue_mtd={data.revenue_mtd}
        revenue_prev_mtd={data.revenue_prev_mtd}
        net_revenue_mtd={data.net_revenue_mtd}
        net_revenue_prev_mtd={data.net_revenue_prev_mtd}
        orders_mtd={data.orders_mtd}
        orders_prev_mtd={data.orders_prev_mtd}
        aov={data.aov}
        active_customers={data.active_customers}
        active_customers_prev={data.active_customers_prev}
        pending_pos={data.pending_pos}
      />

      {/* Revenue Chart */}
      {data.timeline && data.timeline.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Revenue Trend</CardTitle>
            <CardDescription>
              Daily revenue over the selected period
            </CardDescription>
          </CardHeader>
          <div className="px-4 pb-4">
            <ChartContainer
              config={{
                revenue: { label: "Revenue", color: "hsl(var(--primary))" },
              }}
              className="h-64 w-full"
            >
              <AreaChart data={data.timeline}>
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis
                  tickFormatter={(v) => `£ ${(Number(v) / 100).toFixed(0)}`}
                  tick={{ fontSize: 12 }}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary) / 0.15)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          </div>
        </Card>
      )}

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

      {/* Action Center */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <span className="text-amber-500">⚠️</span> Low Stock (
              {data.low_stock.length})
            </CardTitle>
          </CardHeader>
          {data.low_stock.length > 0 ? (
            <div className="px-6 pb-4 space-y-1">
              {data.low_stock.slice(0, 5).map((item) => (
                <div
                  key={item.variant_id}
                  className="flex justify-between text-sm py-1 border-b last:border-0"
                >
                  <span className="truncate">{item.product_name}</span>
                  <span
                    className={`font-mono ml-2 ${item.quantity <= 0 ? "text-red-600 font-bold" : ""}`}
                  >
                    {item.quantity} left
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <CardDescription className="px-6 pb-4">
              No low stock alerts
            </CardDescription>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <span className="text-blue-500">📋</span> Pending Purchase Orders
            </CardTitle>
          </CardHeader>
          <div className="px-6 pb-4">
            {data.pending_pos.count > 0 ? (
              <div className="text-sm space-y-1">
                <p className="font-medium">
                  {data.pending_pos.count} PO
                  {data.pending_pos.count > 1 ? "s" : ""} awaiting approval
                </p>
                <p className="text-muted-foreground">
                  Total value: {formatPence(data.pending_pos.total)}
                </p>
              </div>
            ) : (
              <CardDescription>No pending purchase orders</CardDescription>
            )}
          </div>
        </Card>
      </div>

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

      {/* Top Products */}
      <TopProductsWidget tenantId={currentTenantId} period={period} />

      {/* Category Breakdown */}
      <CategoryWidget tenantId={currentTenantId} period={period} />
    </div>
  );
}

function TopProductsWidget({
  tenantId,
  period,
}: {
  tenantId?: string | null;
  period: string;
}) {
  const [sortBy, setSortBy] = useState<"revenue" | "units">("revenue");
  const { data, isLoading } = useTopProducts(
    { limit: "10", sort_by: sortBy, period },
    tenantId,
  );
  const products = (data ?? []) as Array<Record<string, unknown>>;

  if (isLoading) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Top Products</CardTitle>
          <div className="flex gap-1">
            <button
              onClick={() => setSortBy("revenue")}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                sortBy === "revenue"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Revenue
            </button>
            <button
              onClick={() => setSortBy("units")}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                sortBy === "units"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Units
            </button>
          </div>
        </div>
      </CardHeader>
      <div className="px-6 pb-4">
        {products.length === 0 ? (
          <p className="text-sm text-muted-foreground">No product data yet</p>
        ) : (
          <div className="space-y-2">
            {products.map((p, i) => (
              <div
                key={String(p.product_id)}
                className="flex items-center gap-3 text-sm"
              >
                <span className="text-muted-foreground w-5 text-right">
                  {i + 1}.
                </span>
                <div className="flex-1 truncate font-medium">
                  {String(p.product_name)}
                </div>
                <div className="font-mono text-right tabular-nums w-24">
                  {sortBy === "revenue"
                    ? `\u00A3 ${(Number(p.total_revenue) / 100).toFixed(2)}`
                    : String(p.units_sold)}
                </div>
                <Badge variant="outline" className="text-xs font-mono">
                  {String(p.primary_sku ?? "")}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

function CategoryWidget({
  tenantId,
  period,
}: {
  tenantId?: string | null;
  period: string;
}) {
  const { data, isLoading } = useCategoryBreakdown({ period }, tenantId);
  const categories = (data ?? []) as Array<Record<string, unknown>>;

  if (isLoading) return null;

  const COLORS = [
    "hsl(var(--primary))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
    "hsl(var(--muted-foreground) / 0.3)",
  ];

  const totalRevenue = categories.reduce(
    (s, c) => s + Number(c.total_revenue ?? 0),
    0,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Revenue by Category</CardTitle>
      </CardHeader>
      <div className="px-6 pb-4">
        {categories.length === 0 ? (
          <p className="text-sm text-muted-foreground">No category data yet</p>
        ) : (
          <div className="flex items-center gap-6">
            <PieChart width={180} height={180}>
              <Pie
                data={categories.map((c) => ({
                  name: c.category_name,
                  value: Number(c.total_revenue),
                }))}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                dataKey="value"
              >
                {categories.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <ChartTooltip content={<ChartTooltipContent />} />
            </PieChart>
            <div className="space-y-1.5 text-sm">
              {categories.map((c, i) => (
                <div
                  key={String(c.category_id)}
                  className="flex items-center gap-2"
                >
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                  />
                  <span className="text-muted-foreground">
                    {String(c.category_name)}
                  </span>
                  <span className="font-mono tabular-nums">
                    {String(c.percentage_of_total)}%
                  </span>
                </div>
              ))}
              <div className="pt-2 border-t text-muted-foreground font-medium">
                Total: \u00A3 {(totalRevenue / 100).toFixed(2)}
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
