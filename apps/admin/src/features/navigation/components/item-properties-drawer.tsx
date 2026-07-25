"use client";

import { useEffect, useState } from "react";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@repo/ui/components/ui/sheet";
import { Switch } from "@repo/ui/components/ui/switch";

import { LinkPickerModal, type LinkSelection } from "./link-picker-modal";

export interface NavItemFormData {
  id?: string;
  title: string;
  type: string;
  ref_id?: string;
  href?: string;
  image_url?: string;
  open_in_new_tab: boolean;
  is_title_link: boolean;
  show_view_all: boolean;
  is_featured: boolean;
  badge?: string;
}

interface ItemPropertiesDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: NavItemFormData | null;
  onSave: (data: NavItemFormData) => void;
}

const ITEM_TYPES = [
  { value: "category", label: "Category" },
  { value: "collection", label: "Collection" },
  { value: "product", label: "Product" },
  { value: "custom", label: "Custom URL" },
  { value: "editorial", label: "Editorial" },
];

export function ItemPropertiesDrawer({
  open,
  onOpenChange,
  initial,
  onSave,
}: ItemPropertiesDrawerProps) {
  const [form, setForm] = useState<NavItemFormData>({
    title: "",
    type: "editorial",
    open_in_new_tab: false,
    is_title_link: false,
    show_view_all: false,
    is_featured: false,
  });
  const [linkPickerOpen, setLinkPickerOpen] = useState(false);

  useEffect(() => {
    if (initial) {
      setForm(initial);
    } else {
      setForm({
        title: "",
        type: "editorial",
        open_in_new_tab: false,
        is_title_link: false,
        show_view_all: false,
        is_featured: false,
      });
    }
  }, [initial, open]);

  const handleLinkSelect = (sel: LinkSelection) => {
    setForm((f) => ({
      ...f,
      type: sel.type,
      ref_id: sel.ref_id,
      href: sel.href,
      title: sel.title || f.title,
    }));
  };

  const needsLinkPicker = ["category", "collection", "product"].includes(
    form.type,
  );

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-[400px] sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{initial ? "Edit Item" : "Add Item"}</SheetTitle>
            <SheetDescription>
              Configure navigation item properties
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-4 py-6">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={form.type}
                onValueChange={(v: string | null) =>
                  v && setForm({ ...form, type: v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ITEM_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {needsLinkPicker && (
              <div className="space-y-2">
                <Label>Linked Item</Label>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => setLinkPickerOpen(true)}
                >
                  {form.title || form.ref_id ? form.title : "Select..."}
                </Button>
              </div>
            )}

            {form.type === "custom" && (
              <div className="space-y-2">
                <Label>URL</Label>
                <Input
                  value={form.href ?? ""}
                  onChange={(e) => setForm({ ...form, href: e.target.value })}
                  placeholder="/promo/summer"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Badge (optional)</Label>
              <Input
                value={form.badge ?? ""}
                onChange={(e) => setForm({ ...form, badge: e.target.value })}
                placeholder="New, Sale, Coming Soon"
              />
            </div>

            <div className="space-y-2">
              <Label>Image URL (optional)</Label>
              <Input
                value={form.image_url ?? ""}
                onChange={(e) =>
                  setForm({ ...form, image_url: e.target.value })
                }
                placeholder="https://..."
              />
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <div className="flex items-center justify-between">
                <Label>Open in new tab</Label>
                <Switch
                  checked={form.open_in_new_tab}
                  onCheckedChange={(v) =>
                    setForm({ ...form, open_in_new_tab: v })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Is title link</Label>
                <Switch
                  checked={form.is_title_link}
                  onCheckedChange={(v) =>
                    setForm({ ...form, is_title_link: v })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Show "View All"</Label>
                <Switch
                  checked={form.show_view_all}
                  onCheckedChange={(v) =>
                    setForm({ ...form, show_view_all: v })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Featured</Label>
                <Switch
                  checked={form.is_featured}
                  onCheckedChange={(v) => setForm({ ...form, is_featured: v })}
                />
              </div>
            </div>

            <Button className="mt-4" onClick={() => onSave(form)}>
              {initial ? "Update" : "Add"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <LinkPickerModal
        open={linkPickerOpen}
        onOpenChange={setLinkPickerOpen}
        onSelect={handleLinkSelect}
      />
    </>
  );
}
