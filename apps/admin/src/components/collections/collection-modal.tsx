"use client";

import { Alert, AlertDescription } from "@repo/ui/components/ui/alert";
import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@repo/ui/components/ui/dialog";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { AlertCircle } from "@repo/ui/icons";
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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
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
    <Dialog
      open={true}
      onOpenChange={(open) => {
        !open && onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {collection?.id ? "Edit Collection" : "Add Collection"}
          </DialogTitle>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Collection name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                required
                className="font-mono"
                placeholder="collection-slug"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="hero_image_url">Hero Image URL</Label>
              <Input
                id="hero_image_url"
                value={heroImageUrl}
                onChange={(e) => setHeroImageUrl(e.target.value)}
                className="font-mono"
                placeholder="https://..."
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="hero_image_alt">Image Alt Text</Label>
              <Input
                id="hero_image_alt"
                value={heroImageAlt}
                onChange={(e) => setHeroImageAlt(e.target.value)}
                placeholder="Alt text"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="sort_order">Sort Order</Label>
              <Input
                id="sort_order"
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
              />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="is_active" className="!mt-0">
                Active
              </Label>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
