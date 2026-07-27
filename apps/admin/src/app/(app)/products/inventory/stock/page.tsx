"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
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
import { Loader2Icon, SaveIcon } from "@repo/ui/icons";

import { useTenantContext } from "@/contexts/tenant-context";
import { request } from "@/lib/api/client";

export default function InventoryStockPage() {
  const { currentTenantId } = useTenantContext();
  const queryClient = useQueryClient();
  const [selectedNode, setSelectedNode] = useState<string>("all");
  const [edits, setEdits] = useState<Record<string, string>>({});

  const { data: nodes } = useQuery({
    queryKey: ["inventory-nodes", currentTenantId],
    queryFn: () => request("/admin/inventory/nodes", { tenantId: currentTenantId }),
    enabled: !!currentTenantId,
  });

  const nodeList = (nodes ?? []) as Array<{ id: string; name: string }>;

  const { data: stockData, isLoading } = useQuery({
    queryKey: ["inventory-stock", selectedNode, currentTenantId],
    queryFn: async () => {
      if (selectedNode === "all") {
        const results = [];
        for (const n of nodeList) {
          const s = await request(`/admin/inventory/nodes/${n.id}/stock`, { tenantId: currentTenantId }) as Array<Record<string, unknown>>;
          results.push(...s.map((r: any) => ({ ...r, node_name: n.name })));
        }
        return results;
      }
      const s = await request(`/admin/inventory/nodes/${selectedNode}/stock`, { tenantId: currentTenantId }) as Array<Record<string, unknown>>;
      const nodeName = nodeList.find((n) => n.id === selectedNode)?.name;
      return s.map((r: any) => ({ ...r, node_name: nodeName }));
    },
    enabled: !!currentTenantId && nodeList.length > 0,
  });

  const updateMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      request("/admin/inventory/stock", {
        method: "PUT",
        body: JSON.stringify(body),
        tenantId: currentTenantId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-stock"] });
      setEdits({});
    },
  });

  const stockRows = (stockData ?? []) as Array<{
    id: string;
    variant_id: string;
    node_id: string;
    node_name: string;
    quantity: number;
    reserved: number;
    available: number;
  }>;

  const handleSave = (row: typeof stockRows[0]) => {
    const qty = parseInt(edits[row.id] ?? "");
    if (isNaN(qty)) return;
    updateMutation.mutate({ variant_id: row.variant_id, node_id: row.node_id, quantity: qty });
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Stock Levels</h1>
        <div className="flex items-center gap-2">
          <Label>Node:</Label>
          <Select value={selectedNode} onValueChange={(v: string | null) => v && setSelectedNode(v)}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Nodes</SelectItem>
              {nodeList.map((n) => <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? <Skeleton className="h-64 w-full" /> : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Location</TableHead>
              <TableHead>Variant ID</TableHead>
              <TableHead className="text-right">On Hand</TableHead>
              <TableHead className="text-right">Reserved</TableHead>
              <TableHead className="text-right">Available</TableHead>
              <TableHead className="text-right">Adjust</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stockRows.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No stock records</TableCell></TableRow>
            ) : stockRows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.node_name}</TableCell>
                <TableCell className="font-mono text-xs">{row.variant_id.slice(0, 8)}...</TableCell>
                <TableCell className="text-right font-mono">{row.quantity}</TableCell>
                <TableCell className="text-right font-mono">{row.reserved}</TableCell>
                <TableCell className="text-right font-mono">
                  <Badge variant={row.available > 0 ? "default" : "destructive"}>{row.available}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Input
                      type="number"
                      className="w-20 h-8 text-xs"
                      placeholder={String(row.quantity)}
                      value={edits[row.id] ?? ""}
                      onChange={(e) => setEdits({ ...edits, [row.id]: e.target.value })}
                    />
                    <Button
                      variant="outline"
                      size="icon-xs"
                      onClick={() => handleSave(row)}
                      disabled={updateMutation.isPending || !(edits[row.id] ?? "").trim()}
                    >
                      <SaveIcon className="h-3 w-3" />
                    </Button>
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
