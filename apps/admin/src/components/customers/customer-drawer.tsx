"use client";

import { Separator } from "@repo/ui/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@repo/ui/components/ui/sheet";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/ui/components/ui/tabs";

import {
  useCustomer,
  useCustomerTimeline,
} from "@/features/customers/hooks/use-customers";

import { TabAccount } from "./customer-drawer/tab-account";
import { TabCredit } from "./customer-drawer/tab-credit";
import { TabSegmentation } from "./customer-drawer/tab-segmentation";

interface CustomerDrawerProps {
  customerId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId?: string | null;
}

export function CustomerDrawer({
  customerId,
  open,
  onOpenChange,
  tenantId,
}: CustomerDrawerProps) {
  const { data, isLoading } = useCustomer(customerId ?? "", tenantId);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[500px] sm:w-[600px] overflow-y-auto">
        <SheetHeader>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          ) : (
            <SheetTitle>
              {[data?.first_name, data?.last_name].filter(Boolean).join(" ") ||
                "Customer"}
            </SheetTitle>
          )}
        </SheetHeader>
        <Separator className="my-4" />
        <Tabs defaultValue="account">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="account">Customer Accounts</TabsTrigger>
            <TabsTrigger value="segmentation">Segmentation</TabsTrigger>
            <TabsTrigger value="integrations" disabled>
              Import & Export
            </TabsTrigger>
            <TabsTrigger value="credit">Store Credit</TabsTrigger>
          </TabsList>
          <TabsContent value="account" className="mt-4">
            <TabAccount
              customerId={customerId ?? ""}
              data={data}
              isLoading={isLoading}
              tenantId={tenantId}
            />
          </TabsContent>
          <TabsContent value="segmentation" className="mt-4">
            <TabSegmentation data={data} tenantId={tenantId} />
          </TabsContent>
          <TabsContent value="integrations" className="mt-4">
            <div className="py-8 text-center text-sm text-muted-foreground">
              Import/Export tools coming in Phase 3
            </div>
          </TabsContent>
          <TabsContent value="credit" className="mt-4">
            <TabCredit
              customerId={customerId ?? ""}
              data={data}
              isLoading={isLoading}
              tenantId={tenantId}
            />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
