"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import { Skeleton } from "@repo/ui/components/ui/skeleton";

import { ErrorBanner } from "@/components/ui/error-banner";
import { useTenantContext } from "@/contexts/tenant-context";
import { api } from "@/lib/api/client";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  pending: "bg-amber-100 text-amber-800",
  in_transit: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

const STATUS_ACTIONS: Record<string, { label: string; target: string }[]> = {
  draft: [
    { label: "Send", target: "pending" },
    { label: "Cancel", target: "cancelled" },
  ],
  pending: [
    { label: "Mark In Transit", target: "in_transit" },
    { label: "Cancel", target: "cancelled" },
  ],
  in_transit: [
    { label: "Complete", target: "completed" },
    { label: "Cancel", target: "cancelled" },
  ],
};

export default function TransferDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { currentTenantId } = useTenantContext();

  const {
    data: transfer,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["stock-transfer", id, currentTenantId],
    queryFn: () => api.stockTransfers.get(id, { tenantId: currentTenantId }),
    enabled: !!id && !!currentTenantId,
  });

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.stockTransfers.update(id, data, { tenantId: currentTenantId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock-transfer", id] });
      qc.invalidateQueries({ queryKey: ["stock-transfers"] });
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !transfer) {
    return (
      <div className="p-6">
        <ErrorBanner
          message={(error as Error)?.message ?? "Transfer not found"}
          onRetry={() => refetch()}
        />
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push("/transfers")}
        >
          Back to Transfers
        </Button>
      </div>
    );
  }

  const actions = STATUS_ACTIONS[transfer.status] ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{transfer.transfer_number}</h1>
            <Badge className={STATUS_COLORS[transfer.status] ?? ""}>
              {transfer.status.replace("_", " ")}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {transfer.origin_location_name} →{" "}
            {transfer.destination_location_name}
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push("/transfers")}>
          Back
        </Button>
      </div>

      {actions.length > 0 && (
        <div className="flex gap-2">
          {actions.map((action) => (
            <Button
              key={action.target}
              variant={
                action.target === "cancelled" ? "destructive" : "default"
              }
              size="sm"
              onClick={() => updateMutation.mutate({ status: action.target })}
              disabled={updateMutation.isPending}
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Transfer Items
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-4 pb-2 font-medium">Product</th>
                  <th className="px-4 pb-2 font-medium">SKU</th>
                  <th className="px-4 pb-2 text-right font-medium">Qty</th>
                </tr>
              </thead>
              <tbody>
                {transfer.items.map((item) => (
                  <tr key={item.id} className="border-b last:border-b-0">
                    <td className="px-4 py-2">{item.product_name}</td>
                    <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                      {item.sku}
                    </td>
                    <td className="px-4 py-2 text-right font-mono">
                      {item.quantity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                Shipment Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {transfer.carrier && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Carrier</span>
                  <span>{transfer.carrier}</span>
                </div>
              )}
              {transfer.tracking_number && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tracking</span>
                  <span className="font-mono">{transfer.tracking_number}</span>
                </div>
              )}
              {transfer.estimated_arrival && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Est. Arrival</span>
                  <span>{transfer.estimated_arrival}</span>
                </div>
              )}
              {!transfer.carrier &&
                !transfer.tracking_number &&
                !transfer.estimated_arrival && (
                  <p className="text-muted-foreground">No shipment details</p>
                )}
            </CardContent>
          </Card>

          {transfer.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {transfer.notes}
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{new Date(transfer.created_at).toLocaleString()}</span>
              </div>
              {transfer.sent_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sent</span>
                  <span>{new Date(transfer.sent_at).toLocaleString()}</span>
                </div>
              )}
              {transfer.completed_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Completed</span>
                  <span>
                    {new Date(transfer.completed_at).toLocaleString()}
                  </span>
                </div>
              )}
              {transfer.cancelled_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cancelled</span>
                  <span>
                    {new Date(transfer.cancelled_at).toLocaleString()}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
