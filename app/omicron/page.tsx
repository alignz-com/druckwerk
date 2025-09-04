"use client";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { IdCard, ShoppingBag, LogOut, ChevronRight, UploadCloud, QrCode, CheckCircle } from "lucide-react";

// Single-file previewable component for a Next.js + shadcn/ui app.
// Drop this into /app/omicron/page.tsx or any route and it will render.

const navItems = [
  { key: "details", label: "Personal details", icon: IdCard },
  { key: "orders", label: "Orders", icon: ShoppingBag },
] as const;

type NavKey = typeof navItems[number]["key"];

export default function OmicronInterface() {
  const [active, setActive] = useState<NavKey>("details");

  return (
    <div className="min-h-screen w-full bg-muted/20 text-slate-900">
      <div className="mx-auto flex max-w-[1400px] gap-0 p-0 md:gap-6 md:p-6">
        {/* Sidebar */}
        <aside className="sticky top-0 hidden h-[100dvh] w-72 shrink-0 flex-col justify-between border-r bg-white md:flex rounded-2xl">
          <div>
            {/* Logo area */}
            <div className="flex items-center gap-3 p-5">
              <div className="size-9 rounded-xl bg-indigo-600" />
              <div className="flex flex-col">
                <span className="text-sm font-medium text-slate-500 leading-none">Omicron</span>
                <span className="text-base font-semibold leading-tight">Business Cards</span>
              </div>
            </div>
            <Separator />

            {/* Navigation */}
            <nav className="p-3">
              {navItems.map(({ key, label, icon: Icon }) => {
                const activeItem = active === key;
                return (
                  <button
                    key={key}
                    onClick={() => setActive(key)}
                    className={`group mb-1 flex w-full items-center justify-between rounded-xl border p-3 text-left transition ${
                      activeItem
                        ? "border-indigo-600 bg-indigo-50"
                        : "border-transparent hover:bg-slate-50"
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <Icon className={`size-5 ${activeItem ? "text-indigo-700" : "text-slate-500"}`} />
                      <span className={`text-sm ${activeItem ? "font-semibold text-indigo-900" : "text-slate-700"}`}>
                        {label}
                      </span>
                    </span>
                    <ChevronRight className={`size-4 ${activeItem ? "text-indigo-700" : "text-slate-400"}`} />
                  </button>
                );
              })}
            </nav>
          </div>

          {/* User block (bottom-left) */}
          <div className="p-4">
            <Card className="border-slate-200">
              <CardContent className="flex items-center gap-3 p-4">
                <Avatar className="size-10">
                  <AvatarFallback>PR</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">Pascal Rossi</div>
                  <div className="truncate text-xs text-slate-500">pascal@omicron.example</div>
                </div>
                <Button size="icon" variant="ghost" className="ml-auto">
                  <LogOut className="size-4" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex min-h-[100dvh] flex-1 flex-col gap-4 p-5 md:p-0">
          <Header active={active} />

          <div className="flex-1">
            {active === "details" ? <DetailsView /> : <OrdersView />}
          </div>
        </main>
      </div>
    </div>
  );
}

function Header({ active }: { active: NavKey }) {
  return (
    <div className="sticky top-0 z-10 -mx-5 mb-2 bg-muted/20 px-5 pb-2 pt-4 md:static md:mx-0 md:px-0 md:pt-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-bold tracking-tight">
            {active === "details" ? "Personal details" : "Orders"}
          </h1>
          {active === "details" ? (
            <Badge variant="secondary">Omicron branded</Badge>
          ) : (
            <Badge variant="secondary">Print orders</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">Help</Button>
          <Button size="sm">New order</Button>
        </div>
      </div>
    </div>
  );
}

function DetailsView() {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Business card details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="first">First name</Label>
            <Input id="first" placeholder="e.g. Pascal" defaultValue="Pascal" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="last">Last name</Label>
            <Input id="last" placeholder="e.g. Rossi" defaultValue="Rossi" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="title">Job title</Label>
            <Input id="title" placeholder="e.g. Strategy & Technology" defaultValue="Founder, Alignz" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="name@omicron.com" defaultValue="pascal@omicron.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" placeholder="+41 79 000 00 00" defaultValue="+41 79 530 74 60" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="website">Website</Label>
            <Input id="website" placeholder="omicron.com" defaultValue="omicron.com" />
          </div>
        </CardContent>
        <CardFooter className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <QrCode className="size-4" /> Digital card automatically available
          </div>
          <div className="flex gap-2">
            <Button variant="outline">Save</Button>
            <Button>
              <UploadCloud className="mr-2 size-4" />
              Order print cards
            </Button>
          </div>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-2xl border p-5">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-indigo-600" />
              <div>
                <div className="font-semibold">Omicron</div>
                <div className="text-xs text-slate-500">Official business card</div>
              </div>
            </div>
            <Separator className="my-4" />
            <div className="space-y-1 text-sm">
              <div className="font-semibold">Pascal Rossi</div>
              <div className="text-slate-600">Founder, Alignz</div>
              <div className="text-slate-600">pascal@omicron.com</div>
              <div className="text-slate-600">+41 79 530 74 60</div>
              <div className="text-slate-600">omicron.com</div>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button variant="secondary" className="w-full"><IdCard className="mr-2 size-4" /> Download PDF proof</Button>
        </CardFooter>
      </Card>
    </div>
  );
}

function OrdersView() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent orders</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[60vh] pr-2">
          <div className="grid grid-cols-6 items-center gap-3 rounded-lg border bg-white p-3 text-sm font-medium">
            <div>#</div>
            <div>Date</div>
            <div>Status</div>
            <div>Quantity</div>
            <div>Delivery</div>
            <div className="text-right">Actions</div>
          </div>

          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="grid grid-cols-6 items-center gap-3 border-b p-3 text-sm">
              <div>OC-{2025 + i}</div>
              <div>2025-09-0{i}</div>
              <div className="flex items-center gap-1 text-green-700"><CheckCircle className="size-4" /> Printed</div>
              <div>500</div>
              <div>Standard (3–5 days)</div>
              <div className="text-right">
                <Button size="sm" variant="outline" className="mr-2">View</Button>
                <Button size="sm">Reorder</Button>
              </div>
            </div>
          ))}
        </ScrollArea>
      </CardContent>
      <CardFooter className="justify-end">
        <Button>Place new order</Button>
      </CardFooter>
    </Card>
  );
}
