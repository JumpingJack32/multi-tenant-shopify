import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@repo/ui/globals.css";

const inter = Inter({ subsets: ["latin"] });

const queryClient = new QueryClient();

export const metadata: Metadata = {
  title: "Admin Dashboard",
  description: "Multi-tenant Shopify admin control panel",
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
          {/* <QueryClientProvider client={queryClient}> */}
          {children}
          {/* </QueryClientProvider> */}
        </body>
      </html>
    </ClerkProvider>
  );
}
