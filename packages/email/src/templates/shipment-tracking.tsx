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
      <Text className="text-lg font-semibold">Your Order Has Shipped</Text>
      <Text className="text-sm mt-4">Hi {customerName},</Text>
      <Text className="text-sm mt-4">
        Your order <strong>{orderNumber}</strong> is on its way!
      </Text>

      <table className="w-full border-collapse mt-4">
        <tr>
          <td className="p-2 border-b border-[#eee] text-[#666]">Carrier</td>
          <td className="p-2 border-b border-[#eee] font-semibold">
            {carrier}
          </td>
        </tr>
        <tr>
          <td className="p-2 border-b border-[#eee] text-[#666]">Tracking</td>
          <td className="p-2 border-b border-[#eee] font-semibold">
            {trackingNumber}
          </td>
        </tr>
      </table>

      <Button
        href={trackingUrl}
        className="bg-black text-white px-6 py-3 rounded no-underline inline-block mt-4"
      >
        Track Package
      </Button>

      <Button
        href={`${storeUrl}/orders/${orderNumber}`}
        className="bg-white text-black px-6 py-3 rounded no-underline inline-block mt-2 border border-black"
      >
        View Order
      </Button>
    </Layout>
  );
}
