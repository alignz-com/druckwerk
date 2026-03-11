"use client";

import { useState } from "react";
import { Settings2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useTranslations } from "@/components/providers/locale-provider";
import { cn } from "@/lib/utils";

type Props = {
  showTooltip?: boolean;
  tooltip?: string;
  hasPassword?: boolean;
};

export default function UserSettingsDialog({ showTooltip = false, tooltip, hasPassword = false }: Props) {
  const [open, setOpen] = useState(false);
  const t = useTranslations();
  const label = tooltip ?? t("layout.settings.open");
  const pt = {
    title:         t("layout.settings.changePassword.title"),
    current:       t("layout.settings.changePassword.current"),
    new:           t("layout.settings.changePassword.new"),
    confirm:       t("layout.settings.changePassword.confirm"),
    submit:        t("layout.settings.changePassword.submit"),
    submitting:    t("layout.settings.changePassword.submitting"),
    success:       t("layout.settings.changePassword.success"),
    errorMismatch: t("layout.settings.changePassword.errorMismatch"),
    errorShort:    t("layout.settings.changePassword.errorShort"),
    errorWrong:    t("layout.settings.changePassword.errorWrong"),
  };

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  const resetPasswordForm = () => {
    setCurrent("");
    setNext("");
    setConfirm("");
    setPwError(null);
    setPwSuccess(false);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(false);

    if (next.length < 8) {
      setPwError(pt.errorShort);
      return;
    }
    if (next !== confirm) {
      setPwError(pt.errorMismatch);
      return;
    }

    setPwSaving(true);
    try {
      const res = await fetch("/api/user/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPwError(data?.error === "Current password is incorrect" ? pt.errorWrong : (data?.error ?? pt.errorWrong));
        return;
      }
      setPwSuccess(true);
      resetPasswordForm();
    } catch {
      setPwError(pt.errorWrong);
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetPasswordForm(); }}>
      <div className={cn("inline-flex", showTooltip && "relative group")}>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-11 w-11 rounded-full text-slate-600 hover:bg-slate-100",
              showTooltip ? "bg-white" : "bg-slate-50",
            )}
            aria-label={label}
            title={showTooltip ? undefined : label}
          >
            <Settings2 className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        {showTooltip ? (
          <span
            role="tooltip"
            aria-hidden="true"
            className="pointer-events-none absolute left-full top-1/2 z-10 ml-3 -translate-y-1/2 translate-x-2 transform rounded-xl bg-slate-900 px-3 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition group-hover:translate-x-0 group-hover:opacity-100 group-hover:delay-100 group-focus-within:translate-x-0 group-focus-within:opacity-100"
          >
            {label}
          </span>
        ) : null}
      </div>
      <DialogContent className="w-[340px] rounded-2xl">
        <DialogHeader>
          <DialogTitle>{t("layout.settings.title")}</DialogTitle>
          <DialogDescription>{t("layout.settings.description")}</DialogDescription>
        </DialogHeader>

        <LanguageSwitcher onChanged={() => setOpen(false)} />

        {hasPassword ? (
          <>
            <Separator />
            <form onSubmit={handlePasswordSubmit} className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{pt.title}</p>
              <div className="space-y-1.5">
                <Label htmlFor="pw-current">{pt.current}</Label>
                <Input
                  id="pw-current"
                  type="password"
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pw-new">{pt.new}</Label>
                <Input
                  id="pw-new"
                  type="password"
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={8}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pw-confirm">{pt.confirm}</Label>
                <Input
                  id="pw-confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>
              {pwError ? <p className="text-xs text-red-600">{pwError}</p> : null}
              {pwSuccess ? <p className="text-xs text-emerald-600">{pt.success}</p> : null}
              <Button type="submit" className="w-full" disabled={pwSaving || !current || !next || !confirm}>
                {pwSaving ? pt.submitting : pt.submit}
              </Button>
            </form>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
