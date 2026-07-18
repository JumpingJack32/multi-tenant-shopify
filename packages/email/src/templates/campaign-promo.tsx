import { Text, Button } from "@react-email/components";
import { Layout } from "../components/layout";

interface CampaignPromoProps {
  customerName: string;
  segmentName: string;
  offerHtml: string;
  storeUrl: string;
}

export default function CampaignPromo({
  customerName,
  segmentName,
  offerHtml,
  storeUrl,
}: CampaignPromoProps) {
  return (
    <Layout>
      <Text className="text-lg font-semibold">Welcome to {segmentName}</Text>
      <Text className="text-sm mt-4">Hi {customerName},</Text>
      <div dangerouslySetInnerHTML={{ __html: offerHtml }} />
      <Button
        href={storeUrl}
        className="bg-black text-white px-6 py-3 rounded no-underline inline-block mt-4"
      >
        Shop Now
      </Button>
    </Layout>
  );
}
