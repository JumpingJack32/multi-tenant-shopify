import {
  Html,
  Head,
  Body,
  Container,
  Text,
  Tailwind,
} from "@react-email/components";
import "@repo/ui/globals.css";
import type { ReactNode } from "react";
import { cn } from "@repo/shared-utils/cn";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <Html>
      <Head />
      <Tailwind>
        <Body className="bg-[#f9f9f9] p-6 font-sans">
          <Container className="bg-white p-6 rounded-lg">
            {children}
            <Text className="text-[#666] text-xs mt-6 pt-3 border-t border-[#eee]">
              &copy; iGroup — multi-tenant shopify platform
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
