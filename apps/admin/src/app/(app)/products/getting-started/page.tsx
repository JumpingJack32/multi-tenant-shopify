"use client";

import { useRouter } from "next/navigation";
import { PackageIcon, PlusIcon } from "@repo/ui/icons";

import { Button } from "@/components/ui/button";

export default function GettingStartedPage() {
  const router = useRouter();

  return (
    <div className="mx-auto max-w-lg pt-16 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <PackageIcon className="h-6 w-6" />
      </div>
      <h2 className="text-lg font-semibold">Start listing your products</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Create your own custom inventory or source products from suppliers to
        build your storefront.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Button
          variant="outline"
          onClick={() => router.push("/products?view=find")}
        >
          Find Products to Sell
        </Button>
        <Button onClick={() => router.push("/products?view=add")}>
          <PlusIcon className="mr-2 h-4 w-4" /> Add Product
        </Button>
      </div>
    </div>
  );
}
