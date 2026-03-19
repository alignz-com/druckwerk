"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useTranslations } from "@/components/providers/locale-provider";

type Props = {
  hasPassword: boolean;
};

export default function SettingsPageContent({ hasPassword }: Props) {
  const t = useTranslations();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(() => {
    if (!pwSuccess) return;
    const timer = setTimeout(() => setPwSuccess(false), 4000);
    return () => clearTimeout(timer);
  }, [pwSuccess]);

  const reset = () => {
    setCurrent(""); setNext(""); setConfirm("");
    setPwError(null); setPwSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    if (next.length < 8) { setPwError(t("layout.settings.changePassword.errorShort")); return; }
    if (next !== confirm) { setPwError(t("layout.settings.changePassword.errorMismatch")); return; }
    setPwSaving(true);
    try {
      const res = await fetch("/api/user/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPwError(data?.error === "Current password is incorrect"
          ? t("layout.settings.changePassword.errorWrong")
          : (data?.error ?? t("layout.settings.changePassword.errorWrong")));
        return;
      }
      reset();
      setPwSuccess(true);
    } catch {
      setPwError(t("layout.settings.changePassword.errorWrong"));
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div className="space-y-8 max-w-sm">
      {/* Language */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          {t("language.label")}
        </h2>
        <LanguageSwitcher />
      </div>

      {/* Password */}
      {hasPassword ? (
        <>
          <Separator />
          <div className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              {t("layout.settings.changePassword.title")}
            </h2>
            {pwSuccess ? (
              <div className="flex items-center gap-3 text-emerald-600">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <p className="text-sm font-medium">{t("layout.settings.changePassword.success")}</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="pw-current">{t("layout.settings.changePassword.current")}</Label>
                  <Input id="pw-current" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pw-new">{t("layout.settings.changePassword.new")}</Label>
                  <Input id="pw-new" type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" required minLength={8} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pw-confirm">{t("layout.settings.changePassword.confirm")}</Label>
                  <Input id="pw-confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
                </div>
                {pwError ? <p className="text-xs text-red-600">{pwError}</p> : null}
                <LoadingButton type="submit" className="w-full" disabled={!current || !next || !confirm} loading={pwSaving} loadingText={t("layout.settings.changePassword.submitting")} minWidthClassName="min-w-[140px]">
                  {t("layout.settings.changePassword.submit")}
                </LoadingButton>
              </form>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
