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
import { CurrencySwitcher } from "@/components/storefront/currency-switcher";
import { SearchDialog } from "@/components/storefront/search-dialog";
import { SettingsHydrator } from "@/components/storefront/settings-hydrator";
import { MobileNav, SiteNav } from "@/components/storefront/site-nav";
import { getCartCookieName } from "@/lib/cart-cookie";
import { fetchNavigation, fetchSettings, getCart } from "@/lib/storefront-api";

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

  // SSR: read cookies
  const cookieStore = await cookies();
  const cartId = cookieStore.get(getCartCookieName(tenant))?.value ?? null;
  const preferredCurrency =
    cookieStore.get("preferred_currency")?.value ?? null;

  if (cartId) {
    await queryClient.prefetchQuery({
      queryKey: ["cart", tenant, cartId],
      queryFn: () => getCart(tenant, cartId),
    });
  }

  const navData = await queryClient.fetchQuery({
    queryKey: ["navigation", "main", tenant],
    queryFn: () => fetchNavigation(tenant),
  });
  if (!navData) {
    queryClient.removeQueries({ queryKey: ["navigation", "main", tenant] });
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
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border bg-background px-6">
        <div className="flex items-center gap-4">
          <MobileNav tenant={tenant} />
          <Link
            href={`/${tenant}`}
            className="text-lg font-semibold tracking-tight"
          >
            {storeName}
          </Link>
        </div>
        <SiteNav className="hidden lg:flex" tenant={tenant} />
        <div className="flex items-center gap-2">
          <SearchDialog tenantSlug={tenant} />
          <CurrencySwitcher defaultCurrency={preferredCurrency ?? undefined} />
          <CartToggle />
        </div>
      </header>
      {children}
    </HydrationBoundary>
  );
}
