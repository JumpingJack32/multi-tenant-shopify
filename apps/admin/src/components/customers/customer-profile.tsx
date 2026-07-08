"use client";

import { Badge } from "@repo/ui/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table";
import { useRouter } from "next/navigation";

import { ErrorBanner } from "@/components/ui/error-banner";
import { useCustomer } from "@/features/customers/hooks/use-customers";

function formatPence(n: number): string {
  return `£${(n / 100).toFixed(2)}`;
}

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-blue-100 text-blue-800",
  processing: "bg-blue-100 text-blue-800",
  shipped: "bg-purple-100 text-purple-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

export function CustomerProfile({ customerId }: { customerId: string }) {
  const { data, isLoading, error, refetch } = useCustomer(customerId);
  const router = useRouter();

  if (error) {
    return (
      <ErrorBanner
        message="Failed to load customer"
        onRetry={() => refetch()}
      />
    );
  }

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-48 mt-2" />
            <Skeleton className="h-4 w-24 mt-2" />
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-16 w-full mt-2" />
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Left: Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {[data.first_name, data.last_name].filter(Boolean).join(" ") || "—"}
          </CardTitle>
          <div className="mt-4 space-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">Email</span>
              <p className="font-medium">{data.email}</p>
            </div>
            {data.phone && (
              <div>
                <span className="text-muted-foreground">Phone</span>
                <p className="font-medium">{data.phone}</p>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">Customer since</span>
              <p className="font-medium">
                {data.created_at
                  ? new Date(data.created_at).toLocaleDateString()
                  : "—"}
              </p>
            </div>
            {data.last_order_at && (
              <div>
                <span className="text-muted-foreground">Last order</span>
                <p className="font-medium">
                  {new Date(data.last_order_at).toLocaleDateString()}
                </p>
              </div>
            )}
            {data.addresses && data.addresses.length > 0 && (
              <div>
                <span className="text-muted-foreground">Shipping address</span>
                <p className="font-medium">
                  {data.addresses.find((a: any) => a.is_default)?.line1 ??
                    data.addresses[0].line1}
                </p>
              </div>
            )}
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4 border-t pt-4">
            <div>
              <span className="text-xs text-muted-foreground">Total Spent</span>
              <p className="text-lg font-mono font-bold">
                {formatPence(data.total_spent)}
              </p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">
                Avg Order Value
              </span>
              <p className="text-lg font-mono font-bold">
                {formatPence(data.average_order_value)}
              </p>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Right: Order Ledger */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Order History</CardTitle>
        </CardHeader>
        <div className="px-6 pb-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.orders.map((order: any) => (
                <TableRow
                  key={order.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/orders/${order.id}`)}
                >
                  <TableCell className="font-medium">
                    {order.order_number}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(order.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[order.status] ?? ""}>
                      {order.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatPence(order.total)}
                  </TableCell>
                </TableRow>
              ))}
              {data.orders.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No orders yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
