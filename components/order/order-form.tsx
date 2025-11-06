"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Analytics } from "@vercel/analytics/next";
import { Info } from "lucide-react";

import type { ResolvedTemplate } from "@/lib/templates";
import { COUNTRY_CODES, getCountryLabel } from "@/lib/countries";
import { useTranslations } from "@/components/providers/locale-provider";
import { BusinessCardFront, BusinessCardBack } from "@/components/PreviewCard";
import FlipCard from "@/components/FlipCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
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

type BrandAddressEntry = {
  id: string;
  label: string | null;
  company: string | null;
  street: string | null;
  addressExtra?: string | null;
  postalCode: string | null;
  city: string | null;
  countryCode: string | null;
  url?: string | null;
};

const DELIVERY_OPTIONS = {
  express: { businessDays: 5 },
  standard: { businessDays: 15 },
} as const;
type DeliveryOption = keyof typeof DELIVERY_OPTIONS;

function addBusinessDays(start: Date, days: number) {
  const date = new Date(start);
  let remaining = days;
  while (remaining > 0) {
    date.setDate(date.getDate() + 1);
    const weekDay = date.getDay();
    if (weekDay !== 0 && weekDay !== 6) {
      remaining -= 1;
    }
  }
  return date;
}

function formatDeliveryDate(date: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function buildWebsiteFromEmail(email?: string | null) {
  if (!email || !email.includes("@")) return "";
  let domain = email.split("@")[1]?.trim().toLowerCase() ?? "";
  if (!domain) return "";
  if (domain.endsWith(".")) domain = domain.slice(0, -1);
  if (domain.startsWith("www.")) domain = domain.slice(4);
  return domain ? `www.${domain}` : "";
}

function buildAddressBlock(opts: {
  companyName?: string;
  street?: string;
  postalCode?: string;
  city?: string;
  countryCode?: string;
  locale: "en" | "de";
}) {
  const { companyName, street, postalCode, city, countryCode, locale } = opts;
  const lines: string[] = [];
  const nameLine = (companyName ?? "").trim();
  if (nameLine) lines.push(nameLine);

  const segments: string[] = [];
  const streetLine = (street ?? "").trim();
  if (streetLine) segments.push(streetLine);
  const postalCity = [postalCode, city].filter((part) => part && part.toString().trim().length > 0).join(" ").trim();
  if (postalCity) segments.push(postalCity);
  const countryLabel =
    countryCode && countryCode.length > 0 ? getCountryLabel(locale, countryCode).trim() : "";
  if (countryLabel) segments.push(countryLabel);
  if (segments.length > 0) {
    lines.push(segments.join(" | "));
  }
  return lines.join("\n");
}

export type OrderFormProps = {
  templates: ResolvedTemplate[];
  addresses?: BrandAddressEntry[];
};

export default function OrderForm({ templates, addresses = [] }: OrderFormProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const sessionUser = session?.user;
  const localeShort: "en" | "de" = sessionUser?.locale === "de" ? "de" : "en";
  const deliveryLocale = localeShort === "de" ? "de-AT" : "en-GB";
  const hasPrefilledProfile = useRef(false);
  const t = useTranslations();
  const tOrder = useTranslations("orderForm");
  const templateOptions = templates;
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>(templateOptions[0]?.key ?? "");
  const selectedTemplate = useMemo<ResolvedTemplate | null>(() => {
    if (templateOptions.length === 0) return null;
    return templateOptions.find((tpl) => tpl.key === selectedTemplateKey) ?? templateOptions[0]!;
  }, [templateOptions, selectedTemplateKey]);

  useEffect(() => {
    if (templateOptions.length === 0) {
      if (selectedTemplateKey) setSelectedTemplateKey("");
      return;
    }
    const exists = templateOptions.some((tpl) => tpl.key === selectedTemplateKey);
    if (!exists) {
      setSelectedTemplateKey(templateOptions[0]!.key);
    }
  }, [templateOptions, selectedTemplateKey]);

  const [deliveryTime, setDeliveryTime] = useState<DeliveryOption>("standard");
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [mobile, setMobile] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [street, setStreet] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [countryCode, setCountryCode] = useState<string>("");
  const [url, setUrl] = useState("");
  const [quantity, setQuantity] = useState<string>(String(QUANTITIES[1]));
  const [linkedin, setLinkedin] = useState("");
  const [customerReference, setCustomerReference] = useState("");
  const [addressBlock, setAddressBlock] = useState("");
  const [addressSearch, setAddressSearch] = useState("");
  const [isAddressDropdownOpen, setAddressDropdownOpen] = useState(false);
  const [frontOverflow, setFrontOverflow] = useState(false);
  const [backOverflow, setBackOverflow] = useState(false);
  const hasOverflow = frontOverflow || backOverflow;

  const countryOptions = useMemo(() => {
    return COUNTRY_CODES.map((code) => ({ code, label: getCountryLabel(localeShort, code) })).sort((a, b) =>
      a.label.localeCompare(b.label, localeShort === "de" ? "de" : "en"),
    );
  }, [localeShort]);

  useEffect(() => {
    const generated = buildAddressBlock({
      companyName,
      street,
      postalCode,
      city,
      countryCode,
      locale: localeShort,
    });
    setAddressBlock((current) => (current === generated ? current : generated));
  }, [companyName, street, postalCode, city, countryCode, localeShort]);

  const previewAddressFields = useMemo(
    () => ({
      companyName: companyName.trim() ? companyName : undefined,
      street: street.trim() ? street : undefined,
      postalCode: postalCode.trim() ? postalCode : undefined,
      city: city.trim() ? city : undefined,
      country: countryCode ? getCountryLabel(localeShort, countryCode) : undefined,
    }),
    [companyName, street, postalCode, city, countryCode, localeShort],
  );

  const addressOptions = useMemo(() => addresses, [addresses]);
  const filteredAddressOptions = useMemo(() => {
    const query = addressSearch.trim().toLowerCase();
    if (!query) return addressOptions;
    return addressOptions.filter((entry) => {
      const haystack = [entry.label, entry.company, entry.street, entry.postalCode, entry.city]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [addressOptions, addressSearch]);
  const displayedAddressOptions = useMemo(
    () => filteredAddressOptions.slice(0, 5),
    [filteredAddressOptions],
  );

  const handleSelectAddress = (entry: BrandAddressEntry) => {
    setCompanyName(entry.company ?? "");
    setStreet(entry.street ?? "");
    setPostalCode(entry.postalCode ?? "");
    setCity(entry.city ?? "");
    setCountryCode(entry.countryCode ?? "");
    setUrl(entry.url ?? "");
    setAddressSearch(entry.label || entry.company || "");
    setAddressDropdownOpen(false);
  };

  const estimatedDeliveryDate = useMemo(() => {
    const option = DELIVERY_OPTIONS[deliveryTime];
    if (!option) return null;
    const target = addBusinessDays(new Date(), option.businessDays);
    return formatDeliveryDate(target, deliveryLocale);
  }, [deliveryTime, deliveryLocale]);

  useEffect(() => {
    if (!sessionUser || hasPrefilledProfile.current) return;
    if (sessionUser.name) setName(sessionUser.name);
    if (sessionUser.jobTitle) setRole(sessionUser.jobTitle);
    if (sessionUser.email) setEmail(sessionUser.email);
    if (sessionUser.businessPhone) setPhone(sessionUser.businessPhone);
    if (sessionUser.mobilePhone) setMobile(sessionUser.mobilePhone);
    if (sessionUser.url) setUrl((prev) => prev || sessionUser.url || "");
    hasPrefilledProfile.current = true;
  }, [sessionUser]);

  useEffect(() => {
    if (!email) return;
    setUrl((prev) => (prev ? prev : buildWebsiteFromEmail(email)));
  }, [email]);

  const [previewView, setPreviewView] = useState<"front" | "back">("front");
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmView, setConfirmView] = useState<"front" | "back">("front");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (templateOptions.length === 0 || !selectedTemplate) {
    return (
      <section className="space-y-6">
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>{tOrder("noTemplatesTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">{tOrder("noTemplatesDescription")}</p>
          </CardContent>
        </Card>
        <Analytics />
      </section>
    );
  }

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
          company: addressBlock,
          url,
          linkedin,
          template: selectedTemplate.key,
          quantity: Number(quantity),
          deliveryTime,
          customerReference,
          address: {
            companyName,
            street,
            postalCode,
            city,
            countryCode,
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || tOrder("errors.generic"));
      }

      setIsConfirmOpen(false);
      router.push("/orders?created=1");
    } catch (err: any) {
      setSubmitError(err?.message ?? tOrder("errors.generic"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="space-y-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">{tOrder("title")}</h1>
          {tOrder("subtitle") ? (
            <p className="mt-1 text-sm text-slate-500">{tOrder("subtitle")}</p>
          ) : null}
        </div>
        <Button onClick={openConfirm} className="self-start sm:self-auto lg:hidden" disabled={hasOverflow}>
          {tOrder("buttons.order")}
        </Button>
      </header>

      <div className="grid gap-10 lg:grid-cols-[minmax(320px,420px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(360px,440px)_minmax(0,1fr)] lg:items-start 2xl:gap-12">
        <div className="space-y-8">
          <Card className="h-fit">
            <CardHeader className="pb-2">
              <CardTitle className="text-base md:text-lg">{tOrder("infoTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="qty">{tOrder("quantity")}</Label>
                  <Select value={quantity} onValueChange={setQuantity}>
                    <SelectTrigger id="qty">
                      <SelectValue placeholder={tOrder("placeholders.quantity")} />
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
                  <Label htmlFor="template">{tOrder("template")}</Label>
                  <Select value={selectedTemplateKey} onValueChange={setSelectedTemplateKey}>
                    <SelectTrigger id="template">
                      <SelectValue placeholder={tOrder("placeholders.template")} />
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
                  <Label htmlFor="delivery">{tOrder("deliveryTime")}</Label>
                  <Select
                    value={deliveryTime}
                    onValueChange={(value) => setDeliveryTime(value as DeliveryOption)}
                  >
                    <SelectTrigger id="delivery">
                      <SelectValue placeholder={tOrder("placeholders.deliveryTime")} />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(DELIVERY_OPTIONS) as DeliveryOption[]).map((value) => (
                        <SelectItem key={value} value={value}>
                          {tOrder(`deliveryTimes.${value}`) ?? value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {deliveryTime === "express" && (
                    <p className="mt-1 text-xs text-red-600">{tOrder("expressNotice")}</p>
                  )}
                  {estimatedDeliveryDate ? (
                    <p className="text-xs text-slate-500">
                    {tOrder("estimatedDelivery")}: {estimatedDeliveryDate}
                    </p>
                  ) : null}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="customerReference">{tOrder("fields.customerReference")}</Label>
                  <Textarea
                    id="customerReference"
                    value={customerReference}
                    onChange={(e) => setCustomerReference(e.target.value)}
                    rows={2}
                    placeholder={tOrder("placeholders.customerReference") ?? ""}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-base md:text-lg">{tOrder("sections.personal")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="name">{tOrder("fields.name")}</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="role">{tOrder("fields.role")}</Label>
                <Input id="role" value={role} onChange={(e) => setRole(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">{tOrder("fields.phone")}</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="mobile">{tOrder("fields.mobile")}</Label>
                <Input id="mobile" value={mobile} onChange={(e) => setMobile(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">{tOrder("fields.email")}</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="linkedin" className="mb-0">
                    {tOrder("fields.linkedin")}
                  </Label>
                  <span className="inline-flex" title={tOrder("hints.linkedin")} aria-hidden="true">
                    <Info className="h-4 w-4 text-slate-400" />
                  </span>
                </div>
                <Input
                  id="linkedin"
                  type="url"
                  placeholder={tOrder("fields.linkedinPlaceholder")}
                  value={linkedin}
                  onChange={(e) => setLinkedin(e.target.value)}
                  aria-describedby="linkedin-hint"
                />
                <p id="linkedin-hint" className="text-xs text-slate-500">
                  {tOrder("hints.linkedin")}
                </p>
              </div>
              </div>
              <Separator />
              <div className="space-y-4">
                <h3 className="text-base font-semibold text-slate-800">{tOrder("sections.company")}</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2 sm:col-span-2">
                    <Label htmlFor="addressSearch">{tOrder("fields.addressSearch")}</Label>
                    <div className="relative">
                      <Input
                        id="addressSearch"
                        value={addressSearch}
                        onFocus={() => setAddressDropdownOpen(true)}
                        onBlur={() => setTimeout(() => setAddressDropdownOpen(false), 150)}
                        onChange={(e) => {
                          setAddressSearch(e.target.value);
                          if (!isAddressDropdownOpen) setAddressDropdownOpen(true);
                        }}
                        placeholder={tOrder("placeholders.addressSearch") ?? ""}
                        className="border-teal-200 bg-teal-50 focus-visible:border-teal-400 focus-visible:ring-teal-200"
                      />
                      {isAddressDropdownOpen && (
                        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white text-sm shadow-lg">
                          {addressOptions.length === 0 ? (
                            <p className="px-3 py-2 text-slate-500">{tOrder("addressSearch.empty")}</p>
                          ) : displayedAddressOptions.length === 0 ? (
                            <p className="px-3 py-2 text-slate-500">{tOrder("addressSearch.noResults")}</p>
                          ) : (
                            displayedAddressOptions.map((entry) => {
                              const title = entry.label || entry.company || tOrder("addressSearch.unnamed");
                              const subtitle = [entry.company, entry.street, entry.city]
                                .filter(Boolean)
                                .join(" • ");
                              return (
                                <button
                                  type="button"
                                  key={entry.id}
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => handleSelectAddress(entry)}
                                  className="w-full px-3 py-2 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                                >
                                  <p className="font-medium text-slate-900">{title}</p>
                                  {subtitle ? <p className="text-xs text-slate-500">{subtitle}</p> : null}
                                </button>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">{tOrder("hints.addressSearch")}</p>
                  </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="companyName">{tOrder("fields.companyName")}</Label>
                  <Input id="companyName" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="street">{tOrder("fields.street")}</Label>
                  <Input id="street" value={street} onChange={(e) => setStreet(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="postalCode">{tOrder("fields.postalCode")}</Label>
                  <Input id="postalCode" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="city">{tOrder("fields.city")}</Label>
                  <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="country">{tOrder("fields.country")}</Label>
                  <Select value={countryCode} onValueChange={setCountryCode}>
                    <SelectTrigger id="country">
                      <SelectValue placeholder={tOrder("placeholders.country")} />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {countryOptions.map(({ code, label }) => (
                        <SelectItem key={code} value={code}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="url">{tOrder("fields.url")}</Label>
                  <Input id="url" value={url} onChange={(e) => setUrl(e.target.value)} />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="addressBlock">{tOrder("fields.addressExtra")}</Label>
                  <Textarea
                    id="addressBlock"
                    value={addressBlock}
                    onChange={(e) => setAddressBlock(e.target.value)}
                    rows={4}
                    placeholder={tOrder("placeholders.addressExtra") ?? ""}
                  />
                  <p className="text-xs text-slate-500">
                    {tOrder("hints.addressExtra")}
                  </p>
                </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 lg:sticky lg:top-10 lg:self-start">
          <Card className="shadow-sm">
            <CardHeader className="flex flex-col gap-3 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">{tOrder("previewTitle")}</CardTitle>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={previewView === "front" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPreviewView("front")}
                >
                  {tOrder("confirm.front")}
                </Button>
                <Button
                  type="button"
                  variant={previewView === "back" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPreviewView("back")}
                >
                  {tOrder("confirm.back")}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex items-center justify-center pt-0 lg:max-h-[calc(100vh-14rem)] lg:overflow-y-auto">
              <div className="w-full max-w-[1100px]">
                <div className="relative aspect-[85/55] w-full">
                  <FlipCard
                    activeSide={previewView}
                    front={
                      <BusinessCardFront
                        template={selectedTemplate}
                        name={name}
                        role={role}
                        email={email}
                        phone={phone}
                        mobile={mobile}
                        company={addressBlock}
                        url={url}
                        linkedin={linkedin}
                        onOverflowChange={setFrontOverflow}
                        addressFields={previewAddressFields}
                      />
                    }
                    back={
                      <BusinessCardBack
                        template={selectedTemplate}
                        name={name}
                        role={role}
                        email={email}
                        phone={phone}
                        mobile={mobile}
                        company={addressBlock}
                        url={url}
                        linkedin={linkedin}
                        onOverflowChange={setBackOverflow}
                        addressFields={previewAddressFields}
                      />
                    }
                    className="h-full w-full"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
          <div className="hidden lg:flex lg:justify-end">
            <Button onClick={openConfirm} className="px-6" disabled={hasOverflow}>
              {tOrder("buttons.order")}
            </Button>
          </div>
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
            <DialogTitle>{tOrder("confirm.title")}</DialogTitle>
            <DialogDescription>{tOrder("confirm.description")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="flex gap-2">
              <Button
                variant={confirmView === "front" ? "default" : "ghost"}
                size="sm"
                onClick={() => setConfirmView("front")}
                disabled={isSubmitting}
              >
                {tOrder("confirm.front")}
              </Button>
              <Button
                variant={confirmView === "back" ? "default" : "ghost"}
                size="sm"
                onClick={() => setConfirmView("back")}
                disabled={isSubmitting}
              >
                {tOrder("confirm.back")}
              </Button>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50/60 p-4 sm:p-6">
              <div className="mx-auto w-full max-w-[920px]">
                <div className="relative mx-auto aspect-[85/55] w-full max-w-[600px]">
                  <FlipCard
                    activeSide={confirmView}
                    className="h-full w-full"
                    front={
                      <BusinessCardFront
                        template={selectedTemplate}
                        name={name}
                        role={role}
                        email={email}
                        phone={phone}
                        mobile={mobile}
                        company={addressBlock}
                        url={url}
                        linkedin={linkedin}
                        onOverflowChange={setFrontOverflow}
                        addressFields={previewAddressFields}
                      />
                    }
                    back={
                      <BusinessCardBack
                        template={selectedTemplate}
                        name={name}
                        role={role}
                        email={email}
                        phone={phone}
                        mobile={mobile}
                        company={addressBlock}
                        url={url}
                        linkedin={linkedin}
                        onOverflowChange={setBackOverflow}
                        addressFields={previewAddressFields}
                      />
                    }
                  />
                </div>
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
              {tOrder("confirm.cancel")}
            </Button>
            <Button onClick={confirmOrder} disabled={isSubmitting || hasOverflow}>
              {isSubmitting ? tOrder("confirm.submitting") : tOrder("confirm.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Analytics />
    </section>
  );
}
