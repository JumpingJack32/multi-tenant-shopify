"use client";

import { useState } from "react";
import {
  useCollections,
  useDeleteCollection,
} from "@/features/collections/hooks/use-collections";
import { CollectionModal } from "./collection-modal";

export function CollectionsTable() {
  const { data: collections, isLoading, refetch } = useCollections(true);
  const deleteMutation = useDeleteCollection();
  const [editing, setEditing] = useState<any | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handleDelete(id: string, productCount: number) {
    if (productCount > 0) {
      const ok = window.confirm(
        `This collection has ${productCount} product(s). Deleting will hide it. Continue?`,
      );
      if (!ok) return;
    }
    setDeleting(id);
    await deleteMutation.mutateAsync(id);
    setDeleting(null);
    refetch();
  }

  return (
    <>
      <button
        onClick={() => {
          setEditing(null);
          setShowModal(true);
        }}
        className="mb-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        Add Collection
      </button>

      <div className="rounded-lg border">
        <table className="w-full">
          <thead>
            <tr className="border-b text-left text-sm font-medium text-muted-foreground">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Products</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {collections?.map((col: any) => (
              <tr key={col.id} className="border-b last:border-0">
                <td className="px-4 py-2 text-sm font-medium">{col.name}</td>
                <td className="px-4 py-2 text-sm text-muted-foreground font-mono">
                  {col.slug}
                </td>
                <td className="px-4 py-2 text-sm">
                  {col.is_active ? "ACTIVE" : "INACTIVE"}
                </td>
                <td className="px-4 py-2 text-sm text-right">
                  {col.product_count} items
                </td>
                <td className="px-4 py-2 text-sm text-right space-x-2">
                  <button
                    onClick={() => {
                      setEditing(col);
                      setShowModal(true);
                    }}
                    className="text-primary hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(col.id, col.product_count)}
                    disabled={deleting === col.id}
                    className="text-destructive hover:underline disabled:opacity-50"
                  >
                    {deleting === col.id ? "..." : "Delete"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {(!collections || collections.length === 0) && !isLoading && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No collections yet.
          </div>
        )}
      </div>

      {showModal && (
        <CollectionModal
          collection={editing}
          onClose={() => setShowModal(false)}
          onSaved={() => {
            refetch();
            setShowModal(false);
          }}
        />
      )}
    </>
  );
}
