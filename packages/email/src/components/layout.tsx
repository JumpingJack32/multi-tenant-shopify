import {
  Html,
  Head,
  Body,
  Container,
  Text,
  Img,
} from "@react-email/components";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <Html>
      <Head />
      <Body
        style={{
          fontFamily: "-apple-system,BlinkMacSystemFont,sans-serif",
          padding: 24,
          backgroundColor: "#f9f9f9",
        }}
      >
        <Container
          style={{ backgroundColor: "#fff", padding: 24, borderRadius: 8 }}
        >
          {children}
          <Text
            style={{
              color: "#666",
              fontSize: 12,
              marginTop: 24,
              borderTop: "1px solid #eee",
              paddingTop: 12,
            }}
          >
            &copy; iGroup — multi-tenant shopify platform
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
