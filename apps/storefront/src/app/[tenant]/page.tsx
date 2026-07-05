import Link from "next/link";

export default async function TenantLandingPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant } = await params;

  return (
    <main className="min-h-screen bg-black text-white">
      {/* Hero */}
      <section className="flex min-h-[80vh] flex-col items-center justify-center px-4 text-center">
        <h1 className="max-w-4xl text-5xl font-light tracking-tight sm:text-7xl md:text-8xl">
          Amoa & Agou
        </h1>
        <p className="mt-6 max-w-xl text-lg text-white/60">
          Premium gear for the modern explorer.
        </p>
        <div className="mt-10 flex gap-4">
          <Link
            href={`/${tenant}/shop/all`}
            className="inline-flex h-12 items-center justify-center rounded-md bg-white px-8 text-sm font-medium text-black transition-colors hover:bg-white/90"
          >
            Shop All
          </Link>
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-6xl px-4 py-24">
        <div className="grid gap-8 md:grid-cols-2">
          <Link href={`/${tenant}/shop/rucksacks`} className="group">
            <div className="aspect-[4/5] bg-zinc-900 flex items-center justify-center">
              <span className="text-6xl text-white/20">✦</span>
            </div>
            <h3 className="mt-4 text-xl font-medium">Rucksacks</h3>
            <p className="text-sm text-white/40">Built for the journey.</p>
          </Link>
          <Link href={`/${tenant}/shop/gadgets`} className="group">
            <div className="aspect-[4/5] bg-zinc-900 flex items-center justify-center">
              <span className="text-6xl text-white/20">✦</span>
            </div>
            <h3 className="mt-4 text-xl font-medium">Gadgets</h3>
            <p className="text-sm text-white/40">Tech for the trail.</p>
          </Link>
        </div>
      </section>
    </main>
  );
}
