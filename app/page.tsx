"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import Order from "./order";

export default function Page() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-pulse text-sm text-gray-500">
          Loading session…
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md rounded-2xl shadow-sm bg-white p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-9 w-9 rounded-full bg-gray-900 text-white flex items-center justify-center font-semibold">
              BC
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-tight">
                Business Card Portal
              </h1>
              <p className="text-xs text-gray-500">Please sign in to continue</p>
            </div>
          </div>

          <button
            onClick={() => signIn("azure-ad")}
            className="cursor-pointer w-full inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium hover:bg-gray-50 transition"
          >
            <svg
              aria-hidden
              focusable="false"
              viewBox="0 0 24 24"
              className="h-5 w-5"
            >
              <path fill="#f25022" d="M11 11H3V3h8v8z" />
              <path fill="#00a4ef" d="M21 11h-8V3h8v8z" />
              <path fill="#7fba00" d="M11 21H3v-8h8v8z" />
              <path fill="#ffb900" d="M21 21h-8v-8h8v8z" />
            </svg>
            Sign in with Microsoft
          </button>

          <p className="mt-3 text-xs text-gray-500 text-center">
            Access restricted to approved company accounts.
          </p>
        </div>
      </div>
    );
  }

  // ✅ logged in
  return (
    <div className="relative">
      <button
        onClick={() => signOut()}
        className="cursor-pointer absolute top-4 right-4 bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded text-sm"
      >
        Logout
      </button>
      <div className="absolute top-4 left-4 text-sm text-gray-600">
        {session?.user?.email}
      </div>
      <Order />
    </div>
  );
}