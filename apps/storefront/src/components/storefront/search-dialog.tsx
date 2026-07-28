"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatCents } from "@repo/shared-utils/currency";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@repo/ui/components/ui/command";
import { Loader2Icon, SearchIcon } from "@repo/ui/icons";

import { useTenantStore } from "@/hooks/use-tenant-store";

import { StorefrontImage } from "./storefront-image";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface SearchDialogProps {
  tenantSlug: string;
}

export function SearchDialog({ tenantSlug }: SearchDialogProps) {
  const router = useRouter();
  const currency = useTenantStore((s) => s.currency);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const { data, isFetching } = useQuery({
    queryKey: ["search", tenantSlug, debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery.trim()) return [];
      const r = await fetch(`${API_URL}/api/v1/storefront/${tenantSlug}/products/search?q=${encodeURIComponent(debouncedQuery)}&limit=8`);
      return r.json();
    },
    enabled: debouncedQuery.trim().length > 0,
    staleTime: 30_000,
  });

  const results = (data ?? []) as Array<{
    id: string;
    slug: string;
    name: string;
    min_price: number;
    images?: Array<{ url: string }>;
  }>;

  const handleSelect = useCallback(
    (slug: string) => {
      setOpen(false);
      setQuery("");
      router.push(`/${tenantSlug}/products/${slug}`);
    },
    [router, tenantSlug],
  );

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Search products"
      >
        <SearchIcon className="h-5 w-5" />
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search products..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {isFetching && (
              <div className="flex items-center justify-center py-8">
                <Loader2Icon className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
            {!isFetching && query && results.length === 0 && (
              <CommandEmpty>No products found</CommandEmpty>
            )}
            {results.length > 0 && (
              <CommandGroup heading="Products">
                {results.map((p) => (
                  <CommandItem
                    key={p.id}
                    value={p.slug}
                    onSelect={() => handleSelect(p.slug)}
                    className="flex items-center gap-3 py-2"
                  >
                    {p.images?.[0]?.url && (
                      <div className="w-10 h-12 rounded bg-muted overflow-hidden shrink-0">
                        <img src={p.images[0].url} alt={p.name} className="object-cover w-full h-full" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <p className="text-xs font-mono text-muted-foreground">
                        {formatCents(p.min_price, currency)}
                      </p>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
