"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";

const CheckoutFormClient = dynamic(
  () => import("@/components/storefront/checkout-form"),
  { ssr: false },
);

export default function CheckoutPage() {
  const params = useParams();
  const tenant = params.tenant as string;
  return <CheckoutFormClient tenantSlug={tenant} />;
}
