"use client";

import { useState } from "react";

import { StorefrontImage } from "@/components/storefront/storefront-image";

interface ImageGalleryProps {
  images: Array<{ url: string; alt_text?: string | null }>;
  activeIndex?: number;
  onIndexChange?: (index: number) => void;
}

function Placeholder() {
  return (
    <div className="aspect-[4/5] bg-muted rounded-lg flex items-center justify-center">
      <svg className="w-16 h-16 text-muted-foreground/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    </div>
  );
}

export function ImageGallery({ images, activeIndex: externalIndex, onIndexChange }: ImageGalleryProps) {
  const [internalIndex, setInternalIndex] = useState(0);
  const activeIndex = externalIndex ?? internalIndex;
  const setIndex = (i: number) => {
    setInternalIndex(i);
    onIndexChange?.(i);
  };

  if (!images || images.length === 0) return <Placeholder />;

  const safeIndex = Math.min(activeIndex, images.length - 1);
  const current = images[safeIndex] ?? images[0];
  if (!current) return <Placeholder />;

  return (
    <div className="flex gap-4">
      {/* Thumbnail strip — desktop */}
      <div className="hidden md:flex flex-col gap-2 shrink-0">
        {images.map((img, i) => (
          <button
            key={img.url}
            onClick={() => setIndex(i)}
            className={`w-16 h-20 overflow-hidden rounded border-2 transition-colors ${
              i === activeIndex ? "border-primary" : "border-border hover:border-foreground/40"
            }`}
          >
            <StorefrontImage src={img.url} alt={img.alt_text ?? ""} variant="pdpDetail" className="object-cover w-full h-full" />
          </button>
        ))}
      </div>

      {/* Main image */}
      <div className="flex-1 aspect-[4/5] overflow-hidden bg-muted rounded-lg relative">
        <StorefrontImage
          src={current.url}
          alt={current.alt_text ?? ""}
          variant="pdpHero"
          className="object-cover w-full h-full"
        />
      </div>

      {/* Mobile dot indicators */}
      {images.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 md:hidden">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === activeIndex ? "bg-primary" : "bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
