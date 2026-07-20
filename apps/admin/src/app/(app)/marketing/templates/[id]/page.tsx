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

      <div className="flex items-center gap-2 px-4 py-2 border-b">
        <button
          type="button"
          onClick={async () => {
            try {
              const res = await fetch("/api/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  type: "campaign_template",
                  prompt: `Campaign: ${name}. Subject: ${subject}. Write an HTML email body.`,
                  context: {
                    name: name || undefined,
                    tokens: MERGE_TAGS.map((t) => t.value),
                  },
                }),
              });
              const body = await res.json();
              if (body.completion) setHtml(body.completion);
            } catch {
              // silent
            }
          }}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          title="Draft with AI"
        >
          <svg viewBox="0 0 65 65" fill="none" className="h-4 w-4">
            <path
              d="M32.447 0c.68 0 1.273.465 1.439 1.125a38.904 38.904 0 001.999 5.905c2.152 5 5.105 9.376 8.854 13.125 3.751 3.75 8.126 6.703 13.125 8.855a38.98 38.98 0 005.906 1.999c.66.166 1.124.758 1.124 1.438 0 .68-.464 1.273-1.125 1.439a38.902 38.902 0 00-5.905 1.999c-5 2.152-9.375 5.105-13.125 8.854-3.749 3.751-6.702 8.126-8.854 13.125a38.973 38.973 0 00-2 5.906 1.485 1.485 0 01-1.438 1.124c-.68 0-1.272-.464-1.438-1.125a38.913 38.913 0 00-2-5.905c-2.151-5-5.103-9.375-8.854-13.125-3.75-3.749-8.125-6.702-13.125-8.854a38.973 38.973 0 00-5.905-2A1.485 1.485 0 010 32.448c0-.68.465-1.272 1.125-1.438a38.903 38.903 0 005.905-2c5-2.151 9.376-5.104 13.125-8.854 3.75-3.749 6.703-8.125 8.855-13.125a38.972 38.972 0 001.999-5.905A1.485 1.485 0 0132.447 0z"
              fill="currentColor"
            />
          </svg>
          Draft with AI
        </button>
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
