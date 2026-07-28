"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function WelcomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const name = searchParams.get("name") ?? "Your Store";
  const adminUrl = searchParams.get("url");
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (countdown <= 0 && adminUrl) {
      router.push(adminUrl);
      return;
    }
    const timer = setInterval(() => {
      setCountdown((c) => c - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown, adminUrl, router]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center md:px-6 md:py-32">
      <div className="mb-8 text-6xl">&#10003;</div>
      <h1 className="text-4xl font-bold tracking-tight">Your store is ready!</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        <span className="font-semibold text-foreground">{name}</span> has been created.
        Redirecting to your admin dashboard in {countdown} seconds...
      </p>
      {adminUrl && (
        <div className="mt-8">
          <Link
            href={adminUrl}
            className="inline-flex h-12 items-center justify-center rounded-md bg-primary px-8 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Go to Dashboard
          </Link>
        </div>
      )}
      <p className="mt-6 text-sm text-muted-foreground">
        Your 14-day free trial has started. We&apos;ll send you a reminder before it ends.
      </p>
    </div>
  );
}

export default function WelcomePage() {
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
          <WelcomeContent />
        </Suspense>
      </main>
    </div>
  );
}
