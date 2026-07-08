import { CustomerProfile } from "@/components/customers/customer-profile";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="p-6">
      <CustomerProfile customerId={id} />
    </div>
  );
}
