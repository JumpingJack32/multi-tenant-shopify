"use client";

import { useState } from "react";
import type { Product } from "@repo/tenant-orm/types";
import { ArrowLeftIcon, PackageIcon, PlusIcon } from "@repo/ui/icons";

import { ProductDeleteDialog } from "@/components/products/product-delete-dialog";
import { ProductDrawer } from "@/components/products/product-drawer";
import { ProductTable } from "@/components/products/product-table";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { useRbac } from "@/contexts/rbac-context";
import { useTenantContext } from "@/contexts/tenant-context";
import {
  useProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
} from "@/features/products/hooks/use-products";

import AddProductForm from "./components/add-product-form";

type View = "overview" | "add" | "find";

const NAV_ITEMS: { id: View; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "add", label: "Add Product" },
];

export default function ProductsPage() {
  const { can } = useRbac();
  const { currentTenantId, isLoading: tenantLoading } = useTenantContext();
  const [view, setView] = useState<View>("overview");
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
        onSuccess: () => setView("overview"),
      });
    }
  };

  const canUpdate = can("update");
  const canDelete = can("delete");

  return (
    <div className="flex min-h-full">
      {/* Sub-nav sidebar */}
      <aside className="w-56 shrink-0 border-r bg-card p-4">
        <h2 className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Products Menu
        </h2>
        <nav className="mt-3 space-y-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`w-full rounded-md px-3 py-2 text-left text-sm font-medium transition-colors ${
                view === item.id
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main panel */}
      <main className="flex-1 overflow-y-auto p-6">
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
                  <Button variant="outline" onClick={() => setView("find")}>
                    Find Products to Sell
                  </Button>
                  <Button onClick={() => setView("add")}>
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
                    <Button onClick={() => setView("add")}>Add Product</Button>
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
              </>
            )}
          </div>
        )}

        {view === "add" && (
          <div className="mx-auto max-w-4xl">
            <div className="mb-6 flex items-center gap-3">
              <button
                onClick={() => setView("overview")}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeftIcon className="h-4 w-4" /> Products
              </button>
            </div>
            <AddProductForm
              onSubmit={handleSubmit}
              onCancel={() => setView("overview")}
            />
          </div>
        )}

        {view === "find" && (
          <div className="mx-auto max-w-lg pt-16 text-center">
            <h2 className="text-lg font-semibold">Find Products</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Supplier sourcing integrations coming soon.
            </p>
            <button
              onClick={() => setView("overview")}
              className="mt-6 text-sm font-semibold text-primary hover:underline"
            >
              Back to Overview
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
