"use client";

import type { ElementType, ReactNode } from "react";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@repo/ui/components/ui/sidebar";
import { ChevronDownIcon } from "@repo/ui/icons";

export interface NavSecondaryItem {
  title: string;
  url?: string;
  icon: ReactNode;
  items?: { title: string; url: string }[];
}

export function NavSecondary({
  items,
  LinkComponent,
  ...props
}: {
  items: NavSecondaryItem[];
  LinkComponent?: ElementType;
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  const Link = LinkComponent ?? "a";

  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title} className="group/menu-item">
              {item.items ? (
                <>
                  <SidebarMenuButton>
                    {item.icon}
                    <span>{item.title}</span>
                    <ChevronDownIcon className="ml-auto transition-transform duration-200 group-hover/menu-item:rotate-180 group-focus-within/menu-item:rotate-180" />
                  </SidebarMenuButton>
                  <SidebarMenuSub className="grid grid-rows-[0fr] overflow-hidden invisible opacity-0 transition-all duration-200 group-hover/menu-item:grid-rows-[1fr] group-focus-within/menu-item:grid-rows-[1fr] group-hover/menu-item:visible group-focus-within/menu-item:visible group-hover/menu-item:opacity-100 group-focus-within/menu-item:opacity-100">
                    {item.items.map((sub) => (
                      <SidebarMenuSubItem key={sub.title}>
                        <SidebarMenuSubButton render={<Link href={sub.url} />}>
                          <span>{sub.title}</span>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </>
              ) : (
                <SidebarMenuButton render={<Link href={item.url!} />}>
                  {item.icon}
                  <span>{item.title}</span>
                </SidebarMenuButton>
              )}
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
