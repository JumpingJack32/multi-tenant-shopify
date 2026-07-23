//apps/storefront/src/components/storefront/site-nav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/components/ui/accordion";
import { Button } from "@repo/ui/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@repo/ui/components/ui/navigation-menu";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@repo/ui/components/ui/sheet";
import { Menu } from "@repo/ui/icons";

import { useNavigation } from "@/hooks/use-navigation";
import type { NavigationTreeItem } from "@/lib/storefront-api";
import { cn } from "@/lib/utils";

function th(href: string, tenant?: string): string {
  return tenant ? `/${tenant}${href}` : href;
}

function isPathActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

type MenuLinkProps = {
  href: string;
  className?: string;
  activeClassName?: string;
  "aria-label"?: string;
  children: React.ReactNode;
  tenant?: string;
};

function MenuLink({
  href,
  className,
  activeClassName,
  children,
  tenant,
  ...props
}: MenuLinkProps) {
  const fullHref = th(href, tenant);
  const pathname = usePathname();
  const active = isPathActive(pathname, fullHref);

  return (
    <NavigationMenuLink
      render={(linkProps: React.ComponentPropsWithoutRef<"a">) => (
        <Link
          {...linkProps}
          href={fullHref}
          aria-current={active ? "page" : undefined}
          className={cn(
            linkProps.className,
            "rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            active && activeClassName,
            className,
          )}
          {...props}
        >
          {children}
        </Link>
      )}
    />
  );
}

function WomenColumnBlock({
  column,
  tenant,
}: {
  column: NavigationTreeItem;
  tenant?: string;
}) {
  const items = column.children ?? [];

  return (
    <div className="flex min-w-56 flex-col gap-4">
      {column.is_title_link ? (
        <h3 className="text-xs font-semibold uppercase tracking-[0.22em]">
          <MenuLink
            href={column.href ?? ""}
            className="text-foreground/80 hover:text-foreground"
            activeClassName="text-foreground"
            tenant={tenant}
          >
            {column.title}
          </MenuLink>
        </h3>
      ) : (
        <h3 className="text-xs font-semibold uppercase tracking-[0.22em] text-foreground">
          {column.title}
        </h3>
      )}

      {(column.show_view_all || items.length > 0) && (
        <ul className="flex flex-col gap-2.5">
          {column.show_view_all && column.href && (
            <li>
              <MenuLink
                href={column.href}
                aria-label={`View all ${column.title}`}
                className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/70 hover:text-foreground"
                activeClassName="text-foreground"
                tenant={tenant}
              >
                View All
              </MenuLink>
            </li>
          )}

          {items.map((item) => (
            <li key={item.id}>
              <MenuLink
                href={item.href ?? ""}
                className="text-sm text-muted-foreground hover:text-foreground"
                activeClassName="text-foreground"
                tenant={tenant}
              >
                {item.title}
              </MenuLink>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export const MobileNav = React.memo(function MobileNav({
  tenant,
}: {
  tenant?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  const { data } = useNavigation(tenant);
  const womenColumns = data?.womenColumns ?? [];
  const topLevel = data?.topLevel ?? [];

  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Open navigation menu"
          />
        }
      >
        <Menu className="size-5" />
      </SheetTrigger>

      <SheetContent side="left" className="w-[320px] overflow-y-auto p-0">
        <SheetTitle className="sr-only">Primary navigation menu</SheetTitle>

        <div
          className="flex h-full flex-col"
          onClick={(event) => {
            if ((event.target as HTMLElement).closest("a")) {
              setOpen(false);
            }
          }}
        >
          <div className="border-b border-border px-6 py-5 font-display text-sm uppercase tracking-[0.3em]">
            Menu
          </div>

          <Accordion defaultValue={["women"]} className="w-full">
            <AccordionItem value="women" className="border-b border-border/70">
              <AccordionTrigger className="px-6 py-4 text-xs font-medium uppercase tracking-[0.18em]">
                Women
              </AccordionTrigger>

              <AccordionContent className="px-6 pb-6">
                <div className="flex flex-col gap-6">
                  {womenColumns.map((column) => (
                    <div key={column.id} className="flex flex-col gap-3">
                      <Link
                        href={th(column.href ?? "", tenant)}
                        className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground"
                      >
                        {column.title}
                      </Link>

                      {(column.children ?? []).length > 0 && (
                        <ul className="flex flex-col gap-2.5">
                          {(column.children ?? []).map((item) => (
                            <li key={item.id}>
                              <Link
                                href={th(item.href ?? "", tenant)}
                                className="text-sm text-muted-foreground hover:text-foreground"
                              >
                                {item.title}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <nav
            aria-label="Secondary"
            className="flex flex-col border-t border-border/70"
          >
            {topLevel.map((item) => (
              <Link
                key={item.id}
                href={th(item.href ?? "", tenant)}
                className="border-b border-border/50 px-6 py-4 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
              >
                {item.title}
              </Link>
            ))}
          </nav>
        </div>
      </SheetContent>
    </Sheet>
  );
});

export const SiteNav = React.memo(function SiteNav({
  className,
  tenant,
}: {
  className?: string;
  tenant?: string;
}) {
  const { data } = useNavigation(tenant);
  const womenColumns = data?.womenColumns ?? [];
  const topLevel = data?.topLevel ?? [];
  const womenActive = isPathActive(usePathname(), th("/women", tenant));

  return (
    <NavigationMenu
      aria-label="Primary"
      className={cn("max-w-none", className)}
    >
      <NavigationMenuList className="gap-1 space-x-0">
        {womenColumns.length > 0 && (
          <NavigationMenuItem value="women">
            <NavigationMenuTrigger
              className={cn(
                "h-11 bg-transparent px-4 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground transition-colors",
                "hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                "aria-[expanded=true]:bg-accent/60 aria-[expanded=true]:text-foreground",
                womenActive && "text-foreground",
              )}
            >
              Women
            </NavigationMenuTrigger>

            <NavigationMenuContent className="w-screen">
              <div
                className={cn(
                  "grid gap-x-10 gap-y-10 bg-popover p-8 text-popover-foreground max-h-[40vh] overflow-y-auto",
                  "sm:grid-cols-2 lg:grid-cols-4 lg:p-10",
                )}
              >
                {womenColumns.map((column) => (
                  <WomenColumnBlock
                    key={column.id}
                    column={column}
                    tenant={tenant}
                  />
                ))}
              </div>
            </NavigationMenuContent>
          </NavigationMenuItem>
        )}

        {topLevel.map((item) => (
          <NavigationMenuItem key={item.id}>
            <MenuLink
              href={item.href ?? ""}
              className={cn(
                navigationMenuTriggerStyle(),
                "h-11 bg-transparent px-4 text-xs font-medium uppercase tracking-[0.18em]",
                "text-muted-foreground hover:text-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              )}
              activeClassName="text-foreground"
              tenant={tenant}
            >
              {item.title}
            </MenuLink>
          </NavigationMenuItem>
        ))}
      </NavigationMenuList>
    </NavigationMenu>
  );
});
