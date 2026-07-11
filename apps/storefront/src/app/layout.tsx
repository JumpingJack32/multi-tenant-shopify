import { ClerkProvider } from "@clerk/nextjs";
import { cn } from "@repo/shared-utils/cn";
import "@repo/ui/globals.css";
import type { Metadata } from "next";
import type { NextFontWithVariable } from "next/dist/compiled/@next/font";
import {
  Geist_Mono,
  Instrument_Serif,
  Noto_Sans,
  Playfair_Display,
  Plus_Jakarta_Sans,
} from "next/font/google";
import type { ReactNode } from "react";

import { Providers } from "@/components/providers";

const InstrumentTitleHeading: NextFontWithVariable = Instrument_Serif({
  weight: ["400"],
  subsets: ["latin"],
  variable: "--font-title-heading",
});

const playfairDisplayHeading: NextFontWithVariable = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-heading",
});

const notoSans: NextFontWithVariable = Noto_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

const plusJakartaSans: NextFontWithVariable = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-text",
});

const fontMono: NextFontWithVariable = Geist_Mono({
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
      <html lang="en" suppressHydrationWarning>
        <body
          className={cn(
            "antialiased font-sans",
            InstrumentTitleHeading.variable,
            playfairDisplayHeading.variable,
            notoSans.variable,
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
