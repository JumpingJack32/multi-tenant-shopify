"use client";

import { useState } from "react";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { Separator } from "@repo/ui/components/ui/separator";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { MailIcon, NotebookIcon } from "@repo/ui/icons";
import type { CustomerDetail, TimelineEvent } from "@repo/tenant-orm/types";

import {
  useAddTimelineEvent,
  useCustomerTimeline,
} from "@/features/customers/hooks/use-customers";

function formatPence(n: number): string {
  return `£ ${(n / 100).toFixed(2)}`;
}

function getEventIcon(type: string): string {
  switch (type) {
    case "note":
      return "📝";
    case "email_sent":
      return "📧";
    case "credit_added":
      return "💰";
    case "credit_deducted":
      return "💸";
    case "status_change":
      return "🔁";
    case "tag_added":
      return "🏷️";
    case "tag_removed":
      return "🗑️";
    case "imported":
      return "📥";
    default:
      return "📌";
  }
}

interface TabAccountProps {
  customerId: string;
  data?: CustomerDetail | null;
  isLoading?: boolean;
  tenantId?: string | null;
}

export function TabAccount({
  customerId,
  data,
  isLoading,
  tenantId,
}: TabAccountProps) {
  const [newNote, setNewNote] = useState("");
  const { data: timeline, isLoading: timelineLoading } = useCustomerTimeline(
    customerId,
    tenantId,
  );
  const addEvent = useAddTimelineEvent(tenantId);

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    await addEvent.mutateAsync({
      customerId,
      data: { event_type: "note", description: newNote.trim() },
    });
    setNewNote("");
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

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
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Email</span>
            <p className="font-medium">{data.email}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Phone</span>
            <p className="font-medium">{data.phone || "—"}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Customer since</span>
            <p className="font-medium">
              {data.created_at
                ? new Date(data.created_at).toLocaleDateString()
                : "—"}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Last order</span>
            <p className="font-medium">
              {data.last_order_at
                ? new Date(data.last_order_at).toLocaleDateString()
                : "—"}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Total Spent</span>
            <p className="font-mono font-bold">
              {formatPence(data.total_spent)}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Avg Order Value</span>
            <p className="font-mono font-bold">
              {formatPence(data.average_order_value)}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Subscription</span>
            <p className="font-medium capitalize">
              {data.email_subscription_status}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Store Credit</span>
            <p className="font-mono font-bold">
              {formatPence(data.store_credit)}
            </p>
          </div>
        </div>
        {data.addresses && data.addresses.length > 0 && (
          <>
            <Separator />
            <div className="text-sm">
              <span className="text-muted-foreground">Address</span>
              <p className="font-medium mt-1">
                {data.addresses.find((a: any) => a.is_default)?.line1 ??
                  data.addresses[0]?.line1}
                {data.addresses[0]?.city && `, ${data.addresses[0].city}`}
              </p>
            </div>
          </>
        )}
        {data.tags && Object.keys(data.tags).length > 0 && (
          <>
            <Separator />
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(data.tags)
                .filter(([, v]) => v)
                .map(([key]) => (
                  <Badge key={key} variant="secondary" className="text-xs">
                    {key}
                  </Badge>
                ))}
            </div>
          </>
        )}
      </Card>

      <div className="flex gap-2">
        <Button variant="outline" size="sm">
          <MailIcon /> Send Email
        </Button>
        <Button variant="outline" size="sm" disabled>
          Reset Password
        </Button>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium flex items-center gap-2">
          <NotebookIcon /> Internal Notes
        </label>
        <Textarea
          placeholder="Add a note about this customer..."
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          rows={3}
        />
        <Button
          size="sm"
          onClick={handleAddNote}
          disabled={!newNote.trim() || addEvent.isPending}
        >
          {addEvent.isPending ? "Adding..." : "Add Note"}
        </Button>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-medium">Activity Timeline</h4>
        {timelineLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : timeline && timeline.length > 0 ? (
          <div className="space-y-2">
            {timeline.map((event: TimelineEvent) => (
              <div
                key={event.id}
                className="flex gap-3 text-sm p-3 rounded-lg border bg-card"
              >
                <span className="text-lg mt-0.5">
                  {getEventIcon(event.event_type)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{event.description}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(event.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No activity recorded yet
          </p>
        )}
      </div>
    </div>
  );
}
