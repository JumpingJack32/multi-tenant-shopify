"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Input } from "@repo/ui/components/ui/input";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  FilterIcon,
  SearchIcon,
} from "@repo/ui/icons";

import { ErrorBanner } from "@/components/ui/error-banner";
import {
  useBatchApprovePOs,
  usePurchaseOrders,
} from "@/features/purchase-orders/hooks/use-purchase-orders";

import { ApproveModal } from "./approve-modal/approve-modal";

interface POSTableProps {
  tenantId?: string | null;
  tenantLoading?: boolean;
}

function formatPence(n: number): string {
  return `£ ${(n / 100).toFixed(2)}`;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending_review: "Pending Review",
  sent: "Sent to Supplier",
  confirmed: "Confirmed",
  in_transit: "In Transit",
  partially_received: "Partially Received",
  received: "Received",
  closed: "Closed",
  cancelled: "Cancelled",
};

const STATUS_VARIANTS: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  draft: "outline",
  pending_review: "secondary",
  sent: "default",
  confirmed: "default",
  in_transit: "default",
  partially_received: "secondary",
  received: "default",
  closed: "outline",
  cancelled: "destructive",
};

export function POSTable({ tenantId, tenantLoading }: POSTableProps) {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showApproveModal, setShowApproveModal] = useState(false);

  const params: Record<string, string> = {};
  if (page > 1) params.page = String(page);
  if (search) params.search = search;
  if (statusFilter) params.status = statusFilter;

  const { data, isLoading, isError, error, refetch } = usePurchaseOrders(
    params,
    tenantId,
  );
  const batchApprove = useBatchApprovePOs(tenantId);

  const handleSelectAll = () => {
    if (!data?.data) return;
    if (selected.size === data.data.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(data.data.map((po) => po.id)));
    }
  };

  const handleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  if (tenantLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search POs..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="flex gap-1 items-center">
          {["pending_review", "sent", "confirmed", "in_transit", "closed"].map(
            (s) => (
              <Button
                key={s}
                variant={statusFilter === s ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(statusFilter === s ? null : s)}
              >
                {STATUS_LABELS[s]}
              </Button>
            ),
          )}
          {statusFilter && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStatusFilter(null)}
            >
              Clear
            </Button>
          )}
        </div>
        <Button variant="outline" size="icon" aria-label="Filter">
          <FilterIcon className="size-4" />
        </Button>
        {selected.size > 0 && (
          <Button size="sm" onClick={() => setShowApproveModal(true)}>
            Approve ({selected.size})
          </Button>
        )}
      </div>

      {/* error */}
      {isError && (
        <ErrorBanner
          message={(error as Error)?.message ?? "Failed to load POs"}
          onRetry={() => refetch()}
        />
      )}

      {/* table */}
      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={
                      (data?.data?.length ?? 0) > 0 &&
                      selected.size === (data?.data?.length ?? 0)
                    }
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>PO #</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Strategy</TableHead>
                <TableHead>Items</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.data?.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center text-muted-foreground py-8"
                  >
                    No purchase orders found
                  </TableCell>
                </TableRow>
              ) : (
                data?.data?.map((po) => (
                  <TableRow
                    key={po.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/purchase-orders/${po.id}`)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selected.has(po.id)}
                        onCheckedChange={() => handleSelect(po.id)}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {po.po_number}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[po.status] ?? "outline"}>
                        {STATUS_LABELS[po.status] ?? po.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="capitalize">
                      {po.fulfillment_strategy}
                    </TableCell>
                    <TableCell>{po.items?.length ?? 0}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatPence(po.total)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(po.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* pagination */}
      {data?.pagination && data.pagination.total_pages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {data.pagination.page} of {data.pagination.total_pages} (
            {data.pagination.total} total)
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeftIcon className="size-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= (data.pagination.total_pages ?? 1)}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRightIcon className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* approve modal */}
      {showApproveModal && (
        <ApproveModal
          ids={Array.from(selected)}
          onClose={() => {
            setShowApproveModal(false);
            setSelected(new Set());
          }}
          onApproved={() => {
            refetch();
            setSelected(new Set());
          }}
        />
      )}
    </div>
  );
}
