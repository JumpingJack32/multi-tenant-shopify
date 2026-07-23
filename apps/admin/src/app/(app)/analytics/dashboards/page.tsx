"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Badge } from "@repo/ui/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { Skeleton } from "@repo/ui/components/ui/skeleton";

import { useTenantContext } from "@/contexts/tenant-context";
import {
  useCategoryBreakdown,
  useCustomerRetention,
  useCartAbandonment,
  useTopProducts,
} from "@/features/analytics/hooks/use-analytics";
import { useDashboard } from "@/features/dashboard/hooks/use-dashboard";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--muted-foreground) / 0.3)",
];

function formatPence(n: number): string {
  return `\u00A3 ${(n / 100).toFixed(2)}`;
}

const PERIODS = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "12m", label: "Last 12 months" },
];

export default function AnalyticsDashboardPage() {
  const [period, setPeriod] = useState("30d");
  const { currentTenantId, isLoading: tenantLoading } = useTenantContext();

  const dashQuery = useDashboard(currentTenantId, period);
  const productsQuery = useTopProducts(
    { limit: "10", sort_by: "revenue", period },
    currentTenantId,
  );
  const catQuery = useCategoryBreakdown({ period }, currentTenantId);
  const retentionQuery = useCustomerRetention({ period }, currentTenantId);
  const abandonQuery = useCartAbandonment({ period }, currentTenantId);

  const loading = tenantLoading || dashQuery.isPending;
  const data = dashQuery.data;

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  const timeline = data?.timeline ?? [];
  const products = (productsQuery.data ?? []) as Array<Record<string, unknown>>;
  const categories = (catQuery.data ?? []) as Array<Record<string, unknown>>;
  const retention = (retentionQuery.data ?? []) as Array<
    Record<string, unknown>
  >;
  const abandonment = (abandonQuery.data ?? []) as Array<
    Record<string, unknown>
  >;
  const recentOrders = data?.recent_orders ?? [];

  const formatCurrency = (n: number) => formatPence(n);

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
        <Select value={period} onValueChange={(v) => v && setPeriod(v)}>
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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader>
            <CardDescription>Total Revenue</CardDescription>
            <CardTitle className="text-2xl">
              {formatCurrency(data?.revenue_mtd ?? 0)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Total Orders</CardDescription>
            <CardTitle className="text-2xl">{data?.orders_mtd ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Avg Order Value</CardDescription>
            <CardTitle className="text-2xl">
              {formatCurrency(data?.aov ?? 0)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Active Customers</CardDescription>
            <CardTitle className="text-2xl">
              {data?.active_customers ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Pending POs</CardDescription>
            <CardTitle className="text-2xl">
              {data?.pending_pos?.count ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Revenue Trend + Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Revenue Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={timeline}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis
                  tickFormatter={(v) => `\u00A3${(v / 100).toFixed(0)}`}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary) / 0.15)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Top Products</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {products.slice(0, 10).map((p, i) => (
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
                  <div className="font-mono text-right tabular-nums">
                    {formatCurrency(Number(p.total_revenue))}
                  </div>
                  <Badge variant="outline" className="text-xs font-mono">
                    {String(p.primary_sku ?? "")}
                  </Badge>
                </div>
              ))}
              {products.length === 0 && (
                <p className="text-sm text-muted-foreground">No data yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Category + Customer Retention */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Revenue by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data yet</p>
            ) : (
              <div className="flex items-center gap-6">
                <PieChart width={200} height={200}>
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
                  <Tooltip />
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
                      <span className="font-mono">
                        {String(c.percentage_of_total)}%
                      </span>
                    </div>
                  ))}
                  <div className="pt-2 border-t text-muted-foreground font-medium">
                    Total:{" "}
                    {formatCurrency(
                      categories.reduce(
                        (s, c) => s + Number(c.total_revenue ?? 0),
                        0,
                      ),
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Customer Retention</CardTitle>
          </CardHeader>
          <CardContent>
            {retention.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <ComposedChart data={retention}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar
                    dataKey="new_revenue"
                    fill="hsl(var(--primary))"
                    name="New Customers"
                  />
                  <Line
                    type="monotone"
                    dataKey="returning_revenue"
                    stroke="hsl(var(--chart-2))"
                    strokeWidth={2}
                    name="Returning"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cart Abandonment + Top Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Cart Abandonment</CardTitle>
          </CardHeader>
          <CardContent>
            {abandonment.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <ComposedChart data={abandonment}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar
                    dataKey="abandoned_carts"
                    fill="hsl(var(--destructive))"
                    name="Abandoned"
                  />
                  <Line
                    type="monotone"
                    dataKey="completed_carts"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    name="Completed"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Top Orders</CardTitle>
          </CardHeader>
          <CardContent>
            {recentOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No orders yet</p>
            ) : (
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
                  {(recentOrders as any[]).slice(0, 20).map((o) => (
                    <tr key={String(o.id)} className="border-t">
                      <td className="py-1.5">{String(o.order_number)}</td>
                      <td className="py-1.5">
                        {String(o.customer_name ?? "\u2014")}
                      </td>
                      <td className="py-1.5 text-right font-mono">
                        {formatCurrency(Number(o.total))}
                      </td>
                      <td className="py-1.5">
                        <Badge variant="outline">{String(o.status)}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
