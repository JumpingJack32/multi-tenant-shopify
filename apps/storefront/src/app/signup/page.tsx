"use client";

import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function SignupContent() {
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan") ?? "starter";

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 md:px-6 md:py-24">
      <div className="mx-auto max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight">Create your store</h1>
          <p className="mt-2 text-muted-foreground">
            Selected plan: <span className="font-medium capitalize text-foreground">{plan}</span>
          </p>
          <Link href="/pricing" className="text-xs text-muted-foreground underline hover:text-foreground">
            Change plan
          </Link>
        </div>
        <SignUp
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "shadow-none border border-border/40 rounded-lg",
            },
          }}
          signInUrl="/sign-in"
          fallbackRedirectUrl={`/signup/plan?plan=${plan}`}
        />
      </div>
    </div>
  );
}

export default function SignupPage() {
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
          <SignupContent />
        </Suspense>
      </main>
    </div>
  );
}
