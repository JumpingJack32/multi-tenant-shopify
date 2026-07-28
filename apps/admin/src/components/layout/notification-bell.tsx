"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/ui/popover";
import { BellIcon, Loader2Icon, PackageIcon, AlertTriangleIcon, CreditCardIcon } from "@repo/ui/icons";
import { cn } from "@repo/ui/lib/utils";

import { useTenantContext } from "@/contexts/tenant-context";
import { request } from "@/lib/api/client";

const TYPE_ICONS: Record<string, React.ReactNode> = {
  low_stock: <AlertTriangleIcon className="h-4 w-4 text-yellow-500" />,
  subscription_past_due: <CreditCardIcon className="h-4 w-4 text-red-500" />,
  unfulfilled_order: <PackageIcon className="h-4 w-4 text-blue-500" />,
};

const SEVERITY_COLORS: Record<string, string> = {
  warning: "bg-yellow-100 text-yellow-800",
  error: "bg-red-100 text-red-800",
  info: "bg-blue-100 text-blue-800",
};

export function NotificationBell() {
  const { currentTenantId } = useTenantContext();
  const [open, setOpen] = useState(false);

  const { data: notifications, isFetching } = useQuery({
    queryKey: ["notifications", currentTenantId],
    queryFn: () => request("/admin/notifications", { tenantId: currentTenantId }),
    enabled: !!currentTenantId,
    refetchInterval: 60_000,
  });

  const list = (notifications ?? []) as Array<{
    type: string;
    severity: string;
    title: string;
    description: string;
    link: string;
    timestamp: string;
  }>;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="ghost" size="icon" className="relative" aria-label="Notifications" />}>
        <BellIcon className="h-5 w-5" />
        {list.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
            {list.length}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b border-border">
          <p className="text-sm font-semibold">
            Notifications
            {isFetching && <Loader2Icon className="h-3 w-3 animate-spin inline ml-2" />}
          </p>
        </div>
        {list.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">No notifications</div>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {list.map((n, i) => (
              <Link
                key={i}
                href={n.link}
                onClick={() => setOpen(false)}
                className="flex items-start gap-3 p-3 hover:bg-muted/50 transition-colors border-b border-border/50 last:border-0"
              >
                <div className="mt-0.5 shrink-0">{TYPE_ICONS[n.type]}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{n.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{n.description}</p>
                  <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded mt-1 inline-block", SEVERITY_COLORS[n.severity])}>
                    {n.severity}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
