"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle, Send } from "@repo/ui/icons";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/components/ui/accordion";

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

function PinterestIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2C6.5 2 2 6.5 2 12c0 4.2 2.6 7.9 6.3 9.4-.1-.8-.2-2.1 0-3 .2-.9 1.4-5.7 1.4-5.7s-.4-.7-.4-1.8c0-1.7 1-3 2.2-3 .9 0 1.5.7 1.5 1.6 0 1-.6 2.4-1 3.8-.3 1.1.6 2 1.5 2 1.8 0 3.2-1.9 3.2-4.7 0-2.5-1.8-4.2-4.3-4.2-3 0-4.7 2.2-4.7 4.5 0 .9.3 1.8.8 2.4.1.1.1.2.1.4-.1.4-.3 1.2-.3 1.4-.1.2-.2.3-.4.2-1.5-.7-2.4-2.9-2.4-4.6 0-3.8 2.8-7.2 7.9-7.2 4.1 0 7.4 2.9 7.4 6.9 0 4.1-2.6 7.4-6.2 7.4-1.2 0-2.4-.6-2.8-1.4l-.8 3c-.3 1.1-1.1 2.5-1.6 3.4 1.2.4 2.5.6 3.8.6 5.5 0 10-4.5 10-10S17.5 2 12 2z" />
    </svg>
  );
}

function YoutubeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.94 2C5.12 20 12 20 12 20s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z" />
      <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" />
    </svg>
  );
}

interface FooterLink {
  label: string;
  href: string;
}

const customerServiceLinks: FooterLink[] = [
  { label: "Order Tracking", href: "/order-tracking" },
  { label: "Return your order", href: "/returns" },
  { label: "Contact Us", href: "/contact" },
  { label: "One-to-one appointment", href: "/appointments" },
  { label: "Delivery", href: "/delivery" },
  { label: "Returns Policy", href: "/returns-policy" },
  { label: "FAQ", href: "/faq" },
  { label: "Product Care", href: "/product-care" },
  { label: "Authenticity", href: "/authenticity" },
];

const aboutUsLinks: FooterLink[] = [
  { label: "Find a store", href: "/stores" },
  { label: "Our Story", href: "/our-story" },
  { label: "Newsletter Stories", href: "/stories" },
  { label: "Friends of Amao&Agou", href: "/friends-of-amaoagou" },
  { label: "Craftsmanship", href: "/craftsmanship" },
  { label: "Sustainability", href: "/sustainability" },
  { label: "Giving Back", href: "/giving-back" },
  { label: "Reviews", href: "/reviews" },
  { label: "Careers", href: "/careers" },
];

const myAccountLinks: FooterLink[] = [
  { label: "Login", href: "/account/login" },
  { label: "Register", href: "/account/register" },
  { label: "Amao&Agou Insider", href: "/insider" },
  { label: "Refer A Friend", href: "/refer-a-friend" },
];

const legalLinks: FooterLink[] = [
  { label: "Terms of service", href: "/terms" },
  { label: "Privacy policy", href: "/privacy" },
  { label: "Cookies", href: "/cookies" },
  { label: "Modern slavery statement", href: "/modern-slavery" },
];

export function StoreFooter() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "subscribed">("idle");

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setStatus("loading");
    setTimeout(() => {
      setStatus("subscribed");
      setEmail("");
    }, 800);
  };

  return (
    <footer className="w-full bg-[#fcfbfa] text-[#1c1917] border-t border-stone-200 text-sm font-sans">
      <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-start border-b border-stone-200 pb-12">
          {/* Newsletter */}
          <div className="lg:col-span-5 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-stone-900">
              Newsletter
            </h3>
            <p className="text-stone-600 leading-relaxed text-balance">
              Subscribe to our newsletter &amp; enjoy an exclusive 10% off your first full-price order.
            </p>

            <form onSubmit={handleSubscribe} className="space-y-3 pt-2">
              <div className="flex max-w-md gap-x-2">
                <Input
                  type="email"
                  required
                  placeholder="Enter your email here*"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-none border-stone-300 bg-white placeholder:text-stone-400 focus-visible:ring-stone-900"
                />
                <Button
                  type="submit"
                  disabled={status === "loading"}
                  className="rounded-none bg-stone-900 px-6 uppercase tracking-wider text-xs font-medium hover:bg-stone-800 transition-colors shrink-0"
                >
                  {status === "loading" ? (
                    "Subscribing..."
                  ) : status === "subscribed" ? (
                    <span className="flex items-center gap-1">
                      <CheckCircle className="h-4 w-4" /> Joined
                    </span>
                  ) : (
                    "Subscribe"
                  )}
                </Button>
              </div>
              {status === "subscribed" && (
                <p className="text-xs text-emerald-700 font-medium">
                  Thank you for subscribing! Check your inbox for your 10% discount code.
                </p>
              )}
            </form>

            {/* Social */}
            <div className="pt-4 flex items-center space-x-4 text-stone-700">
              <Link href="https://instagram.com" target="_blank" aria-label="Instagram" className="hover:text-black transition-colors">
                <InstagramIcon className="h-5 w-5" />
              </Link>
              <Link href="https://facebook.com" target="_blank" aria-label="Facebook" className="hover:text-black transition-colors">
                <FacebookIcon className="h-5 w-5" />
              </Link>
              <Link href="https://pinterest.com" target="_blank" aria-label="Pinterest" className="hover:text-black transition-colors">
                <PinterestIcon className="h-5 w-5" />
              </Link>
              <Link href="https://youtube.com" target="_blank" aria-label="YouTube" className="hover:text-black transition-colors">
                <YoutubeIcon className="h-5 w-5" />
              </Link>
            </div>
          </div>

          {/* Desktop nav columns */}
          <div className="hidden lg:grid lg:col-span-7 grid-cols-3 gap-8">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-stone-900 mb-4">Customer Services</h3>
              <ul className="space-y-2.5">
                {customerServiceLinks.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-stone-600 hover:text-stone-900 transition-colors text-xs tracking-wide">{link.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-stone-900 mb-4">About Us</h3>
              <ul className="space-y-2.5">
                {aboutUsLinks.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-stone-600 hover:text-stone-900 transition-colors text-xs tracking-wide">{link.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-stone-900 mb-4">My Account</h3>
              <ul className="space-y-2.5">
                {myAccountLinks.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-stone-600 hover:text-stone-900 transition-colors text-xs tracking-wide">{link.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Mobile accordion */}
          <div className="lg:hidden w-full col-span-1">
            <Accordion className="w-full">
              <AccordionItem className="border-stone-200">
                <AccordionTrigger className="text-xs font-semibold uppercase tracking-widest text-stone-900 hover:no-underline py-4">
                  Customer Services
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="space-y-2.5 pb-2">
                    {customerServiceLinks.map((link) => (
                      <li key={link.label}>
                        <Link href={link.href} className="text-stone-600 hover:text-stone-900 transition-colors text-xs">{link.label}</Link>
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem className="border-stone-200">
                <AccordionTrigger className="text-xs font-semibold uppercase tracking-widest text-stone-900 hover:no-underline py-4">
                  About Us
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="space-y-2.5 pb-2">
                    {aboutUsLinks.map((link) => (
                      <li key={link.label}>
                        <Link href={link.href} className="text-stone-600 hover:text-stone-900 transition-colors text-xs">{link.label}</Link>
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem className="border-stone-200">
                <AccordionTrigger className="text-xs font-semibold uppercase tracking-widest text-stone-900 hover:no-underline py-4">
                  My Account
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="space-y-2.5 pb-2">
                    {myAccountLinks.map((link) => (
                      <li key={link.label}>
                        <Link href={link.href} className="text-stone-600 hover:text-stone-900 transition-colors text-xs">{link.label}</Link>
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>

        {/* Brand bar */}
        <div className="flex flex-col items-center justify-center py-10 space-y-4">
          <span className="font-serif tracking-[0.3em] text-2xl font-light uppercase text-stone-900">
            Maison
          </span>
          <span className="text-[10px] tracking-widest text-stone-500 uppercase">
            EDINBURGH
          </span>
        </div>

        {/* Copyright & legal */}
        <div className="flex flex-col items-center justify-between gap-4 border-t border-stone-200 pt-8 sm:flex-row text-xs text-stone-500">
          <p>&copy; {new Date().getFullYear()} Maison &middot; All Rights Reserved</p>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            {legalLinks.map((link) => (
              <Link key={link.label} href={link.href} className="hover:text-stone-900 transition-colors">
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
