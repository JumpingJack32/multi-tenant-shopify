"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/ui/dialog";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { Switch } from "@repo/ui/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table";
import { Loader2Icon, PlusIcon, TrashIcon } from "@repo/ui/icons";

import { useTenantContext } from "@/contexts/tenant-context";
import { request } from "@/lib/api/client";

export default function PromotionsPage() {
  const { currentTenantId } = useTenantContext();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [code, setCode] = useState("");
  const [type, setType] = useState("percentage");
  const [value, setValue] = useState("");
  const [minSubtotal, setMinSubtotal] = useState("");
  const [maxUses, setMaxUses] = useState("");

  const { data: promos, isLoading } = useQuery({
    queryKey: ["promotions", currentTenantId],
    queryFn: () => request("/admin/promotions", { tenantId: currentTenantId }),
    enabled: !!currentTenantId,
  });

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      request("/admin/promotions", {
        method: "POST",
        body: JSON.stringify(body),
        tenantId: currentTenantId,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["promotions"] }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      request(`/admin/promotions/${id}`, {
        method: "PUT",
        body: JSON.stringify({ is_active }),
        tenantId: currentTenantId,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["promotions"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      request(`/admin/promotions/${id}`, {
        method: "DELETE",
        tenantId: currentTenantId,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["promotions"] }),
  });

  const list = (promos ?? []) as Array<{
    id: string;
    code: string;
    type: string;
    value: number;
    min_subtotal: number | null;
    max_uses: number | null;
    uses_count: number;
    starts_at: string | null;
    ends_at: string | null;
    is_active: boolean;
  }>;

  const handleCreate = () => {
    const body: Record<string, unknown> = { code, type };
    if (type === "percentage") body.value = Math.round(parseFloat(value) * 100);
    else body.value = Math.round(parseFloat(value) * 100);
    if (minSubtotal) body.min_subtotal = Math.round(parseFloat(minSubtotal) * 100);
    if (maxUses) body.max_uses = parseInt(maxUses);
    createMutation.mutate(body);
    setShowCreate(false);
    setCode("");
    setType("percentage");
    setValue("");
    setMinSubtotal("");
    setMaxUses("");
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Promotions</h1>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger render={<Button size="sm" />}>
            <PlusIcon className="mr-2 h-4 w-4" />Add Promotion
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Promotion</DialogTitle></DialogHeader>
            <div className="space-y-3 py-4">
              <div><Label>Code</Label><Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="SUMMER20" /></div>
              <div><Label>Type</Label>
                <Select value={type} onValueChange={(v: string | null) => v && setType(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed_amount">Fixed Amount ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>{type === "percentage" ? "Percentage (e.g. 20 = 20%)" : "Amount ($)"}</Label>
                <Input type="number" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} />
              </div>
              <div><Label>Min Subtotal ($, optional)</Label>
                <Input type="number" step="0.01" value={minSubtotal} onChange={(e) => setMinSubtotal(e.target.value)} />
              </div>
              <div><Label>Max Uses (optional)</Label>
                <Input type="number" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} />
              </div>
              <Button className="w-full" onClick={handleCreate} disabled={createMutation.isPending || !code || !value}>
                {createMutation.isPending ? <Loader2Icon className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? <Skeleton className="h-48 w-full" /> : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Value</TableHead>
              <TableHead>Usage</TableHead>
              <TableHead>Active</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No promotions created yet</TableCell></TableRow>
            ) : list.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono font-medium">{p.code}</TableCell>
                <TableCell><Badge variant="outline">{p.type === "percentage" ? "%" : "$"}</Badge></TableCell>
                <TableCell className="text-right font-mono">
                  {p.type === "percentage" ? `${p.value / 100}%` : `$${(p.value / 100).toFixed(2)}`}
                </TableCell>
                <TableCell className="text-sm">
                  {p.uses_count}{p.max_uses ? ` / ${p.max_uses}` : ""}
                </TableCell>
                <TableCell>
                  <Switch checked={p.is_active} onCheckedChange={(v) => toggleMutation.mutate({ id: p.id, is_active: v })} />
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon-xs" onClick={() => deleteMutation.mutate(p.id)}>
                    <TrashIcon className="h-3 w-3" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
