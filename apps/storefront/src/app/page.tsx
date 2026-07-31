import Link from "next/link";

import { LayerParallax } from "@/components/marketing/layer-parallax";
import { StoreFooter } from "@/components/marketing/store-footer";
import { ZoomParallax } from "@/components/marketing/zoom-parallax";

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
        {/* Hero — zoom parallax */}
        <ZoomParallax />

        {/* Feature Grid */}
        <section className="border-b border-border/40 py-24 md:py-32">
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

        {/* Layer parallax — floating images + letter displacement */}
        <LayerParallax />

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
      {/* --- begin color preview --- */}
      <div className="min-h-screen  flex items-center justify-center py-12">
        <ColorPreview />
      </div>
      {/* --- end color preview --- */}
      <StoreFooter />
    </div>
  );
}


function ColorPreview() {
  return (
    <div className="w-full max-w-4xl mx-auto grid md:grid-cols-2 gap-8 p-4">

      {/* LIGHT THEME PREVIEW */}
      <div className="bg-parchment-light rounded-2xl p-8 shadow-sm border border-black/5 text-charcoal flex flex-col justify-between min-h-[350px]">
        <div>
          <div className="flex justify-between items-center mb-6">
            <span className="text-xs font-bold uppercase tracking-wider text-olive bg-white/60 px-2.5 py-1 rounded-full border border-olive/10">
              Light Theme
            </span>
            <span className="text-xs font-mono text-olive/70 font-semibold">#FAF9F1</span>
          </div>

          <h2 className="text-3xl font-extrabold mb-2 tracking-tight">Unified Design System</h2>
          <p className="text-olive font-medium mb-6 text-sm">Secondary heading in Deep Olive (#3A3C30).</p>

          <p className="leading-relaxed text-sm opacity-90">
            This body text is rendered in Dark Charcoal (#1E1F1A). It provides a comfortable, high-contrast reading experience that avoids the harshness of pure black text on a light background.
          </p>
        </div>

        <div className="pt-6">
          <button className="bg-terracotta text-white font-semibold text-sm px-5 py-2.5 rounded-lg shadow-sm hover:opacity-90 transition-opacity">
            Terracotta Button
          </button>
        </div>
      </div>

      {/* DARK THEME PREVIEW */}
      <div className="bg-parchment-dark rounded-2xl p-8 shadow-sm text-parchment-light flex flex-col justify-between min-h-[350px]">
        <div>
          <div className="flex justify-between items-center mb-6">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400 bg-parchment-surface px-2.5 py-1 rounded-full border border-white/5">
              Dark Theme
            </span>
            <span className="text-xs font-mono text-gray-400 font-semibold">#14140F</span>
          </div>

          <h2 className="text-3xl font-extrabold mb-2 tracking-tight text-white">Unified Design System</h2>
          <p className="text-gray-400 font-medium mb-6 text-sm">Secondary heading using muted text.</p>

          {/* Surface Layer Card */}
          <div className="bg-parchment-surface border border-white/5 rounded-xl p-4">
            <p className="text-xs font-mono text-gray-500 mb-1">Surface Card (#1E1F18)</p>
            <p className="leading-relaxed text-sm text-gray-300">
              Your original color (#FAF9F1) serves perfectly here as the primary high-contrast text layer.
            </p>
          </div>
        </div>

        <div className="pt-6">
          <button className="bg-terracotta text-white font-semibold text-sm px-5 py-2.5 rounded-lg shadow-sm hover:opacity-90 transition-opacity w-full md:w-auto">
            Terracotta Button
          </button>
        </div>
      </div>

    </div>
  );
}


