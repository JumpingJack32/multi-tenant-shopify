"use client";

import { useState, useEffect } from "react";

import { CategoryModal } from "./category-modal";

interface Category {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  product_count: number;
}

export function CategoriesTable() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [editing, setEditing] = useState<Category | null>(null);
  const [showModal, setShowModal] = useState(false);

  async function loadCategories() {
    try {
      const res = await fetch("/api/v1/categories/");
      if (res.ok) {
        const data = (await res.json()) as Category[];
        setCategories(data);
      }
    } catch {
      // silently fail
    }
  }

  useEffect(() => {
    loadCategories();
  }, []);

  async function handleDelete(id: string, productCount: number) {
    if (productCount > 0) {
      const ok = window.confirm(
        `This category has ${productCount} product(s). Deleting will unassign them. Continue?`,
      );
      if (!ok) return;
    }
    try {
      await fetch(`/api/v1/categories/${id}`, { method: "DELETE" });
      setCategories((prev) => prev.filter((c) => c.id !== id));
    } catch {
      // silently fail
    }
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
        Add Category
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
            {categories.map((cat) => (
              <tr key={cat.id} className="border-b last:border-0">
                <td className="px-4 py-2 text-sm font-medium">{cat.name}</td>
                <td className="px-4 py-2 text-sm text-muted-foreground font-mono">
                  {cat.slug}
                </td>
                <td className="px-4 py-2 text-sm">
                  {cat.is_active ? "ACTIVE" : "INACTIVE"}
                </td>
                <td className="px-4 py-2 text-sm text-right">
                  {cat.product_count} items
                </td>
                <td className="px-4 py-2 text-sm text-right space-x-2">
                  <button
                    onClick={() => {
                      setEditing(cat);
                      setShowModal(true);
                    }}
                    className="text-primary hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(cat.id, cat.product_count)}
                    className="text-destructive hover:underline"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {categories.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No categories yet.
          </div>
        )}
      </div>

      {showModal && (
        <CategoryModal
          category={editing}
          onClose={() => setShowModal(false)}
          onSaved={() => {
            loadCategories();
            setShowModal(false);
          }}
        />
      )}
    </>
  );
}
