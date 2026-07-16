"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { ChevronDownIcon, PlusIcon } from "@repo/ui/icons";
import type { CustomerMetrics } from "@repo/tenant-orm/types";

interface CustomersHeaderProps {
  metrics?: CustomerMetrics | null;
  isLoading?: boolean;
  onAddCustomer?: () => void;
  onImportCsv?: () => void;
  onExportCsv?: () => void;
}

export function CustomersHeader({
  metrics,
  isLoading,
  onAddCustomer,
  onImportCsv,
  onExportCsv,
}: CustomersHeaderProps) {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold">
                {metrics ? metrics.total_customers.toLocaleString() : "—"}{" "}
                Customers
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {metrics
                  ? `${metrics.percentage.toFixed(0)}% of total customer base`
                  : "Loading..."}
              </p>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" />}>
              Import
              <ChevronDownIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onImportCsv}>
                Import CSV
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                Import from Mailchimp
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled>Resolve CSV Errors</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" onClick={onExportCsv}>
            Export
          </Button>
          <Button onClick={onAddCustomer}>
            <PlusIcon />
            Add Customer
          </Button>
        </div>
      </div>
    </Card>
  );
}
