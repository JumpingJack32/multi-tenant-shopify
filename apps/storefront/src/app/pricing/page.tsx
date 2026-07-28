import { PricingMatrix, type Plan } from "@/components/marketing/pricing-matrix";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function fetchPlans(): Promise<Plan[]> {
  try {
    const res = await fetch(`${API_URL}/api/v1/public/plans`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function PricingPage() {
  const plans = await fetchPlans();

  return (
    <div className="mx-auto max-w-7xl px-4 py-24 md:px-6 md:py-32">
      <div className="mx-auto max-w-2xl text-center mb-16">
        <h1 className="text-4xl font-bold tracking-tight">Pricing</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Choose the plan that fits your business. All plans include a 14-day free trial.
        </p>
      </div>
      {plans.length > 0 ? (
        <PricingMatrix plans={plans} />
      ) : (
        <p className="text-center text-muted-foreground">Plans unavailable right now.</p>
      )}
    </div>
  );
}
