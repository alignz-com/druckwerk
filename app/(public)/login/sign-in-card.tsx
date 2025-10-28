"use client";

import { signIn } from "next-auth/react";

export default function SignInCard() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-16">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
            BC
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900 leading-tight">Business Card Portal</h1>
            <p className="text-xs text-slate-500">Please sign in to continue</p>
          </div>
        </div>

        <button
          onClick={() => signIn("azure-ad", { callbackUrl: "/orders/new" })}
          className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
        >
          <svg aria-hidden focusable="false" viewBox="0 0 24 24" className="h-5 w-5">
            <path fill="#f25022" d="M11 11H3V3h8v8z" />
            <path fill="#7FBA00" d="M21 11h-8V3h8v8z" />
            <path fill="#00A4EF" d="M11 21H3v-8h8v8z" />
            <path fill="#ffb900" d="M21 21h-8v-8h8v8z" />
          </svg>
          Sign in with Microsoft
        </button>

        <p className="text-center text-xs text-slate-500">
          Printer accounts can use their email login once configured by an administrator.
        </p>
      </div>
    </div>
  );
}
