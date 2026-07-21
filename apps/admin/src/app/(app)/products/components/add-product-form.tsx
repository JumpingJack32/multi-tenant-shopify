"use client";

import { useState, useRef, useCallback } from "react";
import type { Product } from "@repo/tenant-orm/types";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { PlusIcon, Trash2Icon } from "@repo/ui/icons";

import {
  MediaDropzone,
  type MediaItem,
} from "@/components/products/media-dropzone";
import { AIToolbar } from "@/components/ui/ai-toolbar";
import { uploadToCloudinary } from "@/lib/cloudinary-upload";

interface AddProductFormProps {
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  editingProduct?: Product | null;
}

interface VariantRow {
  id: string;
  optionType: string;
  optionValue: string;
  price: number;
  sku: string;
  stock: number;
}

const OPTION_TYPES = [
  "Size",
  "Color",
  "Material",
  "Style",
  "Format",
  "Capacity",
];

/** Upload a batch of files to Cloudinary, returns public_ids in order. */
async function uploadMedia(
  items: MediaItem[],
  onProgress?: (done: number, total: number) => void,
): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const publicId = await uploadToCloudinary(item.file);
    ids.push(publicId);
    onProgress?.(i + 1, items.length);
  }
  return ids;
}

export default function AddProductForm({
  onSubmit,
  onCancel,
  editingProduct,
}: AddProductFormProps) {
  const isEditing = !!editingProduct;
  const [name, setName] = useState(editingProduct?.name ?? "");
  const [description, setDescription] = useState(
    editingProduct?.description ?? "",
  );
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [price, setPrice] = useState(0);
  const [comparePrice, setComparePrice] = useState(0);
  const [costPrice, setCostPrice] = useState(0);
  const [hasVariants, setHasVariants] = useState(false);
  const [variants, setVariants] = useState<VariantRow[]>([
    {
      id: "1",
      optionType: "Size",
      optionValue: "",
      price: 0,
      sku: "",
      stock: 0,
    },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const submitRef = useRef(false);
  const descriptionRef = useRef<HTMLTextAreaElement | null>(null);

  const addVariant = () => {
    setVariants((prev) => [
      ...prev,
      {
        id: String(prev.length + 1),
        optionType: "Size",
        optionValue: "",
        price: 0,
        sku: "",
        stock: 0,
      },
    ]);
  };

  const updateVariant = (
    id: string,
    key: keyof VariantRow,
    value: string | number,
  ) => {
    setVariants((prev) =>
      prev.map((v) => (v.id === id ? { ...v, [key]: value } : v)),
    );
  };

  const removeVariant = (id: string) => {
    setVariants((prev) => prev.filter((v) => v.id !== id));
  };

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (submitRef.current) return;
      submitRef.current = true;

      setSubmitting(true);
      setProgress(null);

      try {
        let imageIds: string[] = [];

        if (!isEditing && mediaItems.length > 0) {
          setProgress({ done: 0, total: mediaItems.length });
          imageIds = await uploadMedia(mediaItems, (done, total) =>
            setProgress({ done, total }),
          );
        }

        const payload: Record<string, unknown> = {
          name,
          description,
          price: Math.round(price * 100),
          has_variants: hasVariants,
          variants: hasVariants
            ? variants.map((v) => ({
                options: v.optionValue ? { [v.optionType]: v.optionValue } : {},
                price: Math.round(v.price * 100),
                sku: v.sku,
                inventory_quantity: v.stock,
              }))
            : [],
        };

        if (!isEditing) {
          payload.compare_at_price = comparePrice
            ? Math.round(comparePrice * 100)
            : undefined;
          payload.cost_price = costPrice
            ? Math.round(costPrice * 100)
            : undefined;
          payload.images = imageIds;
        }

        onSubmit(payload);
      } finally {
        setSubmitting(false);
        setProgress(null);
        submitRef.current = false;
      }
    },
    [
      name,
      description,
      mediaItems,
      price,
      comparePrice,
      costPrice,
      hasVariants,
      variants,
      isEditing,
      onSubmit,
    ],
  );

  return (
    <div className="relative rounded-xl bg-cover bg-center bg-no-repeat p-6 pb-32">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Product Details */}
        <div className="rounded-xl border bg-card/80 backdrop-blur-sm p-6 space-y-4 shadow-sm">
          <h3 className="text-base font-semibold">
            {isEditing ? "Edit Product" : "Product Details"}
          </h3>
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Short sleeve linen shirt"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Description</Label>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const res = await fetch("/api/generate", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        type: "product_description",
                        prompt: `Product: ${name}. ${description || "Write a compelling product description."}`,
                        context: { name: name || undefined },
                      }),
                    });
                    const body = await res.json();
                    if (body.completion) setDescription(body.completion);
                  } catch {
                    // silent — AI is optional
                  }
                }}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                title="Generate with AI"
              >
                <svg viewBox="0 0 65 65" fill="none" className="h-4 w-4">
                  <path
                    d="M32.447 0c.68 0 1.273.465 1.439 1.125a38.904 38.904 0 001.999 5.905c2.152 5 5.105 9.376 8.854 13.125 3.751 3.75 8.126 6.703 13.125 8.855a38.98 38.98 0 005.906 1.999c.66.166 1.124.758 1.124 1.438 0 .68-.464 1.273-1.125 1.439a38.902 38.902 0 00-5.905 1.999c-5 2.152-9.375 5.105-13.125 8.854-3.749 3.751-6.702 8.126-8.854 13.125a38.973 38.973 0 00-2 5.906 1.485 1.485 0 01-1.438 1.124c-.68 0-1.272-.464-1.438-1.125a38.913 38.913 0 00-2-5.905c-2.151-5-5.103-9.375-8.854-13.125-3.75-3.749-8.125-6.702-13.125-8.854a38.973 38.973 0 00-5.905-2A1.485 1.485 0 010 32.448c0-.68.465-1.272 1.125-1.438a38.903 38.903 0 005.905-2c5-2.151 9.376-5.104 13.125-8.854 3.75-3.749 6.703-8.125 8.855-13.125a38.972 38.972 0 001.999-5.905A1.485 1.485 0 0132.447 0z"
                    fill="currentColor"
                  />
                </svg>
              </button>
            </div>
            <Textarea
              ref={descriptionRef}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[200px]"
              placeholder="Product description..."
            />
            <AIToolbar textareaRef={descriptionRef} />
          </div>
        </div>

        {/* Media */}
        <div className="rounded-xl border bg-card p-6 space-y-4 shadow-sm">
          <h3 className="text-base font-semibold">Media</h3>
          <MediaDropzone
            value={mediaItems}
            onChange={setMediaItems}
            disabled={submitting}
          />
        </div>

        {/* Pricing */}
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h3 className="mb-4 text-base font-semibold">Pricing</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Price</Label>
              <Input
                type="number"
                step="0.01"
                value={price || ""}
                onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Compare-at Price</Label>
              <Input
                type="number"
                step="0.01"
                value={comparePrice || ""}
                onChange={(e) =>
                  setComparePrice(parseFloat(e.target.value) || 0)
                }
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Cost per Item</Label>
              <Input
                type="number"
                step="0.01"
                value={costPrice || ""}
                onChange={(e) => setCostPrice(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
              />
            </div>
          </div>
        </div>

        {/* Variants */}
        <div className="rounded-xl border bg-card p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold">Variants</h3>
              <p className="text-sm text-muted-foreground">
                Enable for products with multiple options like size or color.
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={hasVariants}
                onChange={(e) => setHasVariants(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              Has Variants
            </label>
          </div>

          {hasVariants && (
            <div className="space-y-3 pt-4 border-t">
              {variants.map((v) => (
                <div
                  key={v.id}
                  className="flex items-end gap-3 rounded-lg bg-muted/50 p-3"
                >
                  <div className="shrink-0 space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Type
                    </Label>
                    <select
                      value={v.optionType}
                      onChange={(e) =>
                        updateVariant(v.id, "optionType", e.target.value)
                      }
                      className="h-8 rounded-md border bg-background px-2 text-xs"
                    >
                      {OPTION_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Value
                    </Label>
                    <Input
                      value={v.optionValue}
                      onChange={(e) =>
                        updateVariant(v.id, "optionValue", e.target.value)
                      }
                      className="h-8 text-xs"
                      placeholder="e.g. M"
                    />
                  </div>
                  <div className="w-24 shrink-0 space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Price
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={v.price || ""}
                      onChange={(e) =>
                        updateVariant(
                          v.id,
                          "price",
                          parseFloat(e.target.value) || 0,
                        )
                      }
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="w-28 shrink-0 space-y-1">
                    <Label className="text-xs text-muted-foreground">SKU</Label>
                    <Input
                      value={v.sku}
                      onChange={(e) =>
                        updateVariant(v.id, "sku", e.target.value)
                      }
                      className="h-8 text-xs font-mono"
                      placeholder="W-SHIRT-M"
                    />
                  </div>
                  <div className="w-20 shrink-0 space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Stock
                    </Label>
                    <Input
                      type="number"
                      value={v.stock || ""}
                      onChange={(e) =>
                        updateVariant(
                          v.id,
                          "stock",
                          parseInt(e.target.value) || 0,
                        )
                      }
                      className="h-8 text-xs"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeVariant(v.id)}
                    className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2Icon className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addVariant}
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <PlusIcon className="h-4 w-4" /> Add variant
              </button>
            </div>
          )}
        </div>

        {/* Sticky footer */}
        <div className="fixed bottom-0 left-0 right-0 border-t bg-card py-4 px-8 flex justify-end gap-3 z-10 shadow-lg">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-lg border bg-background px-4 py-2 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
          >
            Discard
          </button>
          <button
            type="submit"
            disabled={submitting || !name.trim()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
          >
            {submitting && progress
              ? `Uploading ${progress.done}/${progress.total}...`
              : submitting
                ? "Saving..."
                : isEditing
                  ? "Update Product"
                  : "Save Product"}
          </button>
        </div>
      </form>
    </div>
  );
}
