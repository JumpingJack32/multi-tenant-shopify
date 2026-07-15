"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import {
  Trash2Icon,
  UploadIcon,
  PlayIcon,
  FileVideoIcon,
} from "@repo/ui/icons";

export interface MediaItem {
  id: string;
  file: File;
  preview: string;
  type: "image" | "video";
}

interface MediaDropzoneProps {
  value: MediaItem[];
  onChange: (items: MediaItem[]) => void;
  disabled?: boolean;
  maxFiles?: number;
  maxSizeMB?: number;
}

let counter = 0;

function classify(file: File): "image" | "video" {
  return file.type.startsWith("video/") ? "video" : "image";
}

function VideoPreview({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    let cancelled = false;

    const capture = () => {
      if (cancelled || !video || !canvas) return;
      canvas.width = video.videoWidth || 320;
      canvas.height = video.videoHeight || 240;
      canvas
        .getContext("2d")
        ?.drawImage(video, 0, 0, canvas.width, canvas.height);
      if (!cancelled) {
        setThumbnail(canvas.toDataURL("image/jpeg", 0.6));
      }
    };

    const handleLoaded = () => {
      video.currentTime = 0.5;
    };

    const handleSeeked = () => {
      capture();
    };

    video.addEventListener("loadeddata", handleLoaded);
    video.addEventListener("seeked", handleSeeked);

    if (video.readyState >= 2) {
      handleLoaded();
    }

    return () => {
      cancelled = true;
      video.removeEventListener("loadeddata", handleLoaded);
      video.removeEventListener("seeked", handleSeeked);
    };
  }, [src]);

  return (
    <>
      <video
        ref={videoRef}
        src={src}
        preload="metadata"
        muted
        className="hidden"
      />
      <canvas ref={canvasRef} className="hidden" />
      {thumbnail ? (
        <img src={thumbnail} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-muted">
          <FileVideoIcon className="h-8 w-8 text-muted-foreground/40" />
        </div>
      )}
    </>
  );
}

export function MediaDropzone({
  value,
  onChange,
  disabled = false,
  maxFiles = 20,
  maxSizeMB = 100,
}: MediaDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const maxBytes = maxSizeMB * 1024 * 1024;
  const [rejectReason, setRejectReason] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      value.forEach((m) => URL.revokeObjectURL(m.preview));
    };
  }, []);

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const incoming = Array.from(files);
      const remaining = maxFiles - value.length;

      if (remaining <= 0) {
        setRejectReason(`Max ${maxFiles} files`);
        setTimeout(() => setRejectReason(null), 2500);
        return;
      }

      const valid = incoming.slice(0, remaining).filter((f) => {
        if (f.size > maxBytes) {
          setRejectReason(`${f.name} exceeds ${maxSizeMB}MB`);
          setTimeout(() => setRejectReason(null), 2500);
          return false;
        }
        return true;
      });

      if (!valid.length) return;

      const items: MediaItem[] = valid.map((file) => ({
        id: `media-${++counter}`,
        file,
        preview: URL.createObjectURL(file),
        type: classify(file),
      }));

      onChange([...value, ...items]);
    },
    [value, onChange, maxFiles, maxBytes, maxSizeMB],
  );

  const remove = useCallback(
    (id: string) => {
      const item = value.find((m) => m.id === id);
      if (item) URL.revokeObjectURL(item.preview);
      onChange(value.filter((m) => m.id !== id));
    },
    [value, onChange],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (disabled) return;
      addFiles(e.dataTransfer.files);
    },
    [addFiles, disabled],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragOver(false), []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.length) {
        addFiles(e.target.files);
        e.target.value = "";
      }
    },
    [addFiles],
  );

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
          dragOver
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50"
        } ${disabled ? "pointer-events-none opacity-50" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,video/*"
          onChange={handleInputChange}
          className="hidden"
        />
        <UploadIcon className="mb-2 h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-primary">Click to browse</span> or
          drag and drop
        </p>
        <p className="text-xs text-muted-foreground/60">
          Images &middot; Videos &middot; Up to {maxSizeMB}MB each
        </p>
        {rejectReason && (
          <p className="mt-1 text-xs text-destructive">{rejectReason}</p>
        )}
      </div>

      {/* Preview grid */}
      {value.length > 0 && (
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-5 md:grid-cols-6">
          {value.map((item) => (
            <div
              key={item.id}
              className="group relative aspect-[4/5] overflow-hidden rounded-lg border bg-black"
            >
              {item.type === "video" ? (
                <>
                  <VideoPreview src={item.preview} />
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <PlayIcon className="h-8 w-8 text-white/80 drop-shadow-lg" />
                  </div>
                </>
              ) : (
                <img
                  src={item.preview}
                  alt=""
                  className="h-full w-full object-cover"
                />
              )}
              <button
                type="button"
                onClick={() => remove(item.id)}
                disabled={disabled}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity hover:bg-destructive group-hover:opacity-100 disabled:hidden"
                title="Remove"
              >
                <Trash2Icon className="h-3.5 w-3.5" />
              </button>
              <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white/80">
                {item.type === "video" ? "VIDEO" : "IMG"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
