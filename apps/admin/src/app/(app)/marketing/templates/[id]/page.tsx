"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { Textarea } from "@repo/ui/components/ui/textarea";

import { useTenantContext } from "@/contexts/tenant-context";
import {
  useCampaignTemplate,
  useCreateCampaignTemplate,
  useUpdateCampaignTemplate,
} from "@/features/marketing/hooks/use-campaign-templates";

const TOKENS = [
  "{{ customerName }}",
  "{{ segmentName }}",
  "{{ storeUrl }}",
  "{{ offerHtml | safe }}",
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
  const [html, setHtml] = useState("<p>Start designing your email...</p>");

  useEffect(() => {
    if (data && !isNew) {
      setName((data as any).name || "");
      setSubject((data as any).subject || "");
      setHtml((data as any).body_html || "");
    }
  }, [data, isNew]);

  const insertToken = (token: string) => {
    setHtml((prev) => prev + token);
  };

  const handleSave = async () => {
    const payload = { name, subject, body_html: html };
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

      <div className="flex flex-1 gap-4 p-4">
        <div className="flex-1 flex flex-col">
          <Label className="mb-2">HTML Body (Jinja2)</Label>
          <Textarea
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            className="flex-1 min-h-[400px] font-mono text-sm"
          />
        </div>
        <div className="w-48 space-y-2">
          <h3 className="text-sm font-medium">Tokens</h3>
          {TOKENS.map((token) => (
            <Button
              key={token}
              variant="outline"
              size="sm"
              className="w-full justify-start font-mono text-xs"
              onClick={() => insertToken(token)}
            >
              {token}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
