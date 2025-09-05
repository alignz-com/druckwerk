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
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Business Card – Omicron</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Form */}
        <Card className="order-2 lg:order-1">
          <CardHeader>
            <CardTitle className="text-lg">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Telefon</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="company">Firmenadresse (mehrzeilig)</Label>
              <Textarea id="company" rows={5} value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="url">URL für QR (optional)</Label>
              <Input id="url" value={url} onChange={(e) => setUrl(e.target.value)} />
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full" onClick={generate}>Generate PDF</Button>
          </CardFooter>
        </Card>

        {/* Preview */}
        <Card className="order-1 lg:order-2">
          <CardHeader>
            <CardTitle className="text-lg">Live Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="mb-2 text-sm text-muted-foreground">Card Front</div>
              <BusinessCardFront
                name={name}
                role={role}
                email={email}
                phone={phone}
                company={company}
              />
            </div>

            <div>
              <div className="mb-2 text-sm text-muted-foreground">Card Back</div>
              <BusinessCardBack
                name={name}
                role={role}
                email={email}
                phone={phone}
                url={url}
                company={company}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
