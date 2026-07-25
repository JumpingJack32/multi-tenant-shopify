"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
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

export default function ShippingPage() {
  const { currentTenantId } = useTenantContext();
  const queryClient = useQueryClient();

  const { data: methods, isLoading } = useQuery({
    queryKey: ["shipping-methods", currentTenantId],
    queryFn: () => request("/admin/shipping-methods", { tenantId: currentTenantId }),
    enabled: !!currentTenantId,
  }) as { data: Array<Record<string, unknown>> | undefined; isLoading: boolean };

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      request("/admin/shipping-methods", {
        method: "POST",
        body: JSON.stringify(body),
        tenantId: currentTenantId,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["shipping-methods"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      request(`/admin/shipping-methods/${id}`, {
        method: "DELETE",
        tenantId: currentTenantId,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["shipping-methods"] }),
  });

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [rateType, setRateType] = useState("FLAT_RATE");
  const [basePrice, setBasePrice] = useState("");
  const [threshold, setThreshold] = useState("");

  const handleCreate = () => {
    createMutation.mutate({
      name,
      rate_type: rateType,
      base_price: parseFloat(basePrice) || 0,
      free_shipping_threshold: threshold ? parseFloat(threshold) : null,
    });
    setShowForm(false);
    setName("");
    setBasePrice("");
    setThreshold("");
  };

  const list = (methods ?? []) as Array<{ id: string; name: string; rate_type: string; base_price: string; free_shipping_threshold: string | null; is_active: boolean }>;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Shipping</h1>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <PlusIcon className="mr-2 h-4 w-4" />
          Add Method
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-sm">New Shipping Method</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Standard Ground" />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={rateType} onValueChange={(v: string | null) => v && setRateType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="FLAT_RATE">Flat Rate</SelectItem>
                  <SelectItem value="THRESHOLD">Free Shipping Threshold</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Base Price ($)</Label>
              <Input type="number" step="0.01" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} />
            </div>
            {rateType === "THRESHOLD" && (
              <div>
                <Label>Free Shipping Over ($)</Label>
                <Input type="number" step="0.01" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
              </div>
            )}
            <Button size="sm" onClick={handleCreate} disabled={createMutation.isPending || !name}>
              {createMutation.isPending ? <Loader2Icon className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : list.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No shipping methods configured</CardContent></Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Free Threshold</TableHead>
              <TableHead>Active</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.name}</TableCell>
                <TableCell className="text-sm">{m.rate_type}</TableCell>
                <TableCell className="text-right font-mono">${parseFloat(m.base_price).toFixed(2)}</TableCell>
                <TableCell className="text-right font-mono">
                  {m.free_shipping_threshold ? `$${parseFloat(m.free_shipping_threshold).toFixed(2)}` : "—"}
                </TableCell>
                <TableCell>{m.is_active ? "Yes" : "No"}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon-xs" onClick={() => deleteMutation.mutate(m.id)}>
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
