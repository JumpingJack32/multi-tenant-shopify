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
      <Text style={{ fontSize: 18, fontWeight: 600 }}>Order Confirmed</Text>
      <Text>Hi {customerName},</Text>
      <Text>
        Your order <strong>{orderNumber}</strong> has been confirmed and is
        being processed.
      </Text>

      <table
        dangerouslySetInnerHTML={{ __html: itemsTable }}
        style={{ width: "100%", borderCollapse: "collapse" }}
      />

      <Text style={{ fontSize: 16, fontWeight: 600, marginTop: 16 }}>
        Total: {total}
      </Text>

      <Button
        href={`${storeUrl}/orders/${orderNumber}`}
        style={{
          background: "#000",
          color: "#fff",
          padding: "12px 24px",
          borderRadius: 4,
          textDecoration: "none",
          display: "inline-block",
          marginTop: 16,
        }}
      >
        View Order
      </Button>
    </Layout>
  );
}
