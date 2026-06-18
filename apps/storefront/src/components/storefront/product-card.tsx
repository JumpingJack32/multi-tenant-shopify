import { cn } from "@repo/shared-utils/cn";

interface ProductCardProps {
  name: string;
  price: number;
  description?: string | null;
}

export function ProductCard({ name, price, description }: ProductCardProps) {
  return (
    <div className={cn("border rounded-lg p-4 space-y-2")}>
      <h3 className="font-semibold">{name}</h3>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      <p className="font-bold">${(price / 100).toFixed(2)}</p>
    </div>
  );
}
