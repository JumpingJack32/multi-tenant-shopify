import { createImageUpload } from "novel";

const onUpload = (file: File) => {
  const promise = fetch("/api/upload", {
    method: "POST",
    headers: {
      "content-type": file?.type || "application/octet-stream",
      "x-vercel-filename": file?.name || "image.png",
    },
    body: file,
  });

  return new Promise((resolve) => {
    promise
      .then(async (res) => {
        if (res.status === 200) {
          const { url } = (await res.json()) as any;
          const image = new Image();
          image.src = url;
          image.onload = () => resolve(url);
        } else {
          resolve(file);
        }
      })
      .catch(() => resolve(file));
  });
};

export const uploadFn: any = createImageUpload({
  onUpload,
  validateFn: (file: File) => {
    if (!file.type.includes("image/")) return false;
    if (file.size / 1024 / 1024 > 20) return false;
    return true;
  },
});
