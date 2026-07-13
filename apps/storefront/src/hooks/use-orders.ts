"use client";

import type { OrderResponse } from "@repo/codegen/client/types.gen";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useMemo } from "react";

import { fetchOrder } from "@/lib/storefront-api";

export function useOrder(orderId: string) {
  const params = useParams();
  const tenantSlug = (params?.tenant ?? "") as string;

  const queryKey = useMemo(
    () => ["order", tenantSlug, orderId],
    [tenantSlug, orderId],
  );

  return useQuery<OrderResponse | null>({
    queryKey,
    queryFn: () => fetchOrder(tenantSlug, orderId),
    enabled: !!tenantSlug && !!orderId,
  });
}
