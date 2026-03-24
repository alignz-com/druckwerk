"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Check, Plus, Trash2, Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  dataTableContainerClass,
  dataTableHeaderClass,
  dataTableRowClass,
} from "@/components/admin/shared/data-table-styles";
import { useTranslations } from "@/components/providers/locale-provider";

type ApiKeyRow = {
  id: string;
  label: string | null;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
};

export default function BrandApiKeysSection({ brandId }: { brandId: string }) {
  const t = useTranslations("admin.brands");
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [tokenVisible, setTokenVisible] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/brands/${brandId}/api-keys`);
      if (res.ok) setKeys(await res.json());
    } finally {
      setLoading(false);
    }
  }, [brandId]);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await fetch(`/api/admin/brands/${brandId}/api-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newLabel }),
      });
      if (res.ok) {
        const data = await res.json();
        setCreatedToken(data.token);
        setTokenVisible(false);
        setCopied(false);
        setNewLabel("");
        fetchKeys();
      }
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (key: ApiKeyRow) => {
    const res = await fetch(`/api/admin/brands/${brandId}/api-keys`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: key.id, isActive: !key.isActive }),
    });
    if (res.ok) fetchKeys();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/admin/brands/${brandId}/api-keys?id=${deleteId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setDeleteId(null);
        fetchKeys();
      }
    } finally {
      setDeleting(false);
    }
  };

  const copyToken = () => {
    if (!createdToken) return;
    navigator.clipboard.writeText(createdToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("de-AT", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{t("apiKeys.title")}</h2>
          <p className="text-xs text-slate-500">{t("apiKeys.description")}</p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setShowCreateDialog(true);
            setCreatedToken(null);
            setNewLabel("");
          }}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          {t("apiKeys.create")}
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">{t("apiKeys.loading")}</p>
      ) : keys.length === 0 ? (
        <p className="text-sm text-slate-500">{t("apiKeys.empty")}</p>
      ) : (
        <div className={dataTableContainerClass}>
          <Table>
            <TableHeader>
              <TableRow className={dataTableHeaderClass}>
                <TableHead className="w-[200px]">{t("apiKeys.label")}</TableHead>
                <TableHead>{t("apiKeys.status")}</TableHead>
                <TableHead>{t("apiKeys.lastUsed")}</TableHead>
                <TableHead>{t("apiKeys.created")}</TableHead>
                <TableHead className="w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((key) => (
                <TableRow key={key.id} className={dataTableRowClass}>
                  <TableCell className="font-medium">{key.label || "—"}</TableCell>
                  <TableCell>
                    <button
                      onClick={() => handleToggleActive(key)}
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium transition-colors cursor-pointer",
                        key.isActive
                          ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      )}
                    >
                      {key.isActive ? t("apiKeys.active") : t("apiKeys.inactive")}
                    </button>
                  </TableCell>
                  <TableCell className="text-slate-500">
                    {formatDate(key.lastUsedAt)}
                  </TableCell>
                  <TableCell className="text-slate-500">
                    {formatDate(key.createdAt)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-slate-400 hover:text-red-600"
                      onClick={() => setDeleteId(key.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ── Create / Token dialog ── */}
      <Dialog
        open={showCreateDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreateDialog(false);
            setCreatedToken(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          {!createdToken ? (
            <>
              <DialogHeader>
                <DialogTitle>{t("apiKeys.createDialog.title")}</DialogTitle>
                <DialogDescription>{t("apiKeys.createDialog.description")}</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div>
                  <Label htmlFor="api-key-label">{t("apiKeys.label")}</Label>
                  <Input
                    id="api-key-label"
                    placeholder={t("apiKeys.createDialog.labelPlaceholder")}
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  {t("apiKeys.cancel")}
                </Button>
                <LoadingButton loading={creating} onClick={handleCreate}>
                  {t("apiKeys.create")}
                </LoadingButton>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>{t("apiKeys.tokenDialog.title")}</DialogTitle>
                <DialogDescription>{t("apiKeys.tokenDialog.description")}</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-slate-100 px-3 py-2 text-xs font-mono break-all select-all">
                    {tokenVisible ? createdToken : "•".repeat(32)}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => setTokenVisible(!tokenVisible)}
                  >
                    {tokenVisible ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={copyToken}
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => { setShowCreateDialog(false); setCreatedToken(null); }}>
                  {t("apiKeys.tokenDialog.done")}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation dialog ── */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("apiKeys.deleteDialog.title")}</DialogTitle>
            <DialogDescription>{t("apiKeys.deleteDialog.description")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              {t("apiKeys.cancel")}
            </Button>
            <LoadingButton loading={deleting} variant="destructive" onClick={handleDelete}>
              {t("apiKeys.deleteDialog.confirm")}
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
