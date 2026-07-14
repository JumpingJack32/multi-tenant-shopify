"use client";
import { useState, useMemo, type ChangeEvent } from "react";
import { cn } from "@repo/shared-utils/cn";
import type { Product } from "@repo/tenant-orm/types";

interface DataTableProps {
  data: Product[];
  isLoading: boolean;
  columns: DataTableColumn<Product>[];
  onRowClick?: (item: Product) => void;
  rowActions?: (item: Product) => React.ReactNode;
  searchPlaceholder?: string;
  onSearchChange?: (value: string) => void;
  pagination?: {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
  };
  totalItems?: number;
}

export function DataTable({
  data,
  isLoading,
  columns,
  onRowClick,
  rowActions,
  searchPlaceholder = "Search...",
  onSearchChange,
  pagination,
  totalItems,
}: DataTableProps) {
  const [search, setSearch] = useState("");

  const filteredData = useMemo(() => {
    if (!search) return data;
    const lower = search.toLowerCase();
    return data.filter((item) =>
      columns.some((col) => {
        const value = item[col.accessor];
        return value != null && String(value).toLowerCase().includes(lower);
      }),
    );
  }, [data, search, columns]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // const target = e.target as HTMLInputElement;
    const value = e.currentTarget.value; // <-- 100% type-safe fallback
    // const value = e.target.value;
    setSearch(value);
    onSearchChange?.(value);
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={search}
            onChange={handleSearchChange}
            // onChange={(e) => {
            //   setSearch(e.target.value);
            //   onSearchChange?.(e.target.value);
            // }}
            className="w-full rounded-lg border bg-background pl-9 pr-4 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        {totalItems != null && (
          <span className="text-sm text-muted-foreground">
            {filteredData.length} of {totalItems} result
            {totalItems !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.accessor}
                  className={cn(
                    "text-left font-medium text-muted-foreground px-4 py-3",
                    col.className,
                  )}
                >
                  {col.header}
                </th>
              ))}
              {rowActions && (
                <th className="text-right font-medium text-muted-foreground px-4 py-3">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td
                  colSpan={columns.length + (rowActions ? 1 : 0)}
                  className="px-4 py-12 text-center"
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <span className="text-sm text-muted-foreground">
                      Loading...
                    </span>
                  </div>
                </td>
              </tr>
            ) : filteredData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (rowActions ? 1 : 0)}
                  className="px-4 py-12 text-center text-muted-foreground"
                >
                  No results found.
                </td>
              </tr>
            ) : (
              filteredData.map((item) => (
                <tr
                  key={item.id}
                  className={cn(
                    "transition-colors",
                    onRowClick && "cursor-pointer hover:bg-accent/50",
                  )}
                  onClick={() => onRowClick?.(item)}
                >
                  {columns.map((col) => (
                    <td
                      key={col.accessor}
                      className={cn("px-4 py-3", col.cellClassName)}
                    >
                      {col.cell
                        ? col.cell(item[col.accessor], item)
                        : String(item[col.accessor] ?? "")}
                    </td>
                  ))}
                  {rowActions && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {rowActions(item)}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Page {pagination.currentPage} of {pagination.totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                pagination.onPageChange(pagination.currentPage - 1)
              }
              disabled={pagination.currentPage <= 1}
              className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm disabled:opacity-50 disabled:pointer-events-none hover:bg-accent"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() =>
                pagination.onPageChange(pagination.currentPage + 1)
              }
              disabled={pagination.currentPage >= pagination.totalPages}
              className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm disabled:opacity-50 disabled:pointer-events-none hover:bg-accent"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export interface DataTableColumn<T> {
  header: string;
  accessor: keyof T;
  cell?: (value: unknown, row: T) => React.ReactNode;
  className?: string;
  cellClassName?: string;
}
