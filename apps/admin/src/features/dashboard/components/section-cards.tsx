"use client";

import type { PendingPOStats } from "@repo/tenant-orm/types";
import { Badge } from "@repo/ui/components/ui/badge";
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import { Skeleton } from "@repo/ui/components/ui/skeleton";

function formatPence(n: number): string {
  return `\u00A3${(n / 100).toFixed(2)}`;
}

interface CardDef {
  label: string;
  value: number;
  prev: number;
  format: (n: number) => string;
  trendLabel: string;
  trendDesc: string;
}

function StatCardInner({ def }: { def: CardDef }) {
  const delta = def.prev > 0 ? ((def.value - def.prev) / def.prev) * 100 : 0;
  const isUp = delta >= 0;
  const arrow = isUp ? "\u2191" : "\u2193";
  return (
    <Card>
      <CardHeader>
        <CardDescription>{def.label}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums">
          {def.format(def.value)}
        </CardTitle>
        <CardAction>
          <Badge variant="outline">
            {arrow} {isUp ? "+" : ""}
            {Math.abs(delta).toFixed(1)}%
          </Badge>
        </CardAction>
      </CardHeader>
      <CardFooter className="flex-col items-start gap-1.5 text-sm">
        <div className="line-clamp-1 flex gap-2 font-medium">
          {arrow} {def.trendLabel}
        </div>
        <div className="text-muted-foreground">{def.trendDesc}</div>
      </CardFooter>
    </Card>
  );
}

function StatCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-1 h-8 w-32" />
      </CardHeader>
      <CardFooter>
        <Skeleton className="h-4 w-40" />
      </CardFooter>
    </Card>
  );
}

interface SectionCardsProps {
  revenue_mtd: number;
  revenue_prev_mtd: number;
  orders_mtd: number;
  orders_prev_mtd: number;
  aov: number;
  active_customers: number;
  active_customers_prev: number;
  pending_pos: PendingPOStats;
}

export function SectionCards(props: SectionCardsProps) {
  const cards: CardDef[] = [
    {
      label: "Revenue (MTD)",
      value: props.revenue_mtd,
      prev: props.revenue_prev_mtd,
      format: formatPence,
      trendLabel: "Trending up this month",
      trendDesc: "Revenue vs previous period",
    },
    {
      label: "Orders (MTD)",
      value: props.orders_mtd,
      prev: props.orders_prev_mtd,
      format: (n) => n.toString(),
      trendLabel:
        props.orders_mtd >= props.orders_prev_mtd
          ? "Order volume increasing"
          : "Order volume declining",
      trendDesc: "Orders vs previous period",
    },
    {
      label: "AOV",
      value: props.aov,
      prev: 0,
      format: formatPence,
      trendLabel: "Average order value",
      trendDesc: "Per-order revenue",
    },
    {
      label: "Active Customers",
      value: props.active_customers,
      prev: props.active_customers_prev,
      format: (n) => n.toString(),
      trendLabel:
        props.active_customers >= props.active_customers_prev
          ? "Customer base growing"
          : "Customer base shrinking",
      trendDesc: "Unique customers vs previous period",
    },
    {
      label: "Pending POs",
      value: props.pending_pos.count,
      prev: 0,
      format: (n) => n.toString(),
      trendLabel:
        props.pending_pos.count > 0
          ? `${formatPence(props.pending_pos.total)} total value`
          : "No pending orders",
      trendDesc: "Purchase orders awaiting approval",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs sm:grid-cols-2 lg:grid-cols-5 dark:*:data-[slot=card]:bg-card">
      {cards.map((def) => (
        <StatCardInner key={def.label} def={def} />
      ))}
    </div>
  );
}

export function SectionCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {[1, 2, 3, 4, 5].map((i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  );
}
