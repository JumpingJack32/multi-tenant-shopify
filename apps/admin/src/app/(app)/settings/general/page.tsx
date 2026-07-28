"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { Loader2Icon, SaveIcon } from "@repo/ui/icons";

import { useTenantContext } from "@/contexts/tenant-context";
import { request } from "@/lib/api/client";

const CURRENCIES = ["GBP", "USD", "EUR", "CAD", "AUD", "CHF", "JPY"];
const TIMEZONES = ["UTC", "Europe/London", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Asia/Tokyo", "Asia/Shanghai"];
const UNIT_SYSTEMS = ["metric", "imperial"];

export default function GeneralSettingsPage() {
  const { currentTenantId } = useTenantContext();
  const queryClient = useQueryClient();
  const loaded = useRef(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-settings", currentTenantId],
    queryFn: () => request("/admin/settings", { tenantId: currentTenantId }),
    enabled: !!currentTenantId,
  });

  const saveMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      request("/admin/settings", {
        method: "PUT",
        body: JSON.stringify(body),
        tenantId: currentTenantId,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-settings"] }),
  });

  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [currency, setCurrency] = useState("GBP");
  const [timezone, setTimezone] = useState("UTC");
  const [unitSystem, setUnitSystem] = useState("metric");
  const [supportEmail, setSupportEmail] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (data && !loaded.current) {
      loaded.current = true;
      const d = data as Record<string, unknown>;
      const s = (d.settings as Record<string, unknown>) ?? {};
      setName((d.name as string) ?? "");
      setDomain((d.domain as string) ?? "");
      setCurrency((s.currency as string) ?? "GBP");
      setTimezone((s.timezone as string) ?? "UTC");
      setUnitSystem((s.unit_system as string) ?? "metric");
      setSupportEmail((s.support_email as string) ?? "");
      setPhone((s.phone as string) ?? "");
    }
  }, [data]);

  const handleSave = () => {
    saveMutation.mutate({
      name,
      domain,
      settings: { currency, timezone, unit_system: unitSystem, support_email: supportEmail, phone },
    });
  };

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">General Settings</h1>

      {isLoading ? <Skeleton className="h-64 w-full" /> : (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Store Profile</CardTitle>
            <CardDescription>Configure your store name, localization, and contact details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Store Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <Label>Domain</Label>
                <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="mystore.com" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Support Email</Label>
                <Input type="email" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+44 20 1234 5678" />
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold mb-3">Localization</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Currency</Label>
                  <Select value={currency} onValueChange={(v: string | null) => v && setCurrency(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Timezone</Label>
                  <Select value={timezone} onValueChange={(v: string | null) => v && setTimezone(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Unit System</Label>
                  <Select value={unitSystem} onValueChange={(v: string | null) => v && setUnitSystem(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {UNIT_SYSTEMS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2Icon className="h-4 w-4 animate-spin mr-2" /> : <SaveIcon className="h-4 w-4 mr-2" />}
              Save Changes
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
