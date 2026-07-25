"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { formatCents } from "@repo/shared-utils/currency";
import { Badge } from "@repo/ui/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { ExternalLinkIcon, PackageIcon, TruckIcon, CheckCircle2Icon } from "@repo/ui/icons";

import { useTenantStore } from "@/hooks/use-tenant-store";
import { fetchOrder } from "@/lib/storefront-api";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  paid: "bg-green-100 text-green-800",
  processing: "bg-purple-100 text-purple-800",
  shipped: "bg-indigo-100 text-indigo-800",
  delivered: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-red-100 text-red-800",
  refunded: "bg-gray-100 text-gray-800",
};

function StatusTimeline({ status, fulfillments }: { status: string; fulfillments: any[] }) {
  const isDigital = fulfillments.length === 0;
  const steps = isDigital
    ? [
        { label: "Placed", done: true },
        { label: "Fulfilled", done: status === "delivered" || status === "paid" || status === "processing" },
      ]
    : [
        { label: "Placed", done: true },
        { label: "Processing", done: status !== "pending" },
        { label: "Shipped", done: fulfillments.some((f: any) => f.status === "transit" || f.status === "delivered") },
        { label: "Delivered", done: fulfillments.some((f: any) => f.status === "delivered") },
      ];

  return (
    <div className="flex items-center gap-2 py-4">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center gap-2 flex-1 last:flex-none">
          <div className={`flex items-center gap-1.5 text-sm ${step.done ? "text-primary" : "text-muted-foreground"}`}>
            {step.done ? <CheckCircle2Icon className="h-4 w-4" /> : <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />}
            <span>{step.label}</span>
          </div>
          {i < steps.length - 1 && <div className={`flex-1 h-px ${step.done ? "bg-primary" : "bg-border"}`} />}
        </div>
      ))}
    </div>
  );
}

function FulfillmentCard({ fulfillment }: { fulfillment: any }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          {fulfillment.status === "delivered" ? (
            <CheckCircle2Icon className="h-4 w-4 text-green-500" />
          ) : fulfillment.status === "transit" ? (
            <TruckIcon className="h-4 w-4 text-blue-500" />
          ) : (
            <PackageIcon className="h-4 w-4 text-muted-foreground" />
          )}
          Shipment — <span className="capitalize">{fulfillment.status}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {fulfillment.carrier && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Carrier</span>
            <span>{fulfillment.carrier}</span>
          </div>
        )}
        {fulfillment.tracking_number && (
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Tracking</span>
            <span className="font-mono text-xs">{fulfillment.tracking_number}</span>
          </div>
        )}
        {fulfillment.tracking_url && (
          <a
            href={fulfillment.tracking_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground mt-2"
          >
            <ExternalLinkIcon className="h-3 w-3" />
            Track Shipment
          </a>
        )}
        {fulfillment.shipped_at && (
          <p className="text-xs text-muted-foreground">
            Shipped on {new Date(fulfillment.shipped_at).toLocaleDateString()}
          </p>
        )}
        {fulfillment.delivered_at && (
          <p className="text-xs text-muted-foreground">
            Delivered on {new Date(fulfillment.delivered_at).toLocaleDateString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function OrderDetailPage() {
  const { tenant, id } = useParams<{ tenant: string; id: string }>();
  const currency = useTenantStore((s) => s.currency);

  const { data: order, isLoading } = useQuery({
    queryKey: ["order", tenant, id],
    queryFn: () => fetchOrder(tenant, id),
  });

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 text-center">
        <p className="text-muted-foreground">Order not found</p>
        <Link href={`/${tenant}/account/orders`} className="text-sm underline mt-4 inline-block">
          Back to orders
        </Link>
      </div>
    );
  }

  const fulfillments = (order as any).fulfillments ?? [];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link
        href={`/${tenant}/account/orders`}
        className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-block"
      >
        ← Back to orders
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{order.order_number}</h1>
          <p className="text-sm text-muted-foreground">
            Placed on {new Date(order.created_at).toLocaleDateString()}
          </p>
        </div>
        <Badge className={STATUS_COLORS[order.status] ?? ""}>
          {order.status}
        </Badge>
      </div>

      <StatusTimeline status={order.status} fulfillments={fulfillments} />

      {/* Fulfillment cards */}
      {fulfillments.length > 0 && (
        <div className="space-y-3 my-6">
          <h2 className="text-sm font-semibold">Shipments</h2>
          {fulfillments.map((f: any) => (
            <FulfillmentCard key={f.id} fulfillment={f} />
          ))}
        </div>
      )}

      {/* Line items */}
      {order.items && order.items.length > 0 && (
        <div className="my-6">
          <h2 className="text-sm font-semibold mb-3">Items</h2>
          <div className="space-y-3">
            {order.items.map((item: any) => (
              <div key={item.id} className="flex items-start gap-3 border-b border-border pb-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{item.product_name}</p>
                  {item.variant_name && (
                    <p className="text-xs text-muted-foreground">{item.variant_name}</p>
                  )}
                  <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                </div>
                <div className="text-sm font-mono text-right">
                  <p>{formatCents(item.total_price, currency)}</p>
                  <p className="text-xs text-muted-foreground">{formatCents(item.unit_price, currency)} each</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Order summary */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-sm">Order Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-mono">{formatCents(order.subtotal, currency)}</span>
          </div>
          {order.shipping > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Shipping</span>
              <span className="font-mono">{formatCents(order.shipping, currency)}</span>
            </div>
          )}
          {order.tax > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax</span>
              <span className="font-mono">{formatCents(order.tax, currency)}</span>
            </div>
          )}
          {order.discount > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Discount</span>
              <span className="font-mono">-{formatCents(order.discount, currency)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold pt-2 border-t border-border">
            <span>Total</span>
            <span className="font-mono">{formatCents(order.total, currency)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Shipping address */}
      {order.shipping_address && Object.keys(order.shipping_address).length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-sm">Shipping Address</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {(order.shipping_address as any).line1 && <p>{(order.shipping_address as any).line1}</p>}
            {(order.shipping_address as any).city && <p>{(order.shipping_address as any).city}</p>}
            {(order.shipping_address as any).postal_code && <p>{(order.shipping_address as any).postal_code}</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
