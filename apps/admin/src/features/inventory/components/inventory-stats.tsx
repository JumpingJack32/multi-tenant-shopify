import { Card, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Skeleton } from "@repo/ui/components/ui/skeleton";

interface InventoryStatsData {
  total_skus: number;
  total_value: number;
  low_stock_count: number;
  out_of_stock_count: number;
}

export function InventoryStatsCards({
  stats,
  loading,
}: {
  stats: InventoryStatsData | undefined;
  loading: boolean;
}) {
  if (loading || !stats) {
    return (
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-28 mt-2" />
            </CardHeader>
          </Card>
        ))}
      </div>
    );
  }

  const cards = [
    { label: "Total SKUs", value: stats.total_skus.toLocaleString() },
    {
      label: "Inventory Value",
      value: `\u00A3${stats.total_value.toLocaleString()}`,
    },
    {
      label: "Low Stock",
      value: stats.low_stock_count,
      sub: "Needs attention",
    },
    {
      label: "Out of Stock",
      value: stats.out_of_stock_count,
      sub: "Reorder now",
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-4">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardHeader>
            <p className="text-sm text-muted-foreground">{c.label}</p>
            <CardTitle className="text-2xl tabular-nums">{c.value}</CardTitle>
            {c.sub && <p className="text-xs text-muted-foreground">{c.sub}</p>}
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}
