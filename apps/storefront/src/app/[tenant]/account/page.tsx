"use client";

import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CreditCardIcon, Loader2Icon } from "@repo/ui/icons";

import {
  createCustomerPortal,
  fetchPaymentMethods,
  type SavedPaymentMethod,
} from "@/lib/storefront-api";

export default function AccountPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const tenantSlug = params.tenant as string;
  const { user, isLoaded: clerkLoaded } = useUser();

  const clerkEmail = user?.primaryEmailAddress?.emailAddress ?? "";
  const [email, setEmail] = useState(clerkEmail);
  const [orderNumber, setOrderNumber] = useState("");
  const [shippingZip, setShippingZip] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<SavedPaymentMethod[]>([]);
  const [billingMessage, setBillingMessage] = useState("");

  useEffect(() => {
    if (clerkLoaded && clerkEmail && !email) setEmail(clerkEmail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clerkLoaded, clerkEmail]);

  // Handle ?billing=1 return from Stripe portal: refresh preview + success alert
  useEffect(() => {
    if (searchParams.get("billing") === "1") {
      setBillingMessage("Billing details updated.");
      loadPaymentMethods();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const loadPaymentMethods = useCallback(async () => {
    if (!email.trim()) return;
    const methods = await fetchPaymentMethods(tenantSlug, email.trim());
    setPaymentMethods(methods);
  }, [tenantSlug, email]);

  const handleVerify = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await createCustomerPortal(tenantSlug, {
        customer_email: clerkEmail || email.trim(),
        order_number: orderNumber.trim() || undefined,
        shipping_zip: shippingZip.trim() || undefined,
      });
      setVerified(true);
      await loadPaymentMethods();
      if (result.url) window.location.href = result.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  }, [tenantSlug, clerkEmail, email, orderNumber, shippingZip, loadPaymentMethods]);

  const isRegistered = clerkLoaded && !!clerkEmail;

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-2xl px-4 py-12 space-y-8">
        <h1 className="text-3xl font-bold">My Account</h1>

        {billingMessage && (
          <div className="rounded bg-green-500/10 border border-green-500/30 px-3 py-2 text-sm text-green-400">
            {billingMessage}
          </div>
        )}

        <div className="rounded-xl border border-white/10 p-6 space-y-4">
          <h2 className="text-lg font-semibold">Billing & Payment Methods</h2>
          <p className="text-sm text-white/60">
            {isRegistered
              ? "Manage your saved cards, billing address, and invoice history."
              : "Verify your details to manage billing. Your email must match a paid order."}
          </p>

          <div className="space-y-2">
            <label className="text-sm font-medium text-white/80">Email address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              readOnly={isRegistered}
              placeholder="you@example.com"
              className="w-full rounded border border-white/10 bg-black px-3 py-2 text-white placeholder:text-white/40 focus:outline-none focus:border-white/30 disabled:opacity-60"
            />
          </div>

          {!isRegistered && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/80">
                    Order number (optional if using zip)
                  </label>
                  <input
                    type="text"
                    value={orderNumber}
                    onChange={(e) => setOrderNumber(e.target.value)}
                    placeholder="#1234"
                    className="w-full rounded border border-white/10 bg-black px-3 py-2 text-white placeholder:text-white/40 focus:outline-none focus:border-white/30"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/80">
                    Shipping ZIP (optional if using order number)
                  </label>
                  <input
                    type="text"
                    value={shippingZip}
                    onChange={(e) => setShippingZip(e.target.value)}
                    placeholder="SW1A"
                    className="w-full rounded border border-white/10 bg-black px-3 py-2 text-white placeholder:text-white/40 focus:outline-none focus:border-white/30"
                  />
                </div>
              </div>
              <p className="text-xs text-white/40">
                Provide either your order number or shipping ZIP alongside your
                email to verify ownership.
              </p>
            </>
          )}

          {error && (
            <div className="rounded bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-400">
              {error}
            </div>
          )}

          <button
            onClick={handleVerify}
            disabled={loading || !email.trim()}
            className="rounded bg-white px-6 py-3 text-sm font-medium text-black hover:bg-white/90 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <Loader2Icon className="h-4 w-4 animate-spin" />
            ) : (
              "Manage Billing"
            )}
          </button>
        </div>

        {/* Saved payment methods preview */}
        {verified && (
          <div className="rounded-xl border border-white/10 p-6 space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <CreditCardIcon className="h-4 w-4" /> Saved Payment Methods
            </h2>
            {paymentMethods.length === 0 ? (
              <p className="text-sm text-white/60">No saved cards on file.</p>
            ) : (
              <div className="space-y-2">
                {paymentMethods.map((pm) => (
                  <div
                    key={pm.id}
                    className="flex items-center justify-between rounded border border-white/10 px-4 py-3 text-sm"
                  >
                    <span className="capitalize text-white/80">{pm.brand}</span>
                    <span className="font-mono text-white/80">
                      •••• {pm.last4}
                    </span>
                    <span className="text-white/50">
                      {String(pm.exp_month).padStart(2, "0")}/{pm.exp_year}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <Link
          href={`/${tenantSlug}/shop/all`}
          className="inline-block text-sm text-white/60 hover:text-white transition-colors"
        >
          &larr; Back to shop
        </Link>
      </div>
    </main>
  );
}
