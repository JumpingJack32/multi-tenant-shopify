"use client";

import type { CampaignDispatch } from "@/lib/api/client";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table";

const statusVariantMap: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  draft: "outline",
  scheduled: "secondary",
  processing: "default",
  completed: "default",
  failed: "destructive",
};

interface DispatchListProps {
  dispatches: CampaignDispatch[];
  loading: boolean;
  onCancel: (id: string) => void;
  onSchedule: (id: string) => void;
}

export function DispatchList({
  dispatches,
  loading,
  onCancel,
  onSchedule,
}: DispatchListProps) {
  if (loading) {
    return (
      <div className="rounded-md border">
        <div className="p-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (dispatches.length === 0) {
    return (
      <div className="rounded-md border py-8 text-center text-muted-foreground">
        No dispatches yet. Create your first campaign.
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Progress</TableHead>
            <TableHead>Scheduled</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {dispatches.map((d) => {
            const progress =
              d.total_count > 0
                ? Math.round((d.sent_count / d.total_count) * 100)
                : 0;
            return (
              <TableRow key={d.id}>
                <TableCell className="font-medium">{d.name}</TableCell>
                <TableCell>
                  <Badge variant={statusVariantMap[d.status] ?? "outline"}>
                    {d.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          d.status === "failed"
                            ? "bg-destructive"
                            : d.status === "completed"
                              ? "bg-primary"
                              : "bg-muted-foreground/30"
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                      {d.sent_count}/{d.total_count}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {d.scheduled_at
                    ? new Date(d.scheduled_at).toLocaleString()
                    : "\u2014"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {d.status === "scheduled" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onCancel(d.id)}
                      >
                        Cancel
                      </Button>
                    )}
                    {d.status === "draft" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onSchedule(d.id)}
                      >
                        Schedule
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
