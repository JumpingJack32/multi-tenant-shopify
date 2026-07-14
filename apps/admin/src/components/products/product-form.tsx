"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm, type FieldValues } from "react-hook-form";
import {
  ProductCreateSchema,
  ProductUpdateSchema,
} from "@repo/tenant-orm/schemas";
import type { Product } from "@repo/tenant-orm/types";
import { Button as BaseButton } from "@repo/ui/base-ui";

import { useCollections } from "@/features/collections/hooks/use-collections";

interface CategoryOption {
  id: string;
  name: string;
  is_active: boolean;
}

interface ProductFormProps {
  initialData?: Product;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

export function ProductForm({
  initialData,
  onSubmit,
  onCancel,
}: ProductFormProps) {
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const { data: collections } = useCollections(false);
  const [selectedCollections, setSelectedCollections] = useState<string[]>(
    initialData?.collection_ids ?? [],
  );

  useEffect(() => {
    fetch("/api/v1/categories/")
      .then((res) => res.ok && res.json())
      .then((data) => setCategories(data ?? []))
      .catch(() => {});
  }, []);

  const schema = (
    initialData ? ProductUpdateSchema : ProductCreateSchema
  ) as any;
  type FormValues = any;

  const defaultFormValues: FormValues = initialData
    ? {
        ...initialData,
        images: undefined,
        category_id: initialData.category_id ?? null,
      }
    : {
        name: "",
        slug: "",
        status: "draft",
        is_active: true,
        weight: 0,
        weight_unit: "kg",
        category_id: null,
      };

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultFormValues,
  });

  const onFormSubmit = handleSubmit(async (data) => {
    await onSubmit({ ...data, collection_ids: selectedCollections });
  });

  return (
    <form onSubmit={onFormSubmit} className="space-y-6">
      {/* Name */}
      <div className="space-y-2">
        <label htmlFor="name" className="text-sm font-medium">
          Product Name
        </label>
        <input
          id="name"
          type="text"
          {...register("name")}
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="Enter product name"
        />
        {errors.name && (
          <p className="text-xs text-red-500">{String(errors.name.message)}</p>
        )}
      </div>

      {/* Slug */}
      <div className="space-y-2">
        <label htmlFor="slug" className="text-sm font-medium">
          Slug
        </label>
        <input
          id="slug"
          type="text"
          {...register("slug")}
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="product-slug"
        />
        {errors.slug && (
          <p className="text-xs text-red-500">{String(errors.slug.message)}</p>
        )}
      </div>

      {/* Category */}
      <div className="space-y-2">
        <label htmlFor="category_id" className="text-sm font-medium">
          Category
        </label>
        <select
          id="category_id"
          {...register("category_id")}
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">No category</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
        {errors.category_id && (
          <p className="text-xs text-red-500">
            {String(errors.category_id.message)}
          </p>
        )}
      </div>

      {/* Collections Multi-Select */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Collections</label>
        <div className="max-h-40 overflow-y-auto rounded-lg border p-2 space-y-1">
          {collections?.map((col: any) => (
            <label key={col.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                value={col.id}
                checked={selectedCollections.includes(col.id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedCollections([...selectedCollections, col.id]);
                  } else {
                    setSelectedCollections(
                      selectedCollections.filter((id: string) => id !== col.id),
                    );
                  }
                }}
                className="h-4 w-4 rounded border-gray-300"
              />
              {col.name}
            </label>
          ))}
        </div>
      </div>

      {/* Status */}
      <div className="space-y-2">
        <label htmlFor="status" className="text-sm font-medium">
          Status
        </label>
        <select
          id="status"
          {...register("status")}
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
        {errors.status && (
          <p className="text-xs text-red-500">
            {String(errors.status.message)}
          </p>
        )}
      </div>

      {/* Active Toggle */}
      <div className="flex items-center gap-2">
        <input
          id="is_active"
          type="checkbox"
          {...register("is_active")}
          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
        />
        <label htmlFor="is_active" className="text-sm font-medium">
          Active
        </label>
      </div>

      {/* Weight */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label htmlFor="weight" className="text-sm font-medium">
            Weight
          </label>
          <input
            id="weight"
            type="number"
            step="0.01"
            {...register("weight", { valueAsNumber: true })}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="0.00"
          />
          {errors.weight && (
            <p className="text-xs text-red-500">
              {String(errors.weight.message)}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="weight_unit" className="text-sm font-medium">
            Unit
          </label>
          <select
            id="weight_unit"
            {...register("weight_unit")}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="kg">Kilograms (kg)</option>
            <option value="g">Grams (g)</option>
            <option value="lb">Pounds (lb)</option>
            <option value="oz">Ounces (oz)</option>
          </select>
          {errors.weight_unit && (
            <p className="text-xs text-red-500">
              {String(errors.weight_unit.message)}
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-4">
        {/* Ghost Button */}
        <BaseButton
          type="button"
          onClick={onCancel}
          className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 transition-colors"
        >
          Cancel
        </BaseButton>

        {/* Primary / Submit Button */}
        <BaseButton
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting
            ? "Saving..."
            : initialData
              ? "Update Product"
              : "Create Product"}
        </BaseButton>
      </div>
      {/* <div className="flex items-center justify-end gap-3 pt-4">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : initialData ? "Update Product" : "Create Product"}
        </Button> 
    </div>*/}
    </form>
  );
}
