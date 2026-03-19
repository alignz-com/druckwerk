"use client";

import { useState, useCallback, useRef } from "react";
import { ImagePlus, X } from "lucide-react";
import Image from "next/image";
import type { Feature, FeatureComment } from "@prisma/client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type FeatureWithComments = Feature & { comments: FeatureComment[] };

const STATUSES = ["IDEA", "PLANNED", "READY", "IN_PROGRESS", "DONE", "PARKED"] as const;
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
const CATEGORIES = ["UI", "UX", "BACKEND", "INFRASTRUCTURE", "BUG"] as const;

type Props = {
  onClose: () => void;
  onCreated: (f: FeatureWithComments) => void;
  defaultStatus?: string;
  t: {
    create: {
      title: string;
      description: string;
      fields: Record<string, string>;
      placeholders: Record<string, string>;
      submit: string;
      submitting: string;
      image?: {
        label: string;
        upload: string;
        uploading: string;
        remove: string;
        maxSize: string;
      };
    };
    actions: Record<string, string>;
    status: Record<string, string>;
    priority: Record<string, string>;
    category: Record<string, string>;
  };
};

export function FeatureCreateDialog({ onClose, onCreated, defaultStatus, t }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<string>(defaultStatus ?? "IDEA");
  const [priority, setPriority] = useState<string>("MEDIUM");
  const [category, setCategory] = useState<string>("UX");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleImageUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) { setError(t.create.image?.maxSize ?? "Max 5MB"); return; }
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/features/upload", { method: "POST", body: fd });
      if (!res.ok) throw new Error();
      const { url } = await res.json();
      setImageUrls((prev) => [...prev, url]);
    } catch {
      setError("Image upload failed.");
    } finally {
      setUploading(false);
    }
  }, [t.create.image?.maxSize]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/admin/features", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          imageUrls,
          status,
          priority,
          category,
        }),
      });
      if (!res.ok) throw new Error();
      const { feature } = await res.json();
      onCreated(feature);
    } catch {
      setError("Failed to create feature.");
      setSubmitting(false);
    }
  }, [title, description, imageUrls, status, priority, category, onCreated]);

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t.create.title}</DialogTitle>
          <DialogDescription>{t.create.description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">{t.create.fields.title}</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t.create.placeholders.title}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">{t.create.fields.description}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t.create.placeholders.description}
              rows={3}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 resize-none"
            />
          </div>

          {/* Images */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">{t.create.image?.label ?? "Images"}</label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImageUpload(f);
                if (fileRef.current) fileRef.current.value = "";
              }}
            />
            <div className="flex flex-wrap gap-2">
              {imageUrls.map((url, i) => (
                <div key={url} className="relative inline-block">
                  <Image
                    src={url}
                    alt=""
                    width={120}
                    height={80}
                    className="rounded-lg border border-slate-200 object-cover h-20 w-auto"
                    unoptimized
                  />
                  <button
                    type="button"
                    onClick={() => setImageUrls((prev) => prev.filter((_, j) => j !== i))}
                    className="absolute -top-2 -right-2 rounded-full bg-slate-900 p-0.5 text-white hover:bg-slate-700 transition"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-500 hover:border-slate-400 hover:text-slate-600 transition disabled:opacity-50"
              >
                <ImagePlus className="size-4" />
                {uploading ? (t.create.image?.uploading ?? "Uploading…") : (t.create.image?.upload ?? "Add image")}
              </button>
            </div>
          </div>

          {/* Status / Priority / Category */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">{t.create.fields.status}</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{t.status[s] ?? s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">{t.create.fields.priority}</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{t.priority[p] ?? p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">{t.create.fields.category}</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{t.category[c] ?? c}</option>
                ))}
              </select>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition"
            >
              {t.actions.cancel}
            </button>
            <button
              type="submit"
              disabled={!title.trim() || submitting}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              {submitting ? t.create.submitting : t.create.submit}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
