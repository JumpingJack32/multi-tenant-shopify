"use client";

import { useState } from "react";
import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Input } from "@repo/ui/components/ui/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/ui/components/ui/tabs";
import { SearchIcon, LinkIcon } from "@repo/ui/icons";

import {
  useSearchCategories,
  useSearchCollections,
  useSearchProducts,
} from "@/features/navigation/api/use-navigation-admin";

export interface LinkSelection {
  type: "category" | "collection" | "product" | "custom";
  ref_id?: string;
  href?: string;
  title: string;
}

interface LinkPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (selection: LinkSelection) => void;
}

export function LinkPickerModal({
  open,
  onOpenChange,
  onSelect,
}: LinkPickerModalProps) {
  const [tab, setTab] = useState("categories");
  const [query, setQuery] = useState("");
  const [customHref, setCustomHref] = useState("");
  const [customTitle, setCustomTitle] = useState("");

  const searchCats = useSearchCategories();
  const searchCols = useSearchCollections();
  const searchProds = useSearchProducts();

  const categories = (tab === "categories" && query ? searchCats.data : []) as
    | Array<{ id: string; name: string }>
    | undefined;
  const collections = (
    tab === "collections" && query ? searchCols.data : []
  ) as Array<{ id: string; name: string }> | undefined;
  const products = (tab === "products" && query ? searchProds.data : []) as
    | Array<{ id: string; name: string }>
    | undefined;

  const handleSearch = (value: string) => {
    setQuery(value);
    if (!value) return;
    if (tab === "categories") searchCats.mutate(value);
    else if (tab === "collections") searchCols.mutate(value);
    else if (tab === "products") searchProds.mutate(value);
  };

  const handleSelect = (
    type: LinkSelection["type"],
    id: string | undefined,
    title: string,
  ) => {
    onSelect({ type, ref_id: id, title });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Link Picker</DialogTitle>
          <DialogDescription>Search and select a link target</DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList variant="line">
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="collections">Collections</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="custom">Custom URL</TabsTrigger>
          </TabsList>

          <TabsContent value="categories" className="space-y-3 pt-3">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search categories..."
                className="pl-9"
                value={query}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {categories?.map((c) => (
                <Button
                  key={c.id}
                  variant="ghost"
                  className="w-full justify-start text-sm"
                  onClick={() => handleSelect("category", c.id, c.name)}
                >
                  <LinkIcon className="mr-2 h-3 w-3" /> {c.name}
                </Button>
              ))}
              {query && categories?.length === 0 && (
                <p className="text-sm text-muted-foreground">No results</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="collections" className="space-y-3 pt-3">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search collections..."
                className="pl-9"
                value={query}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {collections?.map((c) => (
                <Button
                  key={c.id}
                  variant="ghost"
                  className="w-full justify-start text-sm"
                  onClick={() => handleSelect("collection", c.id, c.name)}
                >
                  <LinkIcon className="mr-2 h-3 w-3" /> {c.name}
                </Button>
              ))}
              {query && collections?.length === 0 && (
                <p className="text-sm text-muted-foreground">No results</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="products" className="space-y-3 pt-3">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                className="pl-9"
                value={query}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {products?.map((p) => (
                <Button
                  key={p.id}
                  variant="ghost"
                  className="w-full justify-start text-sm"
                  onClick={() => handleSelect("product", p.id, p.name)}
                >
                  <LinkIcon className="mr-2 h-3 w-3" /> {p.name}
                </Button>
              ))}
              {query && products?.length === 0 && (
                <p className="text-sm text-muted-foreground">No results</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="custom" className="space-y-3 pt-3">
            <Input
              placeholder="URL path (e.g. /promo/summer)"
              value={customHref}
              onChange={(e) => setCustomHref(e.target.value)}
            />
            <Input
              placeholder="Link title"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
            />
            <Button
              className="w-full"
              disabled={!customHref || !customTitle}
              onClick={() => {
                onSelect({
                  type: "custom",
                  href: customHref,
                  title: customTitle,
                });
                onOpenChange(false);
              }}
            >
              Add Link
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
