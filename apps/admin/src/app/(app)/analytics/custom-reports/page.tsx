"use client";

import { useState } from "react";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import { Input } from "@repo/ui/components/ui/input";
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
import { PlayIcon, XIcon } from "@repo/ui/icons";

import { useTenantContext } from "@/contexts/tenant-context";
import { useCustomReport } from "@/features/analytics/hooks/use-analytics";

const DIMENSION_OPTIONS = [
  { value: "category", label: "Category" },
  { value: "order_status", label: "Order Status" },
  { value: "customer_email", label: "Customer Email" },
  { value: "month", label: "Month" },
  { value: "day", label: "Day" },
];

const METRIC_OPTIONS = [
  { value: "total_revenue", label: "Total Revenue" },
  { value: "order_count", label: "Order Count" },
  { value: "avg_order_value", label: "Avg Order Value" },
  { value: "units_sold", label: "Units Sold" },
  { value: "customer_count", label: "Customer Count" },
  { value: "refund_total", label: "Refund Total" },
];

function formatPence(n: number): string {
  return `\u00A3 ${(n / 100).toFixed(2)}`;
}

export default function CustomReportsPage() {
  const { currentTenantId } = useTenantContext();
  const report = useCustomReport(currentTenantId);

  const [dimensions, setDimensions] = useState<string[]>([]);
  const [metrics, setMetrics] = useState<string[]>(["total_revenue", "order_count"]);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [groupBy, setGroupBy] = useState<string[]>([]);
  const [orderByColumn, setOrderByColumn] = useState("total_revenue");
  const [orderDir, setOrderDir] = useState("desc");
  const [limit, setLimit] = useState("50");

  const addDimension = (v: string | null) => {
    if (v && !dimensions.includes(v)) setDimensions([...dimensions, v]);
  };
  const addMetric = (v: string | null) => {
    if (v && !metrics.includes(v)) setMetrics([...metrics, v]);
  };

  const runReport = () => {
    const filterRecord: Record<string, unknown> = {};
    if (filters.start_date) filterRecord.start_date = filters.start_date;
    if (filters.end_date) filterRecord.end_date = filters.end_date;
    if (filters.min_total) filterRecord.min_total = parseInt(filters.min_total, 10);
    const body: Record<string, unknown> = {
      dimensions,
      metrics,
      filters: filterRecord,
      group_by: groupBy,
      order_by: { column: orderByColumn, direction: orderDir },
      limit: parseInt(limit, 10) || 50,
    };
    report.mutate(body);
  };

  const result = report.data as { columns?: string[]; rows?: Record<string, unknown>[] } | undefined;
  const isLoading = report.isPending;

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold">Custom Reports</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuration panel */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm">Report Configuration</CardTitle>
            <CardDescription>Choose dimensions and metrics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Dimensions */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Dimensions</label>
              <div className="flex flex-wrap gap-1.5">
                {dimensions.map((d) => (
                  <Badge key={d} variant="outline" className="cursor-pointer" onClick={() => setDimensions(dimensions.filter((x) => x !== d))}>
                    {d} <XIcon className="ml-1 h-3 w-3" />
                  </Badge>
                ))}
              </div>
              <Select onValueChange={addDimension}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Add dimension" />
                </SelectTrigger>
                <SelectContent>
                  {DIMENSION_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Metrics */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Metrics</label>
              <div className="flex flex-wrap gap-1.5">
                {metrics.map((m) => (
                  <Badge key={m} variant="outline" className="cursor-pointer" onClick={() => setMetrics(metrics.filter((x) => x !== m))}>
                    {m} <XIcon className="ml-1 h-3 w-3" />
                  </Badge>
                ))}
              </div>
              <Select onValueChange={addMetric}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Add metric" />
                </SelectTrigger>
                <SelectContent>
                  {METRIC_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Group By */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Group By</label>
              <Select onValueChange={(v: string | null) => v && !groupBy.includes(v) && setGroupBy([...groupBy, v])}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Group by (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {DIMENSION_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex flex-wrap gap-1.5">
                {groupBy.map((g) => (
                  <Badge key={g} variant="outline" className="cursor-pointer" onClick={() => setGroupBy(groupBy.filter((x) => x !== g))}>
                    {g} <XIcon className="ml-1 h-3 w-3" />
                  </Badge>
                ))}
              </div>
            </div>

            {/* Filters */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Date Filters</label>
              <Input type="date" aria-label="Start date" placeholder="Start date" value={filters.start_date ?? ""} onChange={(e) => setFilters({ ...filters, start_date: e.target.value })} />
              <Input type="date" aria-label="End date" placeholder="End date" value={filters.end_date ?? ""} onChange={(e) => setFilters({ ...filters, end_date: e.target.value })} />
              <Input type="number" aria-label="Min total" placeholder="Min total (cents)" value={filters.min_total ?? ""} onChange={(e) => setFilters({ ...filters, min_total: e.target.value })} />
            </div>

            {/* Order By */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-sm font-medium">Sort By</label>
                <Select value={orderByColumn} onValueChange={(v: string | null) => v && setOrderByColumn(v)}>
                  <SelectTrigger aria-label="Sort by">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[...DIMENSION_OPTIONS, ...METRIC_OPTIONS].map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Direction</label>
                <Select value={orderDir} onValueChange={(v: string | null) => v && setOrderDir(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc">Desc</SelectItem>
                    <SelectItem value="asc">Asc</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Limit */}
            <div>
              <label className="text-sm font-medium">Limit</label>
              <Input type="number" aria-label="Limit" value={limit} onChange={(e) => setLimit(e.target.value)} min={1} max={500} />
            </div>

            <Button className="w-full" onClick={runReport} disabled={isLoading}>
              <PlayIcon className="mr-2 h-4 w-4" />
              {isLoading ? "Running..." : "Run Report"}
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">Results</CardTitle>
            {result && <CardDescription>{result.columns?.length ?? 0} columns, {result.rows?.length ?? 0} rows</CardDescription>}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64" />
            ) : !result ? (
              <p className="text-sm text-muted-foreground">Configure dimensions/metrics and click Run Report</p>
            ) : !result.rows?.length ? (
              <p className="text-sm text-muted-foreground">No results</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {(result.columns ?? []).map((col) => (
                        <TableHead key={col} className="whitespace-nowrap">{col}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.rows.map((r, i) => (
                      <TableRow key={i}>
                        {(result.columns ?? []).map((col) => {
                          const val = r[col];
                          const isPrice = typeof val === "number" && ["total_revenue", "avg_order_value", "refund_total"].includes(col);
                          return (
                            <TableCell key={col} className="font-mono text-xs whitespace-nowrap">
                              {isPrice ? formatPence(Number(val)) : String(val ?? "")}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
