"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table";
import { CheckIcon, XIcon } from "@repo/ui/icons";

import { useTenantContext } from "@/contexts/tenant-context";
import { request } from "@/lib/api/client";

const STATUS_OPTIONS = ["PENDING", "APPROVED", "REJECTED"];

export default function ReviewsPage() {
  const { currentTenantId } = useTenantContext();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("PENDING");

  const { data: reviews, isLoading } = useQuery({
    queryKey: ["reviews", filter, currentTenantId],
    queryFn: () => request(`/admin/reviews?status=${filter}`, { tenantId: currentTenantId }),
    enabled: !!currentTenantId,
  });

  const moderateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      request(`/admin/reviews/${id}/status`, {
        method: "PUT",
        body: JSON.stringify({ status }),
        tenantId: currentTenantId,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["reviews"] }),
  });

  const list = (reviews ?? []) as Array<{
    id: string;
    product_id: string;
    rating: number;
    title: string;
    reviewer_name: string;
    is_verified_buyer: boolean;
    status: string;
    created_at: string;
  }>;

  const STATUS_COLORS: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-800",
    APPROVED: "bg-green-100 text-green-800",
    REJECTED: "bg-red-100 text-red-800",
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Product Reviews</h1>
        <Select value={filter} onValueChange={(v: string | null) => v && setFilter(v)}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? <Skeleton className="h-48 w-full" /> : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Reviewer</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No reviews found</TableCell></TableRow>
            ) : list.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.product_id.slice(0, 8)}...</TableCell>
                <TableCell>
                  {r.reviewer_name}
                  {r.is_verified_buyer && <Badge variant="outline" className="ml-1 text-[10px]">✓</Badge>}
                </TableCell>
                <TableCell>{'★'.repeat(r.rating)}</TableCell>
                <TableCell className="max-w-48 truncate">{r.title}</TableCell>
                <TableCell><Badge className={STATUS_COLORS[r.status] ?? ""}>{r.status}</Badge></TableCell>
                <TableCell className="text-xs">{new Date(r.created_at).toLocaleDateString()}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {r.status === "PENDING" && (
                      <>
                        <Button variant="ghost" size="icon-xs" onClick={() => moderateMutation.mutate({ id: r.id, status: "APPROVED" })}>
                          <CheckIcon className="h-3 w-3 text-green-500" />
                        </Button>
                        <Button variant="ghost" size="icon-xs" onClick={() => moderateMutation.mutate({ id: r.id, status: "REJECTED" })}>
                          <XIcon className="h-3 w-3 text-red-500" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
