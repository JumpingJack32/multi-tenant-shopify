"use client";

import type { ElementType } from "react";

import { Button } from "@repo/ui/components/ui/button";
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
import { CirclePlusIcon, ChevronDownIcon, MailIcon } from "@repo/ui/icons";

interface SubNavItem {
  title: string;
  url: string;
}

export function NavMain({
  items,
  LinkComponent,
}: {
  items: {
    title: string;
    url?: string;
    icon?: React.ReactNode;
    items?: SubNavItem[];
  }[];
  LinkComponent?: ElementType;
}) {
  const Link = LinkComponent ?? "a";

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          <SidebarMenuItem className="flex items-center gap-2">
            <SidebarMenuButton
              tooltip="Quick Create"
              className="min-w-8 bg-primary text-primary-foreground duration-200 ease-linear hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground"
            >
              <CirclePlusIcon />
              <span>Quick Create</span>
            </SidebarMenuButton>
            <Button
              size="icon"
              className="size-8 group-data-[collapsible=icon]:opacity-0"
              variant="outline"
            >
              <MailIcon />
              <span className="sr-only">Inbox</span>
            </Button>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title} className="group/menu-item">
              {item.items ? (
                <>
                  <SidebarMenuButton>
                    {item.icon}
                    <span>{item.title}</span>
                    <ChevronDownIcon className="ml-auto transition-transform duration-200 group-hover/menu-item:rotate-180" />
                  </SidebarMenuButton>
                  <SidebarMenuSub className="grid grid-rows-[0fr] overflow-hidden invisible opacity-0 transition-all duration-200 group-hover/menu-item:grid-rows-[1fr] group-hover/menu-item:visible group-hover/menu-item:opacity-100">
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
                <SidebarMenuButton
                  tooltip={item.title}
                  render={<Link href={item.url!} />}
                >
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
