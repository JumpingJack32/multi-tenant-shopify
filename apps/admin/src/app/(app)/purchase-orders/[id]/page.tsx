"use client";

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
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use } from "react";
import { useState } from "react";

import { ErrorBanner } from "@/components/ui/error-banner";
import { useTenantContext } from "@/contexts/tenant-context";
import {
  useApprovePO,
  useCancelPO,
  useClosePO,
  useConfirmPO,
  useMarkPOInTransit,
  usePurchaseOrder,
  useUpdatePOTracking,
} from "@/features/purchase-orders/hooks/use-purchase-orders";

function formatPence(n: number): string {
  return `£${(n / 100).toFixed(2)}`;
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

const STATUS_ORDER = [
  "draft",
  "pending_review",
  "sent",
  "confirmed",
  "in_transit",
  "partially_received",
  "received",
  "closed",
];

export default function PODetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(props.params);
  const router = useRouter();
  const { currentTenantId, isLoading: tenantLoading } = useTenantContext();

  const {
    data: po,
    isLoading,
    isError,
    error,
    refetch,
  } = usePurchaseOrder(id, currentTenantId);
  const approvePO = useApprovePO(currentTenantId);
  const cancelPO = useCancelPO(currentTenantId);
  const confirmPO = useConfirmPO(currentTenantId);
  const markInTransit = useMarkPOInTransit(currentTenantId);
  const closePO = useClosePO(currentTenantId);
  const updateTracking = useUpdatePOTracking(currentTenantId);

  const [trackingNumber, setTrackingNumber] = useState("");
  const [carrier, setCarrier] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const currentIdx = STATUS_ORDER.indexOf(po?.status ?? "");

  const handleAction = async (action: () => Promise<unknown>) => {
    setActionLoading(true);
    setActionError(null);
    try {
      await action();
      refetch();
    } catch (err) {
      setActionError((err as Error)?.message ?? "Action failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateTracking = async () => {
    setActionLoading(true);
    setActionError(null);
    try {
      await updateTracking.mutateAsync({
        id,
        data: {
          tracking_number: trackingNumber || null,
          carrier: carrier || null,
        },
      });
      refetch();
      setTrackingNumber("");
      setCarrier("");
    } catch (err) {
      setActionError((err as Error)?.message ?? "Failed to update tracking");
    } finally {
      setActionLoading(false);
    }
  };

  if (tenantLoading || isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6">
        <ErrorBanner
          message={(error as Error)?.message ?? "Purchase order not found"}
          onRetry={() => refetch()}
        />
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push("/purchase-orders")}
        >
          Back to POs
        </Button>
      </div>
    );
  }

  if (!po) return null;

  return (
    <div className="p-6">
      {/* header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold font-mono">{po.po_number}</h1>
            <Badge variant={STATUS_VARIANTS[po.status] ?? "outline"}>
              {STATUS_LABELS[po.status] ?? po.status}
            </Badge>
            {po.source_order_number && (
              <Link
                href={`/orders?search=${po.source_order_number}`}
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
              >
                from {po.source_order_number}
              </Link>
            )}
          </div>
          <p className="text-muted-foreground mt-1">
            Created {new Date(po.created_at).toLocaleDateString()} &middot;{" "}
            {po.items?.length ?? 0} item
            {(po.items?.length ?? 0) !== 1 ? "s" : ""}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => router.push("/purchase-orders")}
        >
          Back to List
        </Button>
      </div>

      {actionError && <ErrorBanner message={actionError} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* main column */}
        <div className="lg:col-span-2 space-y-6">
          {/* items table */}
          <Card>
            <CardHeader>
              <CardTitle>Items</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit Cost</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {po.items?.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center text-muted-foreground py-6"
                      >
                        No items
                      </TableCell>
                    </TableRow>
                  ) : (
                    po.items?.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="font-medium">{item.product_name}</div>
                          <div className="text-sm text-muted-foreground">
                            {item.variant_label}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {item.supplier_sku ?? "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.quantity}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatPence(item.unit_cost)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatPence(item.subtotal)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <div className="flex justify-end mt-4 space-x-6 text-sm">
                <div>
                  <span className="text-muted-foreground">Subtotal: </span>
                  <span className="font-mono font-medium">
                    {formatPence(po.subtotal)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Tax: </span>
                  <span className="font-mono font-medium">
                    {formatPence(po.tax)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Shipping: </span>
                  <span className="font-mono font-medium">
                    {formatPence(po.shipping_cost)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Total: </span>
                  <span className="font-mono font-bold">
                    {formatPence(po.total)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* notes */}
          {po.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{po.notes}</p>
              </CardContent>
            </Card>
          )}

          {/* tracking */}
          <Card>
            <CardHeader>
              <CardTitle>Tracking</CardTitle>
            </CardHeader>
            <CardContent>
              {po.tracking_number || po.carrier ? (
                <div className="text-sm space-y-1 mb-4">
                  {po.tracking_number && (
                    <div>
                      <span className="text-muted-foreground">Tracking #:</span>{" "}
                      {po.tracking_number}
                    </div>
                  )}
                  {po.carrier && (
                    <div>
                      <span className="text-muted-foreground">Carrier:</span>{" "}
                      {po.carrier}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mb-4">
                  No tracking information yet
                </p>
              )}
              <div className="flex gap-3 items-end">
                <div className="space-y-1">
                  <Label htmlFor="tracking-number" className="text-xs">
                    Tracking Number
                  </Label>
                  <Input
                    id="tracking-number"
                    size={20}
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="e.g. 1Z999AA10123456784"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="carrier" className="text-xs">
                    Carrier
                  </Label>
                  <Input
                    id="carrier"
                    size={12}
                    value={carrier}
                    onChange={(e) => setCarrier(e.target.value)}
                    placeholder="e.g. UPS"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={handleUpdateTracking}
                  disabled={actionLoading || (!trackingNumber && !carrier)}
                >
                  Update
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* sidebar */}
        <div className="space-y-6">
          {/* status timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {STATUS_ORDER.map((s, idx) => {
                  const isPast = currentIdx >= idx && po.status !== "cancelled";
                  const isCurrent = po.status === s;
                  return (
                    <div key={s} className="flex items-center gap-3 text-sm">
                      <div
                        className={`size-2 rounded-full shrink-0 ${
                          po.status === "cancelled" && isCurrent
                            ? "bg-destructive"
                            : isCurrent
                              ? "bg-primary ring-2 ring-primary/30"
                              : isPast
                                ? "bg-primary/60"
                                : "bg-muted-foreground/30"
                        }`}
                      />
                      <span
                        className={
                          isCurrent
                            ? "font-medium"
                            : isPast
                              ? "text-muted-foreground/60"
                              : "text-muted-foreground/40"
                        }
                      >
                        {STATUS_LABELS[s]}
                      </span>
                      {isCurrent && !["closed", "cancelled"].includes(s) && (
                        <span className="text-xs text-primary ml-auto">
                          Current
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* actions */}
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {po.status === "pending_review" && (
                <Button
                  className="w-full"
                  onClick={() => handleAction(() => approvePO.mutateAsync(id))}
                  disabled={actionLoading}
                >
                  {actionLoading ? "Processing..." : "Approve & Send"}
                </Button>
              )}
              {po.status === "draft" && (
                <Button
                  className="w-full"
                  onClick={() => handleAction(() => approvePO.mutateAsync(id))}
                  disabled={actionLoading}
                >
                  {actionLoading ? "Processing..." : "Approve & Send"}
                </Button>
              )}
              {po.status === "sent" && (
                <Button
                  className="w-full"
                  onClick={() => handleAction(() => confirmPO.mutateAsync(id))}
                  disabled={actionLoading}
                >
                  {actionLoading ? "Processing..." : "Mark Confirmed"}
                </Button>
              )}
              {po.status === "confirmed" && (
                <Button
                  className="w-full"
                  onClick={() =>
                    handleAction(() => markInTransit.mutateAsync(id))
                  }
                  disabled={actionLoading}
                >
                  {actionLoading ? "Processing..." : "Mark In Transit"}
                </Button>
              )}
              {po.status === "in_transit" && (
                <Button
                  className="w-full"
                  onClick={() => handleAction(() => closePO.mutateAsync(id))}
                  disabled={actionLoading}
                >
                  {actionLoading ? "Processing..." : "Close PO"}
                </Button>
              )}
              {!["closed", "cancelled"].includes(po.status) && (
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => handleAction(() => cancelPO.mutateAsync(id))}
                  disabled={actionLoading}
                >
                  Cancel PO
                </Button>
              )}
            </CardContent>
          </Card>

          {/* metadata */}
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Strategy</span>
                <span className="capitalize">{po.fulfillment_strategy}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{new Date(po.created_at).toLocaleDateString()}</span>
              </div>
              {po.sent_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sent</span>
                  <span>{new Date(po.sent_at).toLocaleDateString()}</span>
                </div>
              )}
              {po.confirmed_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Confirmed</span>
                  <span>{new Date(po.confirmed_at).toLocaleDateString()}</span>
                </div>
              )}
              {po.closed_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Closed</span>
                  <span>{new Date(po.closed_at).toLocaleDateString()}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
