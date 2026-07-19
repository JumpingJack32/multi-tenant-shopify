import dynamic from "next/dynamic";

const CheckoutFormClient = dynamic(
  () => import("@/components/storefront/checkout-form"),
  { ssr: false },
);

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant } = await params;
  return <CheckoutFormClient tenantSlug={tenant} />;
}
