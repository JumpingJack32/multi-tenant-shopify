import Link from "next/link";

export default function RootPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-foreground">Admin</h1>
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center rounded-md border border-input bg-background px-16 py-3 text-lg font-mono underline underline-offset-2 shadow-sm hover:bg-accent hover:text-foreground mt-6"
        >
          Multi-tenant Shopify Dashboard
        </Link>
      </div>
    </main>
  );
}
