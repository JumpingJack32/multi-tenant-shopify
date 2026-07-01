import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { Providers } from "@/components/providers";
import "@repo/ui/globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Storefront",
  description: "Multi-tenant Shopify storefront",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={inter.className}>
          <Providers>{children}</Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
