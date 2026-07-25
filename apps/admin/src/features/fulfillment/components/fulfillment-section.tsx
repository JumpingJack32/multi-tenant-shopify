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
  DialogDescription,
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
import { Switch } from "@repo/ui/components/ui/switch";
import { Loader2Icon, PackageIcon, TruckIcon, ExternalLinkIcon } from "@repo/ui/icons";

import { useTenantContext } from "@/contexts/tenant-context";
import { api } from "@/lib/api/client";

const CARRIERS = ["UPS", "FedEx", "DHL", "USPS", "Royal Mail", "Custom"];

function buildTrackingUrl(carrier: string, trackingNumber: string): string {
  const map: Record<string, string> = {
    UPS: `https://www.ups.com/track?tracknum=${trackingNumber}`,
    FedEx: `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`,
    DHL: `https://www.dhl.com/en/express/tracking.html?AWB=${trackingNumber}`,
    USPS: `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`,
  };
  return map[carrier] ?? "";
}

interface FulfillmentSectionProps {
  orderId: string;
  items: Array<{
    id: string;
    product_name: string;
    variant_name?: string | null;
    quantity: number;
  }>;
}

export function FulfillmentSection({ orderId, items }: FulfillmentSectionProps) {
  const { currentTenantId } = useTenantContext();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [notifyCustomer, setNotifyCustomer] = useState(true);

  const { data: fulfillments, isLoading: fulLoading } = useQuery({
    queryKey: ["fulfillments", orderId, currentTenantId],
    queryFn: () => api.fulfillment.list(orderId, { tenantId: currentTenantId }),
    enabled: !!currentTenantId,
  });

  const createMutation = useMutation({
    mutationFn: (data: {
      items_to_pack: Array<{ order_item_id: string; quantity: number }>;
      notify_customer?: boolean;
      carrier?: string;
      tracking_number?: string;
      tracking_url?: string;
    }) => api.fulfillment.create(orderId, data, { tenantId: currentTenantId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fulfillments", orderId] });
      setOpen(false);
      setCarrier("");
      setTrackingNumber("");
      setQuantities({});
    },
  });

  const handleSubmit = () => {
    const items_to_pack = Object.entries(quantities)
      .filter(([_, qty]) => qty > 0)
      .map(([order_item_id, quantity]) => ({ order_item_id, quantity }));
    if (items_to_pack.length === 0) return;
    const tracking_url = buildTrackingUrl(carrier, trackingNumber);
    createMutation.mutate({
      items_to_pack,
      notify_customer: notifyCustomer,
      carrier: carrier || undefined,
      tracking_number: trackingNumber || undefined,
      ...(tracking_url ? { tracking_url } : {}),
    });
  };

  const fulList = (fulfillments ?? []) as Array<{
    id: string;
    status: string;
    carrier?: string;
    tracking_number?: string;
    tracking_url?: string;
    shipped_at?: string;
    delivered_at?: string;
    created_at: string;
  }>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Fulfillment</CardTitle>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button size="sm" />}>
              <PackageIcon className="mr-2 h-4 w-4" />
              Fulfill Items
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Create Fulfillment</DialogTitle>
                <DialogDescription>
                  Select items to pack and enter tracking details
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.product_name}</p>
                      {item.variant_name && (
                        <p className="text-xs text-muted-foreground">{item.variant_name}</p>
                      )}
                      <p className="text-xs text-muted-foreground">Ordered: {item.quantity}</p>
                    </div>
                    <Input
                      type="number"
                      min={0}
                      max={item.quantity}
                      className="w-20 ml-4"
                      placeholder="0"
                      value={quantities[item.id] ?? 0}
                      onChange={(e) =>
                        setQuantities({
                          ...quantities,
                          [item.id]: Math.min(
                            Math.max(0, parseInt(e.target.value) || 0),
                            item.quantity,
                          ),
                        })
                      }
                    />
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <div>
                  <Label>Carrier</Label>
                  <Select value={carrier} onValueChange={(v: string | null) => v && setCarrier(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select carrier" />
                    </SelectTrigger>
                    <SelectContent>
                      {CARRIERS.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tracking Number</Label>
                  <Input
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="1Z9999999999999999"
                  />
                  {carrier && trackingNumber && buildTrackingUrl(carrier, trackingNumber) && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Tracking URL: {buildTrackingUrl(carrier, trackingNumber)}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label>Notify customer via email</Label>
                <Switch checked={notifyCustomer} onCheckedChange={setNotifyCustomer} />
              </div>

              <Button
                className="w-full"
                onClick={handleSubmit}
                disabled={
                  createMutation.isPending ||
                  Object.values(quantities).every((q) => q === 0)
                }
              >
                {createMutation.isPending ? (
                  <Loader2Icon className="h-4 w-4 animate-spin" />
                ) : (
                  "Create Fulfillment"
                )}
              </Button>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {fulLoading ? (
            <Loader2Icon className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : fulList.length === 0 ? (
            <p className="text-sm text-muted-foreground">No fulfillments yet</p>
          ) : (
            <div className="space-y-3">
              {fulList.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between border rounded p-3 text-sm"
                >
                  <div className="flex items-center gap-2">
                    {f.status === "delivered" ? (
                      <PackageIcon className="h-4 w-4 text-green-500" />
                    ) : f.status === "transit" ? (
                      <TruckIcon className="h-4 w-4 text-blue-500" />
                    ) : (
                      <PackageIcon className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div>
                      <p className="font-medium capitalize">{f.status}</p>
                      {f.carrier && f.tracking_number && (
                        <p className="text-xs text-muted-foreground">
                          {f.carrier} — {f.tracking_number}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {new Date(f.created_at).toLocaleDateString()}
                    </Badge>
                    {f.tracking_url && (
                      <a
                        href={f.tracking_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLinkIcon className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
