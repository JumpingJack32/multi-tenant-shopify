import Link from "next/link";

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ tenant: string; category: string }>;
}) {
  const { tenant, category } = await params;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-3xl font-bold tracking-tight capitalize">
        {category}
      </h1>
      <p className="text-muted-foreground">
        Products coming soon for {tenant}&apos;s {category} collection.
      </p>
      <Link
        href={`/${tenant}`}
        className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
      >
        Back to store
      </Link>
    </div>
  );
}
