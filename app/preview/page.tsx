"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export default function PreviewPage() {
  // Demo-Defaults
  const [name, setName]       = useState("Pascal Rossi");
  const [role, setRole]       = useState("CEO & Founder");
  const [email, setEmail]     = useState("pascal@alignz.com");
  const [phone, setPhone]     = useState("+41 79 530 74 60");
  const [company, setCompany] = useState("Alignz AG\nSeestrasse 12\n8000 Zürich");
  const [url, setUrl]         = useState("https://alignz.com/pascal");

  const template = "omicron"; // 2-seitig: Front=Text, Back=QR

  const generate = async () => {
    const res = await fetch("/api/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, role, email, phone, company, url, template }),
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
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Business Card – Omicron</h1>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Form */}
        <Card className="order-2 md:order-1">
          <CardHeader>
            <CardTitle className="text-lg">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Vor- und Nachname" />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="role">Funktion / Titel</Label>
              <Input id="role" value={role} onChange={(e) => setRole(e.target.value)} placeholder="z. B. CEO" />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="email">E-Mail</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@firma.tld" />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="phone">Telefon</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+41 ..." />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="company">Firmenadresse (mehrzeilig)</Label>
              <Textarea
                id="company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder={"Firma AG\nStrasse 1\nPLZ Ort"}
                rows={5}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="url">URL für QR (optional)</Label>
              <Input id="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={generate} className="w-full">Generate PDF</Button>
          </CardFooter>
        </Card>

        {/* Live Preview (HTML) */}
        <Card className="order-1 md:order-2">
          <CardHeader>
            <CardTitle className="text-lg">Live Preview</CardTitle>
          </CardHeader>
          <CardContent>
            {/* einfache Karten-Vorschau (HTML) */}
            <div className="mx-auto w-[340px] rounded-2xl border p-4 shadow-sm font-frutiger">
              <div className="text-xl font-bold">{name}</div>
              <div className="text-sm text-muted-foreground font-light italic">{role}</div>
              <div className="mt-3 space-y-1 text-sm font-light">
                <div>{email}</div>
                <div>{phone}</div>
                <div className="whitespace-pre-wrap text-muted-foreground font-light">{company}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
