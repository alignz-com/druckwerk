"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Analytics } from "@vercel/analytics/next";

import { TemplateDefinition, DEFAULT_TEMPLATE_LIST } from "@/lib/templates-defaults";
import { BusinessCardFront, BusinessCardBack } from "@/components/PreviewCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const QUANTITIES = [50, 100, 250, 500, 1000];

const DELIVERY_TIMES = [
  { value: "express", label: "Express" },
  { value: "1week", label: "1 Week" },
  { value: "2weeks", label: "2 Weeks" },
] as const;

export type OrderFormProps = {
  templates: TemplateDefinition[];
};

export default function OrderForm({ templates }: OrderFormProps) {
  const router = useRouter();
  const templateOptions = templates.length > 0 ? templates : DEFAULT_TEMPLATE_LIST;
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>(templateOptions[0]?.key ?? "qrcode");
  const selectedTemplate = useMemo(() => {
    return templateOptions.find((tpl) => tpl.key === selectedTemplateKey) ?? templateOptions[0] ?? DEFAULT_TEMPLATE_LIST[0];
  }, [templateOptions, selectedTemplateKey]);

  const [deliveryTime, setDeliveryTime] = useState<string>("1week");
  const [name, setName] = useState("Martin Eichberger");
  const [role, setRole] = useState("Corporate Communications");
  const [email, setEmail] = useState("martin.eichberger@omicronenergy.com");
  const [phone, setPhone] = useState("+43 59495 2099");
  const [mobile, setMobile] = useState("+43 664 88876851");
  const [company, setCompany] = useState("OMICRON electronics GmbH\nOberes Ried 1 | 6833 Klaus | Österreich");
  const [url, setUrl] = useState("www.omicronenergy.com");
  const [quantity, setQuantity] = useState<string>(String(QUANTITIES[1]));
  const [linkedin, setLinkedin] = useState("");

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmView, setConfirmView] = useState<"front" | "back">("front");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const openConfirm = () => {
    if (isSubmitting) return;
    setSubmitError(null);
    setConfirmView("front");
    setIsConfirmOpen(true);
  };

  const confirmOrder = async () => {
    if (!selectedTemplate) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          role,
          email,
          phone,
          mobile,
          company,
          url,
          template: selectedTemplate.key,
          quantity: Number(quantity),
          deliveryTime,
          linkedin,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to submit order");
      }

      setIsConfirmOpen(false);
      router.push("/orders?created=1");
    } catch (err: any) {
      setSubmitError(err?.message ?? "Unexpected error while saving order");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="space-y-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Business Card – Omicron</h1>
      </header>

      <div className="grid gap-10 2xl:gap-12 xl:grid-cols-[minmax(320px,420px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(360px,440px)_minmax(0,1fr)]">
        <div className="space-y-8">
          <Card className="h-fit">
            <CardHeader className="pb-2">
              <CardTitle className="text-base md:text-lg">Order information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="qty">Quantity</Label>
                  <Select value={quantity} onValueChange={setQuantity}>
                    <SelectTrigger id="qty">
                      <SelectValue placeholder="Select quantity" />
                    </SelectTrigger>
                    <SelectContent>
                      {QUANTITIES.map((q) => (
                        <SelectItem key={q} value={String(q)}>
                          {q.toLocaleString("en-US")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="template">Template</Label>
                  <Select value={selectedTemplateKey} onValueChange={setSelectedTemplateKey}>
                    <SelectTrigger id="template">
                      <SelectValue placeholder="Select template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templateOptions.map((tpl) => (
                        <SelectItem key={tpl.key} value={tpl.key}>
                          {tpl.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="delivery">Delivery Time</Label>
                  <Select value={deliveryTime} onValueChange={setDeliveryTime}>
                    <SelectTrigger id="delivery">
                      <SelectValue placeholder="Select delivery time" />
                    </SelectTrigger>
                    <SelectContent>
                      {DELIVERY_TIMES.map((d) => (
                        <SelectItem key={d.value} value={d.value}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {deliveryTime === "express" && (
                    <p className="mt-1 text-xs text-red-600">⚠️ Express delivery will cause additional costs.</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-base md:text-lg">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={32} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="role">Function / Title</Label>
                <Input id="role" value={role} onChange={(e) => setRole(e.target.value)} maxLength={45} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={19} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="mobile">Mobile</Label>
                <Input id="mobile" value={mobile} onChange={(e) => setMobile(e.target.value)} maxLength={19} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">E-Mail</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={50} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="linkedin">LinkedIn</Label>
                <Input
                  id="linkedin"
                  type="url"
                  placeholder="https://www.linkedin.com/in/username"
                  value={linkedin}
                  onChange={(e) => setLinkedin(e.target.value)}
                  maxLength={100}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="url">URL</Label>
                <Input id="url" value={url} onChange={(e) => setUrl(e.target.value)} maxLength={32} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="company">Company & Address</Label>
                <Textarea
                  id="company"
                  value={company}
                  rows={3}
                  onChange={(e) => {
                    const maxLines = 3;
                    const maxPerLine = 48;
                    let lines = e.target.value.split("\n");
                    lines = lines.slice(0, maxLines);
                    lines = lines.map((line) => line.slice(0, maxPerLine));
                    setCompany(lines.join("\n"));
                  }}
                />
              </div>

              <Button onClick={openConfirm} className="w-full">
                Order Business Card
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
          <Card className="shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">Card Front</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center pt-0">
              <div className="w-full max-w-[1100px]">
                <BusinessCardFront
                  template={selectedTemplate}
                  name={name}
                  role={role}
                  email={email}
                  phone={phone}
                  mobile={mobile}
                  company={company}
                  url={url}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">Card Back</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center pt-0">
              <div className="w-full max-w-[1100px]">
                <BusinessCardBack
                  template={selectedTemplate}
                  name={name}
                  role={role}
                  email={email}
                  phone={phone}
                  mobile={mobile}
                  company={company}
                  url={url}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog
        open={isConfirmOpen}
        onOpenChange={(open) => {
          if (isSubmitting) return;
          setSubmitError(null);
          setIsConfirmOpen(open);
        }}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Confirm order</DialogTitle>
            <DialogDescription>Review the preview before submitting your business card order.</DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="flex gap-2">
              <Button
                variant={confirmView === "front" ? "default" : "ghost"}
                size="sm"
                onClick={() => setConfirmView("front")}
                disabled={isSubmitting}
              >
                Front
              </Button>
              <Button
                variant={confirmView === "back" ? "default" : "ghost"}
                size="sm"
                onClick={() => setConfirmView("back")}
                disabled={isSubmitting}
              >
                Back
              </Button>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50/60 p-4 sm:p-6">
              <div className="mx-auto w-full max-w-[920px]">
                {confirmView === "front" ? (
                  <BusinessCardFront
                    template={selectedTemplate}
                    name={name}
                    role={role}
                    email={email}
                    phone={phone}
                    mobile={mobile}
                    company={company}
                    url={url}
                  />
                ) : (
                  <BusinessCardBack
                    template={selectedTemplate}
                    name={name}
                    role={role}
                    email={email}
                    phone={phone}
                    mobile={mobile}
                    company={company}
                    url={url}
                  />
                )}
              </div>
            </div>

            {submitError ? (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {submitError}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsConfirmOpen(false)} disabled={isSubmitting}>
              Back
            </Button>
            <Button onClick={confirmOrder} disabled={isSubmitting}>
              {isSubmitting ? "Saving order…" : "Confirm order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Analytics />
    </section>
  );
}
