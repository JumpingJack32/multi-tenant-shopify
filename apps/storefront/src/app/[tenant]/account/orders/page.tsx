"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { OrderResponse } from "@repo/codegen/client/types.gen";
import { formatCents } from "@repo/shared-utils/currency";
import { Badge } from "@repo/ui/components/ui/badge";
import { Skeleton } from "@repo/ui/components/ui/skeleton";

import { useTenantStore } from "@/hooks/use-tenant-store";
import { fetchCustomerOrders } from "@/lib/storefront-api";

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

export default function OrdersPage() {
  const { tenant } = useParams<{ tenant: string }>();
  const currency = useTenantStore((s) => s.currency);

  // For now, read email from the URL or use a stored value
  // In production, this comes from the Clerk session
  const customerEmail = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("email") ?? ""
    : "";

  const { data: orders, isLoading } = useQuery({
    queryKey: ["customer-orders", tenant, customerEmail],
    queryFn: () => fetchCustomerOrders(tenant, customerEmail),
    enabled: !!customerEmail,
  });

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Order History</h1>

      {!customerEmail ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground mb-4">Sign in to view your orders</p>
          <Link
            href={`/${tenant}/products`}
            className="text-sm font-medium underline underline-offset-4"
          >
            Continue Shopping
          </Link>
        </div>
      ) : isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : !orders || orders.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground mb-4">No orders yet</p>
          <Link
            href={`/${tenant}/products`}
            className="text-sm font-medium underline underline-offset-4"
          >
            Start Shopping
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order: OrderResponse) => (
            <Link
              key={order.id}
              href={`/${tenant}/account/orders/${order.id}`}
              className="block border border-border rounded-lg p-4 hover:border-foreground/40 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-sm">{order.order_number}</span>
                <Badge className={STATUS_COLORS[order.status] ?? ""}>
                  {order.status}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{new Date(order.created_at).toLocaleDateString()}</span>
                <span className="font-mono">{formatCents(order.total, currency)}</span>
              </div>
              {order.items && order.items.length > 0 && (
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  {order.items.slice(0, 3).map((item: any) => (
                    <span key={item.id} className="truncate max-w-32">
                      {item.product_name}
                    </span>
                  ))}
                  {order.items.length > 3 && (
                    <span>+{order.items.length - 3} more</span>
                  )}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
