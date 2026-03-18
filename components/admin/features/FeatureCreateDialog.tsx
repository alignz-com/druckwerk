"use client";

import { useState, useCallback } from "react";
import type { Feature, FeatureComment } from "@prisma/client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type FeatureWithComments = Feature & { comments: FeatureComment[] };

const STATUSES = ["IDEA", "PLANNED", "IN_PROGRESS", "DONE", "PARKED"] as const;
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
const CATEGORIES = ["UI", "BACKEND", "INFRASTRUCTURE", "BUG", "IDEA"] as const;

type Props = {
  onClose: () => void;
  onCreated: (f: FeatureWithComments) => void;
  t: {
    create: {
      title: string;
      description: string;
      fields: Record<string, string>;
      placeholders: Record<string, string>;
      submit: string;
      submitting: string;
    };
    actions: Record<string, string>;
    status: Record<string, string>;
    priority: Record<string, string>;
    category: Record<string, string>;
  };
};

export function FeatureCreateDialog({ onClose, onCreated, t }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<string>("IDEA");
  const [priority, setPriority] = useState<string>("MEDIUM");
  const [category, setCategory] = useState<string>("IDEA");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

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
  }, [title, description, status, priority, category, onCreated]);

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
