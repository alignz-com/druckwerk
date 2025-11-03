"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Analytics } from "@vercel/analytics/next";

import { DEFAULT_TEMPLATE_LIST } from "@/lib/templates-defaults";
import type { ResolvedTemplate } from "@/lib/templates";
import { useTranslations } from "@/components/providers/locale-provider";
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

const DELIVERY_TIMES = ["express", "1week", "2weeks"] as const;

export type OrderFormProps = {
  templates: ResolvedTemplate[];
};

export default function OrderForm({ templates }: OrderFormProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const sessionUser = session?.user;
  const hasPrefilledProfile = useRef(false);
  const t = useTranslations();
  const templateOptions = templates.length > 0 ? templates : DEFAULT_TEMPLATE_LIST;
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>(templateOptions[0]?.key ?? "qrcode");
  const selectedTemplate = useMemo(() => {
    return templateOptions.find((tpl) => tpl.key === selectedTemplateKey) ?? templateOptions[0] ?? DEFAULT_TEMPLATE_LIST[0];
  }, [templateOptions, selectedTemplateKey]);

  const [deliveryTime, setDeliveryTime] = useState<string>("1week");
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [mobile, setMobile] = useState("");
  const [company, setCompany] = useState("");
  const [url, setUrl] = useState("");
  const [quantity, setQuantity] = useState<string>(String(QUANTITIES[1]));
  const [linkedin, setLinkedin] = useState("");

  useEffect(() => {
    if (!sessionUser || hasPrefilledProfile.current) return;
    if (sessionUser.name) setName(sessionUser.name);
    if (sessionUser.jobTitle) setRole(sessionUser.jobTitle);
    if (sessionUser.email) setEmail(sessionUser.email);
    if (sessionUser.businessPhone) setPhone(sessionUser.businessPhone);
    if (sessionUser.mobilePhone) setMobile(sessionUser.mobilePhone);
    hasPrefilledProfile.current = true;
  }, [sessionUser]);

  const [previewView, setPreviewView] = useState<"front" | "back">("front");
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
        throw new Error(data.error || t.orderForm.errors.generic);
      }

      setIsConfirmOpen(false);
      router.push("/orders?created=1");
    } catch (err: any) {
      setSubmitError(err?.message ?? t.orderForm.errors.generic);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="space-y-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{t.orderForm.title}</h1>
          {t.orderForm.subtitle ? (
            <p className="mt-1 text-sm text-slate-500">{t.orderForm.subtitle}</p>
          ) : null}
        </div>
        <Button onClick={openConfirm} className="self-start sm:self-auto">
          {t.orderForm.buttons.order}
        </Button>
      </header>

      <div className="grid gap-10 2xl:gap-12 xl:grid-cols-[minmax(320px,420px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(360px,440px)_minmax(0,1fr)]">
        <div className="space-y-8">
          <Card className="h-fit">
            <CardHeader className="pb-2">
              <CardTitle className="text-base md:text-lg">{t.orderForm.infoTitle}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="qty">{t.orderForm.quantity}</Label>
                  <Select value={quantity} onValueChange={setQuantity}>
                    <SelectTrigger id="qty">
                      <SelectValue placeholder={t.orderForm.placeholders.quantity} />
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
                  <Label htmlFor="template">{t.orderForm.template}</Label>
                  <Select value={selectedTemplateKey} onValueChange={setSelectedTemplateKey}>
                    <SelectTrigger id="template">
                      <SelectValue placeholder={t.orderForm.placeholders.template} />
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
                  <Label htmlFor="delivery">{t.orderForm.deliveryTime}</Label>
                  <Select value={deliveryTime} onValueChange={setDeliveryTime}>
                    <SelectTrigger id="delivery">
                      <SelectValue placeholder={t.orderForm.placeholders.deliveryTime} />
                    </SelectTrigger>
                    <SelectContent>
                      {DELIVERY_TIMES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {t.orderForm.deliveryTimes[value] ?? value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {deliveryTime === "express" && (
                    <p className="mt-1 text-xs text-red-600">{t.orderForm.expressNotice}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-base md:text-lg">{t.orderForm.detailsTitle}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="name">{t.orderForm.fields.name}</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={32} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="role">{t.orderForm.fields.role}</Label>
                <Input id="role" value={role} onChange={(e) => setRole(e.target.value)} maxLength={45} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">{t.orderForm.fields.phone}</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={19} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="mobile">{t.orderForm.fields.mobile}</Label>
                <Input id="mobile" value={mobile} onChange={(e) => setMobile(e.target.value)} maxLength={19} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">{t.orderForm.fields.email}</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={50} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="linkedin">{t.orderForm.fields.linkedin}</Label>
                <Input
                  id="linkedin"
                  type="url"
                  placeholder={t.orderForm.fields.linkedinPlaceholder}
                  value={linkedin}
                  onChange={(e) => setLinkedin(e.target.value)}
                  maxLength={100}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="url">{t.orderForm.fields.url}</Label>
                <Input id="url" value={url} onChange={(e) => setUrl(e.target.value)} maxLength={32} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="company">{t.orderForm.fields.company}</Label>
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

            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader className="flex flex-col gap-3 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t.orderForm.previewTitle}</CardTitle>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={previewView === "front" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPreviewView("front")}
                >
                  {t.orderForm.confirm.front}
                </Button>
                <Button
                  type="button"
                  variant={previewView === "back" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPreviewView("back")}
                >
                  {t.orderForm.confirm.back}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex justify-center pt-0">
              <div className="w-full max-w-[1100px]">
                {previewView === "front" ? (
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
            <DialogTitle>{t.orderForm.confirm.title}</DialogTitle>
            <DialogDescription>{t.orderForm.confirm.description}</DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="flex gap-2">
              <Button
                variant={confirmView === "front" ? "default" : "ghost"}
                size="sm"
                onClick={() => setConfirmView("front")}
                disabled={isSubmitting}
              >
                {t.orderForm.confirm.front}
              </Button>
              <Button
                variant={confirmView === "back" ? "default" : "ghost"}
                size="sm"
                onClick={() => setConfirmView("back")}
                disabled={isSubmitting}
              >
                {t.orderForm.confirm.back}
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
              {t.orderForm.confirm.cancel}
            </Button>
            <Button onClick={confirmOrder} disabled={isSubmitting}>
              {isSubmitting ? t.orderForm.confirm.submitting : t.orderForm.confirm.submit}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Analytics />
    </section>
  );
}
