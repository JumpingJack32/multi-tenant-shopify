"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { formatCurrency } from "@repo/shared-utils/index";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface Order {
  id: string;
  order_number: string;
  customer_email: string;
  status: string;
  total: number;
  subtotal: number;
  tax: number;
  shipping: number;
  currency: string;
  items: OrderItem[];
  shipping_address?: Record<string, string>;
}

export default function CheckoutSuccessPage() {
  const params = useParams();
  const searchParams = useSearchParams();

  const tenantSlug = params.tenant as string;
  const sessionId = searchParams.get("session_id");
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      setError("Missing checkout session reference.");
      return;
    }

    let retries = 0;
    const maxRetries = 5;
    const pollInterval = 1500;

    const fetchOrder = async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/v1/storefront/${tenantSlug}/orders/by-session/${sessionId}`,
        );

        if (res.ok) {
          const data: Order = await res.json();
          setOrder(data);
          setLoading(false);
          return;
        }

        if (res.status === 404 && retries < maxRetries) {
          retries++;
          setTimeout(fetchOrder, pollInterval);
        } else {
          throw new Error("We couldn't locate your order confirmation yet.");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
        setLoading(false);
      }
    };

    fetchOrder();
  }, [tenantSlug, sessionId]);

  if (loading) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-white" />
          <h2 className="text-lg font-medium text-white">
            Confirming your payment...
          </h2>
          <p className="text-sm text-white/60">
            We&apos;re finalizing your order details with Stripe.
          </p>
        </div>
      </main>
    );
  }

  if (error || !order) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center px-4">
        <div className="max-w-md text-center space-y-4">
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
            <p className="text-sm text-red-400">
              {error || "Unable to load order details."}
            </p>
          </div>
          <Link
            href={`/${tenantSlug}`}
            className="inline-block rounded bg-white/10 px-6 py-3 text-sm font-medium text-white hover:bg-white/20 transition-colors"
          >
            Return to Store
          </Link>
        </div>
      </main>
    );
  }

  const addr = order.shipping_address;

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-3xl px-4 py-12">
        {/* Header */}
        <div className="border-b border-white/10 pb-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-500/20">
            <svg
              className="h-6 w-6 text-green-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1
            data-testid="order-success-title"
            className="mt-4 text-3xl font-extrabold tracking-tight"
          >
            Thank you for your order!
          </h1>
          <p className="mt-2 text-sm text-white/60">
            Confirmation sent to{" "}
            <span className="font-medium text-white">
              {order.customer_email}
            </span>
          </p>
          <p className="mt-1 text-xs text-white/40">
            Order Reference:{" "}
            <span className="font-mono">{order.order_number || order.id}</span>
          </p>
        </div>

        {/* Order Items */}
        <div className="mt-8 space-y-6">
          <h2 className="text-lg font-semibold">Order Items</h2>
          <div className="divide-y divide-white/10 rounded-lg border border-white/10">
            {order.items?.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-4"
              >
                <div>
                  <p className="text-sm font-medium">{item.product_name}</p>
                  <p className="text-xs text-white/50">Qty: {item.quantity}</p>
                </div>
                <p className="text-sm font-medium">
                  {formatCurrency(
                    item.total_price || item.unit_price * item.quantity,
                  )}
                </p>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="rounded-lg bg-white/5 p-6 space-y-2 text-sm">
            <div className="flex justify-between text-white/60">
              <span>Subtotal</span>
              <span>
                {formatCurrency(order.total - order.tax - order.shipping)}
              </span>
            </div>
            {order.shipping > 0 && (
              <div className="flex justify-between text-white/60">
                <span>Shipping</span>
                <span>{formatCurrency(order.shipping)}</span>
              </div>
            )}
            {order.tax > 0 && (
              <div className="flex justify-between text-white/60">
                <span>Tax</span>
                <span>{formatCurrency(order.tax)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-white/10 pt-2 text-base font-bold">
              <span>Total Paid</span>
              <span>{formatCurrency(order.total)}</span>
            </div>
          </div>

          {/* Shipping Address */}
          {addr && addr.line1 && (
            <div className="rounded-lg border border-white/10 p-4 space-y-1 text-sm">
              <h3 className="font-semibold mb-2">Shipping Address</h3>
              <p className="text-white/70">{addr.line1}</p>
              {addr.line2 && <p className="text-white/70">{addr.line2}</p>}
              <p className="text-white/70">
                {addr.city}
                {addr.province ? `, ${addr.province}` : ""} {addr.postal_code}
              </p>
              <p className="text-white/70">{addr.country}</p>
            </div>
          )}
        </div>

        {/* CTA */}
        <div className="mt-10 flex justify-center">
          <Link
            href={`/${tenantSlug}/shop/all`}
            className="rounded bg-white px-6 py-3 text-sm font-medium text-black hover:bg-white/90 transition-colors"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    </main>
  );
}
