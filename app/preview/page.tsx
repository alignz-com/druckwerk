"use client";

import { useState } from "react";
import { BusinessCardFront, BusinessCardBack } from "@/components/PreviewCard";

export default function PreviewPage() {
  const [values, setValues] = useState({
    name: "Pascal Rossi",
    role: "CEO & Founder",
    email: "pascal@alignz.com",
    phone: "+41 79 530 74 60",
    company: "Alignz AG\nSeestrasse 12\n8000 Zürich",
    url: "https://alignz.com/pascal",
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Eingabeformular */}
      <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
        <h1 className="text-lg font-semibold">Business Card – Omicron</h1>
        <div className="space-y-4">
          <label className="block">
            <span className="text-sm">Name</span>
            <input
              type="text"
              value={values.name}
              onChange={(e) => setValues({ ...values, name: e.target.value })}
              className="mt-1 block w-full rounded-md border px-2 py-1"
            />
          </label>
          <label className="block">
            <span className="text-sm">Funktion / Titel</span>
            <input
              type="text"
              value={values.role}
              onChange={(e) => setValues({ ...values, role: e.target.value })}
              className="mt-1 block w-full rounded-md border px-2 py-1"
            />
          </label>
          <label className="block">
            <span className="text-sm">E-Mail</span>
            <input
              type="email"
              value={values.email}
              onChange={(e) => setValues({ ...values, email: e.target.value })}
              className="mt-1 block w-full rounded-md border px-2 py-1"
            />
          </label>
          <label className="block">
            <span className="text-sm">Telefon</span>
            <input
              type="text"
              value={values.phone}
              onChange={(e) => setValues({ ...values, phone: e.target.value })}
              className="mt-1 block w-full rounded-md border px-2 py-1"
            />
          </label>
          <label className="block">
            <span className="text-sm">Firmenadresse (mehrzeilig)</span>
            <textarea
              rows={3}
              value={values.company}
              onChange={(e) => setValues({ ...values, company: e.target.value })}
              className="mt-1 block w-full rounded-md border px-2 py-1"
            />
          </label>
          <label className="block">
            <span className="text-sm">URL für QR (optional)</span>
            <input
              type="text"
              value={values.url}
              onChange={(e) => setValues({ ...values, url: e.target.value })}
              className="mt-1 block w-full rounded-md border px-2 py-1"
            />
          </label>
          <button className="mt-4 w-full rounded-md bg-black text-white py-2 font-medium">
            Generate PDF
          </button>
        </div>
      </div>

      {/* Live Preview */}
      <div className="rounded-xl border bg-card p-4 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold">Live Preview</h2>
        <BusinessCardFront {...values} />
        <BusinessCardBack {...values} />
      </div>
    </div>
  );
}
