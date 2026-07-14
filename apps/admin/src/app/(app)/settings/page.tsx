"use client";

import { useCallback, useState } from "react";
import { Badge } from "@repo/ui/components/ui/badge";

import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { useRbac } from "@/contexts/rbac-context";
import { useTenantContext } from "@/contexts/tenant-context";

type Tab = "store" | "users" | "notifications";

const TABS: { id: Tab; label: string }[] = [
  { id: "store", label: "Store Details" },
  { id: "users", label: "Users & Permissions" },
  { id: "notifications", label: "Notifications" },
];

function StoreTab() {
  const { currentTenant } = useTenantContext();
  const [name, setName] = useState(currentTenant?.name ?? "");
  const [slug, setSlug] = useState(currentTenant?.slug ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSave = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!currentTenant) return;
      setError(null);
      setSuccess(false);
      setSaving(true);

      try {
        const token = await (async () => {
          const { getToken } = await import("@clerk/nextjs");
          return getToken();
        })();
        const API_BASE = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1`;
        const response = await fetch(
          `${API_BASE}/tenants/${currentTenant.tenant_id}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ name, slug }),
          },
        );

        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(
            body?.detail ?? `Failed to save (${response.status})`,
          );
        }

        setSuccess(true);
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : "Failed to save settings",
        );
      } finally {
        setSaving(false);
      }
    },
    [currentTenant, name, slug],
  );

  if (!currentTenant) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        No tenant selected.
      </div>
    );
  }

  return (
    <div className="max-w-lg space-y-6">
      {error && (
        <ErrorBanner message={error} onDismiss={() => setError(null)} />
      )}

      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Store details saved successfully.
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="store-name" className="text-sm font-medium">
            Store Name
          </label>
          <input
            id="store-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="My Store"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="store-slug" className="text-sm font-medium">
            Slug
          </label>
          <input
            id="store-slug"
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="my-store"
          />
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
          {currentTenant.status !== "active" && (
            <Badge
              variant="outline"
              className="text-amber-600 border-amber-300"
            >
              {currentTenant.status}
            </Badge>
          )}
        </div>
      </form>
    </div>
  );
}

function UsersTab() {
  const { can, role } = useRbac();

  return (
    <div className="max-w-lg space-y-6">
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Your Role</span>
          <Badge>{role || "admin"}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Permissions: {can("create") && "create "}
          {can("read") && "read "}
          {can("update") && "update "}
          {can("delete") && "delete "}
        </p>
      </div>

      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        User management will be available in a future update.
      </div>
    </div>
  );
}

function NotificationsTab() {
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [orderConfirms, setOrderConfirms] = useState(true);
  const [lowStockAlerts, setLowStockAlerts] = useState(true);

  return (
    <div className="max-w-lg space-y-4">
      <p className="text-sm text-muted-foreground">
        Configure which notifications you receive.
      </p>

      <div className="space-y-3">
        {[
          {
            label: "Email Alerts",
            desc: "Receive email notifications for important events",
            value: emailAlerts,
            set: setEmailAlerts,
          },
          {
            label: "Order Confirmations",
            desc: "Get notified when new orders are placed",
            value: orderConfirms,
            set: setOrderConfirms,
          },
          {
            label: "Low Stock Alerts",
            desc: "Warn when inventory falls below reorder point",
            value: lowStockAlerts,
            set: setLowStockAlerts,
          },
        ].map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between rounded-lg border p-4"
          >
            <div>
              <p className="text-sm font-medium">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
            <button
              role="switch"
              aria-checked={item.value}
              onClick={() => item.set(!item.value)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                item.value ? "bg-primary" : "bg-input"
              }`}
            >
              <span
                className={`pointer-events-none block h-4 w-4 rounded-full bg-background shadow-sm ring-0 transition-transform ${
                  item.value ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Notification preferences are stored locally for now.
      </p>
    </div>
  );
}

export default function SettingsPage() {
  const { currentTenant, isLoading } = useTenantContext();
  const [activeTab, setActiveTab] = useState<Tab>("store");

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-4 w-64 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          {currentTenant
            ? `Configure ${currentTenant.name}`
            : "Configure your store"}
        </p>
      </div>

      <div className="mb-6 flex gap-1 border-b">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "store" && <StoreTab />}
      {activeTab === "users" && <UsersTab />}
      {activeTab === "notifications" && <NotificationsTab />}
    </div>
  );
}
