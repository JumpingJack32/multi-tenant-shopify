"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
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
import { Loader2Icon } from "@repo/ui/icons";

import { useTenantContext } from "@/contexts/tenant-context";
import { request } from "@/lib/api/client";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  past_due: "bg-yellow-100 text-yellow-800",
  canceled: "bg-red-100 text-red-800",
  paused: "bg-gray-100 text-gray-800",
};

export default function SubscriptionsPage() {
  const { currentTenantId } = useTenantContext();
  const queryClient = useQueryClient();

  const { data: metrics } = useQuery({
    queryKey: ["subscription-metrics", currentTenantId],
    queryFn: () => request("/admin/subscriptions/metrics", { tenantId: currentTenantId }),
    enabled: !!currentTenantId,
  });

  const { data: subs, isLoading } = useQuery({
    queryKey: ["subscription-list", currentTenantId],
    queryFn: () => request("/admin/subscriptions/list", { tenantId: currentTenantId }),
    enabled: !!currentTenantId,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      request(`/admin/subscriptions/${id}/status`, {
        method: "PUT",
        body: JSON.stringify({ status }),
        tenantId: currentTenantId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["subscription-list"] });
    },
  });

  const m = metrics as Record<string, unknown> | undefined;
  const list = (subs ?? []) as Array<{
    id: string;
    customer_email: string;
    status: string;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
    created_at: string;
  }>;

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Subscriptions</h1>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">MRR</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">£ {(Number((m as any)?.mrr ?? 0) / 100).toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Active Subscribers</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{Number((m as any)?.active_subscribers ?? 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Churn Rate (30d)</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{Number((m as any)?.churn_rate_30d ?? 0)}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">ARPU</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">£ {(Number((m as any)?.arpu ?? 0) / 100).toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Subscriber table */}
      {isLoading ? <Skeleton className="h-48 w-full" /> : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Next Billing</TableHead>
              <TableHead>Created</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No subscriptions yet</TableCell></TableRow>
            ) : list.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.customer_email}</TableCell>
                <TableCell>
                  <Badge className={STATUS_COLORS[s.status] ?? ""}>{s.status}</Badge>
                </TableCell>
                <TableCell className="text-sm">
                  {s.current_period_end ? new Date(s.current_period_end).toLocaleDateString() : "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(s.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <Select
                    value={s.status}
                    onValueChange={(v: string | null) => v && statusMutation.mutate({ id: s.id, status: v })}
                  >
                    <SelectTrigger className="w-28 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="paused">Paused</SelectItem>
                      <SelectItem value="canceled">Canceled</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
