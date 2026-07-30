import Link from "next/link";
import { StoreFooter } from "@/components/marketing/store-footer";

const FEATURES = [
  {
    title: "Multi-Warehouse Inventory",
    description: "Track stock across unlimited locations with real-time reservations, transfers, and auto-allocation.",
  },
  {
    title: "Subscription Engine",
    description: "Recurring billing with Stripe, plan management, customer self-service portal, and churn analytics.",
  },
  {
    title: "RMA & Returns",
    description: "Full refund workflow with Stripe integration, store credit, and automated restock.",
  },
  {
    title: "Multi-Currency",
    description: "Price in any currency with automatic conversion at checkout. 20 supported currencies.",
  },
  {
    title: "Analytics & Reports",
    description: "Sales trends, customer insights, custom reports, and live dashboard with CSV export.",
  },
  {
    title: "Team Management",
    description: "Role-based access, audit logs, notification preferences, and multi-user support.",
  },
];

export default function MarketingLanding() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground antialiased selection:bg-primary/10">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6">
          <Link href="/" className="text-lg font-bold tracking-tight">
            Multi-tenant Shopify
          </Link>
          <nav className="flex items-center gap-6">
            <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Pricing
            </Link>
            <Link href="/showcase" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Showcase
            </Link>
            <Link
              href="/signup"
              className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Start Free Trial
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="border-b border-border/40">
          <div className="mx-auto max-w-7xl px-4 py-24 md:px-6 md:py-32">
            <div className="mx-auto max-w-3xl text-center">
              <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
                The e-commerce platform for independent brands
              </h1>
              <p className="mt-6 text-lg text-muted-foreground md:text-xl">
                Multi-warehouse inventory, subscriptions, global payments, and analytics — all in one platform.
                Start your 14-day free trial. No credit card required.
              </p>
              <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                <Link
                  href="/signup"
                  className="inline-flex h-12 items-center justify-center rounded-md bg-primary px-8 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
                >
                  Start Your 14-Day Free Trial
                </Link>
                <Link
                  href="/showcase"
                  className="inline-flex h-12 items-center justify-center rounded-md border border-border px-8 text-sm font-semibold hover:bg-muted transition-colors"
                >
                  View Showcase Store
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="py-24 md:py-32">
          <div className="mx-auto max-w-7xl px-4 md:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight">Everything you need to grow</h2>
              <p className="mt-4 text-muted-foreground">
                Built for brands that outgrow basic e-commerce tools.
              </p>
            </div>
            <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <div key={f.title} className="rounded-lg border border-border/40 p-6">
                  <h3 className="font-semibold">{f.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{f.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="border-t border-border/40 py-24">
          <div className="mx-auto max-w-2xl px-4 text-center md:px-6">
            <h2 className="text-3xl font-bold tracking-tight">Ready to launch your store?</h2>
            <p className="mt-4 text-muted-foreground">
              Join brands using Multi-tenant Shopify to power their e-commerce operations.
            </p>
            <div className="mt-8">
              <Link
                href="/signup"
                className="inline-flex h-12 items-center justify-center rounded-md bg-primary px-8 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
              >
                Start Free Trial
              </Link>
            </div>
          </div>
        </section>
      </main>

      <StoreFooter />
    </div>
  );
}
