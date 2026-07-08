"use client";

import { useState } from "react";

interface CollectionModalProps {
  collection: {
    id?: string;
    name?: string;
    slug?: string;
    description?: string | null;
    hero_image_url?: string | null;
    hero_image_alt?: string | null;
    sort_order?: number;
    is_active?: boolean;
  } | null;
  onClose: () => void;
  onSaved: () => void;
}

export function CollectionModal({
  collection,
  onClose,
  onSaved,
}: CollectionModalProps) {
  const [name, setName] = useState(collection?.name ?? "");
  const [slug, setSlug] = useState(collection?.slug ?? "");
  const [description, setDescription] = useState(collection?.description ?? "");
  const [heroImageUrl, setHeroImageUrl] = useState(
    collection?.hero_image_url ?? "",
  );
  const [heroImageAlt, setHeroImageAlt] = useState(
    collection?.hero_image_alt ?? "",
  );
  const [sortOrder, setSortOrder] = useState(collection?.sort_order ?? 0);
  const [isActive, setIsActive] = useState(collection?.is_active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const method = collection?.id ? "PUT" : "POST";
    const url = collection?.id
      ? `/api/v1/collections/${collection.id}`
      : "/api/v1/collections/";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug,
          description,
          hero_image_url: heroImageUrl,
          hero_image_alt: heroImageAlt,
          sort_order: sortOrder,
          is_active: isActive,
        }),
      });

      if (!res.ok) {
        const err = await res
          .json()
          .catch(() => ({ detail: "Failed to save" }));
        setError(err.detail ?? "Failed to save");
        return;
      }
      onSaved();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg bg-background p-6 shadow-lg">
        <h2 className="text-lg font-bold mb-4">
          {collection?.id ? "Edit Collection" : "Add Collection"}
        </h2>

        {error && (
          <div className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Slug</label>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                required
                className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Hero Image URL</label>
              <input
                value={heroImageUrl}
                onChange={(e) => setHeroImageUrl(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Image Alt Text</label>
              <input
                value={heroImageAlt}
                onChange={(e) => setHeroImageAlt(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Sort Order</label>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4"
              />
              <label className="text-sm font-medium">Active</label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
