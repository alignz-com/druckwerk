"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { AlertCircle, ChevronDown, Info, ImagePlus } from "lucide-react";
import dynamic from "next/dynamic";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Cropper, { type Area } from "react-easy-crop";

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
import { cn } from "@/lib/utils";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { designHasBinding } from "@/lib/template-design";
import { DEFAULT_ORDER_QUANTITIES } from "@/lib/order-quantities";

const DEMO_PROFILE: ProfilePrefill = {
  name: "Anna Berger",
  jobTitle: "Projektleiterin",
  seniority: "",
  email: "anna.berger@beispiel.at",
  businessPhone: "+43 1 234 56 78",
  mobilePhone: "+43 664 123 456 78",
  url: "www.beispiel.at",
  linkedin: "linkedin.com/in/anna-berger",
};

function PreviewSkeleton() {
  return <div className="h-full w-full rounded-2xl border border-slate-200 bg-slate-50" />;
}

const createImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (event) => reject(event));
    image.src = url;
  });

const getCroppedPhoto = async (imageSrc: string, pixelCrop: Area) => {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const width = Math.round(pixelCrop.width);
  const height = Math.round(pixelCrop.height);
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  ctx.beginPath();
  ctx.arc(width / 2, height / 2, Math.min(width, height) / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(image, -pixelCrop.x, -pixelCrop.y);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Failed to crop image"));
    }, "image/png");
  });
};

const FlipCard = dynamic(() => import("@/components/FlipCard"), {
  ssr: false,
});

const MAX_ADDRESS_BLOCK_LINES = 4;
const SIGNED_URL_REFRESH_BUFFER_MS = 5 * 60 * 1000;
const PREVIEW_MESSAGE_CLASS =
  "flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 text-center text-sm font-medium";
type OverflowFieldKey =
  | "name"
  | "role"
  | "seniority"
  | "email"
  | "phone"
  | "mobile"
  | "url"
  | "linkedin"
  | "addressBlock";
const bindingFieldMap: Record<string, OverflowFieldKey> = {
  name: "name",
  role: "role",
  seniority: "seniority",
  email: "email",
  phone: "phone",
  mobile: "mobile",
  url: "url",
  linkedin: "linkedin",
};

const mapBindingToField = (binding: string): OverflowFieldKey | null => {
  if (!binding) return null;
  if (binding.startsWith("company")) return "addressBlock";
  return bindingFieldMap[binding as keyof typeof bindingFieldMap] ?? null;
};

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

type BrandProfilePayload = {
  name?: string | null;
  jobTitle?: string | null;
  seniority?: string | null;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  url?: string | null;
  linkedin?: string | null;
  addressId?: string | null;
  addressLabel?: string | null;
  companyName?: string | null;
  street?: string | null;
  postalCode?: string | null;
  city?: string | null;
  countryCode?: string | null;
  addressBlock?: string | null;
  updatedAt?: string | null;
};

type BrandResourcePayload = {
  templates: TemplateSummary[];
  addresses: BrandAddressEntry[];
  initialTemplate: ResolvedTemplate | null;
  initialTemplateKey: string | null;
  brandId: string | null;
  qrMode?: "VCARD_ONLY" | "PUBLIC_PROFILE_ONLY" | "BOTH";
  defaultQrMode?: "VCARD_ONLY" | "PUBLIC_PROFILE_ONLY" | null;
  templateAddressMap?: Record<string, string[]>;
  quantityMin?: number | null;
  quantityMax?: number | null;
  quantityStep?: number | null;
  quantityOptions?: number[] | null;
  profile: BrandProfilePayload | null;
};

type ProfilePrefill = {
  name?: string | null;
  jobTitle?: string | null;
  seniority?: string | null;
  email?: string | null;
  businessPhone?: string | null;
  mobilePhone?: string | null;
  url?: string | null;
  linkedin?: string | null;
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

function getEarliestSignedAssetExpiry(template: ResolvedTemplate | null): number | null {
  if (!template) return null;
  const timestamps: number[] = [];
  template.assets?.forEach((asset) => {
    if (!asset?.expiresAt) return;
    const ts = Date.parse(asset.expiresAt);
    if (!Number.isNaN(ts)) timestamps.push(ts);
  });
  template.fonts.forEach((font) => {
    if (!font.expiresAt) return;
    const ts = Date.parse(font.expiresAt);
    if (!Number.isNaN(ts)) timestamps.push(ts);
  });
  if (timestamps.length === 0) return null;
  return Math.min(...timestamps);
}

export type OrderFormProps = {
  availableBrands?: BrandOption[];
  initialBrandId?: string | null;
  initialTemplateSummaries: TemplateSummary[];
  initialTemplate?: ResolvedTemplate | null;
  initialAddresses?: BrandAddressEntry[];
  initialTemplateKey?: string | null;
  initialBrandQrMode?: "VCARD_ONLY" | "PUBLIC_PROFILE_ONLY" | "BOTH" | null;
  initialBrandDefaultQrMode?: "VCARD_ONLY" | "PUBLIC_PROFILE_ONLY" | null;
  initialBrandQuantityMin?: number | null;
  initialBrandQuantityMax?: number | null;
  initialBrandQuantityStep?: number | null;
  initialBrandQuantityOptions?: number[] | null;
  initialProfile?: ProfilePrefill | null;
  initialBrandProfile?: BrandProfilePayload | null;
  isDemo?: boolean;
};

export default function OrderForm({
  availableBrands = [],
  initialBrandId,
  initialTemplateSummaries,
  initialTemplate,
  initialAddresses = [],
  initialTemplateKey = null,
  initialBrandQrMode = null,
  initialBrandDefaultQrMode = null,
  initialBrandQuantityMin = null,
  initialBrandQuantityMax = null,
  initialBrandQuantityStep = null,
  initialBrandQuantityOptions = null,
  initialProfile = null,
  initialBrandProfile = null,
  isDemo = false,
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
  const templateRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTemplateRefreshTimeout = useCallback(() => {
    if (templateRefreshTimeoutRef.current !== null) {
      clearTimeout(templateRefreshTimeoutRef.current);
      templateRefreshTimeoutRef.current = null;
    }
  }, []);

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
      qrMode: initialBrandQrMode ?? "VCARD_ONLY",
      defaultQrMode: initialBrandDefaultQrMode ?? null,
      quantityMin: initialBrandQuantityMin ?? null,
      quantityMax: initialBrandQuantityMax ?? null,
      quantityStep: initialBrandQuantityStep ?? null,
      quantityOptions: initialBrandQuantityOptions ?? null,
      profile: initialBrandProfile ?? null,
    }),
    [
      initialTemplateSummaries,
      initialAddresses,
      initialTemplate,
      initialTemplateKey,
      initialBrandId,
      initialBrandQrMode,
      initialBrandDefaultQrMode,
      initialBrandQuantityMin,
      initialBrandQuantityMax,
      initialBrandQuantityStep,
      initialBrandQuantityOptions,
      initialBrandProfile,
    ],
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
    gcTime: 0,
  });

  useEffect(() => {
    return () => {
      queryClient.removeQueries({ queryKey: ["brand-resources"] });
    };
  }, [queryClient]);

  const brandData: BrandResourcePayload = currentBrandId
    ? brandQuery.data ?? {
        templates: [],
        addresses: [],
        templateAddressMap: {},
        qrMode: "VCARD_ONLY",
        defaultQrMode: null,
        quantityMin: null,
        quantityMax: null,
        quantityStep: null,
        quantityOptions: null,
        initialTemplate: null,
        initialTemplateKey: null,
        brandId: currentBrandId,
        profile: null,
      }
    : initialBrandData;

  const templates = brandData.templates;
  const addresses = brandData.addresses;
  const derivedInitialTemplate = brandData.initialTemplate;
  const isBrandLoading = currentBrandId ? brandQuery.isFetching : false;
  const brandError = currentBrandId ? (brandQuery.error instanceof Error ? brandQuery.error.message : null) : null;
  const [quantity, setQuantity] = useState<string>(String(DEFAULT_ORDER_QUANTITIES[1]));
  const quantityOptions = useMemo(() => {
    const explicit = Array.isArray(brandData.quantityOptions)
      ? Array.from(new Set(brandData.quantityOptions.filter((value) => Number.isFinite(value) && value > 0)))
      : [];
    if (explicit.length > 0) {
      return explicit.sort((a, b) => a - b);
    }
    const min = brandData.quantityMin ?? null;
    const max = brandData.quantityMax ?? null;
    const step = brandData.quantityStep ?? 1;
    if (
      min !== null &&
      max !== null &&
      Number.isFinite(min) &&
      Number.isFinite(max) &&
      min > 0 &&
      max >= min &&
      step > 0
    ) {
      const values: number[] = [];
      for (let current = min; current <= max; current += step) {
        values.push(current);
      }
      if (values.length > 0) return values;
    }
    return DEFAULT_ORDER_QUANTITIES;
  }, [brandData.quantityMax, brandData.quantityMin, brandData.quantityOptions, brandData.quantityStep]);

  useEffect(() => {
    if (quantityOptions.length === 0) return;
    if (!quantityOptions.includes(Number(quantity))) {
      setQuantity(String(quantityOptions[0]));
    }
  }, [quantity, quantityOptions]);

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
  const templateHasQrCode = Boolean(selectedSummary?.hasQrCode ?? selectedTemplate?.hasQrCode ?? false);
  const templateHasPhotoSlot = Boolean(selectedSummary?.hasPhotoSlot ?? selectedTemplate?.hasPhotoSlot ?? false);
  const templateSupportsSeniority = useMemo(
    () => designHasBinding(selectedTemplate?.design ?? null, "seniority"),
    [selectedTemplate],
  );
  const templateAddressIds = useMemo(() => {
    if (!selectedSummary?.id) return [];
    return brandData.templateAddressMap?.[selectedSummary.id] ?? [];
  }, [brandData.templateAddressMap, selectedSummary?.id]);
  const brandQrMode = brandData.qrMode ?? "VCARD_ONLY";
  const brandDefaultQrMode = brandData.defaultQrMode ?? null;
  const [selectedQrMode, setSelectedQrMode] = useState<"vcard" | "public">("vcard");

  const lastBrandIdRef = useRef<string | null>(initialBrandData.brandId ?? null);
  const lastBrandProfileSignatureRef = useRef<string | null>(null);
  const brandProfileCacheRef = useRef<Map<string, BrandProfilePayload>>(new Map());

  useEffect(() => {
    if (brandQrMode === "PUBLIC_PROFILE_ONLY") {
      setSelectedQrMode("public");
    } else if (brandQrMode === "BOTH") {
      setSelectedQrMode(brandDefaultQrMode === "PUBLIC_PROFILE_ONLY" ? "public" : "vcard");
    } else {
      setSelectedQrMode("vcard");
    }
  }, [brandQrMode, brandDefaultQrMode]);

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

  const loadTemplate = useCallback(
    async (
      templateKey: string,
      opts: {
        silent?: boolean;
        signal?: AbortSignal;
      } = {},
    ) => {
      if (!templateKey) return null;
      const { silent = false, signal } = opts;
      if (!silent) {
        setTemplateError(null);
        setTemplateLoadingKey(templateKey);
      }
      try {
        const params = new URLSearchParams({ key: templateKey });
        if (currentBrandId) params.set("brandId", currentBrandId);
        const response = await fetch(`/api/templates/resolve?${params.toString()}`, { signal });
        if (!response.ok) throw new Error("Failed to load template");
        const data = await response.json();
        if (!data?.template) {
          throw new Error("Template not available");
        }
        const template: ResolvedTemplate = data.template;
        setTemplateDetails((current) => ({ ...current, [template.key]: template }));
        return template;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return null;
        }
        if (!silent) {
          setTemplateError(error instanceof Error ? error.message : "Failed to load template");
        } else {
          console.warn("[order-form] Silent template refresh failed", error);
        }
        return null;
      } finally {
        if (!silent) {
          setTemplateLoadingKey((current) => (current === templateKey ? null : current));
        }
      }
    },
    [currentBrandId],
  );

  useEffect(() => {
    if (!selectedSummaryKey || templateLoaded) return;
    const controller = new AbortController();
    loadTemplate(selectedSummaryKey, { signal: controller.signal });
    return () => {
      controller.abort();
    };
  }, [selectedSummaryKey, templateLoaded, loadTemplate]);

  useEffect(() => {
    clearTemplateRefreshTimeout();
    if (!selectedTemplate) return;
    const earliestExpiry = getEarliestSignedAssetExpiry(selectedTemplate);
    if (!earliestExpiry) return;
    const refreshAt = earliestExpiry - SIGNED_URL_REFRESH_BUFFER_MS;
    const delay = refreshAt - Date.now();
    if (delay <= 0) {
      loadTemplate(selectedTemplate.key, { silent: true });
      return;
    }
    templateRefreshTimeoutRef.current = setTimeout(() => {
      loadTemplate(selectedTemplate.key, { silent: true });
    }, delay);
    return () => {
      clearTemplateRefreshTimeout();
    };
  }, [selectedTemplate, loadTemplate, clearTemplateRefreshTimeout]);

  const [deliveryTime, setDeliveryTime] = useState<DeliveryOption>("standard");
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [seniority, setSeniority] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [mobile, setMobile] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [street, setStreet] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [countryCode, setCountryCode] = useState<string>("");
  const [url, setUrl] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [customerReference, setCustomerReference] = useState("");
  const [addressBlock, setAddressBlock] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoSource, setPhotoSource] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState("photo");
  const [isCropOpen, setIsCropOpen] = useState(false);
  const [isCropping, setIsCropping] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [frontOverflowFields, setFrontOverflowFields] = useState<string[]>([]);
  const [backOverflowFields, setBackOverflowFields] = useState<string[]>([]);
  const handleFrontOverflowFields = useCallback((fields: string[]) => {
    setFrontOverflowFields((previous) => {
      if (previous.length === fields.length && previous.every((value, index) => value === fields[index])) {
        return previous;
      }
      return fields;
    });
  }, []);
  const handleBackOverflowFields = useCallback((fields: string[]) => {
    setBackOverflowFields((previous) => {
      if (previous.length === fields.length && previous.every((value, index) => value === fields[index])) {
        return previous;
      }
      return fields;
    });
  }, []);
  const addressBlockLineCount = useMemo(() => {
    if (!addressBlock) return 0;
    return addressBlock.replace(/\r\n/g, "\n").split("\n").length;
  }, [addressBlock]);
  const addressBlockHasOverflow = addressBlockLineCount > MAX_ADDRESS_BLOCK_LINES;
  const [addressInputValue, setAddressInputValue] = useState("");
  const [addressSearch, setAddressSearch] = useState("");
  const [isAddressDropdownOpen, setAddressDropdownOpen] = useState(false);
  const [selectedAddressEntry, setSelectedAddressEntry] = useState<BrandAddressEntry | null>(null);
  const [frontOverflow, setFrontOverflow] = useState(false);
  const [backOverflow, setBackOverflow] = useState(false);
  const overflowFieldSet = useMemo(() => {
    const set = new Set<OverflowFieldKey>();
    const register = (fields: string[]) => {
      fields.forEach((field) => {
        const mapped = mapBindingToField(field);
        if (mapped) set.add(mapped);
      });
    };
    register(frontOverflowFields);
    register(backOverflowFields);
    if (addressBlockHasOverflow) set.add("addressBlock");
    return set;
  }, [frontOverflowFields, backOverflowFields, addressBlockHasOverflow]);
  const forcedBindingPrefixes = useMemo(() => {
    const prefixes: string[] = [];
    if (overflowFieldSet.has("addressBlock") || addressBlockHasOverflow) {
      prefixes.push("company", "companyPrimary", "companySecondary", "companyLines");
    }
    return prefixes;
  }, [overflowFieldSet, addressBlockHasOverflow]);
  const fieldOverflowMessage = tOrder("errors.fieldOverflow");
  const fieldErrorClass = "border-red-400 focus-visible:ring-red-200 focus-visible:border-red-400";
  const getFieldTitle = (field: OverflowFieldKey) => (overflowFieldSet.has(field) ? fieldOverflowMessage : undefined);
  const nameOverflow = overflowFieldSet.has("name");
  const roleOverflow = overflowFieldSet.has("role");
  const seniorityOverflow = overflowFieldSet.has("seniority");
  const emailOverflow = overflowFieldSet.has("email");
  const phoneOverflow = overflowFieldSet.has("phone");
  const mobileOverflow = overflowFieldSet.has("mobile");
  const urlOverflow = overflowFieldSet.has("url");
  const linkedinOverflow = overflowFieldSet.has("linkedin");
  const addressBlockOverflow = overflowFieldSet.has("addressBlock") || addressBlockHasOverflow;
  const hasOverflow = frontOverflow || backOverflow || addressBlockOverflow;

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

  const addressOptions = useMemo(() => {
    if (templateAddressIds.length === 0) return addresses;
    const allowed = new Set(templateAddressIds);
    return addresses.filter((entry) => allowed.has(entry.id));
  }, [addresses, templateAddressIds]);
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
  // Show all filtered options; scroll container handles large lists.
  const handleSelectAddress = useCallback((entry: BrandAddressEntry) => {
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
  }, [getAddressBlockFromEntry]);

  const displayedAddressOptions = useMemo(() => filteredAddressOptions, [filteredAddressOptions]);

  useEffect(() => {
    if (!selectedSummary) return;
    const isRestricted = templateAddressIds.length > 0;
    if (!isRestricted) return;
    if (selectedAddressEntry && !addressOptions.some((entry) => entry.id === selectedAddressEntry.id)) {
      setSelectedAddressEntry(null);
      setAddressInputValue("");
      setAddressSearch("");
    }
    if (addressOptions.length === 1) {
      const only = addressOptions[0];
      if (!selectedAddressEntry || selectedAddressEntry.id !== only.id) {
        handleSelectAddress(only);
      }
    }
  }, [selectedSummary, templateAddressIds, addressOptions, selectedAddressEntry, handleSelectAddress]);

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
    if (isDemo) return DEMO_PROFILE;
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

    assignIfMissing("linkedin", initialProfile?.linkedin ?? null);
    assignIfMissing("seniority", initialProfile?.seniority ?? null);

    if (sessionUser) {
      assignIfMissing("name", sessionUser.name ?? null);
      assignIfMissing("jobTitle", sessionUser.jobTitle ?? null);
      assignIfMissing("email", sessionUser.email ?? null);
      assignIfMissing("businessPhone", sessionUser.businessPhone ?? null);
      assignIfMissing("mobilePhone", sessionUser.mobilePhone ?? null);
      assignIfMissing("url", sessionUser.url ?? null);
    }

    const hasValue = (
      ["name", "jobTitle", "seniority", "email", "businessPhone", "mobilePhone", "url", "linkedin"] as (keyof ProfilePrefill)[]
    ).some(
      (field) => {
        const value = merged[field];
        if (typeof value === "string") return value.trim().length > 0;
        return Boolean(value);
      },
    );

    return hasValue ? merged : null;
  }, [initialProfile, sessionUser]);

  const applyGeneralProfileValues = useCallback(() => {
    if (!resolvedProfile) return;
    if (resolvedProfile.name) setName(resolvedProfile.name);
    if (resolvedProfile.jobTitle) setRole(resolvedProfile.jobTitle);
    if (resolvedProfile.seniority) setSeniority(resolvedProfile.seniority);
    if (resolvedProfile.email) setEmail(resolvedProfile.email);
    if (resolvedProfile.businessPhone) setPhone(resolvedProfile.businessPhone);
    if (resolvedProfile.mobilePhone) setMobile(resolvedProfile.mobilePhone);
    if (resolvedProfile.url) setUrl(resolvedProfile.url);
    if (resolvedProfile.linkedin) setLinkedin(resolvedProfile.linkedin);
  }, [resolvedProfile]);

  useEffect(() => {
    if (!resolvedProfile || hasPrefilledProfile.current) return;
    applyGeneralProfileValues();
    hasPrefilledProfile.current = true;
  }, [resolvedProfile, applyGeneralProfileValues]);

  const applyBrandProfile = useCallback(
    (profile: BrandProfilePayload | null) => {
      if (!profile) {
        setSelectedAddressEntry(null);
        setAddressInputValue("");
        setAddressSearch("");
        setAddressDropdownOpen(false);
        setCompanyName("");
        setStreet("");
        setPostalCode("");
        setCity("");
        setCountryCode("");
        setAddressBlock("");
        setSeniority("");
        return;
      }

      if (profile.name) setName(profile.name);
      if (profile.jobTitle) setRole(profile.jobTitle);
      if (profile.seniority) setSeniority(profile.seniority);
      if (profile.email) setEmail(profile.email);
      if (profile.phone) setPhone(profile.phone);
      if (profile.mobile) setMobile(profile.mobile);
      if (profile.url) setUrl(profile.url);
      if (profile.linkedin) setLinkedin(profile.linkedin);

      const matchedAddress =
        profile.addressId && addresses.length > 0
          ? addresses.find((entry) => entry.id === profile.addressId)
          : null;

      // Only show a saved address label if it still exists for this brand; otherwise start empty.
      const displayLabel = matchedAddress ? matchedAddress.label ?? matchedAddress.company ?? "" : "";
      setSelectedAddressEntry(matchedAddress ?? null);
      setAddressInputValue(displayLabel);
      setAddressSearch("");
      setAddressDropdownOpen(false);
      setCompanyName(profile.companyName ?? matchedAddress?.company ?? "");
      setStreet(profile.street ?? matchedAddress?.street ?? "");
      setPostalCode(profile.postalCode ?? matchedAddress?.postalCode ?? "");
      setCity(profile.city ?? matchedAddress?.city ?? "");
      setCountryCode(profile.countryCode ?? matchedAddress?.countryCode ?? "");

      if (profile.addressBlock) {
        setAddressBlock(profile.addressBlock);
      } else if (matchedAddress) {
        setAddressBlock(getAddressBlockFromEntry(matchedAddress));
      } else {
        setAddressBlock("");
      }
    },
    [addresses, getAddressBlockFromEntry],
  );

  useEffect(() => {
    if (!brandData.brandId) return;
    const signature = `${brandData.brandId}:${brandData.profile?.updatedAt ?? "none"}:${brandData.profile ? "has" : "none"}`;
    if (signature === lastBrandProfileSignatureRef.current) return;
    lastBrandProfileSignatureRef.current = signature;

    if (brandData.profile) {
      brandProfileCacheRef.current.set(brandData.brandId, brandData.profile);
      applyBrandProfile(brandData.profile);
    } else {
      const cached = brandProfileCacheRef.current.get(brandData.brandId);
      if (cached) {
        applyBrandProfile(cached);
        return;
      }
      applyBrandProfile(null);
      applyGeneralProfileValues();
    }
  }, [brandData.brandId, brandData.profile, applyBrandProfile, applyGeneralProfileValues]);

  useEffect(() => {
    if (!email) return;
    setUrl((prev) => (prev ? prev : buildWebsiteFromEmail(email)));
  }, [email]);

  const [previewView, setPreviewView] = useState<"front" | "back">("front");
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmView, setConfirmView] = useState<"front" | "back">("front");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [draftContactId, setDraftContactId] = useState<string | null>(null);
  const [draftPublicUrl, setDraftPublicUrl] = useState<string | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [isDraftCreating, setIsDraftCreating] = useState(false);
  const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastDraftPayloadRef = useRef<string>("");
  const draftBrandIdRef = useRef<string | null>(null);

  const mustSelectBrand = availableBrands.length > 1 && !currentBrandId;
  const noTemplatesForBrand = Boolean(currentBrandId) && templates.length === 0 && !templateIsLoading && !isBrandLoading;

  const canSubmitOrder = Boolean(selectedSummary) && !templateIsLoading && !mustSelectBrand;
  const effectiveLinkedin = templateHasQrCode ? linkedin : "";
  const isPublicQrMode = templateHasQrCode && selectedQrMode === "public";
  const canUploadPhoto = templateHasPhotoSlot && isPublicQrMode;
  const showPublicQrNote = isPublicQrMode;

  const buildDraftPayload = useCallback(() => {
    if (!currentBrandId) return null;
    return {
      brandId: currentBrandId,
      name,
      role,
      seniority: templateSupportsSeniority ? seniority : "",
      email,
      phone,
      mobile,
      url,
      linkedin: effectiveLinkedin,
      photoUrl: canUploadPhoto ? photoUrl : "",
      addressId: templateHasQrCode ? selectedAddressEntry?.id ?? null : null,
    };
  }, [
    currentBrandId,
    name,
    role,
    seniority,
    templateSupportsSeniority,
    email,
    phone,
    mobile,
    url,
    effectiveLinkedin,
    photoUrl,
    canUploadPhoto,
    templateHasQrCode,
    selectedAddressEntry,
  ]);

  const saveDraft = useCallback(
    async (payload: ReturnType<typeof buildDraftPayload>) => {
      if (!payload || !draftContactId) return;
      try {
        const response = await fetch(`/api/public/contacts/draft/${draftContactId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (response.ok) {
          lastDraftPayloadRef.current = JSON.stringify(payload);
        } else {
          console.warn("[order-form] draft save failed", await response.text());
        }
      } catch (error) {
        console.warn("[order-form] draft save failed", error);
      }
    },
    [draftContactId],
  );

  const flushDraftSave = useCallback(() => {
    if (!isPublicQrMode || !draftContactId) return;
    if (draftSaveTimerRef.current) {
      clearTimeout(draftSaveTimerRef.current);
      draftSaveTimerRef.current = null;
    }
    const payload = buildDraftPayload();
    if (payload) {
      void saveDraft(payload);
    }
  }, [isPublicQrMode, draftContactId, buildDraftPayload, saveDraft]);

  useEffect(() => {
    if (!isPublicQrMode) {
      if (draftSaveTimerRef.current) {
        clearTimeout(draftSaveTimerRef.current);
        draftSaveTimerRef.current = null;
      }
      setDraftContactId(null);
      setDraftPublicUrl(null);
      setDraftError(null);
      draftBrandIdRef.current = null;
      lastDraftPayloadRef.current = "";
      return;
    }
    if (!currentBrandId || isDraftCreating) return;
    if (draftContactId && draftBrandIdRef.current === currentBrandId) return;

    const createDraft = async () => {
      setIsDraftCreating(true);
      setDraftError(null);
      try {
        const payload = buildDraftPayload();
        if (!payload) return;
        const response = await fetch("/api/public/contacts/draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data?.error || "Draft creation failed");
        }
        setDraftContactId(data.id);
        setDraftPublicUrl(data.publicUrl);
        draftBrandIdRef.current = currentBrandId;
        lastDraftPayloadRef.current = JSON.stringify(payload);
      } catch (error) {
        setDraftError(error instanceof Error ? error.message : tOrder("errors.generic"));
      } finally {
        setIsDraftCreating(false);
      }
    };

    void createDraft();
  }, [buildDraftPayload, currentBrandId, isDraftCreating, isPublicQrMode, draftContactId, tOrder]);

  useEffect(() => {
    if (!isPublicQrMode || !draftContactId) return;
    const payload = buildDraftPayload();
    if (!payload) return;
    const serialized = JSON.stringify(payload);
    if (serialized === lastDraftPayloadRef.current) return;
    if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);
    draftSaveTimerRef.current = setTimeout(() => {
      void saveDraft(payload);
    }, 800);
    return () => {
      if (draftSaveTimerRef.current) {
        clearTimeout(draftSaveTimerRef.current);
      }
    };
  }, [buildDraftPayload, draftContactId, isPublicQrMode, saveDraft]);

  const openConfirm = () => {
    if (isSubmitting || !canSubmitOrder) return;
    setSubmitError(null);
    setConfirmView("front");
    setIsConfirmOpen(true);
  };

  useEffect(() => {
    if (canUploadPhoto) return;
    setPhotoFile(null);
    setPhotoUrl("");
    setPhotoError(null);
    setPhotoSource(null);
    setIsCropOpen(false);
  }, [canUploadPhoto]);

  useEffect(() => {
    return () => {
      if (photoSource) URL.revokeObjectURL(photoSource);
    };
  }, [photoSource]);

  useEffect(() => {
    if (photoPreviewUrl) {
      URL.revokeObjectURL(photoPreviewUrl);
    }
    if (!photoFile) {
      setPhotoPreviewUrl(null);
      return;
    }
    const preview = URL.createObjectURL(photoFile);
    setPhotoPreviewUrl(preview);
    return () => URL.revokeObjectURL(preview);
  }, [photoFile]);

  const processPhotoFile = (file: File | null) => {
    if (!file) {
      setPhotoFile(null);
      setPhotoUrl("");
      setPhotoError(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setPhotoFile(null);
      setPhotoError(tOrder("errors.photoInvalid"));
      return;
    }
    if (photoSource) URL.revokeObjectURL(photoSource);
    const url = URL.createObjectURL(file);
    setPhotoSource(url);
    setPhotoName(file.name || "photo");
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setIsCropOpen(true);
    setPhotoUrl("");
    setPhotoError(null);
  };

  const handlePhotoChange: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    processPhotoFile(event.target.files?.[0] ?? null);
  };

  const handlePhotoDrop: React.DragEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0] ?? null;
    processPhotoFile(file);
  };

  const handleCropCancel = () => {
    if (photoSource) URL.revokeObjectURL(photoSource);
    setPhotoSource(null);
    setIsCropOpen(false);
    setIsCropping(false);
    setCroppedAreaPixels(null);
  };

  const handleCropConfirm = async () => {
    if (!photoSource || !croppedAreaPixels) {
      setPhotoError(tOrder("errors.photoInvalid"));
      return;
    }
    setIsCropping(true);
    setPhotoError(null);
    try {
      const blob = await getCroppedPhoto(photoSource, croppedAreaPixels);
      const baseName = photoName.replace(/\.[^.]+$/, "") || "photo";
      const croppedFile = new File([blob], `${baseName}-cropped.png`, { type: "image/png" });
      setPhotoFile(croppedFile);
      setPhotoUrl("");
      if (canUploadPhoto) {
        const uploadedUrl = await uploadPhoto(croppedFile);
        if (!uploadedUrl) {
          setPhotoError(tOrder("errors.photoUploadFailed"));
          return;
        }
      }
      handleCropCancel();
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : tOrder("errors.photoUploadFailed"));
    } finally {
      setIsCropping(false);
    }
  };

  const handleFieldBlur: React.FocusEventHandler<HTMLInputElement> = () => {
    flushDraftSave();
  };

  const uploadPhoto = async (fileOverride?: File) => {
    const fileToUpload = fileOverride ?? photoFile;
    if (!fileToUpload) return "";
    setIsUploadingPhoto(true);
    setPhotoError(null);
    try {
      const body = new FormData();
      body.append("file", fileToUpload);
      const response = await fetch("/api/uploads/photo", { method: "POST", body });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error ?? tOrder("errors.photoUploadFailed"));
      }
      const url = String(payload?.url ?? "");
      if (!url) throw new Error(tOrder("errors.photoUploadFailed"));
      setPhotoUrl(url);
      return url;
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : tOrder("errors.photoUploadFailed"));
      return "";
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const confirmOrder = async () => {
    if (!selectedSummary || !selectedTemplate) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const qrAddressPayload = templateHasQrCode
        ? {
            companyName,
            street,
            postalCode,
            city,
            countryCode,
          }
        : undefined;
      const qrAddressId = templateHasQrCode ? selectedAddressEntry?.id ?? null : null;
      const qrAddressLabel = templateHasQrCode ? addressInputValue : null;

      const resolvedPhotoUrl = canUploadPhoto && !photoUrl && photoFile ? await uploadPhoto() : photoUrl;

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          role,
          seniority: templateSupportsSeniority ? seniority : "",
          email,
          phone,
          mobile,
          company: addressBlock,
          url,
          linkedin: effectiveLinkedin,
          brandId: currentBrandId,
          template: selectedSummary.key,
          quantity: Number(quantity),
          deliveryTime,
          customerReference,
          qrMode: templateHasQrCode ? selectedQrMode : undefined,
          draftContactId: isPublicQrMode ? draftContactId ?? undefined : undefined,
          addressId: qrAddressId,
          addressLabel: qrAddressLabel,
          address: qrAddressPayload,
          photoUrl: resolvedPhotoUrl || undefined,
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
    <section>
      {isDemo ? (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          {tOrder("demoBanner")}
        </div>
      ) : null}
      <header className="hidden xl:block">
        <h1 className="text-2xl font-semibold tracking-tight">{tOrder("title")}</h1>
        {tOrder("subtitle") ? (
          <p className="mt-1 text-sm text-slate-500">{tOrder("subtitle")}</p>
        ) : null}
      </header>

      <div className="grid gap-0 items-start xl:mt-10 xl:gap-10 xl:grid-cols-[minmax(320px,420px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(360px,440px)_minmax(0,1fr)] 2xl:gap-12">
        <div className="space-y-8 order-2 xl:order-1 pt-6 xl:pt-0">
          <Card className="h-fit border-0 shadow-none rounded-none xl:rounded-xl xl:border xl:shadow-sm">
            <CardHeader className="pb-2 px-0 xl:px-6">
              <CardTitle className="text-base md:text-lg">{tOrder("infoTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="px-0 xl:px-6">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="qty">{tOrder("quantity")}</Label>
                  <Select value={quantity} onValueChange={setQuantity}>
                    <SelectTrigger id="qty">
                      <SelectValue placeholder={tOrder("placeholders.quantity")} />
                    </SelectTrigger>
                    <SelectContent>
                      {quantityOptions.map((q) => (
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
                {templateHasQrCode && brandQrMode === "BOTH" ? (
                  <div className="grid gap-2">
                    <Label htmlFor="qrMode">{tOrder("fields.qrMode")}</Label>
                    <Select
                      value={selectedQrMode}
                      onValueChange={(value) => setSelectedQrMode(value as "vcard" | "public")}
                    >
                      <SelectTrigger id="qrMode">
                        <SelectValue placeholder={tOrder("placeholders.qrMode")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="vcard">{tOrder("qrModes.vcard")}</SelectItem>
                        <SelectItem value="public">{tOrder("qrModes.public")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}

                <div className="grid gap-2">
                  <Label>{tOrder("deliveryTime")}</Label>
                  <div className="flex w-fit gap-2">
                    {(["standard", "express"] as DeliveryOption[]).map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setDeliveryTime(value)}
                        className={`flex flex-col items-center justify-center rounded-xl border-2 px-5 py-2.5 transition-all ${
                          deliveryTime === value
                            ? "border-slate-400 bg-background shadow-sm"
                            : "border-border bg-muted/30 text-muted-foreground hover:border-slate-300 hover:bg-muted/50"
                        }`}
                      >
                        <span className="text-sm font-semibold leading-none">{tOrder(`deliveryTimeLabels.${value}`)}</span>
                        <span className="text-xs mt-1 opacity-70">{tOrder(`deliveryTimeDurations.${value}`)}</span>
                      </button>
                    ))}
                  </div>
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

          <Card className="h-fit border-0 shadow-none rounded-none xl:rounded-xl xl:border xl:shadow-sm">
            <CardHeader className="px-0 xl:px-6">
              <CardTitle className="text-base md:text-lg">{tOrder("sections.personal")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 px-0 xl:px-6">
              <div className="grid gap-4">
                {canUploadPhoto ? (
                  <div className="grid gap-2">
                    <Label htmlFor="photo">{tOrder("fields.photo")}</Label>
                    <input
                      id="photo"
                      ref={photoInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                      aria-invalid={photoError ? true : undefined}
                      className="hidden"
                    />
                    <div
                      className={cn(
                        "flex h-36 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed bg-slate-50 text-center text-sm text-slate-500 transition",
                        photoError ? "border-red-300 bg-red-50" : "border-slate-200 hover:border-slate-300",
                      )}
                      onClick={() => photoInputRef.current?.click()}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={handlePhotoDrop}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          photoInputRef.current?.click();
                        }
                      }}
                    >
                      {photoPreviewUrl ? (
                        <img
                          src={photoPreviewUrl}
                          alt={photoFile?.name ?? tOrder("fields.photo")}
                          className="h-20 w-20 rounded-full object-cover"
                        />
                      ) : (
                        <>
                          <ImagePlus className="h-5 w-5 text-slate-400" aria-hidden="true" />
                          <div className="text-sm font-medium text-slate-700">{tOrder("fields.photo")}</div>
                          <div className="text-xs text-slate-500">{tOrder("hints.photo")}</div>
                        </>
                      )}
                    </div>
                    {photoFile ? (
                      <p className="text-xs text-slate-500">
                        {tOrder("hints.photoSelected", { name: photoFile.name })}
                      </p>
                    ) : null}
                    {photoError ? <p className="text-xs text-red-600">{photoError}</p> : null}
                  </div>
                ) : null}
                <div className="grid gap-2">
                  <Label htmlFor="name" className="flex items-center gap-1">
                    {tOrder("fields.name")}
                    {nameOverflow ? (
                      <span className="inline-flex" title={fieldOverflowMessage}>
                        <AlertCircle className="h-3.5 w-3.5 text-red-500" aria-hidden="true" />
                      </span>
                    ) : null}
                  </Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={handleFieldBlur}
                    className={cn(nameOverflow && fieldErrorClass)}
                    aria-invalid={nameOverflow || undefined}
                    title={getFieldTitle("name")}
                  />
                </div>
                {templateSupportsSeniority ? (
                  <div className="grid gap-2">
                    <Label htmlFor="seniority" className="flex items-center gap-1">
                      {tOrder("fields.seniority")}
                      {seniorityOverflow ? (
                        <span className="inline-flex" title={fieldOverflowMessage}>
                          <AlertCircle className="h-3.5 w-3.5 text-red-500" aria-hidden="true" />
                        </span>
                      ) : null}
                    </Label>
                    <Input
                      id="seniority"
                      value={seniority}
                      onChange={(e) => setSeniority(e.target.value)}
                      onBlur={handleFieldBlur}
                      className={cn(seniorityOverflow && fieldErrorClass)}
                      aria-invalid={seniorityOverflow || undefined}
                      title={getFieldTitle("seniority")}
                    />
                  </div>
                ) : null}
                <div className="grid gap-2">
                  <Label htmlFor="role" className="flex items-center gap-1">
                    {tOrder("fields.role")}
                    {roleOverflow ? (
                      <span className="inline-flex" title={fieldOverflowMessage}>
                        <AlertCircle className="h-3.5 w-3.5 text-red-500" aria-hidden="true" />
                      </span>
                    ) : null}
                  </Label>
                  <Input
                    id="role"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    onBlur={handleFieldBlur}
                    className={cn(roleOverflow && fieldErrorClass)}
                    aria-invalid={roleOverflow || undefined}
                    title={getFieldTitle("role")}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone" className="flex items-center gap-1">
                    {tOrder("fields.phone")}
                    {phoneOverflow ? (
                      <span className="inline-flex" title={fieldOverflowMessage}>
                        <AlertCircle className="h-3.5 w-3.5 text-red-500" aria-hidden="true" />
                      </span>
                    ) : null}
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      onBlur={handleFieldBlur}
                      className={cn("flex-1", phoneOverflow && fieldErrorClass)}
                      aria-invalid={phoneOverflow || undefined}
                      title={getFieldTitle("phone")}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="shrink-0 text-xs"
                      onClick={() => handleFormatPhone("phone")}
                    >
                      {tOrder("buttons.format")}
                    </Button>
                  </div>
              </div>
                <div className="grid gap-2">
                  <Label htmlFor="mobile" className="flex items-center gap-1">
                    {tOrder("fields.mobile")}
                    {mobileOverflow ? (
                      <span className="inline-flex" title={fieldOverflowMessage}>
                        <AlertCircle className="h-3.5 w-3.5 text-red-500" aria-hidden="true" />
                      </span>
                    ) : null}
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="mobile"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      onBlur={handleFieldBlur}
                      className={cn("flex-1", mobileOverflow && fieldErrorClass)}
                      aria-invalid={mobileOverflow || undefined}
                      title={getFieldTitle("mobile")}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="shrink-0 text-xs"
                      onClick={() => handleFormatPhone("mobile")}
                    >
                      {tOrder("buttons.format")}
                    </Button>
                  </div>
              </div>
                <div className="grid gap-2">
                  <Label htmlFor="email" className="flex items-center gap-1">
                    {tOrder("fields.email")}
                    {emailOverflow ? (
                      <span className="inline-flex" title={fieldOverflowMessage}>
                        <AlertCircle className="h-3.5 w-3.5 text-red-500" aria-hidden="true" />
                      </span>
                    ) : null}
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={handleFieldBlur}
                    className={cn(emailOverflow && fieldErrorClass)}
                    aria-invalid={emailOverflow || undefined}
                    title={getFieldTitle("email")}
                  />
                </div>
                {templateHasQrCode ? (
                  <div className="grid gap-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="linkedin" className="mb-0 flex items-center gap-1">
                        {tOrder("fields.linkedin")}
                        {linkedinOverflow ? (
                          <span className="inline-flex" title={fieldOverflowMessage}>
                            <AlertCircle className="h-3.5 w-3.5 text-red-500" aria-hidden="true" />
                          </span>
                        ) : null}
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
                      onBlur={handleFieldBlur}
                      aria-describedby="linkedin-hint"
                      className={cn(linkedinOverflow && fieldErrorClass)}
                      aria-invalid={linkedinOverflow || undefined}
                      title={getFieldTitle("linkedin")}
                    />
                    <p id="linkedin-hint" className="text-xs text-slate-500">
                      {tOrder("hints.linkedin")}
                    </p>
                  </div>
                ) : null}
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
                      onMouseDown={() => {
                        // Allow reopening the dropdown even when the input is already focused.
                        setAddressDropdownOpen(true);
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
                        <div className="absolute z-20 mt-1 w-full max-h-80 overflow-auto rounded-lg border border-slate-200 bg-white text-sm shadow-lg">
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
                  <Label htmlFor="url" className="flex items-center gap-1">
                    {tOrder("fields.url")}
                    {urlOverflow ? (
                      <span className="inline-flex" title={fieldOverflowMessage}>
                        <AlertCircle className="h-3.5 w-3.5 text-red-500" aria-hidden="true" />
                      </span>
                    ) : null}
                  </Label>
                  <Input
                    id="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onBlur={handleFieldBlur}
                    className={cn(urlOverflow && fieldErrorClass)}
                    aria-invalid={urlOverflow || undefined}
                    title={getFieldTitle("url")}
                  />
                </div>
                {templateHasQrCode ? (
                  <>
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
                  </>
                ) : null}
                <div className="grid gap-2 sm:col-span-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <Label htmlFor="addressBlock">{tOrder("fields.addressExtra")}</Label>
                      {addressBlockOverflow ? (
                        <span className="inline-flex" title={fieldOverflowMessage}>
                          <AlertCircle className="h-3.5 w-3.5 text-red-500" aria-hidden="true" />
                        </span>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="text-xs"
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
                    className={addressBlockOverflow ? "border-red-300 focus-visible:ring-red-200" : undefined}
                    title={
                      addressBlockHasOverflow
                        ? tOrder("errors.addressBlockLines", { count: MAX_ADDRESS_BLOCK_LINES })
                        : addressBlockOverflow
                          ? fieldOverflowMessage
                          : undefined
                    }
                  />
                  <p className={`text-xs ${addressBlockHasOverflow ? "text-red-600" : "text-slate-500"}`}>
                    {addressBlockHasOverflow
                      ? tOrder("errors.addressBlockLines", { count: MAX_ADDRESS_BLOCK_LINES })
                      : tOrder("hints.addressExtra")}
                  </p>
                </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <div className="pt-4 xl:hidden">
            <Button
              onClick={openConfirm}
              className="w-full"
              disabled={!canSubmitOrder || hasOverflow || isSubmitting}
            >
              {tOrder("buttons.order")}
            </Button>
          </div>
        </div>

        <div className="order-1 xl:order-2 sticky top-0 z-10 bg-white xl:space-y-4 xl:top-10 xl:self-start">
          {/* Mobile title — hidden on desktop */}
          <div className="pt-3 pb-2 xl:hidden">
            <h1 className="text-lg font-semibold tracking-tight text-slate-900">{tOrder("title")}</h1>
          </div>
          <Card className="rounded-none border-0 shadow-none xl:rounded-xl xl:border xl:shadow-sm">
            {/* Card header with front/back buttons */}
            <CardHeader className="flex flex-row items-center justify-between pb-2 gap-3">
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
            <CardContent className="px-0 pb-4 xl:px-6 xl:pb-6">
              {!selectedTemplate ? (
                /* Placeholder — grey panel fills the full preview area */
                <div
                  className={`flex min-h-[30vh] items-center justify-center rounded-xl bg-slate-50 border border-dashed border-slate-200 ${
                    templateError ? "text-red-600" : "text-slate-500"
                  }`}
                >
                  <p className="text-sm font-medium text-center px-6">
                    {!currentBrandId
                      ? tOrder("selectBrandPrompt")
                      : templates.length === 0
                      ? tOrder("preview.noTemplates")
                      : !selectedSummary
                      ? tOrder("preview.selectTemplate")
                      : templateError ?? tOrder("preview.loading")}
                  </p>
                </div>
              ) : (
                /* Card loaded — white background, card centered with generous padding */
                <div className="flex w-full flex-col items-center py-10 px-8 pb-6">
                  <div
                    className="relative overflow-visible"
                    style={{
                      aspectRatio: `${selectedTemplate.pageWidthMm ?? 85} / ${selectedTemplate.pageHeightMm ?? 55}`,
                      width: `min(100%, calc(55vh * ${((selectedTemplate.pageWidthMm ?? 85) / (selectedTemplate.pageHeightMm ?? 55)).toFixed(4)}))`,
                      maxHeight: `55vh`,
                    }}
                  >
                    {/* Mobile front/back overlay buttons */}
                    <div className="absolute bottom-2 inset-x-0 flex justify-center gap-1.5 z-20 xl:hidden">
                      <button
                        type="button"
                        onClick={() => setPreviewView("front")}
                        className={cn(
                          "text-xs px-3 py-1 rounded-full font-medium shadow-sm transition-colors",
                          previewView === "front"
                            ? "bg-slate-900 text-white"
                            : "bg-white/90 text-slate-600",
                        )}
                      >
                        {tOrder("confirm.front")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewView("back")}
                        className={cn(
                          "text-xs px-3 py-1 rounded-full font-medium shadow-sm transition-colors",
                          previewView === "back"
                            ? "bg-slate-900 text-white"
                            : "bg-white/90 text-slate-600",
                        )}
                      >
                        {tOrder("confirm.back")}
                      </button>
                    </div>
                    <FlipCard
                      activeSide={previewView}
                      front={
                        <BusinessCardFront
                          template={selectedTemplate}
                          name={name}
                          role={role}
                          seniority={seniority}
                          email={email}
                          phone={phone}
                          mobile={mobile}
                          company={addressBlock}
                          url={url}
                          linkedin={effectiveLinkedin}
                          onOverflowChange={setFrontOverflow}
                          addressFields={previewAddressFields}

                          onFieldOverflowChange={handleFrontOverflowFields}
                          forcedBindingPrefixes={forcedBindingPrefixes}
                          qrPreviewMode={selectedQrMode}
                          qrPayload={isPublicQrMode ? draftPublicUrl : undefined}
                        />
                      }
                      back={
                        <BusinessCardBack
                          template={selectedTemplate}
                          name={name}
                          role={role}
                          seniority={seniority}
                          email={email}
                          phone={phone}
                          mobile={mobile}
                          company={addressBlock}
                          url={url}
                          linkedin={effectiveLinkedin}
                          onOverflowChange={setBackOverflow}
                          addressFields={previewAddressFields}

                          onFieldOverflowChange={handleBackOverflowFields}
                          forcedBindingPrefixes={forcedBindingPrefixes}
                          qrPreviewMode={selectedQrMode}
                          qrPayload={isPublicQrMode ? draftPublicUrl : undefined}
                        />
                      }
                      className="h-full w-full"
                    />
                  </div>
                  {templateError && (
                    <p className="mt-2 text-center text-xs text-red-600">{templateError}</p>
                  )}
                  {showPublicQrNote && (
                    <p className="mt-2 text-center text-xs text-slate-500">{tOrder("preview.publicQrNote")}</p>
                  )}
                  {draftError && (
                    <p className="mt-2 text-center text-xs text-red-600">{draftError}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
          <div className="hidden xl:flex xl:justify-end">
            <Button onClick={openConfirm} className="px-6" disabled={!canSubmitOrder || hasOverflow || isSubmitting}>
              {tOrder("buttons.order")}
            </Button>
          </div>
        </div>
      </div>

      <Dialog
        open={isCropOpen}
        onOpenChange={(open) => {
          if (!open) handleCropCancel();
          else setIsCropOpen(true);
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{tOrder("photoCrop.title")}</DialogTitle>
            <DialogDescription>{tOrder("photoCrop.description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative h-72 w-full overflow-hidden rounded-2xl bg-slate-100">
              {photoSource ? (
                <Cropper
                  image={photoSource}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  cropShape="round"
                  showGrid={false}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={(_, areaPixels) => setCroppedAreaPixels(areaPixels)}
                />
              ) : null}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500">{tOrder("photoCrop.zoom")}</span>
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
                className="w-full"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={handleCropCancel} disabled={isCropping}>
              {tOrder("photoCrop.cancel")}
            </Button>
            <Button type="button" onClick={handleCropConfirm} disabled={isCropping || !photoSource}>
              {tOrder("photoCrop.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isConfirmOpen}
        onOpenChange={(open) => {
          if (isSubmitting) return;
          setSubmitError(null);
          setIsConfirmOpen(open);
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{tOrder("confirm.title")}</DialogTitle>
            <DialogDescription>{tOrder("confirm.description")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
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
            <div className="rounded-3xl border border-slate-200 bg-slate-50/60 p-12 overflow-hidden">
              <div className="mx-auto w-full flex justify-center">
                <div
                  className="relative"
                  style={{
                    aspectRatio: `${selectedTemplate?.pageWidthMm ?? 85} / ${selectedTemplate?.pageHeightMm ?? 55}`,
                    width: `min(100%, calc(38dvh * ${((selectedTemplate?.pageWidthMm ?? 85) / (selectedTemplate?.pageHeightMm ?? 55)).toFixed(4)}))`,
                    maxHeight: `38dvh`,
                  }}
                >
                  {selectedTemplate ? (
                    <FlipCard
                      activeSide={confirmView}
                      className="h-full w-full"
                      front={
                        <BusinessCardFront
                          template={selectedTemplate}
                          name={name}
                          role={role}
                          seniority={seniority}
                          email={email}
                          phone={phone}
                          mobile={mobile}
                          company={addressBlock}
                          url={url}
                          linkedin={effectiveLinkedin}
                          onOverflowChange={setFrontOverflow}
                          addressFields={previewAddressFields}
                          onFieldOverflowChange={handleFrontOverflowFields}
                          forcedBindingPrefixes={forcedBindingPrefixes}
                          qrPreviewMode={selectedQrMode}
                          qrPayload={isPublicQrMode ? draftPublicUrl : undefined}
                        />
                      }
                      back={
                        <BusinessCardBack
                          template={selectedTemplate}
                          name={name}
                          role={role}
                          seniority={seniority}
                          email={email}
                          phone={phone}
                          mobile={mobile}
                          company={addressBlock}
                          url={url}
                          linkedin={effectiveLinkedin}
                          onOverflowChange={setBackOverflow}
                          addressFields={previewAddressFields}
                          onFieldOverflowChange={handleBackOverflowFields}
                          forcedBindingPrefixes={forcedBindingPrefixes}
                          qrPreviewMode={selectedQrMode}
                          qrPayload={isPublicQrMode ? draftPublicUrl : undefined}
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
            {showPublicQrNote ? (
              <p className="text-center text-xs text-slate-500">{tOrder("preview.publicQrNote")}</p>
            ) : null}

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

    </section>
  );
}
