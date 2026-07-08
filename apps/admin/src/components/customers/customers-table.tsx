"use client";

import { useState } from "react";
import { useCustomers } from "@/features/customers/hooks/use-customers";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { Input } from "@repo/ui/components/ui/input";
import { ErrorBanner } from "@/components/ui/error-banner";
import { useRouter } from "next/navigation";

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

      <div className="rounded-lg border">
        <table className="w-full">
          <thead>
            <tr className="border-b text-left text-sm font-medium text-muted-foreground">
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3">Orders</th>
              <th className="px-4 py-3 text-right">LTV</th>
            </tr>
          </thead>
          <tbody>
            {isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    <Skeleton className="h-4 w-40" />
                  </td>
                  <td className="px-4 py-3">
                    <Skeleton className="h-4 w-24" />
                  </td>
                  <td className="px-4 py-3">
                    <Skeleton className="h-4 w-12" />
                  </td>
                  <td className="px-4 py-3">
                    <Skeleton className="h-4 w-20 ml-auto" />
                  </td>
                </tr>
              ))}
            {data?.data.map((customer: any) => (
              <tr
                key={customer.id}
                className="border-b last:border-0 cursor-pointer hover:bg-muted/50"
                onClick={() => router.push(`/customers/${customer.id}`)}
              >
                <td className="px-4 py-2.5">
                  <div className="text-sm font-medium">
                    {[customer.first_name, customer.last_name]
                      .filter(Boolean)
                      .join(" ") || "—"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {customer.email}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-sm text-muted-foreground">
                  {customer.created_at
                    ? new Date(customer.created_at).toLocaleDateString()
                    : "—"}
                </td>
                <td className="px-4 py-2.5 text-sm">{customer.total_orders}</td>
                <td className="px-4 py-2.5 text-sm text-right font-mono font-medium">
                  {formatPence(customer.total_spent)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!isLoading && (!data || data.data.length === 0) && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No customers yet
          </div>
        )}
      </div>

      {/* Pagination */}
      {data && data.total > data.per_page && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Showing {(data.page - 1) * data.per_page + 1}–
            {Math.min(data.page * data.per_page, data.total)} of {data.total}
          </span>
          <div className="flex gap-2">
            <button
              disabled={data.page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1 rounded border text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <button
              disabled={data.page * data.per_page >= data.total}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1 rounded border text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
