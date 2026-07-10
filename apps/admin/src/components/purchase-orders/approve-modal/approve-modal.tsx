"use client";

import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Label } from "@repo/ui/components/ui/label";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { useState } from "react";

import { useBatchApprovePOs } from "@/features/purchase-orders/hooks/use-purchase-orders";

interface ApproveModalProps {
  ids: string[];
  onClose: () => void;
  onApproved: () => void;
}

export function ApproveModal({ ids, onClose, onApproved }: ApproveModalProps) {
  const batchApprove = useBatchApprovePOs();
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApprove = async () => {
    setSaving(true);
    setError(null);
    try {
      await batchApprove.mutateAsync(ids);
      onApproved();
    } catch (err) {
      setError((err as Error)?.message ?? "Approval failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Approve Purchase Orders</DialogTitle>
          <DialogDescription>
            You are about to approve {ids.length} purchase order
            {ids.length !== 1 ? "s" : ""}.
            {ids.length === 1
              ? " This will send it to the supplier."
              : " These will be sent to their suppliers."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="rounded-md bg-muted p-3">
            <p className="text-sm font-medium">Email to Supplier</p>
            <p className="text-sm text-muted-foreground mt-1">
              Subject: New Purchase Order{ids.length > 1 ? "s" : ""} —{" "}
              {ids.join(", ")}
            </p>
            <p className="text-sm text-muted-foreground">
              Body: Please find attached purchase order
              {ids.length > 1 ? "s" : ""} for fulfillment.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="approve-note">Internal Note (optional)</Label>
            <Textarea
              id="approve-note"
              placeholder="Add a note..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleApprove} disabled={saving}>
            {saving
              ? "Approving..."
              : `Approve ${ids.length} PO${ids.length !== 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
