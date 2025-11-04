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

export default function UserSettingsDialog() {
  const [open, setOpen] = useState(false);
  const t = useTranslations();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 rounded-full border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
          aria-label={t("layout.settings.open")}
          title={t("layout.settings.open")}
        >
          <Settings2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
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
