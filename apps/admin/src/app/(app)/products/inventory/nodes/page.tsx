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
  CardDescription,
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
import { Switch } from "@repo/ui/components/ui/switch";
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

const NODE_TYPES = ["warehouse", "retail", "dropshipper"];

export default function InventoryNodesPage() {
  const { currentTenantId } = useTenantContext();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [nodeType, setNodeType] = useState("warehouse");
  const [priority, setPriority] = useState("0");

  const { data: nodes, isLoading } = useQuery({
    queryKey: ["inventory-nodes", currentTenantId],
    queryFn: () => request("/admin/inventory/nodes", { tenantId: currentTenantId }),
    enabled: !!currentTenantId,
  });

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      request("/admin/inventory/nodes", {
        method: "POST",
        body: JSON.stringify(body),
        tenantId: currentTenantId,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["inventory-nodes"] }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      request(`/admin/inventory/nodes/${id}`, {
        method: "PUT",
        body: JSON.stringify({ is_active }),
        tenantId: currentTenantId,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["inventory-nodes"] }),
  });

  const list = (nodes ?? []) as Array<{
    id: string;
    name: string;
    type: string;
    priority: number;
    is_active: boolean;
  }>;

  const handleCreate = () => {
    createMutation.mutate({ name, type: nodeType, priority: parseInt(priority) || 0 });
    setShowCreate(false);
    setName("");
    setNodeType("warehouse");
    setPriority("0");
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Inventory Nodes</h1>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger render={<Button size="sm" />}>
            <PlusIcon className="mr-2 h-4 w-4" />Add Node
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Inventory Node</DialogTitle></DialogHeader>
            <div className="space-y-3 py-4">
              <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Main Warehouse" /></div>
              <div><Label>Type</Label>
                <Select value={nodeType} onValueChange={(v: string | null) => v && setNodeType(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {NODE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Priority (lower = preferred)</Label>
                <Input type="number" value={priority} onChange={(e) => setPriority(e.target.value)} />
              </div>
              <Button className="w-full" onClick={handleCreate} disabled={createMutation.isPending || !name}>
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
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Priority</TableHead>
              <TableHead>Active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No nodes configured</TableCell></TableRow>
            ) : list.map((n) => (
              <TableRow key={n.id}>
                <TableCell className="font-medium">{n.name}</TableCell>
                <TableCell><Badge variant="outline">{n.type}</Badge></TableCell>
                <TableCell className="text-right">{n.priority}</TableCell>
                <TableCell>
                  <Switch
                    checked={n.is_active}
                    onCheckedChange={(v) => toggleMutation.mutate({ id: n.id, is_active: v })}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
