"use client";

import { useCallback, useState } from "react";
import { Button } from "@repo/ui/components/ui/button";
import { Skeleton } from "@repo/ui/components/ui/skeleton";

import { CreateDispatchSheet } from "@/features/marketing/components/create-dispatch-sheet";
import { DispatchList } from "@/features/marketing/components/dispatch-list";
import {
  useCreateDispatch,
  useDispatches,
  useCancelDispatch,
} from "@/features/marketing/hooks/use-dispatches";
import { useCampaignTemplates } from "@/features/marketing/hooks/use-campaign-templates";
import { useSegments } from "@/features/segments/hooks/use-segments";
import { useTenantContext } from "@/contexts/tenant-context";

export default function DispatchesPage() {
  const { currentTenantId, isLoading: tenantLoading } = useTenantContext();
  const [createOpen, setCreateOpen] = useState(false);

  const { data: dispatchData, isLoading: dispatchesLoading } = useDispatches(
    undefined,
    currentTenantId,
  );
  const { data: templates } = useCampaignTemplates(currentTenantId);
  const { data: segments } = useSegments(currentTenantId);
  const createMutation = useCreateDispatch(currentTenantId);
  const cancelMutation = useCancelDispatch(currentTenantId);

  const handleCreate = useCallback(
    async (data: {
      name: string;
      template_id: string;
      segment_id: string;
      send_immediately?: boolean;
      scheduled_at?: string;
    }) => {
      await createMutation.mutateAsync(data);
    },
    [createMutation],
  );

  const handleCancel = useCallback(
    (id: string) => {
      cancelMutation.mutate(id);
    },
    [cancelMutation],
  );

  const isLoading = tenantLoading || dispatchesLoading;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Campaign Dispatches</h1>
          <p className="text-muted-foreground">
            Send scheduled campaigns to customer segments
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>New Campaign</Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <DispatchList
          dispatches={dispatchData?.data ?? []}
          loading={false}
          onCancel={handleCancel}
          onSchedule={() => {}}
        />
      )}

      <CreateDispatchSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={handleCreate}
        segments={
          (segments ?? []) as Array<{
            id: string;
            name: string;
            customer_count: number;
          }>
        }
        templates={(templates ?? []).map((t: Record<string, unknown>) => ({
          id: t.id as string,
          name: t.name as string,
        }))}
      />
    </div>
  );
}
