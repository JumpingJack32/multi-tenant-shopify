import { Text, Button } from "@react-email/components";
import { Layout } from "../components/layout";

interface OrderConfirmProps {
  customerName: string;
  orderNumber: string;
  itemsTable: string;
  total: string;
  storeUrl: string;
}

export default function OrderConfirm({
  customerName,
  orderNumber,
  itemsTable,
  total,
  storeUrl,
}: OrderConfirmProps) {
  return (
    <Layout>
      <Text className="text-lg font-semibold mb-4 mt-4">Order Confirmed</Text>
      <Text className="text-sm mb-4 mt-4">Hi {customerName},</Text>
      <Text className="text-sm mb-4 mt-4">
        Your order <strong>{orderNumber}</strong> has been confirmed and is
        being processed.
      </Text>

      <table
        dangerouslySetInnerHTML={{ __html: itemsTable }}
        className="w-full border-collapse"
      />

      <Text className="text-base font-semibold mt-4 mb-4">Total: {total}</Text>

      <Button
        href={`${storeUrl}/orders/${orderNumber}`}
        className="bg-black text-white px-6 py-3 rounded no-underline inline-block mt-4"
      >
        View Order
      </Button>
    </Layout>
  );
}
