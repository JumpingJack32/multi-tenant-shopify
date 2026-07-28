"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table";
import { Loader2Icon, SaveIcon, MailIcon } from "@repo/ui/icons";

import { useTenantContext } from "@/contexts/tenant-context";
import { request } from "@/lib/api/client";

const EMAIL_EVENTS = [
  { key: "order_confirmation", label: "Order Confirmation", description: "Sent when an order is placed" },
  { key: "shipping_update", label: "Shipping Update", description: "Sent when tracking is added to an order" },
  { key: "refund_receipt", label: "Refund Receipt", description: "Sent when a refund is processed" },
  { key: "subscription_renewal", label: "Subscription Renewal", description: "Sent before a subscription renews" },
  { key: "abandoned_cart", label: "Abandoned Cart", description: "Sent when a cart is abandoned" },
];

export default function NotificationsPage() {
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
      <h1 className="text-2xl font-bold">Notifications</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <MailIcon className="h-4 w-4" />
            Email Notifications
          </CardTitle>
          <CardDescription>Enable or disable automated email triggers</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Enabled</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {EMAIL_EVENTS.map((evt) => (
                <TableRow key={evt.key}>
                  <TableCell className="font-medium">{evt.label}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{evt.description}</TableCell>
                  <TableCell className="text-right">
                    <Switch
                      checked={s[`email_${evt.key}`] !== false}
                      onCheckedChange={(v) => update(`email_${evt.key}`, v)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
