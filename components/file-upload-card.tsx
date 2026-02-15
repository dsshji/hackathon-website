"use client";

import { useCallback, useState } from "react";
import { Upload, FileText, CheckCircle2, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileUploadCardProps {
  label: string;
  description: string;
  accept?: string;
  onFileUploaded: (fileUrl: string, fileName: string) => void;
  uploadedFileUrl?: string;
  uploadedFileName?: string;
}

export function FileUploadCard({
  label,
  description,
  accept = ".pdf",
  onFileUploaded,
  uploadedFileUrl,
  uploadedFileName,
}: FileUploadCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = useCallback(
    async (file: File) => {
      setIsUploading(true);
      setError(null);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/opus/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Upload failed");
        }

        const data = await res.json();
        onFileUploaded(data.fileUrl, data.fileName);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setIsUploading(false);
      }
    },
    [onFileUploaded]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleUpload(file);
    },
    [handleUpload]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleUpload(file);
    },
    [handleUpload]
  );

  const handleRemove = useCallback(() => {
    onFileUploaded("", "");
    setError(null);
  }, [onFileUploaded]);

  const isUploaded = !!uploadedFileUrl;

  return (
    <div
      className={cn(
        "relative rounded-xl border-2 border-dashed p-5 transition-all duration-200",
        isDragging && "border-accent bg-accent/5 scale-[1.01]",
        isUploaded && "border-solid border-accent/40 bg-accent/5",
        !isDragging && !isUploaded && "border-border bg-card hover:border-muted-foreground/30",
        error && "border-destructive/50 bg-destructive/5"
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <div className="flex items-start gap-4">
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg",
            isUploaded ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground"
          )}
        >
          {isUploading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : isUploaded ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : (
            <FileText className="h-5 w-5" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            {description}
          </p>

          {isUploaded && uploadedFileName && (
            <div className="mt-2 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
                <FileText className="h-3 w-3" />
                {uploadedFileName}
              </span>
              <button
                onClick={handleRemove}
                className="text-muted-foreground hover:text-destructive transition-colors"
                aria-label={`Remove ${uploadedFileName}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {error && (
            <p className="mt-2 text-xs text-destructive">{error}</p>
          )}
        </div>

        {!isUploaded && !isUploading && (
          <label className="shrink-0 cursor-pointer">
            <div className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
              <Upload className="h-3.5 w-3.5" />
              Upload
            </div>
            <input
              type="file"
              accept={accept}
              onChange={handleFileInput}
              className="sr-only"
            />
          </label>
        )}
      </div>
    </div>
  );
}
