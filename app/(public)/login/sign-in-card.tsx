"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import LanguageSwitcher from "@/components/LanguageSwitcher";

type SignInCardProps = {
  successMessage?: string;
};

export default function SignInCard({ successMessage }: SignInCardProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCredentialsSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl: "/orders/new",
    });

    if (result?.error) {
      setError("Login not possible with these credentials");
      setIsSubmitting(false);
      return;
    }

    router.push("/orders/new");
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-16">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
            <img src="/logo-mark.svg" alt="Druckwerk Logo" className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900 leading-tight">Druckwerk von Thurnher Druckerei</h1>
            <p className="text-xs text-slate-500">Please sign in to continue</p>
          </div>
        </div>

        {successMessage ? (
          <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            {successMessage}
          </div>
        ) : null}

        <Button
          onClick={() => signIn("azure-ad", { callbackUrl: "/orders/new" })}
          variant="outline"
          className="mb-6 flex w-full items-center justify-center gap-2"
        >
          <svg aria-hidden focusable="false" viewBox="0 0 24 24" className="h-5 w-5">
            <path fill="#f25022" d="M11 11H3V3h8v8z" />
            <path fill="#7FBA00" d="M21 11h-8V3h8v8z" />
            <path fill="#00A4EF" d="M11 21H3v-8h8v8z" />
            <path fill="#ffb900" d="M21 21h-8v-8h8v8z" />
          </svg>
          Sign in with Microsoft
        </Button>

        <div className="relative mb-6 text-center text-xs uppercase tracking-wide text-slate-400">
          <span className="bg-white px-2">or</span>
          <span className="absolute inset-x-0 top-1/2 block h-px bg-slate-200" aria-hidden />
        </div>

        <form onSubmit={handleCredentialsSignIn} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="text-xs font-medium text-slate-600">
              Email
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-xs font-medium text-slate-600">
              Password
            </label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          {error ? <p className="text-xs text-red-600">{error}</p> : null}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <p className="mt-3 text-center text-xs text-slate-500">
          <a href="/password-reset" className="text-slate-700 underline-offset-2 hover:underline">
            Forgot password?
          </a>
        </p>

        <p className="mt-6 text-center text-xs text-slate-500">
          Printer accounts can use their email login once configured by an administrator.
        </p>

        <div className="mt-8">
          <LanguageSwitcher />
        </div>
      </div>
    </div>
  );
}
