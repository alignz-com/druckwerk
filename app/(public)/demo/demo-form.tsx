"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const copy = {
  en: {
    title: "Try Druckwerk",
    subtitle: "Experience the full ordering flow — no account needed.",
    nameLabel: "Your name",
    namePlaceholder: "Anna Berger",
    emailLabel: "Email",
    emailPlaceholder: "anna@example.com",
    cta: "Start demo",
    starting: "Starting...",
    error: "Something went wrong. Please try again.",
    note: "Demo orders are not saved. You can explore everything freely.",
    login: "Already have an account?",
    loginLink: "Sign in",
  },
  de: {
    title: "Druckwerk testen",
    subtitle: "Erleben Sie den gesamten Bestellablauf — kein Konto nötig.",
    nameLabel: "Ihr Name",
    namePlaceholder: "Anna Berger",
    emailLabel: "E-Mail",
    emailPlaceholder: "anna@beispiel.at",
    cta: "Demo starten",
    starting: "Wird gestartet...",
    error: "Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.",
    note: "Demo-Bestellungen werden nicht gespeichert. Sie können alles frei erkunden.",
    login: "Bereits ein Konto?",
    loginLink: "Anmelden",
  },
} as const

type Props = { locale: string }

export default function DemoForm({ locale }: Props) {
  const t = locale === "de" ? copy.de : copy.en
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setError(null)
    setSubmitting(true)

    try {
      // 1. Register / upsert demo user
      const res = await fetch("/api/demo/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      })

      if (!res.ok) {
        setError(t.error)
        setSubmitting(false)
        return
      }

      const { email: demoEmail, password } = await res.json()

      // 2. Sign in via NextAuth credentials
      const result = await signIn("credentials", {
        email: demoEmail,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError(t.error)
        setSubmitting(false)
        return
      }

      // 3. Redirect to order form with tour flag
      router.push("/orders/new?tour=bc")
    } catch {
      setError(t.error)
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-16">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
            <img src="/logo-mark.svg" alt="Druckwerk Logo" className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900 leading-tight">{t.title}</h1>
            <p className="text-xs text-slate-500">{t.subtitle}</p>
          </div>
        </div>

        <div className="mb-6 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
          {t.note}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="demo-name" className="text-xs font-medium text-slate-600">
              {t.nameLabel}
            </label>
            <Input
              id="demo-name"
              type="text"
              required
              minLength={2}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.namePlaceholder}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="demo-email" className="text-xs font-medium text-slate-600">
              {t.emailLabel}
            </label>
            <Input
              id="demo-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.emailPlaceholder}
            />
          </div>

          {error ? <p className="text-xs text-red-600">{error}</p> : null}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? t.starting : t.cta}
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-500">
          {t.login}{" "}
          <a href="/login" className="text-slate-700 underline-offset-2 hover:underline">
            {t.loginLink}
          </a>
        </p>
      </div>
    </div>
  )
}
