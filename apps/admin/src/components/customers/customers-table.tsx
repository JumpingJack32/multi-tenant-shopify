"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table";
import { ChevronLeftIcon, ChevronRightIcon } from "@repo/ui/icons";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ErrorBanner } from "@/components/ui/error-banner";
import { useCustomers } from "@/features/customers/hooks/use-customers";

function formatPence(n: number): string {
  return `£${(n / 100).toFixed(2)}`;
}

export function CustomersTable() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const router = useRouter();

  const params: Record<string, string> = {};
  if (search) params.search = search;
  params.page = String(page);
  params.per_page = "20";

  const { data, isLoading, error, refetch } = useCustomers(params);

  if (error) {
    return (
      <ErrorBanner
        message="Failed to load customers"
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div>
      <div className="mb-4">
        <Input
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-sm"
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead>Orders</TableHead>
              <TableHead className="text-right">LTV</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-40" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-12" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="h-4 w-20 ml-auto" />
                  </TableCell>
                </TableRow>
              ))}
            {data?.data.map((customer: any) => (
              <TableRow
                key={customer.id}
                className="cursor-pointer"
                onClick={() => router.push(`/customers/${customer.id}`)}
              >
                <TableCell>
                  <div className="font-medium">
                    {[customer.first_name, customer.last_name]
                      .filter(Boolean)
                      .join(" ") || "—"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {customer.email}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {customer.created_at
                    ? new Date(customer.created_at).toLocaleDateString()
                    : "—"}
                </TableCell>
                <TableCell>{customer.total_orders}</TableCell>
                <TableCell className="text-right font-mono font-medium">
                  {formatPence(customer.total_spent)}
                </TableCell>
              </TableRow>
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
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={data.page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeftIcon />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={data.page * data.per_page >= data.total}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRightIcon />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
