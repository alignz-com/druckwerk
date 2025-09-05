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

  const template = "omicron";

  const generate = async () => {
    const res = await fetch("/api/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, role, email, phone, company, url, template }),
    });
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href; a.download = "card.pdf"; a.click();
    URL.revokeObjectURL(href);
  };

  return (
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Business Card – Omicron</h1>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Form */}
        <Card className="order-2 md:order-1">
          <CardHeader><CardTitle className="text-lg">Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {/* Inputs … (deine vorhandenen Felder) */}
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">Funktion / Titel</Label>
              <Input id="role" value={role} onChange={(e) => setRole(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">E-Mail</Label>
              <Input id="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Telefon</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="company">Firmenadresse</Label>
              <Textarea id="company" rows={5} value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="url">URL für QR (optional)</Label>
              <Input id="url" value={url} onChange={(e) => setUrl(e.target.value)} />
            </div>
          </CardContent>
          <CardFooter><Button onClick={generate} className="w-full">Generate PDF</Button></CardFooter>
        </Card>

        {/* Live Preview – vorne & hinten */}
        <Card className="order-1 md:order-2">
          <CardHeader><CardTitle className="text-lg">Live Preview</CardTitle></CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <BusinessCardFront name={name} role={role} email={email} phone={phone} company={company} />
            <BusinessCardBack email={email} url={url} />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
