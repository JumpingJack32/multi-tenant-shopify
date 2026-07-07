"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";

export default function SettingsPage() {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSaving(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Configure your store</p>
      </div>

      <div className="max-w-lg space-y-6">
        {error && (
          <ErrorBanner message={error} onDismiss={() => setError(null)} />
        )}

        {success && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            Settings saved successfully.
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

          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </form>
      </div>
    </div>
  );
}
