"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { Switch } from "@repo/ui/components/ui/switch";
import { Loader2Icon } from "@repo/ui/icons";

import { useTenantContext } from "@/contexts/tenant-context";
import { request } from "@/lib/api/client";

export default function TaxSettingsPage() {
  const { currentTenantId } = useTenantContext();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["tax-config", currentTenantId],
    queryFn: () => request("/settings/taxes", { tenantId: currentTenantId }),
    enabled: !!currentTenantId,
  });

  const updateMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      request("/settings/taxes", {
        method: "PUT",
        body: JSON.stringify(body),
        tenantId: currentTenantId,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tax-config"] }),
  });

  const config = data as {
    enabled?: boolean;
    default_rate?: number;
    tax_inclusive?: boolean;
  } | null;

  const defaultRate = config?.default_rate ?? 0;
  const ratePercent = (defaultRate / 100).toFixed(2);

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Tax Settings</h1>

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Tax Configuration</CardTitle>
            <CardDescription>Configure tax rates and behavior for this store</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Enable Tax Calculation</Label>
                <p className="text-xs text-muted-foreground">Calculate and display taxes during checkout</p>
              </div>
              <Switch
                checked={config?.enabled ?? false}
                onCheckedChange={(v) =>
                  updateMutation.mutate({ enabled: v } as any)
                }
              />
            </div>

            <div>
              <Label>Default Tax Rate (%)</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  type="number"
                  step="0.01"
                  className="w-32"
                  value={ratePercent}
                  onChange={(e) => {
                    const pct = parseFloat(e.target.value) || 0;
                    updateMutation.mutate({ default_rate: Math.round(pct * 100) } as any);
                  }}
                />
                <span className="text-sm text-muted-foreground">
                  (stored as {defaultRate} × 0.01%)
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Prices Include Tax</Label>
                <p className="text-xs text-muted-foreground">Prices entered already include tax (tax-inclusive pricing)</p>
              </div>
              <Switch
                checked={config?.tax_inclusive ?? false}
                onCheckedChange={(v) =>
                  updateMutation.mutate({ tax_inclusive: v } as any)
                }
              />
            </div>

            {updateMutation.isPending && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2Icon className="h-4 w-4 animate-spin" />
                Saving...
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
