"use client";

import { formatCurrency } from "@repo/tenant-orm/utils";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
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
import { useState } from "react";

import { ErrorBanner } from "@/components/ui/error-banner";
import { useTenantContext } from "@/contexts/tenant-context";
import {
  useOrder,
  useOrderLinkedPOs,
  useUpdateOrderStatus,
} from "@/features/orders/hooks/use-orders";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  paid: "Paid",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

const STATUS_VARIANTS: Record<string, string> = {
  pending: "secondary",
  confirmed: "outline",
  paid: "default",
  processing: "secondary",
  shipped: "secondary",
  delivered: "default",
  cancelled: "destructive",
  refunded: "destructive",
};

const STATUS_ORDER = [
  "pending",
  "confirmed",
  "paid",
  "processing",
  "shipped",
  "delivered",
];

export function OrderDetailContent({ id }: { id: string }) {
  const router = useRouter();
  const { currentTenantId, isLoading: tenantLoading } = useTenantContext();
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const {
    data: order,
    isLoading,
    isError,
    error,
    refetch,
  } = useOrder(id, currentTenantId);
  const { data: linkedPOs } = useOrderLinkedPOs(id, currentTenantId);
  const updateStatus = useUpdateOrderStatus(currentTenantId);

  const handleAction = async (data: Record<string, unknown>) => {
    setActionLoading(true);
    setActionError(null);
    try {
      await updateStatus.mutateAsync({ id, data });
      refetch();
    } catch (err) {
      setActionError((err as Error)?.message ?? "Action failed");
    } finally {
      setActionLoading(false);
    }
  };

  if (tenantLoading || isLoading) {
    return (
      <div className="p-6 space-y-4" data-testid="loading-skeleton">
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
          message={(error as Error)?.message ?? "Failed to load order"}
          onRetry={() => refetch()}
        />
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push("/orders")}
        >
          Back to Orders
        </Button>
      </div>
    );
  }

  if (!order) return null;

  const currentIdx = STATUS_ORDER.indexOf(order.status);

  return (
    <div className="p-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold font-mono">
              {order.order_number}
            </h1>
            <Badge
              variant={
                (STATUS_VARIANTS[order.status] as
                  | "default"
                  | "secondary"
                  | "destructive"
                  | "outline") ?? "outline"
              }
            >
              {STATUS_LABELS[order.status] ?? order.status}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1">
            Created {new Date(order.created_at).toLocaleDateString()}
            {order.customer_email && <> &middot; {order.customer_email}</>}
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push("/orders")}>
          Back to Orders
        </Button>
      </div>

      {actionError && <ErrorBanner message={actionError} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
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
                    <TableHead>Variant</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items?.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.product_name}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {item.sku || "—"}
                      </TableCell>
                      <TableCell>{item.variant_name ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        {item.quantity}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(item.unit_price, order.currency)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(item.total_price, order.currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {linkedPOs && linkedPOs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Procurement</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>PO Number</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {linkedPOs.map((po) => (
                      <TableRow key={po.id}>
                        <TableCell>
                          <Link
                            href={`/purchase-orders/${po.id}`}
                            className="font-mono text-sm underline underline-offset-2 hover:text-foreground"
                          >
                            {po.po_number}
                          </Link>
                        </TableCell>
                        <TableCell>{po.supplier_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{po.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(po.total, "USD")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {order.notes || "No notes"}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Status Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {STATUS_ORDER.map((s, idx) => {
                const isPast = idx < currentIdx;
                const isCurrent = idx === currentIdx;
                const isCancelled = order.status === "cancelled";
                const dotColor = isCancelled
                  ? "bg-destructive"
                  : isCurrent
                    ? "bg-primary"
                    : isPast
                      ? "bg-primary/60"
                      : "bg-muted-foreground/20";
                return (
                  <div key={s} className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
                    <span
                      className={`text-sm ${
                        isCurrent
                          ? "font-semibold text-foreground"
                          : isPast || isCancelled
                            ? "text-muted-foreground"
                            : "text-muted-foreground/50"
                      }`}
                    >
                      {STATUS_LABELS[s] ?? s}
                    </span>
                    {isCurrent && (
                      <Badge variant="outline" className="text-xs ml-auto">
                        Current
                      </Badge>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {order.status === "pending" &&
                order.payment_status === "unpaid" && (
                  <>
                    <Button
                      className="w-full"
                      disabled={actionLoading}
                      onClick={() => handleAction({ payment_status: "paid" })}
                    >
                      Mark as Paid
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      disabled={actionLoading}
                      onClick={() => handleAction({ status: "cancelled" })}
                    >
                      Cancel Order
                    </Button>
                  </>
                )}
              {order.status === "confirmed" && (
                <Button
                  className="w-full"
                  disabled={actionLoading}
                  onClick={() => handleAction({ status: "shipped" })}
                >
                  Ship Order
                </Button>
              )}
              {order.status === "shipped" && (
                <Button
                  className="w-full"
                  disabled={actionLoading}
                  onClick={() => handleAction({ status: "delivered" })}
                >
                  Mark as Delivered
                </Button>
              )}
              {order.status !== "cancelled" &&
                order.status !== "delivered" &&
                order.status !== "refunded" &&
                order.status !== "pending" && (
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={actionLoading}
                    onClick={() => handleAction({ status: "cancelled" })}
                  >
                    Cancel Order
                  </Button>
                )}
              {(order.status === "delivered" || order.status === "shipped") && (
                <Button
                  variant="destructive"
                  className="w-full"
                  disabled={actionLoading}
                  onClick={() => handleAction({ status: "refunded" })}
                >
                  Refund
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payment</span>
                <span>{order.payment_method ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-mono">
                  {formatCurrency(order.subtotal, order.currency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax</span>
                <span className="font-mono">
                  {formatCurrency(order.tax, order.currency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipping</span>
                <span className="font-mono">
                  {formatCurrency(order.shipping, order.currency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Discount</span>
                <span className="font-mono">
                  {order.discount > 0
                    ? `-${formatCurrency(order.discount, order.currency)}`
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between font-semibold border-t pt-2">
                <span>Total</span>
                <span className="font-mono">
                  {formatCurrency(order.total, order.currency)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
