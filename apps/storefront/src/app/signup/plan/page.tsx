"use client";

import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, useEffect } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_cents_monthly: number;
  price_cents_yearly: number;
  trial_days: number;
  features: string[];
}

function PlanSelection() {
  const { getToken } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedSlug = searchParams.get("plan") ?? "starter";
  const [plans, setPlans] = useState<Plan[]>([]);
  const [annual, setAnnual] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API_URL}/api/v1/public/plans`)
      .then((r) => r.json())
      .then(setPlans)
      .catch(() => {});
  }, []);

  const handleSelect = async (planSlug: string) => {
    setLoading(true);
    setError("");

    try {
      const token = await getToken();
      const name = prompt("Store name:") || "My Store";
      const slug = prompt("Store subdomain (e.g., mystore):") || "mystore";

      if (!token) {
        setError("Please sign in first");
        setLoading(false);
        return;
      }

      const res = await fetch(`${API_URL}/api/v1/public/tenants`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, slug, plan_slug: planSlug }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.detail ?? "Sign-up failed");
        setLoading(false);
        return;
      }

      const data = await res.json();
      router.push(`/signup/welcome?name=${encodeURIComponent(data.name)}&url=${encodeURIComponent(data.admin_url)}`);
    } catch (e) {
      setError("An error occurred. Please try again.");
      setLoading(false);
    }
  };

  const selected = plans.find((p) => p.slug === selectedSlug) ?? plans[0];

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 md:px-6 md:py-24">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight">Choose your plan</h1>
          <p className="mt-2 text-muted-foreground">
            You selected <span className="font-medium text-foreground capitalize">{selectedSlug}</span>.
            <Link href="/signup" className="ml-2 text-xs underline hover:text-foreground">
              Change
            </Link>
          </p>
        </div>

        {selected && (
          <div className="rounded-lg border border-border/40 p-8">
            <h3 className="text-xl font-semibold">{selected.name}</h3>
            {selected.description && (
              <p className="mt-1 text-sm text-muted-foreground">{selected.description}</p>
            )}

            {/* Monthly/annual toggle */}
            <div className="flex items-center gap-3 mt-6">
              <span className={`text-sm ${!annual ? "text-foreground font-medium" : "text-muted-foreground"}`}>Monthly</span>
              <button
                onClick={() => setAnnual(!annual)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${annual ? "bg-primary" : "bg-muted-foreground/30"}`}
                aria-label="Toggle annual billing"
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${annual ? "translate-x-[22px]" : "translate-x-[2px]"}`} />
              </button>
              <span className={`text-sm ${annual ? "text-foreground font-medium" : "text-muted-foreground"}`}>Annual</span>
              {annual && <span className="text-xs text-green-600 font-medium">Save 20%</span>}
            </div>

            <div className="mt-6">
              <span className="text-4xl font-bold">
                £{((annual ? selected.price_cents_yearly : selected.price_cents_monthly) / 100).toFixed(0)}
              </span>
              <span className="text-sm text-muted-foreground">/{annual ? "yr" : "mo"}</span>
            </div>

            <ul className="mt-8 space-y-3">
              {selected.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <span className="mt-0.5 text-green-600">&#10003;</span>
                  {f}
                </li>
              ))}
            </ul>

            {error && (
              <p className="mt-4 text-sm text-destructive">{error}</p>
            )}

            <button
              onClick={() => handleSelect(selected.slug)}
              disabled={loading}
              className="mt-8 inline-flex h-12 w-full items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? "Creating your store..." : `Start 14-Day Free Trial`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PlanPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground antialiased selection:bg-primary/10">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6">
          <Link href="/" className="text-lg font-bold tracking-tight">
            Multi-tenant Shopify
          </Link>
        </div>
      </header>
      <main className="flex-1">
        <Suspense fallback={<div className="text-center py-24 text-muted-foreground">Loading...</div>}>
          <PlanSelection />
        </Suspense>
      </main>
    </div>
  );
}
