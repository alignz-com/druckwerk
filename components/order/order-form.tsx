"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Analytics } from "@vercel/analytics/next";
import { ChevronDown, Info } from "lucide-react";
import dynamic from "next/dynamic";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { ResolvedTemplate, TemplateSummary } from "@/lib/templates";
import { COUNTRY_CODES, getCountryLabel } from "@/lib/countries";
import { DELIVERY_OPTIONS, type DeliveryOption } from "@/lib/delivery-options";
import { addBusinessDays } from "@/lib/date-utils";
import { useTranslations } from "@/components/providers/locale-provider";
import { BusinessCardFront, BusinessCardBack } from "@/components/PreviewCard";
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
import { LoadingButton } from "@/components/ui/loading-button";
import { parsePhoneNumberFromString } from "libphonenumber-js";

function PreviewSkeleton() {
  return <div className="h-full w-full rounded-2xl border border-slate-200 bg-slate-50" />;
}

const FlipCard = dynamic(() => import("@/components/FlipCard"), {
  ssr: false,
  loading: () => <PreviewSkeleton />,
});

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
  cardAddressText?: string | null;
  url?: string | null;
};

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

type BrandOption = {
  id: string;
  name: string;
};

type BrandResourcePayload = {
  templates: TemplateSummary[];
  addresses: BrandAddressEntry[];
  initialTemplate: ResolvedTemplate | null;
  initialTemplateKey: string | null;
  brandId: string | null;
};

type ProfilePrefill = {
  name?: string | null;
  jobTitle?: string | null;
  email?: string | null;
  businessPhone?: string | null;
  mobilePhone?: string | null;
  url?: string | null;
};

const brandResourcesFetcher = async (brandId: string): Promise<BrandResourcePayload> => {
  const params = new URLSearchParams({ brandId });
  const response = await fetch(`/api/orders/brand-data?${params.toString()}`, { cache: "no-store" });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.error ?? "Failed to load brand data");
  }
  return (await response.json()) as BrandResourcePayload;
};

export type OrderFormProps = {
  availableBrands?: BrandOption[];
  initialBrandId?: string | null;
  initialTemplateSummaries: TemplateSummary[];
  initialTemplate?: ResolvedTemplate | null;
  initialAddresses?: BrandAddressEntry[];
  initialTemplateKey?: string | null;
  initialProfile?: ProfilePrefill | null;
};

export default function OrderForm({
  availableBrands = [],
  initialBrandId,
  initialTemplateSummaries,
  initialTemplate,
  initialAddresses = [],
  initialTemplateKey = null,
  initialProfile = null,
}: OrderFormProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const sessionUser = session?.user;
  const localeShort: "en" | "de" = sessionUser?.locale === "de" ? "de" : "en";
  const deliveryLocale = localeShort === "de" ? "de-AT" : "en-GB";
  const hasPrefilledProfile = useRef(false);
  const t = useTranslations();
  const tOrder = useTranslations("orderForm");
  const [currentBrandId, setCurrentBrandId] = useState<string | null>(initialBrandId ?? null);
  const initialKey = initialTemplateKey ?? initialTemplateSummaries[0]?.key ?? "";
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>(initialKey);
  const [templateDetails, setTemplateDetails] = useState<Record<string, ResolvedTemplate>>(() => {
    if (initialTemplate) {
      return { [initialTemplate.key]: initialTemplate };
    }
    return {};
  });
  const [templateLoadingKey, setTemplateLoadingKey] = useState<string | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);

  useEffect(() => {
    if (initialTemplate) {
      setTemplateDetails((current) => {
        if (current[initialTemplate.key]) return current;
        return { ...current, [initialTemplate.key]: initialTemplate };
      });
    }
  }, [initialTemplate]);

  const queryClient = useQueryClient();
  const initialBrandData = useMemo(
    () => ({
      templates: initialTemplateSummaries,
      addresses: initialAddresses,
      initialTemplate: initialTemplate ?? null,
      initialTemplateKey: initialTemplateKey ?? initialTemplateSummaries[0]?.key ?? null,
      brandId: initialBrandId ?? null,
    }),
    [initialTemplateSummaries, initialAddresses, initialTemplate, initialTemplateKey, initialBrandId],
  );

  useEffect(() => {
    if (initialBrandData.brandId) {
      queryClient.setQueryData(["brand-resources", initialBrandData.brandId], initialBrandData);
    }
  }, [initialBrandData, queryClient]);

  const brandQuery = useQuery<BrandResourcePayload>({
    queryKey: ["brand-resources", currentBrandId ?? "none"],
    queryFn: () => brandResourcesFetcher(currentBrandId!),
    enabled: Boolean(currentBrandId),
  });

  const brandData: BrandResourcePayload = currentBrandId
    ? brandQuery.data ?? {
        templates: [],
        addresses: [],
        initialTemplate: null,
        initialTemplateKey: null,
        brandId: currentBrandId,
      }
    : initialBrandData;

  const templates = brandData.templates;
  const addresses = brandData.addresses;
  const derivedInitialTemplate = brandData.initialTemplate;
  const isBrandLoading = currentBrandId ? brandQuery.isFetching : false;
  const brandError = currentBrandId ? (brandQuery.error instanceof Error ? brandQuery.error.message : null) : null;

  useEffect(() => {
    if (derivedInitialTemplate) {
      setTemplateDetails((current) => {
        if (current[derivedInitialTemplate.key]) return current;
        return { ...current, [derivedInitialTemplate.key]: derivedInitialTemplate };
      });
    }
  }, [derivedInitialTemplate]);

  const selectedSummary = useMemo(() => {
    if (templates.length === 0) return null;
    return templates.find((tpl) => tpl.key === selectedTemplateKey) ?? templates[0]!;
  }, [templates, selectedTemplateKey]);

  const selectedTemplate = selectedSummary ? templateDetails[selectedSummary.key] ?? null : null;
  const selectedSummaryKey = selectedSummary?.key ?? "";
  const templateLoaded = selectedSummaryKey ? Boolean(templateDetails[selectedSummaryKey]) : false;
  const templateIsLoading = selectedSummaryKey ? templateLoadingKey === selectedSummaryKey : false;

  const lastBrandIdRef = useRef<string | null>(initialBrandData.brandId ?? null);

  useEffect(() => {
    if (templates.length === 0) {
      if (selectedTemplateKey) setSelectedTemplateKey("");
      return;
    }

    const brandIdentity = brandData.brandId ?? currentBrandId ?? null;
    const availableKeys = templates.map((tpl) => tpl.key);
    const defaultKey =
      brandData.initialTemplateKey && availableKeys.includes(brandData.initialTemplateKey)
        ? brandData.initialTemplateKey
        : availableKeys[0] ?? "";

    if (brandIdentity && brandIdentity !== lastBrandIdRef.current) {
      lastBrandIdRef.current = brandIdentity;
      if (defaultKey) {
        setSelectedTemplateKey(defaultKey);
      }
      return;
    }

    const exists = availableKeys.includes(selectedTemplateKey);
    if (!exists && defaultKey) {
      setSelectedTemplateKey(defaultKey);
    }
  }, [brandData.initialTemplateKey, brandData.brandId, templates, currentBrandId]);

  useEffect(() => {
    if (!selectedSummaryKey || templateLoaded) return;
    let cancelled = false;
    setTemplateError(null);
    setTemplateLoadingKey(selectedSummaryKey);
    const params = new URLSearchParams({ key: selectedSummaryKey });
    if (currentBrandId) params.set("brandId", currentBrandId);
    fetch(`/api/templates/resolve?${params.toString()}`)
      .then((response) => {
        if (!response.ok) throw new Error("Failed to load template");
        return response.json();
      })
      .then((data) => {
        if (cancelled) return;
        if (data?.template) {
          setTemplateDetails((current) => ({ ...current, [data.template.key]: data.template }));
        } else {
          throw new Error("Template not available");
        }
      })
      .catch((error) => {
        if (cancelled) return;
        setTemplateError(error instanceof Error ? error.message : "Failed to load template");
      })
      .finally(() => {
        if (cancelled) return;
        setTemplateLoadingKey((current) => (current === selectedSummaryKey ? null : current));
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSummaryKey, templateLoaded, currentBrandId]);

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
  const [addressInputValue, setAddressInputValue] = useState("");
  const [addressSearch, setAddressSearch] = useState("");
  const [isAddressDropdownOpen, setAddressDropdownOpen] = useState(false);
  const [selectedAddressEntry, setSelectedAddressEntry] = useState<BrandAddressEntry | null>(null);
  const [frontOverflow, setFrontOverflow] = useState(false);
  const [backOverflow, setBackOverflow] = useState(false);
  const [frontPreviewReady, setFrontPreviewReady] = useState(false);
  const [backPreviewReady, setBackPreviewReady] = useState(false);
  const hasOverflow = frontOverflow || backOverflow;
  const previewReady = frontPreviewReady && backPreviewReady;
  const [showPreviewSkeleton, setShowPreviewSkeleton] = useState(true);

  const getAddressBlockFromEntry = useCallback(
    (entry?: BrandAddressEntry | null) => {
      if (!entry) return "";
      const stored = entry.cardAddressText?.trim();
      if (stored) return stored;
      return buildAddressBlock({
        companyName: entry.company ?? undefined,
        street: entry.street ?? undefined,
        postalCode: entry.postalCode ?? undefined,
        city: entry.city ?? undefined,
        countryCode: entry.countryCode ?? undefined,
        locale: localeShort,
      });
    },
    [localeShort],
  );

  const handleBrandChange = useCallback(
    (nextBrandId: string) => {
      if (!nextBrandId || nextBrandId === currentBrandId) return;
      setCurrentBrandId(nextBrandId);
      setTemplateError(null);
    },
    [currentBrandId],
  );

  useEffect(() => {
    setSelectedAddressEntry(null);
    setAddressInputValue("");
    setAddressSearch("");
    setAddressBlock("");
  }, [currentBrandId]);

  const formatPhoneValue = useCallback((value: string) => {
    if (!value || !value.trim()) return value;
    try {
      const parsed = parsePhoneNumberFromString(value);
      if (parsed) return parsed.formatInternational();
    } catch (error) {
      console.warn("[order-form] phone format failed", error);
    }
    return value.trim();
  }, []);

  const handleFormatPhone = useCallback(
    (type: "phone" | "mobile") => {
      if (type === "phone") {
        setPhone((prev) => formatPhoneValue(prev));
      } else {
        setMobile((prev) => formatPhoneValue(prev));
      }
    },
    [formatPhoneValue],
  );

  useEffect(() => {
    setFrontPreviewReady(false);
    setBackPreviewReady(false);
    setShowPreviewSkeleton(true);
  }, [selectedTemplateKey]);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    if (previewReady) {
      timeout = setTimeout(() => {
        setShowPreviewSkeleton(false);
      }, 400);
    } else {
      setShowPreviewSkeleton(true);
    }
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [previewReady]);

  const countryOptions = useMemo(() => {
    return COUNTRY_CODES.map((code) => ({ code, label: getCountryLabel(localeShort, code) })).sort((a, b) =>
      a.label.localeCompare(b.label, localeShort === "de" ? "de" : "en"),
    );
  }, [localeShort]);

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
    const displayLabel = entry.label || entry.company || "";
    setAddressInputValue(displayLabel);
    setAddressSearch("");
    setAddressDropdownOpen(false);
    setSelectedAddressEntry(entry);
    setAddressBlock(getAddressBlockFromEntry(entry));
  };

  const handleLoadAddressDefault = () => {
    if (!selectedAddressEntry) return;
    setAddressBlock(getAddressBlockFromEntry(selectedAddressEntry));
  };

  const estimatedDeliveryDate = useMemo(() => {
    const option = DELIVERY_OPTIONS[deliveryTime];
    if (!option) return null;
    const target = addBusinessDays(new Date(), option.businessDays);
    return formatDeliveryDate(target, deliveryLocale);
  }, [deliveryTime, deliveryLocale]);

  const resolvedProfile = useMemo<ProfilePrefill | null>(() => {
    const merged: ProfilePrefill = { ...(initialProfile ?? {}) };

    const assignIfMissing = (key: keyof ProfilePrefill, value?: string | null) => {
      const existing = merged[key];
      const hasExistingValue =
        typeof existing === "string" ? existing.trim().length > 0 : Boolean(existing);
      if (hasExistingValue) return;
      if (!value) return;
      const normalized = typeof value === "string" ? value.trim() : value;
      if (!normalized) return;
      merged[key] = normalized;
    };

    if (sessionUser) {
      assignIfMissing("name", sessionUser.name ?? null);
      assignIfMissing("jobTitle", sessionUser.jobTitle ?? null);
      assignIfMissing("email", sessionUser.email ?? null);
      assignIfMissing("businessPhone", sessionUser.businessPhone ?? null);
      assignIfMissing("mobilePhone", sessionUser.mobilePhone ?? null);
      assignIfMissing("url", sessionUser.url ?? null);
    }

    const hasValue = (["name", "jobTitle", "email", "businessPhone", "mobilePhone", "url"] as (keyof ProfilePrefill)[]).some(
      (field) => {
        const value = merged[field];
        if (typeof value === "string") return value.trim().length > 0;
        return Boolean(value);
      },
    );

    return hasValue ? merged : null;
  }, [initialProfile, sessionUser]);

  useEffect(() => {
    if (!resolvedProfile || hasPrefilledProfile.current) return;
    if (resolvedProfile.name) setName(resolvedProfile.name);
    if (resolvedProfile.jobTitle) setRole(resolvedProfile.jobTitle);
    if (resolvedProfile.email) setEmail(resolvedProfile.email);
    if (resolvedProfile.businessPhone) setPhone(resolvedProfile.businessPhone);
    if (resolvedProfile.mobilePhone) setMobile(resolvedProfile.mobilePhone);
    if (resolvedProfile.url) {
      setUrl((prev) => (prev ? prev : resolvedProfile.url ?? ""));
    }
    hasPrefilledProfile.current = true;
  }, [resolvedProfile]);

  useEffect(() => {
    if (!email) return;
    setUrl((prev) => (prev ? prev : buildWebsiteFromEmail(email)));
  }, [email]);

  const [previewView, setPreviewView] = useState<"front" | "back">("front");
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmView, setConfirmView] = useState<"front" | "back">("front");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const mustSelectBrand = availableBrands.length > 1 && !currentBrandId;
  const noTemplatesForBrand = Boolean(currentBrandId) && templates.length === 0 && !templateIsLoading && !isBrandLoading;

  const canSubmitOrder = Boolean(selectedSummary) && !templateIsLoading && !mustSelectBrand;

  const openConfirm = () => {
    if (isSubmitting || !canSubmitOrder) return;
    setSubmitError(null);
    setConfirmView("front");
    setIsConfirmOpen(true);
  };

  const confirmOrder = async () => {
    if (!selectedSummary || !selectedTemplate) return;
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
          brandId: currentBrandId,
          template: selectedSummary.key,
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
        <Button
          onClick={openConfirm}
          className="self-start sm:self-auto lg:hidden"
          disabled={!canSubmitOrder || hasOverflow || isSubmitting}
        >
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

                {availableBrands.length > 1 ? (
                  <div className="grid gap-2">
                    <Label htmlFor="brand">{tOrder("brand")}</Label>
                    <Select
                      value={currentBrandId ?? ""}
                      onValueChange={(value) => {
                        handleBrandChange(value);
                      }}
                      disabled={isBrandLoading}
                    >
                      <SelectTrigger id="brand">
                        <SelectValue placeholder={tOrder("placeholders.brand")} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableBrands.map((brand) => (
                          <SelectItem key={brand.id} value={brand.id}>
                            {brand.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {brandError ? <p className="text-xs text-red-600">{brandError}</p> : null}
                    {mustSelectBrand ? (
                      <p className="text-xs text-slate-500">{tOrder("selectBrandPrompt")}</p>
                    ) : null}
                  </div>
                ) : null}

                <div className="grid gap-2">
                  <Label htmlFor="template">{tOrder("template")}</Label>
                  <Select
                    value={selectedTemplateKey}
                    onValueChange={(next) => {
                      setSelectedTemplateKey(next);
                    }}
                    disabled={mustSelectBrand || isBrandLoading || templates.length === 0}
                  >
                    <SelectTrigger id="template">
                      <SelectValue placeholder={tOrder("placeholders.template")} />
                    </SelectTrigger>
                    <SelectContent>
                        {templates.map((tpl) => (
                          <SelectItem key={tpl.key} value={tpl.key}>
                            {tpl.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                  </Select>
                  {mustSelectBrand ? (
                    <p className="text-xs text-slate-500">{tOrder("selectBrandPrompt")}</p>
                  ) : null}
                  {noTemplatesForBrand ? (
                    <p className="text-xs text-red-600">{tOrder("noTemplatesForBrand")}</p>
                  ) : null}
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
                <div className="relative">
                  <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="pr-16" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 text-xs"
                    onClick={() => handleFormatPhone("phone")}
                  >
                    {tOrder("buttons.format")}
                  </Button>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="mobile">{tOrder("fields.mobile")}</Label>
                <div className="relative">
                  <Input id="mobile" value={mobile} onChange={(e) => setMobile(e.target.value)} className="pr-16" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 text-xs"
                    onClick={() => handleFormatPhone("mobile")}
                  >
                    {tOrder("buttons.format")}
                  </Button>
                </div>
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
                        value={addressInputValue}
                        onFocus={(e) => {
                          setAddressDropdownOpen(true);
                          setAddressSearch("");
                          e.target.select();
                        }}
                        onBlur={() => setTimeout(() => setAddressDropdownOpen(false), 150)}
                        onChange={(e) => {
                          setAddressInputValue(e.target.value);
                          setAddressSearch(e.target.value);
                          if (!isAddressDropdownOpen) setAddressDropdownOpen(true);
                        }}
                        placeholder={tOrder("placeholders.addressSearch") ?? ""}
                        className={`border-slate-300 bg-slate-50 pr-10 focus-visible:border-slate-400 focus-visible:ring-slate-200 ${isAddressDropdownOpen ? "cursor-text" : "cursor-pointer"}`}
                      />
                      <ChevronDown
                        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                        aria-hidden="true"
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
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="addressBlock">{tOrder("fields.addressExtra")}</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleLoadAddressDefault}
                      disabled={!selectedAddressEntry}
                    >
                      {tOrder("buttons.loadAddressDefault")}
                    </Button>
                  </div>
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
                  {showPreviewSkeleton && selectedTemplate ? (
                    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 transition-opacity duration-300">
                      <div className="animate-pulse text-xs font-medium text-slate-500">
                        {tOrder("preview.loading")}
                      </div>
                    </div>
                  ) : null}
                  <div
                    className={`h-full w-full transition-opacity duration-300 ${
                      selectedTemplate ? (previewReady ? "opacity-100" : "opacity-0") : "opacity-100"
                    }`}
                  >
                    {!currentBrandId ? (
                      <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500 text-center px-4">
                        {tOrder("selectBrandPrompt")}
                      </div>
                    ) : templates.length === 0 ? (
                      <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500 text-center px-4">
                        {tOrder("preview.noTemplates")}
                      </div>
                    ) : !selectedSummary ? (
                      <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500 text-center px-4">
                        {tOrder("preview.selectTemplate")}
                      </div>
                    ) : !selectedTemplate ? (
                      <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500 text-center px-4">
                        {templateError ?? tOrder("preview.loading")}
                      </div>
                    ) : (
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
                            onReadyChange={setFrontPreviewReady}
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
                            onReadyChange={setBackPreviewReady}
                          />
                        }
                        className="h-full w-full"
                      />
                    )}
                  </div>
                </div>
                {templateError ? (
                  <p className="mt-2 text-center text-xs text-red-600">{templateError}</p>
                ) : null}
              </div>
            </CardContent>
          </Card>
          <div className="hidden lg:flex lg:justify-end">
            <Button onClick={openConfirm} className="px-6" disabled={!canSubmitOrder || hasOverflow || isSubmitting}>
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
            <div className="flex w-full justify-end gap-2">
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
                  {selectedTemplate ? (
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
                  ) : (
                    <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/60 text-sm text-slate-500">
                      {templateError ?? tOrder("preview.loading")}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {isSubmitting ? (
              <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                {tOrder("confirm.generating")}
              </p>
            ) : null}

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
            <LoadingButton
              onClick={confirmOrder}
              loading={isSubmitting}
              loadingText={tOrder("confirm.submitting")}
              disabled={hasOverflow || !canSubmitOrder}
            >
              {tOrder("confirm.submit")}
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Analytics />
    </section>
  );
}
