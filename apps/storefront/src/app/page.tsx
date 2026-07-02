"use client";
import { Button } from "@repo/ui/base-ui";
import { Card, CardContent } from "@repo/ui/components/card";
import Link from "next/link";
import * as React from "react";

export default function CatsAndDogsLanding() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground antialiased selection:bg-primary/10">
      {/* Navigation */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
          <Link
            href="/"
            className="flex items-center gap-2 font-bold tracking-tight text-xl transition-opacity hover:opacity-90"
          >
            Amoa & Agou
          </Link>

          <nav className="hidden gap-6 md:flex">
            <Link
              href="/shop/cats"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Shop Cats
            </Link>
            <Link
              href="/shop/dogs"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Shop Dogs
            </Link>
            <Link
              href="/about"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              About Us
            </Link>
          </nav>

          <div className="flex items-center gap-4">
            {/* Outline style via Tailwind border classes */}
            <Button className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground">
              Log In
            </Button>
            {/* Primary filled style via Tailwind background classes */}
            <Button className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
              Cart (0)
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="w-full bg-muted/40 py-12 md:py-24 lg:py-32">
          <div className="container mx-auto px-4 md:px-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <h1 className="max-w-3xl text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl lg:text-6xl text-balance">
                Everything for Cool Cats and Top Dogs - not your furry friends.
              </h1>
              <p className="max-w-[700px] text-muted-foreground md:text-xl text-pretty">
                Premium Trail Running Gear, Clothing & Footwear tailored
                specifically for the Cools Cats and Top Dogs you love.
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <Button
                  nativeButton={false}
                  render={<Link href="/shop" />}
                  className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Shop Now
                </Button>
                <Button
                  nativeButton={false}
                  className="inline-flex h-11 items-center justify-center rounded-md border border-input bg-background px-8 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                  render={<Link href="/collections/new" />}
                >
                  View New Arrivals
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Categories Section */}
        <section className="w-full py-12 md:py-24 lg:py-32">
          <div className="container mx-auto px-4 md:px-6">
            <h2 className="mb-10 text-center text-2xl font-bold tracking-tight sm:text-3xl text-balance">
              Not A Pet Shop
            </h2>
            <div className="grid gap-6 md:grid-cols-2 max-w-5xl mx-auto">
              {/* Cat Category Card */}
              <Card className="group overflow-hidden transition-all duration-200 hover:border-primary hover:shadow-sm">
                <CardContent className="p-0">
                  <div className="relative aspect-[16/10] bg-muted flex items-center justify-center text-muted-foreground bg-slate-100">
                    {/* <Image src="https://www.craiyon.com/en/image/pmtwGeBPS0q4nz27RlL-XA" alt="Cat Supplies" width={250} height={400} className="object-cover w-full h-full" /> */}
                  </div>
                  <div className="p-6">
                    <h3 className="text-2xl font-bold tracking-tight mb-2">
                      Amoa
                    </h3>
                    <p className="text-muted-foreground mb-6">
                      Hand-made bags and shoes for Cool cats and more.
                    </p>
                    <Button
                      nativeButton={false}
                      className="inline-flex h-10 w-full items-center justify-center rounded-md bg-muted px-4 text-sm font-medium text-muted-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground"
                      render={<Link href="/shop/cats" />}
                    >
                      Explore Cat Supplies
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Dog Category Card */}
              <Card className="group overflow-hidden transition-all duration-200 hover:border-primary hover:shadow-sm">
                <CardContent className="p-0">
                  <div className="relative aspect-[16/10] bg-muted flex items-center justify-center text-muted-foreground bg-slate-100">
                    [Dog Image Placeholder]
                  </div>
                  <div className="p-6">
                    <h3 className="text-2xl font-bold tracking-tight mb-2">
                      Agou
                    </h3>
                    <p className="text-muted-foreground mb-6">
                      Top dogs toys and harnesses.
                    </p>
                    <Button
                      nativeButton={false}
                      className="inline-flex h-10 w-full items-center justify-center rounded-md bg-muted px-4 text-sm font-medium text-muted-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground"
                      render={<Link href="/shop/dogs" />}
                    >
                      Explore Dog Supplies
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Newsletter CTA Section */}
        <section className="w-full border-t border-border/40 bg-muted/40 py-12 md:py-24 lg:py-32">
          <div className="container mx-auto px-4 md:px-6">
            <div className="flex flex-col items-center justify-center gap-4 text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-balance">
                Join our Club
              </h2>
              <p className="max-w-[600px] text-muted-foreground md:text-xl text-pretty">
                Sign up for our newsletter and get 10% off your first order.
              </p>

              <form
                className="mt-4 flex w-full max-w-md items-stretch gap-2"
                onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
                  e.preventDefault();
                }}
              >
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  required
                />
                <Button
                  type="submit"
                  className="inline-flex h-10 shrink-0 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Subscribe
                </Button>
              </form>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-border/40 bg-background py-6">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 md:flex-row md:px-6">
          <p className="text-sm text-muted-foreground">
            © 2026 Cats & Dogs. All rights reserved.
          </p>
          <nav className="flex gap-4">
            <Link
              href="/terms"
              className="text-sm text-muted-foreground hover:underline underline-offset-4"
            >
              Terms
            </Link>
            <Link
              href="/privacy"
              className="text-sm text-muted-foreground hover:underline underline-offset-4"
            >
              Privacy
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
