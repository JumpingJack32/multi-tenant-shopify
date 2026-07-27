"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import type { Product } from "@repo/tenant-orm/types";
import { ArrowLeftIcon, PackageIcon, PlusIcon } from "@repo/ui/icons";

import { ProductDeleteDialog } from "@/components/products/product-delete-dialog";
import { ProductTable } from "@/components/products/product-table";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { useRbac } from "@/contexts/rbac-context";
import { useTenantContext } from "@/contexts/tenant-context";
import {
  useProducts,
  useProduct,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
} from "@/features/products/hooks/use-products";

import AddProductForm from "./components/add-product-form";

function ProductsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = searchParams.get("view") || "overview";
  const editId = searchParams.get("id");

  const { can } = useRbac();
  const { currentTenantId, isLoading: tenantLoading } = useTenantContext();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  const { data: editProduct, isLoading: editLoading } = useProduct(
    editId,
    currentTenantId,
  );

  const {
    data: productsData,
    isLoading,
    isError,
    error,
  } = useProducts(
    { search, page: String(page), limit: String(pageSize) },
    currentTenantId,
  );

  const products = productsData?.data ?? [];
  const total = productsData?.total ?? 0;

  const createMutation = useCreateProduct(currentTenantId);
  const updateMutation = useUpdateProduct(currentTenantId);
  const deleteMutation = useDeleteProduct(currentTenantId);

  const handleEdit = (product: Product) => {
    router.push(`/products?view=edit&id=${product.id}`);
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
    if (editId) {
      updateMutation.mutate(
        { id: editId, data: data as any },
        {
          onSuccess: () => router.push("/products"),
        },
      );
    } else {
      createMutation.mutate(data as any, {
        onSuccess: () => router.push("/products"),
      });
    }
  };

  const canUpdate = can("update");
  const canDelete = can("delete");

  return (
    <div
      className="flex-1 overflow-y-auto p-6"
      style={{ backgroundImage: "url('/drew-beamer.jpg')" }}
    >
      {view === "overview" && (
        <div>
          {products.length === 0 ? (
            <div className="mx-auto max-w-lg pt-16 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <PackageIcon className="h-6 w-6" />
              </div>
              <h2 className="text-lg font-semibold">
                Start listing your products
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Create your own custom inventory or source products from
                suppliers to build your storefront.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Button
                  variant="outline"
                  onClick={() => router.push("/products?view=find")}
                >
                  Find Products to Sell
                </Button>
                <Button onClick={() => router.push("/products?view=add")}>
                  <PlusIcon className="mr-2 h-4 w-4" /> Add Product
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold">Products</h1>
                  <p className="text-muted-foreground">
                    Manage your product catalog
                  </p>
                </div>
                {canUpdate && (
                  <Button onClick={() => router.push("/products?view=add")}>
                    Add Product
                  </Button>
                )}
              </div>

              {isError && (
                <div className="mb-4">
                  <ErrorBanner
                    message={
                      error instanceof Error
                        ? error.message
                        : "Failed to load products"
                    }
                  />
                </div>
              )}

              <ProductTable
                products={products}
                loading={isLoading || tenantLoading}
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

              <ProductDeleteDialog
                product={deletingProduct}
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                onConfirm={handleConfirmDelete}
                confirmLoading={deleteMutation.isPending}
              />
            </>
          )}
        </div>
      )}

      {view === "add" && (
        <div className="mx-auto max-w-4xl">
          <div className="mb-6 flex items-center gap-3">
            <button
              onClick={() => router.push("/products")}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeftIcon className="h-4 w-4" /> Products
            </button>
          </div>
          <AddProductForm
            onSubmit={handleSubmit}
            onCancel={() => router.push("/products")}
          />
        </div>
      )}

      {view === "edit" && editProduct && (
        <div className="mx-auto max-w-4xl">
          <div className="mb-6 flex items-center gap-3">
            <button
              onClick={() => router.push("/products")}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeftIcon className="h-4 w-4" /> Products
            </button>
          </div>
          <AddProductForm
            key={editProduct.id}
            editingProduct={editProduct}
            onSubmit={handleSubmit}
            onCancel={() => router.push("/products")}
          />
        </div>
      )}

      {view === "edit" && !editProduct && !editLoading && (
        <div className="mx-auto max-w-lg pt-16 text-center">
          <p className="text-muted-foreground">Product not found.</p>
          <button
            onClick={() => router.push("/products")}
            className="mt-4 text-sm font-semibold text-primary hover:underline"
          >
            Back to Products
          </button>
        </div>
      )}

      {view === "edit" && editLoading && (
        <div className="mx-auto max-w-lg pt-16 text-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      )}

      {view === "find" && (
        <div className="mx-auto max-w-lg pt-16 text-center">
          <h2 className="text-lg font-semibold">Find Products</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Supplier sourcing integrations coming soon.
          </p>
          <button
            onClick={() => router.push("/products")}
            className="mt-6 text-sm font-semibold text-primary hover:underline"
          >
            Back to Overview
          </button>
        </div>
      )}
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <ProductsContent />
    </Suspense>
  );
}
