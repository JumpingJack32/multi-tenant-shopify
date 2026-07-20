"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";

interface Segment {
  id: string;
  name: string;
  customer_count: number;
}

interface Template {
  id: string;
  name: string;
}

interface CreateDispatchSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (data: {
    name: string;
    template_id: string;
    segment_id: string;
    send_immediately?: boolean;
    scheduled_at?: string;
  }) => Promise<void>;
  segments: Segment[];
  templates: Template[];
}

export function CreateDispatchSheet({
  open,
  onOpenChange,
  onCreate,
  segments,
  templates,
}: CreateDispatchSheetProps) {
  const [name, setName] = useState("");
  const [segmentId, setSegmentId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [sendNow, setSendNow] = useState(true);
  const [scheduledAt, setScheduledAt] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setSegmentId("");
      setTemplateId("");
      setSendNow(true);
      setScheduledAt("");
    }
  }, [open]);

  const handleSubmit = useCallback(async () => {
    if (!name.trim() || !segmentId || !templateId) return;
    setSaving(true);
    try {
      await onCreate({
        name: name.trim(),
        template_id: templateId,
        segment_id: segmentId,
        send_immediately: sendNow,
        scheduled_at: sendNow ? undefined : scheduledAt || undefined,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }, [
    name,
    segmentId,
    templateId,
    sendNow,
    scheduledAt,
    onCreate,
    onOpenChange,
  ]);

  const isValid = name.trim() && segmentId && templateId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Campaign</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Campaign Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. VIP Summer Sale"
            />
          </div>

          <div className="space-y-2">
            <Label>Segment</Label>
            <Select
              value={segmentId}
              onValueChange={(v) => v && setSegmentId(v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select segment..." />
              </SelectTrigger>
              <SelectContent>
                {segments.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} ({s.customer_count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Template</Label>
            <Select
              value={templateId}
              onValueChange={(v) => v && setTemplateId(v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select template..." />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-4">
            <Label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={sendNow}
                onChange={(e) => setSendNow(e.target.checked)}
                className="rounded"
              />
              Send immediately
            </Label>
          </div>

          {!sendNow && (
            <div className="space-y-2">
              <Label>Schedule Date & Time</Label>
              <Input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!isValid || saving}>
              {saving ? "Creating..." : "Create Campaign"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
