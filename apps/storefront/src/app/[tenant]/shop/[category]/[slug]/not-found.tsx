import Link from "next/link";

export default function ProductNotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black px-4 text-center text-white">
      <h1 className="text-6xl font-light">Product not found</h1>
      <p className="mt-4 text-white/60">
        This product doesn&apos;t exist or has been removed.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex h-12 items-center justify-center rounded-md bg-white px-8 text-sm font-medium text-black transition-colors hover:bg-white/90"
      >
        Back to shop
      </Link>
    </main>
  );
}
