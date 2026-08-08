"use client";

import { useState } from "react";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
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
import { DownloadIcon, RotateCwIcon } from "@repo/ui/icons";

import { useRbac } from "@/contexts/rbac-context";
import {
  exportAuditLogs,
  type AuditFilters,
} from "@/features/audit/api/audit-service";
import { useAuditLogs } from "@/features/audit/hooks/use-audit-logs";

const ACTIONS = [
  "settings.manage_staff.invite",
  "settings.manage_staff.update",
  "settings.manage_staff.remove",
  "settings.transfer_ownership",
  "orders.refund",
  "store_credit.issue",
  "inventory.override",
  "customers.export",
  "settings.manage_webhooks",
  "settings.manage_api_keys",
];

const ACTION_LABELS: Record<string, string> = {
  "settings.manage_staff.invite": "Invite User",
  "settings.manage_staff.update": "Update User",
  "settings.manage_staff.remove": "Remove User",
  "settings.transfer_ownership": "Transfer Ownership",
  "orders.refund": "Order Refund",
  "store_credit.issue": "Store Credit",
  "inventory.override": "Inventory Override",
  "customers.export": "Customer Export",
  "settings.manage_webhooks": "Webhook Change",
  "settings.manage_api_keys": "API Key Change",
};

export default function AuditLogsPage() {
  const { can } = useRbac();
  const [filters, setFilters] = useState<AuditFilters>({});
  const [draftFilters, setDraftFilters] = useState<AuditFilters>({});
  const [page, setPage] = useState(1);

  const { data, isLoading } = useAuditLogs(filters, page);
  const logs = data?.data ?? [];
  const totalPages = data?.pagination.total_pages ?? 1;

  if (!can("audit_logs.read")) {
    return (
      <div className="p-6 text-muted-foreground">
        You don&apos;t have permission to view audit logs.
      </div>
    );
  }

  const applyFilters = () => {
    setFilters(draftFilters);
    setPage(1);
  };

  const resetFilters = () => {
    setDraftFilters({});
    setFilters({});
    setPage(1);
  };

  const handleExport = async () => {
    try {
      await exportAuditLogs(filters);
    } catch {
      alert("Export failed — please try again.");
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Audit Logs</h1>
        <Button variant="outline" onClick={handleExport}>
          <DownloadIcon className="mr-2 h-4 w-4" />Export CSV
        </Button>
      </div>

      <Card>
        <CardContent className="grid gap-4 p-4 md:grid-cols-3">
          <div>
            <Label>Action</Label>
            <Select
              value={draftFilters.action ?? "all"}
              onValueChange={(v) =>
                setDraftFilters((f) => ({ ...f, action: v && v !== "all" ? v : undefined }))
              }
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                {ACTIONS.map((a) => (
                  <SelectItem key={a} value={a}>{ACTION_LABELS[a] ?? a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Actor email</Label>
            <Input
              value={draftFilters.actor_email ?? ""}
              onChange={(e) => setDraftFilters((f) => ({ ...f, actor_email: e.target.value || undefined }))}
              placeholder="search@example.com"
            />
          </div>
          <div>
            <Label>Resource type</Label>
            <Input
              value={draftFilters.resource_type ?? ""}
              onChange={(e) => setDraftFilters((f) => ({ ...f, resource_type: e.target.value || undefined }))}
              placeholder="order / variant / webhook"
            />
          </div>
          <div>
            <Label>Start date</Label>
            <Input
              type="date"
              value={draftFilters.start_date ?? ""}
              onChange={(e) => setDraftFilters((f) => ({ ...f, start_date: e.target.value || undefined }))}
            />
          </div>
          <div>
            <Label>End date</Label>
            <Input
              type="date"
              value={draftFilters.end_date ?? ""}
              onChange={(e) => setDraftFilters((f) => ({ ...f, end_date: e.target.value || undefined }))}
            />
          </div>
          <div className="flex items-end gap-2">
            <Button onClick={applyFilters}>Apply</Button>
            <Button variant="ghost" onClick={resetFilters}>
              <RotateCwIcon className="mr-1 h-3.5 w-3.5" />Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              {data?.pagination.total ?? 0} events
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No audit events match the filters
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {new Date(log.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs">{log.actor_email ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{ACTION_LABELS[log.action] ?? log.action}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {log.resource_type ?? ""}{log.resource_id ? `:${log.resource_id.slice(0, 8)}` : ""}
                      </TableCell>
                      <TableCell className="max-w-64 truncate text-xs text-muted-foreground">
                        {JSON.stringify(log.details ?? {})}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Prev
                </Button>
                <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
