"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  FilterIcon,
  PlusIcon,
  SearchIcon,
} from "@repo/ui/icons";

import { ErrorBanner } from "@/components/ui/error-banner";
import { useSuppliers } from "@/features/suppliers/hooks/use-suppliers";

interface SuppliersTableProps {
  tenantId?: string | null;
  tenantLoading?: boolean;
}

export function SuppliersTable({
  tenantId,
  tenantLoading,
}: SuppliersTableProps) {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const params: Record<string, string> = {};
  if (page > 1) params.page = String(page);
  if (search) params.search = search;

  const { data, isLoading, isError, error, refetch } = useSuppliers(
    params,
    tenantId,
  );

  if (tenantLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search suppliers..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Button variant="outline" size="icon" aria-label="Filter">
          <FilterIcon className="size-4" />
        </Button>
        <Button onClick={() => router.push("/suppliers/new")}>
          <PlusIcon className="mr-2 size-4" />
          Add Supplier
        </Button>
      </div>

      {/* error */}
      {isError && (
        <ErrorBanner
          message={(error as Error)?.message ?? "Failed to load suppliers"}
          onRetry={() => refetch()}
        />
      )}

      {/* table */}
      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Delivery Method</TableHead>
                <TableHead>Products</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.data?.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-muted-foreground py-8"
                  >
                    No suppliers found
                  </TableCell>
                </TableRow>
              ) : (
                data?.data?.map((s) => (
                  <TableRow
                    key={s.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/suppliers/${s.id}`)}
                  >
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{s.contact_email ?? "—"}</TableCell>
                    <TableCell>{s.contact_phone ?? "—"}</TableCell>
                    <TableCell className="capitalize">
                      {s.delivery_method}
                    </TableCell>
                    <TableCell>{s.product_count ?? 0}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* pagination */}
      {data?.pagination && data.pagination.total_pages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {data.pagination.page} of {data.pagination.total_pages} (
            {data.pagination.total} total)
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeftIcon className="size-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= (data.pagination.total_pages ?? 1)}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRightIcon className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
