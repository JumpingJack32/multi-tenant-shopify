import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import "@repo/ui/globals.css";

import { AdminCommandMenu } from "@/components/admin-command-menu";
import { ClerkLoadErrorBanner } from "@/components/auth/clerk-load-error";
import { ClerkProviderPinned } from "@/components/auth/clerk-provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Admin Dashboard",
  description: "Multi-tenant Shopify admin control panel",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProviderPinned>
      <html lang="en" suppressHydrationWarning>
        <body className={inter.className}>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem={false}
          >
            {children}
            <Toaster richColors closeButton />
            <AdminCommandMenu />
            <ClerkLoadErrorBanner />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProviderPinned>
  );
}
