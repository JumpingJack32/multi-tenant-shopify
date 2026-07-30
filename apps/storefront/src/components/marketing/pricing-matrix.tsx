'use client';

import Link from 'next/link';
import { useState } from 'react';

export interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_cents_monthly: number;
  price_cents_yearly: number;
  trial_days: number;
  features: string[];
}

interface PricingMatrixProps {
  plans: Plan[];
}

export function PricingMatrix({ plans }: PricingMatrixProps) {
  const [annual, setAnnual] = useState(false);

  return (
    <div>
      {/* Toggle */}
      <div className="mb-12 flex items-center justify-center gap-3">
        <span
          className={`text-sm ${!annual ? 'text-foreground font-medium' : 'text-muted-foreground'}`}
        >
          Monthly
        </span>
        <button
          onClick={() => setAnnual(!annual)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${annual ? 'bg-primary' : 'bg-muted-foreground/30'
            }`}
          aria-label="Toggle annual billing"
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${annual ? 'translate-x-5.5' : 'translate-x-0.5'
              }`}
          />
        </button>
        <span
          className={`text-sm ${annual ? 'text-foreground font-medium' : 'text-muted-foreground'}`}
        >
          Annual
        </span>
        {annual && (
          <span className="text-xs font-medium text-green-600">Save 20%</span>
        )}
      </div>

      {/* Plan cards */}
      <div className="grid gap-8 md:grid-cols-3">
        {plans.map((plan) => {
          const price = annual
            ? plan.price_cents_yearly
            : plan.price_cents_monthly;
          const period = annual ? 'yr' : 'mo';
          const monthlyEquiv = annual
            ? Math.round(plan.price_cents_yearly / 12)
            : null;

          return (
            <div
              key={plan.slug}
              className="border-border/40 flex flex-col rounded-lg border p-8"
            >
              <h3 className="text-lg font-semibold">{plan.name}</h3>
              {plan.description && (
                <p className="text-muted-foreground mt-1 text-sm">
                  {plan.description}
                </p>
              )}
              <div className="mt-6">
                <span className="text-4xl font-bold">
                  £{(price / 100).toFixed(0)}
                </span>
                <span className="text-muted-foreground text-sm">/{period}</span>
                {monthlyEquiv && (
                  <p className="text-muted-foreground mt-1 text-xs">
                    £{(monthlyEquiv / 100).toFixed(0)}/mo billed yearly
                  </p>
                )}
              </div>
              <ul className="mt-8 flex-1 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <span className="mt-0.5 text-green-600">&#10003;</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={`/signup?plan=${plan.slug}`}
                className="bg-primary text-primary-foreground mt-8 inline-flex h-10 w-full items-center justify-center rounded-md text-sm font-medium transition-opacity hover:opacity-90"
              >
                {plan.slug === 'enterprise'
                  ? 'Contact Sales'
                  : `Start ${plan.name}`}
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
