"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import { Skeleton } from "@repo/ui/components/ui/skeleton";

import { ErrorBanner } from "@/components/ui/error-banner";
import { useTenantContext } from "@/contexts/tenant-context";
import { api } from "@/lib/api/client";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  pending: "bg-amber-100 text-amber-800",
  in_transit: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

export default function TransfersPage() {
  const router = useRouter();
  const { currentTenantId, isLoading: tenantLoading } = useTenantContext();
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["stock-transfers", { page, page_size: 20 }, currentTenantId],
    queryFn: () =>
      api.stockTransfers.list(
        { page: String(page), page_size: "20" },
        { tenantId: currentTenantId },
      ),
    enabled: !!currentTenantId,
  });

  if (tenantLoading || isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6">
        <ErrorBanner
          message={(error as Error)?.message ?? "Failed to load transfers"}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const transfers = data?.data ?? [];
  const pagination = data?.pagination ?? {
    page: 1,
    page_size: 20,
    total: 0,
    total_pages: 0,
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Stock Transfers</h1>
          <p className="text-sm text-muted-foreground">
            Track inventory movement between locations
          </p>
        </div>
        <Button onClick={() => router.push("/transfers/new")}>
          New Transfer
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            {pagination.total} transfer{pagination.total !== 1 ? "s" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-6 pb-3 font-medium">Transfer</th>
                <th className="px-6 pb-3 font-medium">Origin</th>
                <th className="px-6 pb-3 font-medium">Destination</th>
                <th className="px-6 pb-3 font-medium">Items</th>
                <th className="px-6 pb-3 font-medium">Status</th>
                <th className="px-6 pb-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {transfers.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-muted-foreground"
                  >
                    No transfers yet
                  </td>
                </tr>
              )}
              {transfers.map((t) => (
                <tr
                  key={t.id}
                  className="border-b cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/transfers/${t.id}`)}
                >
                  <td className="px-6 py-3 font-mono text-sm">
                    {t.transfer_number}
                  </td>
                  <td className="px-6 py-3">{t.origin_location_name}</td>
                  <td className="px-6 py-3">{t.destination_location_name}</td>
                  <td className="px-6 py-3">{t.items.length}</td>
                  <td className="px-6 py-3">
                    <Badge className={STATUS_COLORS[t.status] ?? ""}>
                      {t.status.replace("_", " ")}
                    </Badge>
                  </td>
                  <td className="px-6 py-3 text-muted-foreground">
                    {new Date(t.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {pagination.total_pages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {pagination.page} of {pagination.total_pages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pagination.total_pages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
