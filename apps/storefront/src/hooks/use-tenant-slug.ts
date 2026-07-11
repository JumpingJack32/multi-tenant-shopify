"use client";

import { useParams } from "next/navigation";

export function useTenantSlug(): string {
  const params = useParams();
  return params.tenant as string;
}
