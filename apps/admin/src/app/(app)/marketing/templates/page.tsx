"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@repo/ui/components/ui/card";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { PlusIcon } from "@repo/ui/icons";

import { ErrorBanner } from "@/components/ui/error-banner";
import { useTenantContext } from "@/contexts/tenant-context";
import {
  useCampaignTemplates,
  useDeleteCampaignTemplate,
} from "@/features/marketing/hooks/use-campaign-templates";

export default function MarketingTemplatesPage() {
  const router = useRouter();
  const { currentTenantId, isLoading: tenantLoading } = useTenantContext();
  const {
    data: templates,
    isLoading,
    error,
    refetch,
  } = useCampaignTemplates(currentTenantId);
  const deleteMutation = useDeleteCampaignTemplate(currentTenantId);

  if (error) {
    return (
      <div className="p-6">
        <ErrorBanner
          message="Failed to load templates"
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Campaign Templates</h1>
          <p className="text-muted-foreground">
            Design and manage email templates for automated campaigns
          </p>
        </div>
        <Button onClick={() => router.push("/marketing/templates/new")}>
          <PlusIcon /> New Template
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading || tenantLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-48 mt-2" />
                </CardHeader>
              </Card>
            ))
          : templates?.map((t: any) => (
              <Card
                key={t.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => router.push(`/marketing/templates/${t.id}`)}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">{t.name}</CardTitle>
                    <Badge
                      variant={t.is_active ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {t.is_active ? "Active" : "Draft"}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs mt-1">
                    {t.subject || "No subject"}
                  </CardDescription>
                  <div className="flex gap-2 mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/marketing/templates/${t.id}`);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteMutation.mutate(t.id);
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </CardHeader>
              </Card>
            ))}

        {!isLoading && !tenantLoading && templates?.length === 0 && (
          <Card className="col-span-full">
            <CardHeader>
              <CardTitle className="text-sm">No templates yet</CardTitle>
              <CardDescription>
                Create your first campaign template to get started.
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
    </div>
  );
}
