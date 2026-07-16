"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { Separator } from "@repo/ui/components/ui/separator";
import {
  LoaderIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  XIcon,
} from "@repo/ui/icons";
import type { CustomerDetail } from "@repo/tenant-orm/types";

import { api } from "@/lib/api/client";

interface TabSegmentationProps {
  data?: CustomerDetail | null;
  tenantId?: string | null;
}

export function TabSegmentation({ data, tenantId }: TabSegmentationProps) {
  const router = useRouter();
  const [newTagKey, setNewTagKey] = useState("");
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const tags = data?.tags ?? {};
  const activeTags = Object.entries(tags)
    .filter(([, v]) => v)
    .map(([k]) => k);
  const savedSegments: Array<{ id: string; name: string; count: number }> = [];

  const handleAddTag = useCallback(async () => {
    if (!newTagKey.trim() || !data) return;
    setNewTagKey("");
  }, [newTagKey, data]);

  const handleRemoveTag = useCallback((_key: string) => {}, []);

  const handleMailchimpSync = useCallback(async () => {
    if (!data) return;
    setSyncLoading(true);
    setSyncMsg(null);
    try {
      await api.customers.syncMailchimp(data.id, { tenantId });
      setSyncMsg("Sync initiated — status will update shortly.");
    } catch {
      setSyncMsg("Sync failed. Mailchimp may not be configured.");
    } finally {
      setSyncLoading(false);
    }
  }, [data, tenantId]);

  const handleSearchSimilar = useCallback(() => {
    const tagParam = activeTags.length > 0 ? activeTags[0] : "";
    const params = new URLSearchParams();
    if (tagParam) params.set("tag", tagParam);
    router.push(`/customers?${params.toString()}`);
  }, [activeTags, router]);

  if (!data) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        Customer not found
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-4 space-y-3">
        <h4 className="text-sm font-medium">Current Tags</h4>
        {activeTags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {activeTags.map((key) => (
              <Badge
                key={key}
                variant="secondary"
                className="text-xs gap-1 pr-1"
              >
                {key}
                <button
                  onClick={() => handleRemoveTag(key)}
                  className="hover:text-destructive ml-1"
                >
                  <XIcon className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No tags assigned</p>
        )}
      </Card>

      <div className="space-y-2">
        <Label>Add Tag</Label>
        <div className="flex gap-2">
          <Input
            placeholder="e.g. VIP"
            value={newTagKey}
            onChange={(e) => setNewTagKey(e.target.value)}
          />
          <Button size="sm" onClick={handleAddTag} disabled={!newTagKey.trim()}>
            <PlusIcon /> Add
          </Button>
        </div>
      </div>

      <Button variant="outline" size="sm" onClick={handleSearchSimilar}>
        <SearchIcon /> Search Similar Profiles
      </Button>

      <Separator />

      <Card className="p-4 space-y-3">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <RefreshCwIcon className="h-4 w-4" />
          Mailchimp Sync
        </h4>
        <p className="text-sm text-muted-foreground">
          {data.last_synced_at
            ? `Last synced: ${new Date(data.last_synced_at).toLocaleString()}`
            : "Not yet synced with Mailchimp"}
        </p>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleMailchimpSync}
            disabled={syncLoading}
          >
            {syncLoading ? (
              <LoaderIcon className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCwIcon className="h-3 w-3" />
            )}
            Sync Now
          </Button>
          {syncMsg && (
            <span className="text-xs text-muted-foreground">{syncMsg}</span>
          )}
        </div>
      </Card>

      <Separator />

      <div className="space-y-2">
        <h4 className="text-sm font-medium">Saved Segments</h4>
        {savedSegments.length > 0 ? (
          <div className="space-y-1">
            {savedSegments.map((seg) => (
              <div
                key={seg.id}
                className="flex items-center justify-between text-sm p-2 rounded border"
              >
                <span className="font-medium">{seg.name}</span>
                <span className="text-muted-foreground text-xs">
                  {seg.count} customers
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No saved segments yet. Create one from the filters on the customers
            page.
          </p>
        )}
      </div>
    </div>
  );
}
