import Link from "next/link";
import { notFound } from "next/navigation";
import { formatCents } from "@repo/shared-utils/currency";

import { fetchOrder } from "@/lib/storefront-api";

export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ tenant: string; orderId: string }>;
}) {
  const { tenant, orderId } = await params;
  const order = await fetchOrder(tenant, orderId);

  if (!order) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="font-heading text-3xl font-light tracking-wide mb-3">
            Thank You
          </h1>
          <p className="text-muted-foreground text-sm">
            Your order has been confirmed.
          </p>
        </div>

        <div className="border border-border rounded-sm p-6 mb-8">
          <div className="flex items-baseline justify-between mb-6">
            <div>
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-1">
                Order
              </p>
              <p className="font-mono text-sm">{order.order_number}</p>
            </div>
            <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
              {new Date(order.created_at).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>

          <div className="space-y-4">
            {order.items.map((item: any) => (
              <div
                key={item.id}
                className="flex items-start justify-between border-b border-border pb-4 last:border-b-0 last:pb-0"
              >
                <div>
                  <p className="font-medium text-sm">{item.product_name}</p>
                  {item.variant_name && (
                    <p className="font-mono text-xs text-muted-foreground mt-0.5">
                      {item.variant_name}
                    </p>
                  )}
                  <p className="font-mono text-xs text-muted-foreground mt-0.5">
                    Qty: {item.quantity} ×{" "}
                    {formatCents(item.unit_price, order.currency)}
                  </p>
                </div>
                <p className="font-mono text-sm">
                  {formatCents(item.total_price, order.currency)}
                </p>
              </div>
            ))}
          </div>

          <div className="border-t border-border mt-6 pt-4 space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-mono">
                {formatCents(order.subtotal, order.currency)}
              </span>
            </div>
            {order.tax > 0 && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Tax</span>
                <span className="font-mono">
                  {formatCents(order.tax, order.currency)}
                </span>
              </div>
            )}
            {order.shipping > 0 && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Shipping</span>
                <span className="font-mono">
                  {formatCents(order.shipping, order.currency)}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center pt-2 border-t border-border">
              <span className="font-medium">Total</span>
              <span className="font-mono font-semibold">
                {formatCents(order.total, order.currency)}
              </span>
            </div>
          </div>
        </div>

        <div className="text-center">
          <Link
            href={`/${tenant}/products`}
            className="inline-block text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    </main>
  );
}
