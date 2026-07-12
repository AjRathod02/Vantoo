"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { GripVertical, ImagePlus, Star, Trash2, Video } from "lucide-react";
import { MEDIA_SPECS } from "@/lib/admin/product-attributes";
import { toast } from "@/lib/stores/toast";
import { cn } from "@/lib/utils";

export type MediaItem = {
  id: string;
  url: string;
  type: "image" | "video";
  name?: string;
};

interface AdminMediaUploaderProps {
  images: MediaItem[];
  videos: MediaItem[];
  thumbnailId?: string;
  onImagesChange: (items: MediaItem[]) => void;
  onVideosChange: (items: MediaItem[]) => void;
  onThumbnailChange: (id: string) => void;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function AdminMediaUploader({
  images,
  videos,
  thumbnailId,
  onImagesChange,
  onVideosChange,
  onThumbnailChange,
}: AdminMediaUploaderProps) {
  const [dragOver, setDragOver] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const thumb = thumbnailId || images[0]?.id;

  const processFiles = useCallback(
    async (files: FileList | File[], kind: "image" | "video" | "auto") => {
      const list = Array.from(files);
      const nextImages = [...images];
      const nextVideos = [...videos];

      for (const file of list) {
        const isImage = file.type.startsWith("image/");
        const isVideo = file.type.startsWith("video/");
        const wantImage = kind === "image" || (kind === "auto" && isImage);
        const wantVideo = kind === "video" || (kind === "auto" && isVideo);

        if (wantImage) {
          if (!MEDIA_SPECS.image.accept.split(",").includes(file.type) && !isImage) {
            toast.error(`${file.name}: use JPG, PNG, or WebP`);
            continue;
          }
          if (file.size > MEDIA_SPECS.image.maxSizeMb * 1024 * 1024) {
            toast.error(`${file.name}: max ${MEDIA_SPECS.image.maxSizeMb} MB`);
            continue;
          }
          const url = await readFileAsDataUrl(file);
          nextImages.push({
            id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            url,
            type: "image",
            name: file.name,
          });
        } else if (wantVideo) {
          if (file.type !== "video/mp4" && !isVideo) {
            toast.error(`${file.name}: use MP4 (16:9, 1080p)`);
            continue;
          }
          if (file.size > MEDIA_SPECS.video.maxSizeMb * 1024 * 1024) {
            toast.error(`${file.name}: max ${MEDIA_SPECS.video.maxSizeMb} MB`);
            continue;
          }
          const url = await readFileAsDataUrl(file);
          nextVideos.push({
            id: `vid-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            url,
            type: "video",
            name: file.name,
          });
        } else {
          toast.error(`${file.name}: unsupported file type`);
        }
      }

      onImagesChange(nextImages);
      onVideosChange(nextVideos);
      if (!thumbnailId && nextImages[0]) onThumbnailChange(nextImages[0].id);
      toast.success("Media added");
    },
    [images, videos, onImagesChange, onVideosChange, onThumbnailChange, thumbnailId]
  );

  const reorder = (from: number, to: number) => {
    if (to < 0 || to >= images.length) return;
    const next = [...images];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onImagesChange(next);
  };

  const specs = useMemo(
    () => (
      <p className="text-xs text-ink-muted">
        Images: {MEDIA_SPECS.image.aspectRatio}, {MEDIA_SPECS.image.recommendedSize} (
        {MEDIA_SPECS.image.formats.join(", ")}). Videos: {MEDIA_SPECS.video.aspectRatio},{" "}
        {MEDIA_SPECS.video.recommendedSize} ({MEDIA_SPECS.video.formats.join(", ")}).
      </p>
    ),
    []
  );

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.length) processFiles(e.dataTransfer.files, "auto");
        }}
        className={cn(
          "flex min-h-[11rem] flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-8 transition-colors",
          dragOver
            ? "border-brand-primary bg-brand-primary/5"
            : "border-gray-200 bg-gray-50"
        )}
      >
        <ImagePlus className="mb-2 h-8 w-8 text-ink-soft" aria-hidden />
        <p className="text-center text-sm font-medium text-ink">
          <span className="hidden sm:inline">Drag & drop images or videos</span>
          <span className="sm:hidden">Upload images or videos</span>
        </p>
        {specs}
        <div className="mt-4 flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            className="min-h-11 rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
          >
            Add images
          </button>
          <button
            type="button"
            onClick={() => videoInputRef.current?.click()}
            className="min-h-11 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
          >
            Add videos
          </button>
        </div>
        <input
          ref={imageInputRef}
          type="file"
          accept={MEDIA_SPECS.image.accept}
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) processFiles(e.target.files, "image");
            e.target.value = "";
          }}
        />
        <input
          ref={videoInputRef}
          type="file"
          accept={MEDIA_SPECS.video.accept}
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) processFiles(e.target.files, "video");
            e.target.value = "";
          }}
        />
      </div>

      {images.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium text-ink">
            Images ({images.length}) — drag to reorder, star for thumbnail
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {images.map((img, index) => (
              <div
                key={img.id}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragIndex !== null) reorder(dragIndex, index);
                  setDragIndex(null);
                }}
                className={cn(
                  "group relative aspect-square overflow-hidden rounded-xl border bg-gray-100",
                  thumb === img.id ? "border-brand-primary ring-2 ring-brand-primary/30" : "border-gray-200"
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={img.name ?? ""} className="h-full w-full object-cover" />
                <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/50 to-transparent p-1.5">
                  <GripVertical className="h-4 w-4 text-white/80" />
                  <div className="flex gap-1">
                    <button
                      type="button"
                      title="Set as thumbnail"
                      aria-label="Set as thumbnail"
                      onClick={() => onThumbnailChange(img.id)}
                      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md bg-white/90"
                    >
                      <Star
                        className={cn(
                          "h-4 w-4",
                          thumb === img.id ? "fill-amber-400 text-amber-400" : "text-ink-muted"
                        )}
                      />
                    </button>
                    <button
                      type="button"
                      title="Remove"
                      aria-label="Remove image"
                      onClick={() => {
                        const next = images.filter((i) => i.id !== img.id);
                        onImagesChange(next);
                        if (thumb === img.id && next[0]) onThumbnailChange(next[0].id);
                      }}
                      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md bg-white/90 text-brand-secondary"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {videos.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium text-ink">Videos ({videos.length})</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {videos.map((vid) => (
              <div
                key={vid.id}
                className="relative overflow-hidden rounded-xl border border-gray-200 bg-black"
              >
                <video src={vid.url} controls className="aspect-video w-full" />
                <button
                  type="button"
                  onClick={() => onVideosChange(videos.filter((v) => v.id !== vid.id))}
                  className="absolute right-2 top-2 rounded-md bg-white/90 p-1.5 text-brand-secondary"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-md bg-black/60 px-2 py-0.5 text-xs text-white">
                  <Video className="h-3 w-3" /> {vid.name ?? "Video"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
