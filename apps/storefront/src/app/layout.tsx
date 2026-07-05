import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import {
  Geist_Mono,
  Noto_Sans,
  Playfair_Display,
  Plus_Jakarta_Sans,
} from "next/font/google";
import type { ReactNode } from "react";

import { Providers } from "@/components/providers";
import "@repo/ui/globals.css";
import { cn } from "@/lib/utils";

const playfairDisplayHeading = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-heading",
});

const notoSans = Noto_Sans({ subsets: ["latin"], variable: "--font-sans" });

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-text",
});

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Storefront",
  description: "Multi-tenant Shopify storefront",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body
          className={cn(
            "antialiased font-sans",
            notoSans.variable,
            playfairDisplayHeading.variable,
            plusJakartaSans.variable,
            fontMono.variable,
          )}
        >
          <Providers>{children}</Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
