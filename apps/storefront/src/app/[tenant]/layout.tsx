import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";
import { cookies } from "next/headers";
import Link from "next/link";

import { CartDrawer } from "@/components/storefront/cart-drawer";
import { CartHydrator } from "@/components/storefront/cart-hydrator";
import { CartToggle } from "@/components/storefront/cart-toggle";
import { SettingsHydrator } from "@/components/storefront/settings-hydrator";
import { getCartCookieName } from "@/lib/cart-cookie";
import { fetchSettings, getCart } from "@/lib/storefront-api";

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenant: string }>;
}) {
  const { tenant } = await params;
  const queryClient = new QueryClient();

  // SSR: fetch settings
  const settings = await fetchSettings(tenant);

  // SSR: read cart cookie and prefetch cart
  const cookieStore = await cookies();
  const cartId = cookieStore.get(getCartCookieName(tenant))?.value ?? null;

  if (cartId) {
    queryClient.prefetchQuery({
      queryKey: ["cart", tenant, cartId],
      queryFn: () => getCart(tenant, cartId),
    });
  }

  const storeName = settings?.name ?? "Store";

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CartHydrator />
      <SettingsHydrator
        currency={settings?.currency ?? "USD"}
        storeName={settings?.name ?? "Store"}
      />
      <CartDrawer />
      <header className="flex h-14 items-center justify-between border-b border-border bg-background px-6">
        <Link
          href={`/${tenant}`}
          className="text-lg font-semibold tracking-tight"
        >
          {storeName}
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link
            href={`/${tenant}/products`}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Products
          </Link>
          <CartToggle />
        </nav>
      </header>
      {children}
    </HydrationBoundary>
  );
}
