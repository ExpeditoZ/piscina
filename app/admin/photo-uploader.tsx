"use client";

import { useState, useRef, useCallback } from "react";
import {
  Upload,
  X,
  ImagePlus,
  Loader2,
  GripVertical,
  FileImage,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import imageCompression from "browser-image-compression";
import { createClient } from "@/lib/supabase/client";
import { deletePoolPhoto } from "./actions";

interface PhotoUploaderProps {
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  poolId?: string;
}

interface UploadingFile {
  id: string;
  name: string;
  progress: number;
  status: "compressing" | "uploading" | "done" | "error";
  originalSize: number;
  compressedSize?: number;
}

export function PhotoUploader({ photos, onPhotosChange, poolId }: PhotoUploaderProps) {
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateFileStatus = useCallback(
    (id: string, updates: Partial<UploadingFile>) => {
      setUploadingFiles((prev) =>
        prev.map((f) => (f.id === id ? { ...f, ...updates } : f))
      );
    },
    []
  );

  async function compressAndUpload(file: File, fileId: string) {
    try {
      // Phase 1: Compress in browser
      updateFileStatus(fileId, { status: "compressing", progress: 20 });

      const options = {
        maxSizeMB: 0.15, // 150KB
        maxWidthOrHeight: 1200,
        useWebWorker: true,
        fileType: "image/webp" as const,
        initialQuality: 0.8,
      };

      const compressedBlob = await imageCompression(file, options);
      const compressedSize = compressedBlob.size;

      updateFileStatus(fileId, {
        status: "uploading",
        progress: 60,
        compressedSize,
      });

      // Phase 2: Upload to Supabase Storage
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Não autenticado");
      }

      const fileName = `${user.id}/${crypto.randomUUID()}.webp`;

      const { error: uploadError } = await supabase.storage
        .from("pool-photos")
        .upload(fileName, compressedBlob, {
          contentType: "image/webp",
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("pool-photos")
        .getPublicUrl(fileName);

      updateFileStatus(fileId, { status: "done", progress: 100 });

      return urlData.publicUrl;
    } catch (error) {
      updateFileStatus(fileId, { status: "error", progress: 0 });
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      toast.error(`Erro ao enviar ${file.name}: ${message}`);
      return null;
    }
  }

  async function handleFiles(files: FileList | File[]) {
    const fileArray = Array.from(files);

    if (photos.length + fileArray.length > 10) {
      toast.error("Máximo de 10 fotos permitidas.");
      return;
    }

    // Create upload tracking entries
    const newUploading: UploadingFile[] = fileArray.map((f) => ({
      id: crypto.randomUUID(),
      name: f.name,
      progress: 0,
      status: "compressing" as const,
      originalSize: f.size,
    }));

    setUploadingFiles((prev) => [...prev, ...newUploading]);

    // Process all files in parallel
    const results = await Promise.all(
      fileArray.map((file, index) =>
        compressAndUpload(file, newUploading[index].id)
      )
    );

    // Filter successful uploads and add to photos
    const newUrls = results.filter((url): url is string => url !== null);

    if (newUrls.length > 0) {
      onPhotosChange([...photos, ...newUrls]);
      toast.success(
        `${newUrls.length} foto${newUrls.length > 1 ? "s" : ""} enviada${newUrls.length > 1 ? "s" : ""} com sucesso!`
      );
    }

    // Clean up completed uploads after a delay
    setTimeout(() => {
      setUploadingFiles((prev) =>
        prev.filter((f) => f.status !== "done" && f.status !== "error")
      );
    }, 2000);
  }

  async function handleRemovePhoto(index: number) {
    const url = photos[index];

    // Try to delete from storage
    const result = await deletePoolPhoto(url);
    if (result.error) {
      toast.error(result.error);
    }

    // Remove from local state regardless
    const updated = photos.filter((_, i) => i !== index);
    onPhotosChange(updated);
    toast.success("Foto removida.");
  }

  // Drag and drop reorder
  function handleDragStart(index: number) {
    setDragIndex(index);
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;

    const updated = [...photos];
    const draggedItem = updated[dragIndex];
    updated.splice(dragIndex, 1);
    updated.splice(index, 0, draggedItem);
    onPhotosChange(updated);
    setDragIndex(index);
  }

  function handleDragEnd() {
    setDragIndex(null);
  }

  // File drop zone
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }

  return (
    <div className="space-y-4">
      {/* Photo Grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {photos.map((url, index) => (
            <div
              key={url}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className={`relative aspect-square rounded-xl overflow-hidden group cursor-move border-2 transition-all duration-200 ${
                dragIndex === index
                  ? "border-sky-400 opacity-50 scale-95"
                  : "border-transparent hover:border-sky-200"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Foto ${index + 1}`}
                className="w-full h-full object-cover"
              />

              {/* Overlay on hover */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-200 flex items-center justify-center">
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <GripVertical className="h-4 w-4 text-white/80" />
                </div>
              </div>

              {/* Delete button */}
              <button
                type="button"
                onClick={() => handleRemovePhoto(index)}
                className="absolute top-1.5 right-1.5 p-1 rounded-full bg-red-500/90 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-lg"
              >
                <X className="h-3 w-3" />
              </button>

              {/* Position badge */}
              {index === 0 && (
                <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-500 text-white shadow">
                  Capa
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload Progress */}
      {uploadingFiles.length > 0 && (
        <div className="space-y-2">
          {uploadingFiles.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100"
            >
              <FileImage className="h-4 w-4 text-slate-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-600 truncate">{file.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        file.status === "error"
                          ? "bg-red-400"
                          : file.status === "done"
                            ? "bg-emerald-400"
                            : "bg-sky-400"
                      }`}
                      style={{ width: `${file.progress}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 flex-shrink-0">
                    {file.status === "compressing" && "Comprimindo..."}
                    {file.status === "uploading" && "Enviando..."}
                    {file.status === "done" && (
                      <span className="text-emerald-500">
                        ✓ {formatSize(file.originalSize)} → {formatSize(file.compressedSize ?? 0)}
                      </span>
                    )}
                    {file.status === "error" && (
                      <span className="text-red-500">Erro</span>
                    )}
                  </span>
                </div>
              </div>
              {file.status === "compressing" || file.status === "uploading" ? (
                <Loader2 className="h-4 w-4 animate-spin text-sky-400 flex-shrink-0" />
              ) : null}
            </div>
          ))}
        </div>
      )}

      {/* Drop Zone / Upload Button */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-all duration-200 ${
          dragOver
            ? "border-sky-400 bg-sky-50"
            : "border-slate-200 hover:border-sky-300 hover:bg-sky-50/30"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/heic"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFiles(e.target.files);
              e.target.value = ""; // Reset input
            }
          }}
          className="hidden"
        />

        <div className="flex flex-col items-center gap-2">
          {dragOver ? (
            <Upload className="h-8 w-8 text-sky-400 animate-bounce" />
          ) : (
            <ImagePlus className="h-8 w-8 text-slate-300" />
          )}
          <div>
            <p className="text-sm text-slate-500">
              {dragOver ? (
                "Solte as imagens aqui"
              ) : (
                <>
                  Arraste imagens aqui ou{" "}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-sky-500 hover:text-sky-600 font-medium underline underline-offset-2"
                  >
                    escolha arquivos
                  </button>
                </>
              )}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              JPG, PNG, WebP ou HEIC • Máx. 10 fotos • Compressão automática ≤ 150KB
            </p>
          </div>
        </div>
      </div>

      {/* Info */}
      {photos.length > 0 && (
        <p className="text-xs text-slate-400 text-center">
          {photos.length}/10 fotos • Arraste para reordenar • A primeira foto é a capa do anúncio
        </p>
      )}
    </div>
  );
}
