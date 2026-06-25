import { DataTable } from "@/components/ui/data-table";
import { type Product } from "@repo/tenant-orm/types";
import { ProductNameCell } from "./product-name-cell";
import { StatusBadge } from "./status-badge";
import { RelativeTimeCell } from "./relative-time-cell";

interface ProductTableProps {
  products: Product[];
  loading: boolean;
  total: number;
  page: number;
  pageSize: number;
  search: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onSearchChange: (search: string) => void;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
}

export function ProductTable({
  products,
  loading,
  total,
  page,
  pageSize,
  search,
  onPageChange,
  onPageSizeChange,
  onSearchChange,
  onEdit,
  onDelete,
}: ProductTableProps) {
  const columns = [
    {
      header: "Product",
      accessor: (product: Product) => <ProductNameCell product={product} />,
    },
    {
      header: "Status",
      accessor: (product: Product) => <StatusBadge status={product.status} />,
    },
    {
      header: "Weight",
      accessor: (product: Product) => product.weight ? `${product.weight} ${product.weight_unit}` : "—",
    },
    {
      header: "Updated",
      accessor: (product: Product) => <RelativeTimeCell date={product.updated_at} />,
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={products}
      loading={loading}
      search={search}
      onSearchChange={onSearchChange}
      pagination={{ page, pageSize, total }}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
      actions={(product: Product) => [
        {
          label: "Edit",
          onClick: () => onEdit(product),
        },
        {
          label: "Delete",
          onClick: () => onDelete(product),
          variant: "destructive",
        },
      ]}
    />
  );
}
