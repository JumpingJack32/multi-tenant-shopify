"use client";

import { use } from "react";

import { OrderDetailContent } from "./order-detail-content";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function OrderDetailPage({ params }: PageProps) {
  const { id } = use(params);
  return <OrderDetailContent id={id} />;
}
