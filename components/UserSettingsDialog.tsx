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
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useTranslations } from "@/components/providers/locale-provider";
import { cn } from "@/lib/utils";

type Props = {
  showTooltip?: boolean;
  tooltip?: string;
};

export default function UserSettingsDialog({ showTooltip = false, tooltip }: Props) {
  const [open, setOpen] = useState(false);
  const t = useTranslations();
  const label = tooltip ?? t("layout.settings.open");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div
        className={cn(
          "inline-flex",
          showTooltip && "relative group",
        )}
      >
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 rounded-full border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
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
      <DialogContent className="w-[320px] rounded-2xl">
        <DialogHeader>
          <DialogTitle>{t("layout.settings.title")}</DialogTitle>
          <DialogDescription>{t("layout.settings.description")}</DialogDescription>
        </DialogHeader>
        <LanguageSwitcher onChanged={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
