"use client";

import { useState, useCallback, useRef } from "react";
import { Upload, Loader2 } from "lucide-react";
import type { AdminFontFamily } from "@/lib/admin/templates-data";
import { cn } from "@/lib/utils";

type Props = {
  familyId: string;
  onUploaded: (family: AdminFontFamily) => void;
  className?: string;
};

const ACCEPTED_EXTENSIONS = [".woff2", ".woff", ".ttf", ".otf"];

/** Map filename keywords to font weight */
const WEIGHT_MAP: Record<string, number> = {
  thin: 100,
  hairline: 100,
  extralight: 200,
  ultralight: 200,
  light: 300,
  regular: 400,
  normal: 400,
  medium: 500,
  semibold: 600,
  demibold: 600,
  bold: 700,
  extrabold: 800,
  ultrabold: 800,
  black: 900,
  heavy: 900,
};

function detectFromFilename(filename: string): { weight: number | null; style: string; format: string } {
  const lower = filename.toLowerCase();
  const ext = lower.slice(lower.lastIndexOf("."));

  // Format from extension
  const formatMap: Record<string, string> = { ".woff2": "woff2", ".woff": "woff", ".ttf": "ttf", ".otf": "otf" };
  const format = formatMap[ext] ?? "ttf";

  // Style: check for "italic" or trailing "i" suffix (e.g. 400i, 700i)
  const style = lower.includes("italic") || /\d+i\./.test(lower) ? "italic" : "normal";

  // Weight: find longest matching keyword in filename
  const nameWithoutExt = lower.replace(ext, "").replace(/[-_.]/g, "");
  let weight: number | null = null;
  let longestMatch = 0;
  for (const [keyword, w] of Object.entries(WEIGHT_MAP)) {
    if (nameWithoutExt.includes(keyword) && keyword.length > longestMatch) {
      weight = w;
      longestMatch = keyword.length;
    }
  }

  // Also check for numeric weight in filename (e.g. "MyFont-400.woff2" or "400i.ttf")
  if (weight === null) {
    const numMatch = lower.match(/(\d{3})i?\./);
    if (numMatch) {
      const parsed = Number(numMatch[1]);
      if (parsed >= 100 && parsed <= 900) weight = parsed;
    }
  }

  return { weight, style, format };
}

export function FontDropZone({ familyId, onUploaded, className }: Props) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(async (file: File) => {
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      setError(`Unsupported format: ${ext}`);
      return;
    }

    setError(null);

    let { weight, style, format } = detectFromFilename(file.name);

    // If weight couldn't be auto-detected, ask the user
    if (weight === null) {
      const input = window.prompt(
        `Could not detect font weight from "${file.name}".\n\nEnter weight (100–900):`,
        "400",
      );
      if (input === null) return; // cancelled
      const parsed = Number(input);
      if (isNaN(parsed) || parsed < 100 || parsed > 900) {
        setError(`Invalid weight: ${input}`);
        return;
      }
      weight = parsed;
    }

    setUploading(true);

    const formData = new FormData();
    formData.append("familyId", familyId);
    formData.append("weight", String(weight));
    formData.append("style", style);
    formData.append("format", format);
    formData.append("file", file);

    try {
      const response = await fetch("/api/admin/fonts/variants", {
        method: "POST",
        body: formData,
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error ?? `Upload failed (${response.status})`);
      }

      if (payload?.family) {
        onUploaded(payload.family as AdminFontFamily);
      }
      setError(null);
    } catch (err) {
      setError(`${file.name}: ${err instanceof Error ? err.message : "Upload failed"}`);
    } finally {
      setUploading(false);
    }
  }, [familyId, onUploaded]);

  const handleFiles = useCallback((files: File[]) => {
    // Upload sequentially
    const uploadAll = async () => {
      for (const file of files) {
        await uploadFile(file);
      }
    };
    uploadAll();
  }, [uploadFile]);

  return (
    <div className={className}>
      <input
        ref={fileRef}
        type="file"
        accept=".woff2,.woff,.ttf,.otf"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) handleFiles(files);
          if (fileRef.current) fileRef.current.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOver(false);
          const files = Array.from(e.dataTransfer.files);
          if (files.length) handleFiles(files);
        }}
        className={cn(
          "w-full flex flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-sm transition-colors",
          dragOver
            ? "border-slate-400 bg-slate-100 text-slate-700"
            : "border-slate-300 bg-white text-slate-500 hover:border-slate-400 hover:text-slate-600",
          uploading && "opacity-60 pointer-events-none",
        )}
      >
        {uploading ? (
          <>
            <Loader2 className="size-5 animate-spin" />
            <span>Uploading…</span>
          </>
        ) : (
          <>
            <Upload className="size-5" />
            <span>Drop font files or click to upload</span>
            <span className="text-xs text-slate-400">WOFF2, WOFF, TTF, OTF — weight &amp; style auto-detected</span>
          </>
        )}
      </button>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  );
}
