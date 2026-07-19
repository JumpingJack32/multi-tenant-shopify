"use client";

import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { Skeleton } from "@repo/ui/components/ui/skeleton";

import { useTenantContext } from "@/contexts/tenant-context";
import {
  useCampaignTemplate,
  useCreateCampaignTemplate,
  useUpdateCampaignTemplate,
} from "@/features/marketing/hooks/use-campaign-templates";

const TenantEditor = dynamic(
  () => import("@repo/editor").then((mod) => mod.TenantEditor),
  { ssr: false },
);

const MERGE_TAGS = [
  { name: "Customer Name", value: "{{ customerName }}", sample: "John Doe" },
  { name: "Segment Name", value: "{{ segmentName }}", sample: "VIP Customers" },
  { name: "Store URL", value: "{{ storeUrl }}", sample: "https://store.com" },
  {
    name: "Offer HTML",
    value: "{{ offerHtml | safe }}",
    sample: "<strong>50% off</strong>",
  },
  {
    name: "Unsubscribe",
    value: "{{ unsubscribeUrl }}",
    sample: "https://store.com/unsub",
  },
];

export default function TemplateEditorPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const isNew = id === "new";
  const { currentTenantId } = useTenantContext();
  const { data, isLoading } = useCampaignTemplate(id, currentTenantId);
  const createMutation = useCreateCampaignTemplate(currentTenantId);
  const updateMutation = useUpdateCampaignTemplate(currentTenantId);

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [design, setDesign] = useState<object | null>(null);

  useEffect(() => {
    if (data && !isNew) {
      setName((data as any).name || "");
      setSubject((data as any).subject || "");
      setHtml((data as any).body_html || "");
      if ((data as any).body_json) {
        try {
          setDesign(JSON.parse((data as any).body_json));
        } catch {
          setDesign(null);
        }
      }
    }
  }, [data, isNew]);

  const handleSave = async () => {
    const payload: Record<string, unknown> = { name, subject, body_html: html };
    if (design) {
      payload.body_json = JSON.stringify(design);
    }
    if (isNew) {
      await createMutation.mutateAsync(payload);
    } else {
      await updateMutation.mutateAsync({ id, data: payload });
    }
    router.push("/marketing/templates");
  };

  if (!isNew && isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <button
          onClick={() => router.push("/marketing/templates")}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; Templates
        </button>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {isNew ? "New template" : `Editing: ${name}`}
          </span>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={
              !name.trim() ||
              createMutation.isPending ||
              updateMutation.isPending
            }
          >
            {createMutation.isPending || updateMutation.isPending
              ? "Saving..."
              : "Save Template"}
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-4 border-b">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Template Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. VIP Welcome"
            />
          </div>
          <div className="space-y-1">
            <Label>Subject Line</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Welcome {{ customerName }}!"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 p-4">
        <TenantEditor
          design={design}
          mergeTags={MERGE_TAGS}
          onSave={(newHtml, newDesign) => {
            setHtml(newHtml);
            setDesign(newDesign);
          }}
        />
      </div>
    </div>
  );
}
