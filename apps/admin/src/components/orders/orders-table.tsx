import type { Order } from "@repo/tenant-orm/types";
import { formatCurrency } from "@repo/tenant-orm/utils";
import { Badge } from "@repo/ui/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table";

const STATUS_VARIANTS: Record<string, string> = {
  pending: "secondary",
  confirmed: "outline",
  paid: "default",
  processing: "secondary",
  shipped: "secondary",
  delivered: "default",
  cancelled: "destructive",
  refunded: "destructive",
};

interface OrdersTableProps {
  orders: Order[];
  onRowClick: (id: string) => void;
}

export function OrdersTable({ orders, onRowClick }: OrdersTableProps) {
  if (orders.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No orders found
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Order</TableHead>
          <TableHead>Customer</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Payment</TableHead>
          <TableHead>Total</TableHead>
          <TableHead>Date</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => (
          <TableRow
            key={order.id}
            className="cursor-pointer hover:bg-muted/50"
            onClick={() => onRowClick(order.id)}
          >
            <TableCell className="font-mono text-sm">
              {order.order_number}
            </TableCell>
            <TableCell>{order.customer_email ?? "—"}</TableCell>
            <TableCell>
              <Badge
                variant={
                  (STATUS_VARIANTS[order.status] as
                    | "default"
                    | "secondary"
                    | "destructive"
                    | "outline") ?? "outline"
                }
              >
                {order.status}
              </Badge>
            </TableCell>
            <TableCell>
              <Badge variant="outline">{order.payment_status}</Badge>
            </TableCell>
            <TableCell className="font-mono">
              {formatCurrency(order.total, order.currency)}
            </TableCell>
            <TableCell className="text-muted-foreground text-sm">
              {new Date(order.created_at).toLocaleDateString()}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
