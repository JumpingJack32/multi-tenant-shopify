import Link from "next/link";

export default async function CheckoutSuccessPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant } = await params;
  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="max-w-md text-center space-y-6">
        <div className="text-6xl">✓</div>
        <h1 className="text-3xl font-bold">Order Confirmed</h1>
        <p className="text-white/60">
          Thank you for your purchase. You will receive an email confirmation
          shortly.
        </p>
        <Link
          href={`/${tenant}/shop/all`}
          className="inline-block rounded bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Continue Shopping
        </Link>
      </div>
    </main>
  );
}
