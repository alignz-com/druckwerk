"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Search } from "lucide-react";
import { ClipboardCheck, ClipboardList, LayoutTemplate, Layers, Package, PlusCircle, Ruler, ShieldCheck, Sparkles, Type, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  group: string;
  iconKey: string;
  keywords?: string[];
};

type Props = {
  items: NavItem[];
  placeholder: string;
  noResultsLabel: string;
};

export function CommandPalette({ items, placeholder, noResultsLabel }: Props) {
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

  const groups = Array.from(new Set(items.map((i) => i.group)));

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
      onClick={() => setOpen(false)}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" aria-hidden="true" />

      {/* Panel */}
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

          <Command.List className="max-h-72 overflow-y-auto py-2">
            <Command.Empty className="py-8 text-center text-sm text-slate-400">
              {noResultsLabel}
            </Command.Empty>

            {groups.map((group) => (
              <Command.Group
                key={group}
                heading={group}
                className={cn(
                  "[&_[cmdk-group-heading]]:px-4 [&_[cmdk-group-heading]]:py-1.5",
                  "[&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold",
                  "[&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide",
                  "[&_[cmdk-group-heading]]:text-slate-400",
                )}
              >
                {items.filter((i) => i.group === group).map((item) => {
                  const Icon = NAV_ICONS[item.iconKey];
                  return (
                    <Command.Item
                      key={item.href}
                      value={[item.label, ...(item.keywords ?? [])].join(" ")}
                      onSelect={() => navigate(item.href)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-2.5 cursor-pointer text-sm text-slate-700",
                        "data-[selected=true]:bg-slate-900 data-[selected=true]:text-white",
                        "transition-colors",
                      )}
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

// Icon map — same as SidebarNav
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
};
