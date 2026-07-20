"use client";

import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import type { StripeElementsOptions } from "@stripe/stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";

import { useCart } from "@/hooks/use-cart";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "",
);

const darkTheme: StripeElementsOptions["appearance"] = {
  variables: {
    colorPrimary: "#ffffff",
    colorBackground: "#000000",
    colorText: "#ffffff",
    fontFamily: "Inter, sans-serif",
  },
};

interface CheckoutFormProps {
  tenantSlug: string;
}

function EmbeddedForm({
  tenantSlug,
  clientSecret,
  onComplete,
}: {
  tenantSlug: string;
  clientSecret: string;
  onComplete: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [email, setEmail] = useState("");

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!stripe || !elements || isSubmitting) return;

      setIsSubmitting(true);
      setError(null);

      const { error: confirmError, paymentIntent } =
        await stripe.confirmPayment({
          elements,
          redirect: "if_required",
        });

      if (confirmError) {
        setError(confirmError.message ?? "Payment failed");
        setIsSubmitting(false);
        return;
      }

      if (paymentIntent?.status === "succeeded") {
        try {
          const res = await fetch(`/api/v1/storefront/${tenantSlug}/orders`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              payment_intent_id: paymentIntent.id,
              customer_email: email,
              shipping_address: {},
            }),
          });
          if (!res.ok) throw new Error("Order creation failed");
          onComplete();
          router.push(`/${tenantSlug}/checkout/success`);
        } catch {
          setError(
            "Order confirmation failed. You will receive an email shortly.",
          );
          setIsSubmitting(false);
        }
      } else {
        setError("Payment did not complete");
        setIsSubmitting(false);
      }
    },
    [stripe, elements, tenantSlug, email, onComplete, router, isSubmitting],
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <label className="text-sm font-medium text-white/80">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded border border-white/10 bg-black px-3 py-2 text-white placeholder:text-white/40 focus:outline-none focus:border-white/30"
          placeholder="you@example.com"
        />
      </div>
      <PaymentElement />
      {error && (
        <div className="rounded bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-400">
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={!stripe || isSubmitting}
        className="w-full rounded bg-white px-6 py-3 text-sm font-medium text-black hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? "Processing..." : "Pay"}
      </button>
    </form>
  );
}

export default function CheckoutForm({ tenantSlug }: CheckoutFormProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { items, clear } = useCart();

  useEffect(() => {
    const init = async () => {
      try {
        const res = await fetch(
          `/api/v1/storefront/${tenantSlug}/checkout/intent`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              items: items.map((i) => ({
                variant_id: i.product_id,
                quantity: i.quantity,
              })),
              customer_email: "",
            }),
          },
        );
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || "Failed to initialize checkout");
        }
        const data = await res.json();
        setClientSecret(data.clientSecret);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Checkout unavailable");
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [tenantSlug, items]);

  if (loading) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white/60">Loading checkout...</div>
      </main>
    );
  }

  if (error || !clientSecret) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center px-4">
        <div className="max-w-md text-center space-y-4">
          <div className="text-red-400 text-lg">
            {error || "Checkout unavailable"}
          </div>
          <a
            href={`/${tenantSlug}/cart`}
            className="inline-block rounded bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20 transition-colors"
          >
            Back to Cart
          </a>
        </div>
      </main>
    );
  }

  const options: StripeElementsOptions = {
    clientSecret,
    appearance: darkTheme,
  };

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-3 space-y-6">
            <h1 className="text-2xl font-bold">Checkout</h1>
            <Elements stripe={stripePromise} options={options}>
              <EmbeddedForm
                tenantSlug={tenantSlug}
                clientSecret={clientSecret}
                onComplete={() => clear()}
              />
            </Elements>
          </div>
          <div className="lg:col-span-2">
            <div className="sticky top-24 rounded-xl border border-white/10 p-6 space-y-4">
              <h2 className="text-lg font-semibold">Order Summary</h2>
              {items.map((item) => (
                <div
                  key={item.product_id}
                  className="flex justify-between text-sm"
                >
                  <span className="text-white/60 truncate mr-2">
                    {item.name}
                  </span>
                  <span className="font-mono">
                    £ {((item.price ?? 0) / 100).toFixed(2)}
                  </span>
                </div>
              ))}
              <div className="border-t border-white/10 pt-4 flex justify-between font-semibold">
                <span>Total</span>
                <span className="font-mono">
                  £
                  {(
                    items.reduce((s, i) => s + (i.price ?? 0) * i.quantity, 0) /
                    100
                  ).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
