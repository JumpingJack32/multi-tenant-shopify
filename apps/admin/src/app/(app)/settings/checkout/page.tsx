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
import { Loader2Icon, SaveIcon } from "@repo/ui/icons";

import { useTenantContext } from "@/contexts/tenant-context";
import { request } from "@/lib/api/client";

export default function CheckoutSettingsPage() {
  const { currentTenantId } = useTenantContext();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-settings", currentTenantId],
    queryFn: () => request("/admin/settings", { tenantId: currentTenantId }),
    enabled: !!currentTenantId,
  });

  const s = ((data as any)?.settings as Record<string, unknown>) ?? {};

  const saveMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      request("/admin/settings", { method: "PUT", body: JSON.stringify(body), tenantId: currentTenantId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-settings"] }),
  });

  const update = (key: string, value: unknown) => {
    saveMutation.mutate({ settings: { ...s, [key]: value } });
  };

  if (isLoading) return <Skeleton className="h-64 w-full p-6" />;

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Checkout</h1>

      <Card>
        <CardHeader><CardTitle className="text-sm">Customer Accounts</CardTitle><CardDescription>Control how customers identify during checkout</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div><p className="text-sm font-medium">Account Creation</p><p className="text-xs text-muted-foreground">Require or allow customer account creation</p></div>
            <Select value={(s.account_mode as string) || "optional"} onValueChange={(v: string | null) => v && update("account_mode", v)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="required">Required</SelectItem>
                <SelectItem value="optional">Optional</SelectItem>
                <SelectItem value="guest">Guest only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Form Fields</CardTitle><CardDescription>Additional fields to show during checkout</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div><p className="text-sm font-medium">Require Phone</p><p className="text-xs text-muted-foreground">Collect phone number at checkout</p></div>
            <Switch checked={!!s.require_phone} onCheckedChange={(v) => update("require_phone", v)} />
          </div>
          <div className="flex items-center justify-between">
            <div><p className="text-sm font-medium">Require Company Name</p><p className="text-xs text-muted-foreground">Collect company name for B2B orders</p></div>
            <Switch checked={!!s.require_company} onCheckedChange={(v) => update("require_company", v)} />
          </div>
          <div className="flex items-center justify-between">
            <div><p className="text-sm font-medium">Order Notes</p><p className="text-xs text-muted-foreground">Allow customers to add order instructions</p></div>
            <Switch checked={!!s.order_notes} onCheckedChange={(v) => update("order_notes", v)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Tipping</CardTitle><CardDescription>Enable checkout tipping options</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div><p className="text-sm font-medium">Enable Tipping</p><p className="text-xs text-muted-foreground">Show tip options at checkout</p></div>
            <Switch checked={!!s.tipping_enabled} onCheckedChange={(v) => update("tipping_enabled", v)} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
