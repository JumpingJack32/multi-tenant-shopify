"use client";

import type { Order } from "@repo/tenant-orm/types";
import { useState } from "react";

import { OrdersTable } from "@/components/orders/orders-table";

const PLACEHOLDER_ORDERS: Order[] = [];

export default function OrdersPage() {
  const [loading] = useState(false);
  const [orders] = useState<Order[]>(PLACEHOLDER_ORDERS);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Orders</h1>
        <p className="text-muted-foreground">View and manage orders</p>
      </div>
      <OrdersTable orders={orders} loading={loading} />
    </div>
  );
}
