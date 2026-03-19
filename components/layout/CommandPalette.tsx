"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Search } from "lucide-react";
import { ClipboardCheck, ClipboardList, LayoutTemplate, Layers, Lightbulb, Package, PlusCircle, Ruler, ShieldCheck, Sparkles, Type, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type CmdItem = {
  href: string;
  label: string;
  group: string;
  iconKey: string;
  keywords?: string[];
};

type Props = {
  items: CmdItem[];
  actions: CmdItem[];
  placeholder: string;
  noResultsLabel: string;
};

const GROUP_CLASS = cn(
  "[&_[cmdk-group-heading]]:px-4 [&_[cmdk-group-heading]]:py-1.5",
  "[&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold",
  "[&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide",
  "[&_[cmdk-group-heading]]:text-slate-400",
);

const ITEM_CLASS = cn(
  "flex items-center gap-3 px-4 py-2.5 cursor-pointer text-sm text-slate-700",
  "data-[selected=true]:bg-slate-900 data-[selected=true]:text-white",
  "transition-colors",
);

export function CommandPalette({ items, actions, placeholder, noResultsLabel }: Props) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const navigate = useCallback((href: string) => {
    setOpen(false);
    router.push(href);
  }, [router]);

  if (!open) return null;

  const navGroups = Array.from(new Set(items.map((i) => i.group)));
  const actionGroups = Array.from(new Set(actions.map((i) => i.group)));

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
      onClick={() => setOpen(false)}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" aria-hidden="true" />

      <div
        className="relative w-full max-w-md mx-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <Command>
          <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <Command.Input
              autoFocus
              placeholder={placeholder}
              className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none"
            />
            <kbd className="hidden sm:flex items-center gap-0.5 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
              <span>⌘</span><span>K</span>
            </kbd>
          </div>

          <Command.List className="max-h-80 overflow-y-auto py-2">
            <Command.Empty className="py-8 text-center text-sm text-slate-400">
              {noResultsLabel}
            </Command.Empty>

            {/* Actions group */}
            {actions.length > 0 && actionGroups.map((group) => (
              <Command.Group key={`actions-${group}`} heading={group} className={GROUP_CLASS}>
                {actions.filter((i) => i.group === group).map((item) => {
                  const Icon = NAV_ICONS[item.iconKey];
                  return (
                    <Command.Item
                      key={`action-${item.href}`}
                      value={`action:${item.href} ${[item.label, ...(item.keywords ?? [])].join(" ")}`}
                      onSelect={() => navigate(item.href)}
                      className={ITEM_CLASS}
                    >
                      {Icon ? <Icon className="h-4 w-4 shrink-0 opacity-60" /> : null}
                      <span>{item.label}</span>
                    </Command.Item>
                  );
                })}
              </Command.Group>
            ))}

            {/* Navigation groups */}
            {navGroups.map((group) => (
              <Command.Group key={`nav-${group}`} heading={group} className={GROUP_CLASS}>
                {items.filter((i) => i.group === group).map((item) => {
                  const Icon = NAV_ICONS[item.iconKey];
                  return (
                    <Command.Item
                      key={`nav-${item.href}`}
                      value={`nav:${item.href} ${[item.label, ...(item.keywords ?? [])].join(" ")}`}
                      onSelect={() => navigate(item.href)}
                      className={ITEM_CLASS}
                    >
                      {Icon ? <Icon className="h-4 w-4 shrink-0 opacity-60" /> : null}
                      <span>{item.label}</span>
                    </Command.Item>
                  );
                })}
              </Command.Group>
            ))}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}

export const NAV_ICONS: Record<string, LucideIcon> = {
  orders: ClipboardList,
  "new-order": PlusCircle,
  deliveries: ClipboardCheck,
  "admin-brands": ShieldCheck,
  "admin-users": Users,
  "admin-products": Package,
  "admin-formats": Ruler,
  "admin-finishes": Sparkles,
  "admin-papers": Layers,
  "admin-templates": LayoutTemplate,
  "admin-fonts": Type,
  "admin-features": Lightbulb,
};
