"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table";
import { Loader2Icon, PlusIcon } from "@repo/ui/icons";

import { useTenantContext } from "@/contexts/tenant-context";
import { request } from "@/lib/api/client";

export default function InventoryTransfersPage() {
  const { currentTenantId } = useTenantContext();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [fromNode, setFromNode] = useState("");
  const [toNode, setToNode] = useState("");
  const [variantId, setVariantId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");

  const { data: nodes } = useQuery({
    queryKey: ["inventory-nodes", currentTenantId],
    queryFn: () => request("/admin/inventory/nodes", { tenantId: currentTenantId }),
    enabled: !!currentTenantId,
  });

  const { data: transfers, isLoading } = useQuery({
    queryKey: ["inventory-transfers", currentTenantId],
    queryFn: () => request("/admin/inventory/transfers", { tenantId: currentTenantId }),
    enabled: !!currentTenantId,
  });

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      request("/admin/inventory/transfers", {
        method: "POST",
        body: JSON.stringify(body),
        tenantId: currentTenantId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-transfers"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-stock"] });
      setShowCreate(false);
      setFromNode("");
      setToNode("");
      setVariantId("");
      setQuantity("1");
      setReason("");
    },
  });

  const nodeList = (nodes ?? []) as Array<{ id: string; name: string }>;
  const transferList = (transfers ?? []) as Array<{
    id: string;
    from_node_id: string;
    to_node_id: string;
    variant_id: string;
    quantity: number;
    status: string;
    reason: string | null;
    created_at: string;
  }>;

  const getNodeName = (id: string) => nodeList.find((n) => n.id === id)?.name ?? id.slice(0, 8);

  const handleCreate = () => {
    if (!fromNode || !toNode || !variantId || !quantity) return;
    createMutation.mutate({
      from_node_id: fromNode,
      to_node_id: toNode,
      variant_id: variantId,
      quantity: parseInt(quantity),
      reason: reason || undefined,
    });
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Stock Transfers</h1>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger render={<Button size="sm" />}>
            <PlusIcon className="mr-2 h-4 w-4" />
            New Transfer
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Stock Transfer</DialogTitle></DialogHeader>
            <div className="space-y-3 py-4">
              <div><Label>From Node</Label>
                <Select value={fromNode} onValueChange={(v: string | null) => v && setFromNode(v)}>
                  <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
                  <SelectContent>
                    {nodeList.filter((n) => n.id !== toNode).map((n) => <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>To Node</Label>
                <Select value={toNode} onValueChange={(v: string | null) => v && setToNode(v)}>
                  <SelectTrigger><SelectValue placeholder="Select destination" /></SelectTrigger>
                  <SelectContent>
                    {nodeList.filter((n) => n.id !== fromNode).map((n) => <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Variant ID</Label><Input value={variantId} onChange={(e) => setVariantId(e.target.value)} placeholder="UUID" /></div>
              <div><Label>Quantity</Label><Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} /></div>
              <div><Label>Reason (optional)</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Restock, Store transfer, etc." /></div>
              <Button className="w-full" onClick={handleCreate} disabled={createMutation.isPending || !fromNode || !toNode || !variantId}>
                {createMutation.isPending ? <Loader2Icon className="h-4 w-4 animate-spin" /> : "Create Transfer"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? <Skeleton className="h-48 w-full" /> : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead>Variant</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transferList.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No transfers yet</TableCell></TableRow>
            ) : transferList.map((t) => (
              <TableRow key={t.id}>
                <TableCell>{getNodeName(t.from_node_id)}</TableCell>
                <TableCell>{getNodeName(t.to_node_id)}</TableCell>
                <TableCell className="font-mono text-xs">{t.variant_id.slice(0, 8)}...</TableCell>
                <TableCell className="text-right font-mono">{t.quantity}</TableCell>
                <TableCell><Badge variant="outline">{t.status}</Badge></TableCell>
                <TableCell className="text-xs text-muted-foreground">{t.reason || "—"}</TableCell>
                <TableCell className="text-xs">{new Date(t.created_at).toLocaleDateString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
