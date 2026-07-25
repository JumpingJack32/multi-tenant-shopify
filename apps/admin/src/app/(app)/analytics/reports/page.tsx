"use client";

import { useState } from "react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/ui/tabs";
import { DownloadIcon } from "@repo/ui/icons";

import { useTenantContext } from "@/contexts/tenant-context";
import {
  useSalesReport,
  useProductsReport,
  useCustomersReport,
  useCartsReport,
} from "@/features/analytics/hooks/use-analytics";

function formatPence(n: number): string {
  return `\u00A3 ${(n / 100).toFixed(2)}`;
}

const PERIODS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

function SalesTab() {
  const [period, setPeriod] = useState("daily");
  const { currentTenantId } = useTenantContext();
  const { data, isPending } = useSalesReport({ period }, currentTenantId);
  const rows = (data ?? []) as Array<Record<string, unknown>>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Select value={period} onValueChange={(v) => v && setPeriod(v)}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODS.map((p) => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <a
          href={`${process.env.NEXT_PUBLIC_API_URL}/analytics/reports/sales?format=csv&period=${period}`}
          download
          className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground"
        >
          <DownloadIcon className="h-4 w-4" />
          CSV
        </a>
      </div>
      {isPending ? (
        <Skeleton className="h-64" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No data yet</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Period</TableHead>
              <TableHead className="text-right">Gross Sales</TableHead>
              <TableHead className="text-right">Net Sales</TableHead>
              <TableHead className="text-right">Refunds</TableHead>
              <TableHead className="text-right">Orders</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i}>
                <TableCell>{String(r.period)}</TableCell>
                <TableCell className="text-right font-mono">{formatPence(Number(r.gross_sales))}</TableCell>
                <TableCell className="text-right font-mono">{formatPence(Number(r.net_sales))}</TableCell>
                <TableCell className="text-right font-mono">{formatPence(Number(r.refunds))}</TableCell>
                <TableCell className="text-right font-mono">{Number(r.order_count)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function ProductsTab() {
  const { currentTenantId } = useTenantContext();
  const { data, isPending } = useProductsReport({}, currentTenantId);
  const rows = (data ?? []) as Array<Record<string, unknown>>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <a
          href={`${process.env.NEXT_PUBLIC_API_URL}/analytics/reports/products?format=csv`}
          download
          className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground"
        >
          <DownloadIcon className="h-4 w-4" />
          CSV
        </a>
      </div>
      {isPending ? (
        <Skeleton className="h-64" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No data yet</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Units Sold</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
              <TableHead className="text-right">Avg Price</TableHead>
              <TableHead className="text-right">Orders</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium">{String(r.product_name)}</TableCell>
                <TableCell className="font-mono text-xs">{String(r.sku ?? "")}</TableCell>
                <TableCell>{String(r.category ?? "")}</TableCell>
                <TableCell className="text-right font-mono">{Number(r.units_sold)}</TableCell>
                <TableCell className="text-right font-mono">{formatPence(Number(r.total_revenue))}</TableCell>
                <TableCell className="text-right font-mono">{formatPence(Math.round(Number(r.avg_price)))}</TableCell>
                <TableCell className="text-right font-mono">{Number(r.times_ordered)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function CustomersTab() {
  const { currentTenantId } = useTenantContext();
  const { data, isPending } = useCustomersReport({}, currentTenantId);
  const rows = (data ?? []) as Array<Record<string, unknown>>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <a
          href={`${process.env.NEXT_PUBLIC_API_URL}/analytics/reports/customers?format=csv`}
          download
          className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground"
        >
          <DownloadIcon className="h-4 w-4" />
          CSV
        </a>
      </div>
      {isPending ? (
        <Skeleton className="h-64" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No data yet</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>First Order</TableHead>
              <TableHead>Last Order</TableHead>
              <TableHead className="text-right">Orders</TableHead>
              <TableHead className="text-right">Total Spent</TableHead>
              <TableHead className="text-right">AOV</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium">{String(r.email)}</TableCell>
                <TableCell className="text-xs">{String(r.first_order ?? "").slice(0, 10)}</TableCell>
                <TableCell className="text-xs">{String(r.last_order ?? "").slice(0, 10)}</TableCell>
                <TableCell className="text-right font-mono">{Number(r.order_count)}</TableCell>
                <TableCell className="text-right font-mono">{formatPence(Number(r.total_spent))}</TableCell>
                <TableCell className="text-right font-mono">{formatPence(Math.round(Number(r.avg_order_value)))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function CartsTab() {
  const [period, setPeriod] = useState("daily");
  const { currentTenantId } = useTenantContext();
  const { data, isPending } = useCartsReport({ period }, currentTenantId);
  const rows = (data ?? []) as Array<Record<string, unknown>>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Select value={period} onValueChange={(v) => v && setPeriod(v)}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODS.map((p) => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <a
          href={`${process.env.NEXT_PUBLIC_API_URL}/analytics/reports/carts?format=csv&period=${period}`}
          download
          className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground"
        >
          <DownloadIcon className="h-4 w-4" />
          CSV
        </a>
      </div>
      {isPending ? (
        <Skeleton className="h-64" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No data yet</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Period</TableHead>
              <TableHead className="text-right">Active</TableHead>
              <TableHead className="text-right">Abandoned</TableHead>
              <TableHead className="text-right">Completed</TableHead>
              <TableHead className="text-right">Conv. Rate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i}>
                <TableCell>{String(r.period)}</TableCell>
                <TableCell className="text-right font-mono">{Number(r.active_carts)}</TableCell>
                <TableCell className="text-right font-mono">{Number(r.abandoned_carts)}</TableCell>
                <TableCell className="text-right font-mono">{Number(r.completed_carts)}</TableCell>
                <TableCell className="text-right font-mono">{Number(r.conversion_rate).toFixed(2)}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

export default function ReportsPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold">Reports</h1>
      <Tabs defaultValue="sales">
        <TabsList variant="line">
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="carts">Carts</TabsTrigger>
        </TabsList>
        <TabsContent value="sales"><SalesTab /></TabsContent>
        <TabsContent value="products"><ProductsTab /></TabsContent>
        <TabsContent value="customers"><CustomersTab /></TabsContent>
        <TabsContent value="carts"><CartsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
