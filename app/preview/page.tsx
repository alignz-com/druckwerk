"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { BusinessCardFront, BusinessCardBack } from "@/components/PreviewCard";

export default function PreviewPage() {
  const [name, setName]       = useState("Pascal Rossi");
  const [role, setRole]       = useState("CEO & Founder");
  const [email, setEmail]     = useState("pascal@alignz.com");
  const [phone, setPhone]     = useState("+41 79 530 74 60");
  const [company, setCompany] = useState("Alignz AG\nSeestrasse 12\n8000 Zürich");
  const [url, setUrl]         = useState("https://alignz.com/pascal");

  const generate = async () => {
    const res = await fetch("/api/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, role, email, phone, company, url, template: "omicron" }),
    });
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = "card.pdf";
    a.click();
    URL.revokeObjectURL(href);
  };

  return (
    <main className="mx-auto max-w-[1200px] p-4 sm:p-6 space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Business Card – Omicron</h1>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Form */}
        <Card className="md:sticky md:top-4 md:h-fit">
          <CardHeader>
            <CardTitle className="text-lg">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Funktion / Titel">
              <Input value={role} onChange={(e) => setRole(e.target.value)} />
            </Field>
            <Field label="E-Mail">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Telefon">
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
            <Field label="Firmenadresse (mehrzeilig)">
              <Textarea
                rows={5}
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder={"Firma AG\nStrasse 1\nPLZ Ort"}
              />
            </Field>
            <Field label="URL für QR (optional)">
              <Input value={url} onChange={(e) => setUrl(e.target.value)} />
            </Field>
          </CardContent>
          <CardFooter>
            <Button onClick={generate} className="w-full">Generate PDF</Button>
          </CardFooter>
        </Card>

        {/* Live Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Live Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="w-full overflow-hidden">
              <BusinessCardFront
                name={name}
                role={role}
                email={email}
                phone={phone}
                company={company}
              />
            </div>
            <div className="w-full overflow-hidden">
              <BusinessCardBack
                name={name}
                role={role}
                email={email}
                phone={phone}
                company={company}
                url={url}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
