"use client";

import { useState } from "react";
import { BusinessCardFront, BusinessCardBack } from "@/components/PreviewCard";

export default function PreviewPage() {
  const [name, setName] = useState("Pascal Rossi");
  const [role, setRole] = useState("CEO & Founder");
  const [email, setEmail] = useState("pascal@alignz.com");
  const [phone, setPhone] = useState("+41 79 530 74 60");
  const [company, setCompany] = useState("Alignz AG\nSeestrasse 12\n8000 Zürich");
  const [url, setUrl] = useState("https://alignz.com/pascal");

  const cardProps = { name, role, email, phone, company, url };

  return (
    <main
      className="
        mx-auto
        max-w-screen-xl        /* zentriert & begrenzt */
        px-4 sm:px-6 lg:px-8   /* schöne Seitenränder */
        py-6 sm:py-8 lg:py-10  /* oben/unten Luft */
      "
    >
      <h1 className="mb-6 text-xl font-semibold tracking-tight">
        Business Card – Omicron
      </h1>

      <div
        className="
          grid gap-6 lg:gap-8
          lg:grid-cols-[minmax(320px,420px)_1fr]  /* linke Spalte fix-bis-420, rechts flexibel */
        "
      >
        {/* Formular */}
        <section className="rounded-lg border bg-card p-5 shadow-sm lg:self-start lg:sticky lg:top-6">
          <h2 className="mb-4 text-base font-medium text-muted-foreground">Details</h2>

          <div className="space-y-4">
            <label className="block">
              <span className="text-sm">Name</span>
              <input
                className="mt-1 w-full rounded-md border px-3 py-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>

            <label className="block">
              <span className="text-sm">Funktion / Titel</span>
              <input
                className="mt-1 w-full rounded-md border px-3 py-2"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              />
            </label>

            <label className="block">
              <span className="text-sm">E-Mail</span>
              <input
                type="email"
                className="mt-1 w-full rounded-md border px-3 py-2"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>

            <label className="block">
              <span className="text-sm">Telefon</span>
              <input
                className="mt-1 w-full rounded-md border px-3 py-2"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </label>

            <label className="block">
              <span className="text-sm">Firmenadresse (mehrzeilig)</span>
              <textarea
                rows={4}
                className="mt-1 w-full rounded-md border px-3 py-2"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </label>

            <label className="block">
              <span className="text-sm">URL für QR (optional)</span>
              <input
                className="mt-1 w-full rounded-md border px-3 py-2"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </label>

            <button className="mt-2 w-full rounded-md bg-black py-2.5 font-medium text-white">
              Generate PDF
            </button>
          </div>
        </section>

        {/* Preview */}
        <section className="rounded-lg border bg-card p-5 shadow-sm">
          <h2 className="mb-4 text-base font-medium text-muted-foreground">Live Preview</h2>

          <div className="space-y-6">
            {/* Ein einzelner sauberer Rahmen je Karte kommt aus PreviewCard.Frame */}
            <BusinessCardFront {...cardProps} />
            <BusinessCardBack  {...cardProps} />
          </div>
        </section>
      </div>
    </main>
  );
}
