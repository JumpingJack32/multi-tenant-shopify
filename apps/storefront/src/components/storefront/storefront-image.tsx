"use client";

import { CldImage } from "next-cloudinary";
import type { CldImageProps } from "next-cloudinary";

type Variant = "plp" | "pdpHero" | "pdpDetail" | "original";

interface StorefrontImageProps extends CldImageProps {
  variant?: Variant;
}

const variantDefaults: Record<Variant, { width: number; height: number }> = {
  plp: { width: 600, height: 750 },
  pdpHero: { width: 1200, height: 675 },
  pdpDetail: { width: 800, height: 1000 },
  original: { width: 1200, height: 1200 },
};

export function StorefrontImage({
  src,
  alt,
  variant = "original",
  width,
  height,
  ...props
}: StorefrontImageProps) {
  const defaults = variantDefaults[variant];

  return (
    <CldImage
      src={src}
      alt={alt}
      width={width ?? defaults.width}
      height={height ?? defaults.height}
      crop="fill"
      quality="auto"
      format="auto"
      {...props}
    />
  );
}
