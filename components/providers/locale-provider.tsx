"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useSession } from "next-auth/react";

import { locales, messages, type Locale } from "@/lib/i18n/messages";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
};

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

type LocaleProviderProps = {
  initialLocale: Locale;
  children: ReactNode;
};

export function LocaleProvider({ initialLocale, children }: LocaleProviderProps) {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const { data: session } = useSession();

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    const sessionLocale = session?.user?.locale;
    if (sessionLocale && locales.includes(sessionLocale as Locale) && sessionLocale !== locale) {
      setLocale(sessionLocale as Locale);
    }
  }, [session?.user?.locale, locale]);

  const value = useMemo(() => ({ locale, setLocale }), [locale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocale must be used within a LocaleProvider");
  }
  return ctx;
}

type TranslationParams = Record<string, string | number>;

function resolvePath(source: any, path: string) {
  return path.split(".").reduce((current, segment) => {
    if (current && Object.prototype.hasOwnProperty.call(current, segment)) {
      return current[segment];
    }
    return undefined;
  }, source);
}

function interpolate(value: string, params?: TranslationParams) {
  if (!params) return value;
  return value.replace(/\{([^}]+)\}/g, (_, token: string) => {
    const replacement = params[token];
    return replacement !== undefined ? String(replacement) : `{${token}}`;
  });
}

export function useTranslations(namespace?: string) {
  const { locale } = useLocale();
  return (key: string, params?: TranslationParams) => {
    const fullPath = namespace ? `${namespace}.${key}` : key;
    const raw = resolvePath(messages[locale], fullPath);
    if (typeof raw !== "string") {
      throw new Error(`Missing translation for key: ${fullPath}`);
    }
    return interpolate(raw, params);
  };
}
