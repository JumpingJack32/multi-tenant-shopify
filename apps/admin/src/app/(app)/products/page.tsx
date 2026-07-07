"use client";

import type { Product } from "@repo/tenant-orm/types";
import { useState } from "react";

import { ProductDeleteDialog } from "@/components/products/product-delete-dialog";
import { ProductDrawer } from "@/components/products/product-drawer";
import { ProductTable } from "@/components/products/product-table";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { useRbac } from "@/contexts/rbac-context";
import {
  useProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
} from "@/features/products/hooks/use-products";

export default function ProductsPage() {
  const { can } = useRbac();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  const {
    data: productsData,
    isLoading,
    isError,
    error,
  } = useProducts({
    search,
    page: String(page),
    limit: String(pageSize),
  });

  const products = productsData?.data ?? [];
  const total = productsData?.total ?? 0;

  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();
  const deleteMutation = useDeleteProduct();

  const handleCreate = () => {
    setEditingProduct(null);
    setDrawerOpen(true);
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setDrawerOpen(true);
  };

  const handleDelete = (product: Product) => {
    setDeletingProduct(product);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (deletingProduct) {
      deleteMutation.mutate(deletingProduct.id, {
        onSuccess: () => {
          setDeleteDialogOpen(false);
          setDeletingProduct(null);
        },
      });
    }
  };

  const handleSubmit = (data: Record<string, unknown>) => {
    if (editingProduct) {
      updateMutation.mutate(
        { id: editingProduct.id, data },
        {
          onSuccess: () => {
            setDrawerOpen(false);
            setEditingProduct(null);
          },
        },
      );
    } else {
      createMutation.mutate(data as any, {
        onSuccess: () => {
          setDrawerOpen(false);
        },
      });
    }
  };

  const canUpdate = can("update");
  const canDelete = can("delete");

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-muted-foreground">Manage your product catalog</p>
        </div>
        {canUpdate && <Button onClick={handleCreate}>Add Product</Button>}
      </div>

      {isError && (
        <div className="mb-4">
          <ErrorBanner
            message={
              error instanceof Error ? error.message : "Failed to load products"
            }
          />
        </div>
      )}

      <ProductTable
        products={products}
        loading={isLoading}
        total={total}
        page={page}
        pageSize={pageSize}
        search={search}
        onPageChange={setPage}
        onPageSizeChange={() => {}}
        onSearchChange={setSearch}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <ProductDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        product={editingProduct}
        onSubmit={handleSubmit}
      />

      <ProductDeleteDialog
        product={deletingProduct}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        confirmLoading={deleteMutation.isPending}
      />
    </div>
  );
}
