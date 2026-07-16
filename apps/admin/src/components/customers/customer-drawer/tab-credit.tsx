"use client";

import { useState } from "react";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { Separator } from "@repo/ui/components/ui/separator";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { PlusIcon, MinusIcon } from "@repo/ui/icons";
import type { CustomerDetail } from "@repo/tenant-orm/types";

import {
  useAddCredit,
  useCustomerCredit,
} from "@/features/customers/hooks/use-customers";

function formatPence(n: number): string {
  return `£ ${(n / 100).toFixed(2)}`;
}

interface TabCreditProps {
  customerId: string;
  data?: CustomerDetail | null;
  isLoading?: boolean;
  tenantId?: string | null;
}

export function TabCredit({
  customerId,
  data,
  isLoading,
  tenantId,
}: TabCreditProps) {
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustType, setAdjustType] = useState<"add" | "deduct">("add");

  const { data: creditData, isLoading: creditLoading } = useCustomerCredit(
    customerId,
    tenantId,
  );
  const addCredit = useAddCredit(tenantId);

  const handleAdjust = async () => {
    const pounds = parseFloat(adjustAmount);
    if (isNaN(pounds) || pounds <= 0 || !adjustReason.trim()) return;
    const pence = Math.round(pounds * 100);
    const amount = adjustType === "deduct" ? -pence : pence;

    await addCredit.mutateAsync({
      customerId,
      data: { amount, reason: adjustReason.trim() },
    });
    setAdjustOpen(false);
    setAdjustAmount("");
    setAdjustReason("");
  };

  if (isLoading || creditLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const balance = creditData?.balance ?? data?.store_credit ?? 0;
  const transactions = creditData?.transactions ?? [];

  return (
    <div className="space-y-6">
      <Card className="p-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Current Balance</p>
          <p className="text-3xl font-mono font-bold">{formatPence(balance)}</p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => {
              setAdjustType("add");
              setAdjustOpen(true);
            }}
          >
            <PlusIcon /> Add Credit
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setAdjustType("deduct");
              setAdjustOpen(true);
            }}
          >
            <MinusIcon /> Deduct
          </Button>
        </div>
      </Card>

      <div className="space-y-3">
        <h4 className="text-sm font-medium">Transaction History</h4>
        {transactions.length > 0 ? (
          <div className="space-y-2">
            {transactions.map((tx: any) => (
              <div
                key={tx.id}
                className="flex items-start justify-between text-sm p-3 rounded-lg border"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{tx.reason}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(tx.created_at).toLocaleString()}
                    {tx.created_by ? ` — by ${tx.created_by}` : ""}
                  </p>
                </div>
                <span
                  className={`font-mono font-bold ml-3 ${tx.amount >= 0 ? "text-green-600" : "text-red-600"}`}
                >
                  {tx.amount >= 0 ? "+" : ""}
                  {formatPence(tx.amount)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No transactions yet
          </p>
        )}
      </div>

      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {adjustType === "add" ? "Add" : "Deduct"} Store Credit
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Amount (£)</Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="10.00"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea
                placeholder="Compensation for damaged Q1 magazine"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                rows={3}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              This will also create a timeline event recording this change.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAdjust}
              disabled={
                !adjustAmount || !adjustReason.trim() || addCredit.isPending
              }
            >
              {addCredit.isPending ? "Processing..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
