"use client";

import React, { useState } from "react";
import { BusinessCardFront, BusinessCardBack } from "@/components/PreviewCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export default function PreviewPage() {
  const [name, setName] = useState("Pascal Rossi");
  const [role, setRole] = useState("CEO & Founder");
  const [email, setEmail] = useState("pascal@alignz.com");
  const [phone, setPhone] = useState("+41 79 530 74 60");
  const [company, setCompany] = useState("Alignz AG\nSeestrasse 12\n8000 Zürich");
  const [url, setUrl] = useState("https://alignz.com/pascal");

  async function generate() {
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
  }

  return (
    <main className="mx-auto max-w-[1200px] p-6 md:p-8">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Business Card – Omicron</h1>

      <div className="grid gap-6 md:grid-cols-[minmax(0,520px)_1fr]">
        {/* Formular */}
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <label className="text-sm text-muted-foreground">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <label className="text-sm text-muted-foreground">Funktion / Titel</label>
              <Input value={role} onChange={(e) => setRole(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <label className="text-sm text-muted-foreground">E-Mail</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <label className="text-sm text-muted-foreground">Telefon</label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <label className="text-sm text-muted-foreground">Firmenadresse (mehrzeilig)</label>
              <Textarea rows={5} value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <label className="text-sm text-muted-foreground">URL für QR (optional)</label>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} />
            </div>
            <Button className="w-full" onClick={generate}>
              Generate PDF
            </Button>
          </CardContent>
        </Card>

        {/* Live Preview */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Card Front</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mx-auto max-w-[560px] rounded-xl border bg-white p-4 shadow-sm">
                {/* Rahmen NICHT doppelt: nur dieser Container */}
                <BusinessCardFront name={name} role={role} email={email} phone={phone} company={company} url={url} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Card Back</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mx-auto max-w-[560px] rounded-xl border bg-white p-4 shadow-sm">
                <BusinessCardBack name={name} role={role} email={email} phone={phone} company={company} url={url} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
