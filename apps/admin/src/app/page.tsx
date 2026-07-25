import Link from "next/link";

import { Button } from "@/components/ui/button";


export default function RootPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-foreground">Admin</h1>
        <Button className="mt-6 text-muted-foreground bg-background h-22 px-16 text-lg">
          <Link
            href={`dashboard/`}
            className="font-mono text-lg underline underline-offset-2 hover:text-foreground"
          >
            Multi-tenant Shopify Dashboard
          </Link>
        </Button>

        {/* <Button className="mt-6 text-muted-foreground bg-background h-22 px-16 text-lg">Multi-tenant Shopify platform</Button> */}
      </div>
    </main>
  );
}
