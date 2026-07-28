"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { Loader2Icon } from "@repo/ui/icons";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function SubscriptionsPage() {
  const { tenant } = useParams<{ tenant: string }>();
  const queryClient = useQueryClient();

  const customerEmail = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("email") ?? ""
    : "";

  const { data: subs, isLoading } = useQuery({
    queryKey: ["subscriptions", tenant, customerEmail],
    queryFn: async () => {
      const r = await fetch(`${API_URL}/api/v1/storefront/${tenant}/subscriptions?customer_email=${encodeURIComponent(customerEmail)}`);
      return r.json();
    },
    enabled: !!customerEmail,
  });

  const cancelMutation = useMutation({
    mutationFn: async (subId: string) => {
      await fetch(`${API_URL}/api/v1/storefront/${tenant}/subscriptions/${subId}/cancel`, { method: "POST" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["subscriptions"] }),
  });

  const list = (subs ?? []) as Array<{
    id: string;
    stripe_subscription_id: string;
    status: string;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
  }>;

  const STATUS_COLORS: Record<string, string> = {
    active: "bg-green-100 text-green-800",
    past_due: "bg-yellow-100 text-yellow-800",
    canceled: "bg-red-100 text-red-800",
    paused: "bg-gray-100 text-gray-800",
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">My Subscriptions</h1>

      {!customerEmail ? (
        <p className="text-muted-foreground">Sign in to view your subscriptions</p>
      ) : isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : list.length === 0 ? (
        <p className="text-muted-foreground">No active subscriptions</p>
      ) : (
        <div className="space-y-4">
          {list.map((sub) => (
            <Card key={sub.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-sm">
                  Subscription
                  <Badge className={STATUS_COLORS[sub.status] ?? ""}>{sub.status}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <span className="capitalize">{sub.status}</span>
                </div>
                {sub.current_period_end && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Next billing</span>
                    <span>{new Date(sub.current_period_end).toLocaleDateString()}</span>
                  </div>
                )}
                {sub.cancel_at_period_end && (
                  <p className="text-xs text-yellow-600">Cancels at period end</p>
                )}
                {sub.status === "active" && !sub.cancel_at_period_end && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => cancelMutation.mutate(sub.id)}
                    disabled={cancelMutation.isPending}
                    className="mt-2"
                  >
                    {cancelMutation.isPending ? <Loader2Icon className="h-4 w-4 animate-spin" /> : "Cancel Subscription"}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
