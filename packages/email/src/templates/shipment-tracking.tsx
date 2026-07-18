import { Text, Button } from "@react-email/components";
import { Layout } from "../components/layout";

interface ShipmentTrackingProps {
  customerName: string;
  orderNumber: string;
  carrier: string;
  trackingNumber: string;
  trackingUrl: string;
  storeUrl: string;
}

export default function ShipmentTracking({
  customerName,
  orderNumber,
  carrier,
  trackingNumber,
  trackingUrl,
  storeUrl,
}: ShipmentTrackingProps) {
  return (
    <Layout>
      <Text style={{ fontSize: 18, fontWeight: 600 }}>
        Your Order Has Shipped
      </Text>
      <Text>Hi {customerName},</Text>
      <Text>
        Your order <strong>{orderNumber}</strong> is on its way!
      </Text>

      <table
        style={{ width: "100%", borderCollapse: "collapse", marginTop: 16 }}
      >
        <tr>
          <td
            style={{
              padding: 8,
              borderBottom: "1px solid #eee",
              color: "#666",
            }}
          >
            Carrier
          </td>
          <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
            <strong>{carrier}</strong>
          </td>
        </tr>
        <tr>
          <td
            style={{
              padding: 8,
              borderBottom: "1px solid #eee",
              color: "#666",
            }}
          >
            Tracking
          </td>
          <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
            <strong>{trackingNumber}</strong>
          </td>
        </tr>
      </table>

      <Button
        href={trackingUrl}
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
        Track Package
      </Button>

      <Button
        href={`${storeUrl}/orders/${orderNumber}`}
        style={{
          background: "#fff",
          color: "#000",
          padding: "12px 24px",
          borderRadius: 4,
          textDecoration: "none",
          display: "inline-block",
          marginTop: 8,
          border: "1px solid #000",
        }}
      >
        View Order
      </Button>
    </Layout>
  );
}
