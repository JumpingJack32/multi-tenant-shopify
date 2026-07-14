"use client";

import Placeholder from "@tiptap/extension-placeholder";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useState } from "react";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import {
  BoldIcon,
  ItalicIcon,
  ListIcon,
  PlusIcon,
  Trash2Icon,
} from "@repo/ui/icons";

interface AddProductFormProps {
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
}

interface VariantRow {
  id: string;
  option1: string;
  option2: string;
  price: number;
  sku: string;
  stock: number;
}

function MenuBar({ editor }: { editor: any }) {
  if (!editor) return null;
  const btn = (
    active: boolean,
    onPress: () => void,
    label: string,
    icon: React.ReactNode,
  ) => (
    <button
      type="button"
      onClick={onPress}
      className={`rounded p-1.5 transition-colors ${
        active
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      }`}
      title={label}
    >
      {icon}
    </button>
  );

  return (
    <div className="flex items-center gap-0.5 border-b px-3 py-2">
      {btn(
        editor.isActive("bold"),
        () => editor.chain().focus().toggleBold().run(),
        "Bold",
        <BoldIcon className="h-4 w-4" />,
      )}
      {btn(
        editor.isActive("italic"),
        () => editor.chain().focus().toggleItalic().run(),
        "Italic",
        <ItalicIcon className="h-4 w-4" />,
      )}
      {btn(
        editor.isActive("bulletList"),
        () => editor.chain().focus().toggleBulletList().run(),
        "Bullet List",
        <ListIcon className="h-4 w-4" />,
      )}
    </div>
  );
}

export default function AddProductForm({
  onSubmit,
  onCancel,
}: AddProductFormProps) {
  const [name, setName] = useState("");
  const [media, setMedia] = useState<File[]>([]);
  const [price, setPrice] = useState(0);
  const [comparePrice, setComparePrice] = useState(0);
  const [costPrice, setCostPrice] = useState(0);
  const [hasVariants, setHasVariants] = useState(false);
  const [variants, setVariants] = useState<VariantRow[]>([
    { id: "1", option1: "Default", option2: "", price: 0, sku: "", stock: 0 },
  ]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "Provide a detailed description of this product...",
      }),
    ],
    editorProps: {
      attributes: {
        class:
          "focus:outline-none min-h-[160px] px-3 py-2 text-sm leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold [&_em]:italic",
      },
    },
  });

  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setMedia((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const addVariant = () => {
    setVariants((prev) => [
      ...prev,
      {
        id: String(prev.length + 1),
        option1: "",
        option2: "",
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      description: editor?.getHTML() || "",
      price: Math.round(price * 100),
      compare_at_price: comparePrice
        ? Math.round(comparePrice * 100)
        : undefined,
      cost_price: costPrice ? Math.round(costPrice * 100) : undefined,
      has_variants: hasVariants,
      variants: hasVariants
        ? variants.map((v) => ({
            option1: v.option1,
            option2: v.option2,
            price: Math.round(v.price * 100),
            sku: v.sku,
            stock: v.stock,
          }))
        : [],
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pb-32">
      {/* Product Details */}
      <div className="rounded-xl border bg-card p-6 space-y-4 shadow-sm">
        <h3 className="text-base font-semibold">Product Details</h3>
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
          <Label>Description</Label>
          <div className="overflow-hidden rounded-lg border">
            <MenuBar editor={editor} />
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>

      {/* Media */}
      <div className="rounded-xl border bg-card p-6 space-y-4 shadow-sm">
        <h3 className="text-base font-semibold">Media</h3>
        <div className="relative cursor-pointer rounded-lg border-2 border-dashed p-8 text-center hover:border-muted-foreground/50 transition-colors">
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={handleMediaUpload}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
          <svg
            className="mx-auto h-10 w-10 text-muted-foreground/50"
            stroke="currentColor"
            fill="none"
            viewBox="0 0 48 48"
          >
            <path
              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <p className="mt-2 text-sm text-muted-foreground">
            <span className="font-semibold text-primary">Upload assets</span> or
            drag and drop
          </p>
          <p className="text-xs text-muted-foreground/60">
            PNG, JPG, GIF up to 10MB
          </p>
        </div>
        {media.length > 0 && (
          <div className="grid grid-cols-4 gap-3">
            {media.map((file, i) => (
              <div
                key={i}
                className="truncate rounded-lg border bg-muted p-2 text-xs"
              >
                {file.name}
              </div>
            ))}
          </div>
        )}
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
              onChange={(e) => setComparePrice(parseFloat(e.target.value) || 0)}
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
                className="grid grid-cols-6 gap-3 items-end rounded-lg bg-muted/50 p-3"
              >
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    Option 1
                  </Label>
                  <Input
                    value={v.option1}
                    onChange={(e) =>
                      updateVariant(v.id, "option1", e.target.value)
                    }
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    Option 2
                  </Label>
                  <Input
                    value={v.option2}
                    onChange={(e) =>
                      updateVariant(v.id, "option2", e.target.value)
                    }
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Price</Label>
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
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">SKU</Label>
                  <Input
                    value={v.sku}
                    onChange={(e) => updateVariant(v.id, "sku", e.target.value)}
                    className="h-8 text-xs font-mono"
                    placeholder="W-SHIRT-M"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Stock</Label>
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
          className="rounded-lg border bg-background px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
        >
          Discard
        </button>
        <button
          type="submit"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
        >
          Save Product
        </button>
      </div>
    </form>
  );
}
