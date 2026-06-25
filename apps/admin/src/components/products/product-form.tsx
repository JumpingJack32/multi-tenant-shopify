"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ProductCreateSchema, ProductUpdateSchema } from "@repo/tenant-orm/schemas/tenant";
import type { Product } from "@repo/tenant-orm/types";
import { Button as BaseButton } from "@repo/ui/base-ui";
// import { Button } from "@/components/ui/button";

interface ProductFormProps {
  initialData?: Product;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

export function ProductForm({ initialData, onSubmit, onCancel }: ProductFormProps) {
  const schema = initialData ? ProductUpdateSchema : ProductCreateSchema;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: initialData ?? {
      name: "",
      slug: "",
      status: "draft",
      is_active: true,
      weight: 0,
      weight_unit: "kg",
    },
  });

  const onFormSubmit = handleSubmit(async (data) => {
    await onSubmit(data);
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
          <p className="text-xs text-red-500">{errors.name.message}</p>
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
          <p className="text-xs text-red-500">{errors.slug.message}</p>
        )}
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
          <p className="text-xs text-red-500">{errors.status.message}</p>
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
            <p className="text-xs text-red-500">{errors.weight.message}</p>
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
            <p className="text-xs text-red-500">{errors.weight_unit.message}</p>
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
          {isSubmitting ? "Saving..." : initialData ? "Update Product" : "Create Product"}
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
    </form >
  );
}
