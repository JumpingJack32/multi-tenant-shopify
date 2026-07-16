"use client";

import { memo, useCallback, useMemo } from "react";
import { Badge } from "@repo/ui/components/ui/badge";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table";
import type { Customer, CustomerListResponse } from "@repo/tenant-orm/types";

import { ErrorBanner } from "@/components/ui/error-banner";

function formatPence(n: number): string {
  return `£ ${(n / 100).toFixed(2)}`;
}

function getSubscriptionBadge(status: string): {
  label: string;
  className: string;
} {
  switch (status) {
    case "subscribed":
      return { label: "Subscribed", className: "bg-green-100 text-green-800" };
    case "unsubscribed":
      return {
        label: "Unsubscribed",
        className: "bg-neutral-100 text-neutral-600",
      };
    case "bounced":
      return { label: "Bounced", className: "bg-red-100 text-red-800" };
    default:
      return { label: status, className: "bg-neutral-100 text-neutral-600" };
  }
}

interface CustomerRowProps {
  customer: Customer;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onDoubleClick: (customer: Customer) => void;
}

const CustomerRow = memo(function CustomerRow({
  customer,
  isSelected,
  onSelect,
  onDoubleClick,
}: CustomerRowProps) {
  const badge = getSubscriptionBadge(customer.email_subscription_status);
  const name =
    [customer.first_name, customer.last_name].filter(Boolean).join(" ") || "—";
  const spent = formatPence(customer.total_spent);

  return (
    <TableRow
      className="cursor-pointer"
      onDoubleClick={() => onDoubleClick(customer)}
    >
      <TableCell onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onSelect(customer.id)}
          aria-label={`Select ${customer.email}`}
        />
      </TableCell>
      <TableCell>
        <div className="font-medium">{name}</div>
        <div className="text-xs text-muted-foreground">{customer.email}</div>
      </TableCell>
      <TableCell>
        <Badge className={badge.className}>{badge.label}</Badge>
      </TableCell>
      <TableCell className="text-muted-foreground">—</TableCell>
      <TableCell>{customer.total_orders}</TableCell>
      <TableCell className="text-right font-mono font-medium">
        {spent}
      </TableCell>
    </TableRow>
  );
});

interface CustomersTableProps {
  data?: CustomerListResponse | null;
  isLoading?: boolean;
  error?: Error | null;
  onRefetch?: () => void;
  onRowDoubleClick?: (customer: Customer) => void;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
}

export function CustomersTable({
  data,
  isLoading,
  error,
  onRefetch,
  onRowDoubleClick,
  selectedIds = new Set(),
  onSelectionChange,
}: CustomersTableProps) {
  const allSelected = useMemo(
    () =>
      data?.data?.length
        ? data.data.every((c) => selectedIds.has(c.id))
        : false,
    [data, selectedIds],
  );

  const handleSelectAll = useCallback(() => {
    if (!data?.data) return;
    if (allSelected) {
      onSelectionChange?.(new Set());
    } else {
      onSelectionChange?.(new Set(data.data.map((c) => c.id)));
    }
  }, [data, allSelected, onSelectionChange]);

  const handleSelectOne = useCallback(
    (id: string) => {
      const next = new Set(selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      onSelectionChange?.(next);
    },
    [selectedIds, onSelectionChange],
  );

  const handleDoubleClick = useCallback(
    (customer: Customer) => onRowDoubleClick?.(customer),
    [onRowDoubleClick],
  );

  if (error) {
    return (
      <ErrorBanner
        message="Failed to load customers"
        onRetry={() => onRefetch?.()}
      />
    );
  }

  return (
    <div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead>Customer Name</TableHead>
              <TableHead>Email Subscription</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Orders</TableHead>
              <TableHead className="text-right">Amount Spent</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-4" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-40" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-8" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="h-4 w-20 ml-auto" />
                  </TableCell>
                </TableRow>
              ))}
            {data?.data.map((customer) => (
              <CustomerRow
                key={customer.id}
                customer={customer}
                isSelected={selectedIds.has(customer.id)}
                onSelect={handleSelectOne}
                onDoubleClick={handleDoubleClick}
              />
            ))}
          </TableBody>
        </Table>
        {!isLoading && (!data || data.data.length === 0) && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No customers yet
          </div>
        )}
      </div>
      {data && data.total > data.per_page && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Showing {(data.page - 1) * data.per_page + 1}–
            {Math.min(data.page * data.per_page, data.total)} of {data.total}
          </span>
        </div>
      )}
    </div>
  );
}
