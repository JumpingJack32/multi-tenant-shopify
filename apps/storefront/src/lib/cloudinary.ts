/** Cloudinary configuration and image transformation helpers. */

export const cloudinaryConfig = {
  cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "",
};

/** Default image transformations for the storefront. */
export const transforms = {
  /** 4:5 aspect ratio crop — used on PLP product cards. */
  plp: {
    width: 600,
    height: 750,
    crop: "fill",
    quality: "auto",
    format: "auto",
  },
  /** 16:9 hero crop — used on PDP hero image. */
  pdpHero: {
    width: 1200,
    height: 675,
    crop: "fill",
    quality: "auto",
    format: "auto",
  },
  /** 4:5 detail crop — used on PDP detail images. */
  pdpDetail: {
    width: 800,
    height: 1000,
    crop: "fill",
    quality: "auto",
    format: "auto",
  },
} as const;

/** Build a Cloudinary URL with transformations for a given public ID or URL. */
export function buildCloudinaryUrl(
  src: string,
  options?: {
    width?: number;
    height?: number;
    crop?: string;
    quality?: string;
    format?: string;
  },
): string {
  if (!cloudinaryConfig.cloudName || src.startsWith("http")) return src;

  const {
    width,
    height,
    crop = "fill",
    quality = "auto",
    format = "auto",
  } = options ?? {};
  const parts = [
    `https://res.cloudinary.com/${cloudinaryConfig.cloudName}/image/upload`,
  ];

  const transformations = [`q_${quality}`, `f_${format}`];
  if (width) transformations.push(`w_${width}`);
  if (height) transformations.push(`h_${height}`);
  if (crop) transformations.push(`c_${crop}`);

  parts.push(transformations.join(","));
  parts.push(src);

  return parts.join("/");
}
