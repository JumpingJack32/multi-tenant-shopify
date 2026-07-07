"use client";

import Image from "next/image";
import { CldUploadWidget } from "next-cloudinary";
import { useState } from "react";

interface ManagedImage {
  id: string;
  url: string;
  alt_text: string | null;
  sort_order: number;
}

interface ImageManagerProps {
  productId: string;
  images: ManagedImage[];
  onImagesChange: (images: ManagedImage[]) => void;
}

export function ImageManager({
  productId,
  images: initialImages,
  onImagesChange,
}: ImageManagerProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [images, setImages] = useState(initialImages);

  const updateImages = (newImages: ManagedImage[]) => {
    setImages(newImages);
    onImagesChange(newImages);
  };

  const handleUploadSuccess = async (result: any) => {
    setIsUploading(true);
    try {
      const publicId = result?.info?.public_id;
      if (!publicId) return;

      const res = await fetch(`/api/v1/products/${productId}/images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: publicId,
          alt_text: "",
          sort_order: images.length,
        }),
      });
      if (!res.ok) throw new Error("Failed to save image");
      const newImage = await res.json();
      updateImages([...images, newImage]);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (imageId: string) => {
    const res = await fetch(`/api/v1/product-images/${imageId}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete image");
    updateImages(images.filter((img) => img.id !== imageId));
  };

  const handleAltTextChange = async (imageId: string, altText: string) => {
    const res = await fetch(`/api/v1/product-images/${imageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alt_text: altText }),
    });
    if (!res.ok) throw new Error("Failed to update alt text");
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        {images
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((image) => (
            <div
              key={image.id}
              className="group relative aspect-[4/5] overflow-hidden bg-black"
            >
              <Image
                src={`https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload/w_400,q_auto,f_auto/${image.url}`}
                alt={image.alt_text ?? ""}
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/60 p-2 opacity-0 transition-opacity group-hover:opacity-100">
                <input
                  type="text"
                  defaultValue={image.alt_text ?? ""}
                  placeholder="Alt text"
                  onBlur={(e) => handleAltTextChange(image.id, e.target.value)}
                  className="w-full rounded bg-white/90 px-2 py-1 text-xs text-black"
                />
                <button
                  onClick={() => handleDelete(image.id)}
                  className="ml-1 rounded bg-red-600 px-2 py-1 text-xs text-white"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
      </div>
      <CldUploadWidget
        uploadPreset="ml_default"
        signatureEndpoint="/api/v1/cloudinary/signature"
        onSuccess={handleUploadSuccess}
      >
        {({ open }) => (
          <button
            type="button"
            disabled={isUploading}
            onClick={() => open()}
            className="rounded border border-dashed px-4 py-2 text-sm disabled:opacity-50"
          >
            {isUploading ? "Uploading..." : "Add Image"}
          </button>
        )}
      </CldUploadWidget>
    </div>
  );
}
