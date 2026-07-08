"use client";

import type { ElementType, ReactNode } from "react";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/ui/components/ui/sidebar";

export interface NavSecondaryItem {
  title: string;
  url?: string;
  icon: ReactNode;
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
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton render={<Link href={item.url} />}>
                {item.icon}
                <span>{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
