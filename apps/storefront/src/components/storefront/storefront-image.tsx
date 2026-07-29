"use client";

import Image from "next/image";
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

function isCloudinaryUrl(src: string): boolean {
  return src.includes("res.cloudinary.com");
}

export function StorefrontImage({
  src,
  alt,
  variant = "original",
  width,
  height,
  className,
}: StorefrontImageProps) {
  const defaults = variantDefaults[variant];
  const w = width ?? defaults.width;
  const h = height ?? defaults.height;

  if (isCloudinaryUrl(src)) {
    return (
      <CldImage
        src={src}
        alt={alt}
        width={w}
        height={h}
        crop="fill"
        quality="auto"
        format="auto"
        className={className}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={w}
      height={h}
      className={className}
      style={{ objectFit: "cover", width: "100%", height: "100%" }}
    />
  );
}
