"use client";

import { useQuery } from "@tanstack/react-query";
import { Badge } from "@repo/ui/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import { Label } from "@repo/ui/components/ui/label";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { Switch } from "@repo/ui/components/ui/switch";
import { CreditCardIcon, BanknoteIcon } from "@repo/ui/icons";

import { useTenantContext } from "@/contexts/tenant-context";
import { request } from "@/lib/api/client";

const ACCEPTED_CARDS = ["Visa", "Mastercard", "Amex", "Apple Pay", "Google Pay"];

export default function PaymentsPage() {
  const { currentTenantId } = useTenantContext();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin-settings", currentTenantId],
    queryFn: () => request("/admin/settings", { tenantId: currentTenantId }),
    enabled: !!currentTenantId,
  });

  const s = (settings as Record<string, unknown>)?.settings as Record<string, unknown> ?? {};

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Payments</h1>

      {isLoading ? <Skeleton className="h-48 w-full" /> : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <CreditCardIcon className="h-4 w-4" />
                Stripe
              </CardTitle>
              <CardDescription>Payment processing via Stripe</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Stripe Connected</p>
                  <p className="text-xs text-muted-foreground">{s.stripe_account_id ? `Account: ${s.stripe_account_id}` : "Not connected"}</p>
                </div>
                <Badge variant={s.stripe_account_id ? "default" : "outline"}>
                  {s.stripe_account_id ? "Connected" : "Disconnected"}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                {ACCEPTED_CARDS.map((card) => (
                  <Badge key={card} variant="secondary" className="text-xs">{card}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <BanknoteIcon className="h-4 w-4" />
                Manual Payment Methods
              </CardTitle>
              <CardDescription>Additional payment options for B2B or offline orders</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Cash on Delivery (COD)</p>
                  <p className="text-xs text-muted-foreground">Accept cash payments on delivery</p>
                </div>
                <Switch checked={!!s.cod_enabled} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Bank Transfer</p>
                  <p className="text-xs text-muted-foreground">Accept direct bank wire transfers</p>
                </div>
                <Switch checked={!!s.bank_transfer_enabled} />
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
