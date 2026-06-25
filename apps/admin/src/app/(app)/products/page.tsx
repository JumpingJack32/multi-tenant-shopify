"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
// import { DataTable } from "@repo/ui/base-ui";
import { DataTable } from "@/components/ui/data-table";
import { Drawer } from "@/components/ui/drawer";
import { ProductForm } from "@/components/products/product-form";
import type { Product } from "@repo/tenant-orm/types";
import { Button } from "@/components/ui/button";
import { useRbac } from "@/contexts/rbac-context";

export default function ProductsPage() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const queryClient = useQueryClient();
  const { can } = useRbac();

  const { data: products, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const result = await api.products.list();
      return result.data ?? [];
    },
  });

  const createMutation = useMutation({
    mutationFn: api.products.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setIsDrawerOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.products.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setIsDrawerOpen(false);
      setEditingProduct(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: api.products.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });

  const handleCreate = () => {
    setEditingProduct(null);
    setIsDrawerOpen(true);
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setIsDrawerOpen(true);
  };

  const handleDelete = (product: Product) => {
    if (confirm(`Are you sure you want to delete "${product.name}"?`)) {
      deleteMutation.mutate(product.id);
    }
  };

  const handleSubmit = (data: any) => {
    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const columns = [
    {
      header: "Name",
      accessor: "name" as keyof Product,
      cell: (value: unknown) => <span className="font-medium">{String(value ?? "")}</span>,
    },
    {
      header: "Status",
      accessor: "status" as keyof Product,
      cell: (value: unknown) => (
        <span
          className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${value === "published"
              ? "bg-green-100 text-green-800"
              : value === "draft"
                ? "bg-gray-100 text-gray-800"
                : "bg-yellow-100 text-yellow-800"
            }`}
        >
          {String(value ?? "draft")}
        </span>
      ),
    },
    {
      header: "Unit Price",
      accessor: "unit_price" as keyof Product,
      cell: (value: unknown) => {
        const num = typeof value === "number" ? value : parseFloat(String(value ?? 0));
        return <span>${num.toFixed(2)}</span>;
      },
    },
  ];

  const rowActions = (product: Product) => (
    <div className="flex items-center justify-end gap-2">
      {can("update") && (
        <Button variant="ghost" size="sm" onClick={() => handleEdit(product)}>
          Edit
        </Button>
      )}
      {can("delete") && (
        <Button variant="ghost" size="sm" onClick={() => handleDelete(product)}>
          Delete
        </Button>
      )}
    </div>
  );

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-muted-foreground">Manage your product catalog</p>
        </div>
        {can("create") && (
          <Button onClick={handleCreate}>Add Product</Button>
        )}
      </div>

      <DataTable
        data={products ?? []}
        isLoading={isLoading}
        columns={columns}
        rowActions={rowActions}
        searchPlaceholder="Search products..."
      />

      <Drawer
        open={isDrawerOpen}
        onOpenChange={(open) => {
          setIsDrawerOpen(open);
          if (!open) setEditingProduct(null);
        }}
        title={editingProduct ? "Edit Product" : "Create Product"}
        size="md"
      >
        <ProductForm
          initialData={editingProduct ?? undefined}
          onSubmit={handleSubmit}
          onCancel={() => {
            setIsDrawerOpen(false);
            setEditingProduct(null);
          }}
        />
      </Drawer>
    </div>
  );
}
