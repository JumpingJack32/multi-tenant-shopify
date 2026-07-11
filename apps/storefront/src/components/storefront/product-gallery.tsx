"use client";

import { motion, AnimatePresence } from "@repo/ui/components/motion";
import { useState } from "react";

import { StorefrontImage } from "@/components/storefront/storefront-image";

interface GalleryImage {
  url: string;
}

interface ProductGalleryProps {
  images: GalleryImage[];
  name: string;
}

export function ProductGallery({ images, name }: ProductGalleryProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!images || images.length === 0) {
    return (
      <div className="flex aspect-[16/9] items-center justify-center bg-muted p-4 text-center text-muted-foreground">
        {name}
      </div>
    );
  }

  const heroImage = images[0]!.url;
  const imageUrls = images.map((img) => img.url);
  const detailImages = images.slice(1);

  return (
    <div>
      <div
        className="relative aspect-[16/9] overflow-hidden bg-background"
        onMouseEnter={() => setHoveredIndex(0)}
        onMouseLeave={() => setHoveredIndex(null)}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={
              hoveredIndex === 0 && images.length > 1 ? "hero-hover" : "hero"
            }
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <StorefrontImage
              src={
                hoveredIndex === 0 && images.length > 1
                  ? imageUrls[1]!
                  : heroImage
              }
              alt={name}
              variant="pdpHero"
              className="object-cover"
            />
          </motion.div>
        </AnimatePresence>
      </div>
      {detailImages.map((img, i) => {
        const actualIndex = i + 1;
        const nextIndex = actualIndex + 1;
        return (
          <div
            key={img.url}
            className="relative aspect-[4/5] overflow-hidden bg-background"
            onMouseEnter={() => setHoveredIndex(actualIndex)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={
                  hoveredIndex === actualIndex && nextIndex < images.length
                    ? `detail-hover-${i}`
                    : `detail-${i}`
                }
                className="absolute inset-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <StorefrontImage
                  src={
                    hoveredIndex === actualIndex && nextIndex < images.length
                      ? imageUrls[nextIndex]!
                      : img.url
                  }
                  alt={name}
                  variant="pdpDetail"
                  className="object-cover"
                />
              </motion.div>
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
