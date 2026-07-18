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
      <Text style={{ fontSize: 18, fontWeight: 600 }}>
        Welcome to {segmentName}
      </Text>
      <Text>Hi {customerName},</Text>
      <div dangerouslySetInnerHTML={{ __html: offerHtml }} />
      <Button
        href={storeUrl}
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
        Shop Now
      </Button>
    </Layout>
  );
}
