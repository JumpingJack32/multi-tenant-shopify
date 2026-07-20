"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useState } from "react";

export default function AccountPage() {
  const params = useParams();
  const tenantSlug = params.tenant as string;
  const [email, setEmail] = useState("");
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  const handleBilling = useCallback(async () => {
    if (!email.trim()) return;
    setPortalLoading(true);
    setPortalError(null);
    try {
      const res = await fetch(
        `/api/v1/storefront/${tenantSlug}/customer-portal`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customer_email: email.trim(), items: [] }),
        },
      );
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.detail || "Failed to launch billing portal");
      window.location.href = data.url;
    } catch (err) {
      setPortalError(
        err instanceof Error ? err.message : "Something went wrong",
      );
    } finally {
      setPortalLoading(false);
    }
  }, [tenantSlug, email]);

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-2xl px-4 py-12 space-y-8">
        <h1 className="text-3xl font-bold">My Account</h1>

        <div className="rounded-xl border border-white/10 p-6 space-y-4">
          <h2 className="text-lg font-semibold">Billing & Payment Methods</h2>
          <p className="text-sm text-white/60">
            Manage your saved cards, billing address, and invoice history
            through Stripe&apos;s secure portal.
          </p>

          <div className="space-y-2">
            <label className="text-sm font-medium text-white/80">
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded border border-white/10 bg-black px-3 py-2 text-white placeholder:text-white/40 focus:outline-none focus:border-white/30"
            />
          </div>

          {portalError && (
            <div className="rounded bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-400">
              {portalError}
            </div>
          )}

          <button
            onClick={handleBilling}
            disabled={portalLoading || !email.trim()}
            className="rounded bg-white px-6 py-3 text-sm font-medium text-black hover:bg-white/90 transition-colors disabled:opacity-50"
          >
            {portalLoading ? "Opening Stripe Portal..." : "Manage Billing"}
          </button>
        </div>

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
