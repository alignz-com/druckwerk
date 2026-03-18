"use client";

import { useState, useCallback } from "react";
import { formatDistanceToNow } from "date-fns";
import { Trash2, MessageSquare } from "lucide-react";
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
  feature: FeatureWithComments;
  onClose: () => void;
  onUpdated: (f: FeatureWithComments) => void;
  onDeleted: (id: string) => void;
  t: {
    actions: Record<string, string>;
    status: Record<string, string>;
    priority: Record<string, string>;
    category: Record<string, string>;
    create: { fields: Record<string, string> };
    detail: {
      descriptionEmpty: string;
      comments: string;
      commentsEmpty: string;
      commentPlaceholder: string;
      deleteConfirm: string;
    };
  };
};

export function FeatureDetailDialog({ feature, onClose, onUpdated, onDeleted, t }: Props) {
  const [title, setTitle] = useState(feature.title);
  const [description, setDescription] = useState(feature.description ?? "");
  const [status, setStatus] = useState(feature.status);
  const [priority, setPriority] = useState(feature.priority);
  const [category, setCategory] = useState(feature.category);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");

  const dirty =
    title !== feature.title ||
    description !== (feature.description ?? "") ||
    status !== feature.status ||
    priority !== feature.priority ||
    category !== feature.category;

  const handleSave = useCallback(async () => {
    if (!title.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/features/${feature.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), description: description.trim() || null, status, priority, category }),
      });
      if (!res.ok) throw new Error();
      const { feature: updated } = await res.json();
      onUpdated(updated);
    } catch {
      setError("Save failed.");
    } finally {
      setSaving(false);
    }
  }, [feature.id, title, description, status, priority, category, onUpdated]);

  const handleDelete = useCallback(async () => {
    const msg = t.detail.deleteConfirm.replace("{title}", feature.title);
    if (!confirm(msg)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/features/${feature.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      onDeleted(feature.id);
    } catch {
      setError("Delete failed.");
      setDeleting(false);
    }
  }, [feature.id, feature.title, onDeleted, t.detail.deleteConfirm]);

  const handleAddComment = useCallback(async () => {
    if (!commentText.trim()) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/admin/features/${feature.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: commentText.trim() }),
      });
      if (!res.ok) throw new Error();
      // Re-fetch full feature with comments
      const featureRes = await fetch(`/api/admin/features`);
      const { features } = await featureRes.json();
      const updated = features.find((f: Feature) => f.id === feature.id);
      if (updated) onUpdated(updated);
      setCommentText("");
    } catch {
      setError("Failed to post comment.");
    } finally {
      setPosting(false);
    }
  }, [feature.id, commentText, onUpdated]);

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="sr-only">{feature.title}</DialogTitle>
          <DialogDescription className="sr-only">Feature details</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-5 px-1">
          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">{t.create.fields.title}</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </div>

          {/* Status / Priority / Category row */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">{t.create.fields.status}</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Feature["status"])}
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
                onChange={(e) => setPriority(e.target.value as Feature["priority"])}
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
                onChange={(e) => setCategory(e.target.value as Feature["category"])}
                className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{t.category[c] ?? c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">{t.create.fields.description}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 resize-none"
              placeholder={t.detail.descriptionEmpty}
            />
          </div>

          {/* Metadata */}
          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <span>Created {formatDistanceToNow(new Date(feature.createdAt), { addSuffix: true })}</span>
            <span>Updated {formatDistanceToNow(new Date(feature.updatedAt), { addSuffix: true })}</span>
          </div>

          {/* Error */}
          {error && <p className="text-sm text-red-600">{error}</p>}

          {/* Comments */}
          <div className="border-t border-slate-200 pt-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3">
              <MessageSquare className="size-4" />
              {t.detail.comments}
              <span className="text-xs font-normal text-slate-400">({feature.comments.length})</span>
            </h3>

            {feature.comments.length === 0 ? (
              <p className="text-sm text-slate-400 mb-3">{t.detail.commentsEmpty}</p>
            ) : (
              <div className="space-y-3 mb-3 max-h-60 overflow-y-auto">
                {feature.comments.map((c) => (
                  <div key={c.id} className="rounded-lg bg-slate-50 px-3 py-2.5">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-slate-700">{c.author}</span>
                      <span className="text-[10px] text-slate-400">
                        {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 whitespace-pre-wrap">{c.content}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Add comment */}
            <div className="flex gap-2">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && commentText.trim()) {
                    e.preventDefault();
                    handleAddComment();
                  }
                }}
                placeholder={t.detail.commentPlaceholder}
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
              <button
                onClick={handleAddComment}
                disabled={!commentText.trim() || posting}
                className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                {posting ? t.actions.posting : t.actions.addComment}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 pt-4 shrink-0">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition disabled:opacity-40"
          >
            <Trash2 className="size-3.5" />
            {deleting ? t.actions.deleting : t.actions.delete}
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition"
            >
              {t.actions.close}
            </button>
            {dirty && (
              <button
                onClick={handleSave}
                disabled={saving || !title.trim()}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40 transition"
              >
                {saving ? t.actions.saving : t.actions.save}
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
