"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { StorefrontVariantResponse } from "@repo/codegen/client/types.gen";
import { Button } from "@repo/ui/components/ui/button";

import { cn } from "@/lib/utils";

export type VariantWithImage = StorefrontVariantResponse & { image_url?: string | null };

interface VariantSelectorProps {
  variants: VariantWithImage[];
  onVariantChange: (variant: VariantWithImage) => void;
  selectedVariantId?: string;
}

export function VariantSelector({ variants, onVariantChange, selectedVariantId: externalId }: VariantSelectorProps) {
  const [quantity, setQuantity] = useState(1);
  const [internalId, setInternalId] = useState<string | null>(null);
  const selectedId = externalId ?? internalId;

  const optionKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const v of variants) {
      for (const key of Object.keys(v.options)) {
        keys.add(key);
      }
    }
    return Array.from(keys);
  }, [variants]);

  const selections = useMemo(() => {
    const selected = variants.find((v) => v.id === selectedId);
    if (!selected) return {};
    return Object.fromEntries(
      Object.entries(selected.options).map(([k, v]) => [k, String(v)]),
    );
  }, [variants, selectedId]);

  const isOptionAvailable = useCallback(
    (key: string, value: string): boolean => {
      return variants.some((variant) => {
        const matchesAllSelections = Object.entries(selections).every(
          ([k, val]) => k === key || val === String(variant.options[k] ?? ""),
        );
        return matchesAllSelections && String(variant.options[key] ?? "") === value && variant.in_stock && variant.is_active;
      });
    },
    [variants, selections],
  );

  const uniqueValues = useCallback(
    (key: string): string[] => {
      return Array.from(new Set(variants.map((v) => String(v.options[key] ?? ""))));
    },
    [variants],
  );

  // Auto-select first valid variant on mount or when variants change
  useEffect(() => {
    const first = variants.find((v) => v.in_stock && v.is_active) ?? variants[0];
    if (first && first.id !== selectedId) {
      setInternalId(first.id);
      onVariantChange(first);
    }
    // Only run on mount / variants change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variants]);

  const handleSelect = useCallback(
    (key: string, value: string) => {
      const candidate = Object.assign({}, selections, { [key]: value });
      const match = variants.find((v) =>
        Object.entries(candidate).every(
          ([k, val]) => String(v.options[k] ?? "") === val,
        ) && v.in_stock && v.is_active
      ) ?? variants.find((v) =>
        Object.entries(candidate).every(
          ([k, val]) => String(v.options[k] ?? "") === val,
        )
      );
      if (match) {
        setInternalId(match.id);
        onVariantChange(match);
      }
    },
    [variants, selections, onVariantChange],
  );

  const selected = variants.find((v) => v.id === selectedId);

  return (
    <div className="space-y-4">
      {optionKeys.map((key) => (
        <div key={key}>
          <p className="text-sm font-semibold mb-2">
            {key}: <span className="font-normal text-muted-foreground">{selections[key] ?? ""}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {uniqueValues(key).map((value) => {
              const available = isOptionAvailable(key, value);
              const active = selections[key] === value;
              return (
                <button
                  key={value}
                  onClick={() => handleSelect(key, value)}
                  disabled={!available}
                  className={cn(
                    "px-4 min-h-[44px] min-w-[44px] text-sm rounded border transition-colors",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : available
                        ? "border-border hover:border-foreground"
                        : "border-border opacity-30 line-through cursor-not-allowed",
                  )}
                >
                  {value}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {selected && (
        <div className="flex items-center gap-2 pt-2">
          <p className="text-sm font-semibold">Qty</p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="min-h-[44px] min-w-[44px]"
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              disabled={quantity <= 1}
            >
              -
            </Button>
            <span className="w-8 text-center text-sm font-mono">{quantity}</span>
            <Button
              variant="outline"
              size="icon"
              className="min-h-[44px] min-w-[44px]"
              onClick={() => setQuantity(quantity + 1)}
            >
              +
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
