"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  PackageIcon,
  SearchIcon,
  Trash2Icon,
} from "@repo/ui/icons";

import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { useTenantContext } from "@/contexts/tenant-context";
import { api } from "@/lib/api/client";

interface TransferItem {
  id: string;
  variant_id: string;
  name: string;
  sku: string;
  quantity: number;
}

export default function NewTransferPage() {
  const router = useRouter();
  const { currentTenantId } = useTenantContext();
  const [originId, setOriginId] = useState("");
  const [destId, setDestId] = useState("");
  const [items, setItems] = useState<TransferItem[]>([]);
  const [carrier, setCarrier] = useState("");
  const [tracking, setTracking] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [estArrival, setEstArrival] = useState("");
  const setV = (fn: (v: string) => void) => (v: string | null) => v && fn(v);

  const { data: locations } = useQuery({
    queryKey: ["locations", currentTenantId],
    queryFn: () => api.inventory.list({}, { tenantId: currentTenantId }),
    enabled: !!currentTenantId,
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.stockTransfers.create(data, { tenantId: currentTenantId }),
    onSuccess: (transfer) => {
      router.push(`/transfers/${transfer.id}`);
    },
  });

  const updateQuantity = (id: string, qty: number) => {
    setItems(
      items.map((item) =>
        item.id === id ? { ...item, quantity: Math.max(0, qty) } : item,
      ),
    );
  };

  const removeItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const handleSave = () => {
    if (!originId || !destId) return;
    createMutation.mutate({
      origin_location_id: originId,
      destination_location_id: destId,
      carrier: carrier || undefined,
      tracking_number: tracking || undefined,
      reference_number: reference || undefined,
      notes: notes || undefined,
      estimated_arrival: estArrival || undefined,
      items: items.map((i) => ({
        variant_id: i.variant_id,
        quantity: i.quantity,
      })),
    });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <button
        onClick={() => router.push("/transfers")}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeftIcon className="h-4 w-4" /> Stock Transfers
      </button>

      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Create stock transfer
          </h1>
          <p className="text-sm text-muted-foreground">
            Track and move inventory between your storefront locations.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => router.push("/transfers")}>
            Discard
          </Button>
          <Button onClick={handleSave} disabled={createMutation.isPending}>
            {createMutation.isPending ? "Saving..." : "Save as draft"}
          </Button>
        </div>
      </div>

      {createMutation.isError && (
        <ErrorBanner
          message={
            createMutation.error instanceof Error
              ? createMutation.error.message
              : "Failed to create transfer"
          }
        />
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="space-y-6 md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                Select Locations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center gap-4 sm:flex-row">
                <div className="w-full space-y-2">
                  <Label htmlFor="origin">Origin</Label>
                  <Select value={originId} onValueChange={setV(setOriginId)}>
                    <SelectTrigger id="origin">
                      <SelectValue placeholder="Select origin" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="loc-1">
                        Main Warehouse (NYC)
                      </SelectItem>
                      <SelectItem value="loc-2">
                        Europe Logistics Center
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="mt-6 hidden text-muted-foreground sm:block">
                  <ArrowRightIcon className="h-5 w-5" />
                </div>
                <div className="w-full space-y-2">
                  <Label htmlFor="destination">Destination</Label>
                  <Select value={destId} onValueChange={setV(setDestId)}>
                    <SelectTrigger id="destination">
                      <SelectValue placeholder="Select destination" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="loc-3">
                        SoHo Retail Flagship
                      </SelectItem>
                      <SelectItem value="loc-4">Brooklyn Pop-Up</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div className="space-y-1">
                <CardTitle className="text-base font-semibold">
                  Add Products
                </CardTitle>
                <CardDescription>
                  Select variants to add to this transfer assignment.
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" className="gap-2">
                <SearchIcon className="h-4 w-4" /> Browse
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search variants by name or SKU..."
                  className="pl-8"
                />
              </div>

              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-8 text-center text-muted-foreground">
                  <PackageIcon className="mb-2 h-8 w-8 stroke-1" />
                  <p className="text-sm">
                    No items added yet. Click browse or search above.
                  </p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead className="w-[100px] text-right">
                          Quantity
                        </TableHead>
                        <TableHead className="w-[50px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-sm font-medium">
                            {item.name}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {item.sku}
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              min={0}
                              value={item.quantity}
                              onChange={(e) =>
                                updateQuantity(
                                  item.id,
                                  parseInt(e.target.value) || 0,
                                )
                              }
                              className="ml-auto h-8 w-20 text-right"
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              onClick={() => removeItem(item.id)}
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2Icon className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                Shipment Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="est-arrival">Estimated Arrival</Label>
                <Input
                  type="date"
                  id="est-arrival"
                  value={estArrival}
                  onChange={(e) => setEstArrival(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="carrier">Shipping Carrier</Label>
                <Select value={carrier} onValueChange={setV(setCarrier)}>
                  <SelectTrigger id="carrier">
                    <SelectValue placeholder="Select carrier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ups">UPS Ground</SelectItem>
                    <SelectItem value="fedex">FedEx Express</SelectItem>
                    <SelectItem value="dhl">DHL Logistics</SelectItem>
                    <SelectItem value="internal">
                      Own Fleet / Messenger
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tracking-num">Tracking Number</Label>
                <Input
                  id="tracking-num"
                  value={tracking}
                  onChange={(e) => setTracking(e.target.value)}
                  placeholder="e.g. 1Z999AA10123456784"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                Additional Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reference">Reference Number</Label>
                <Input
                  id="reference"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="e.g. #PO-2026-089"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  rows={3}
                  placeholder="Internal notes..."
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
