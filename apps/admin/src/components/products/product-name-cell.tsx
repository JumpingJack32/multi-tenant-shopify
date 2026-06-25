import { type Product } from "@repo/tenant-orm/types";

interface ProductNameCellProps {
  product: Product;
}

export function ProductNameCell({ product }: ProductNameCellProps) {
  return (
    <div>
      <div className="font-medium">{product.name}</div>
      <div className="text-sm text-gray-500">{product.slug}</div>
    </div>
  );
}
