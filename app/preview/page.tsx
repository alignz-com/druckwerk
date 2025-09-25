"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Analytics } from "@vercel/analytics/next"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { BusinessCardFront, BusinessCardBack } from "@/components/PreviewCard";

// + add:
const QUANTITIES = [50, 100, 250, 500, 1000];
const TEMPLATES = [
  { value: "qrcode", label: "QR Code" },
  { value: "claim", label: "Claim" },
  { value: "omicron-lab", label: "Omicron Lab" },
] as const;

export default function PreviewPage() {
  // Demo-Defaults
  const [name, setName] = useState("Martin Eichberger");
  const [role, setRole] = useState("Corporate Communications");
  const [email, setEmail] = useState("martin.eichberger@omicronenergy.com");
  const [phone, setPhone] = useState("+43 59495 2099");
  const [mobile, setMobile] = useState("+43 664 88876851");
  const [company, setCompany] = useState("OMICRON electronics GmbH\nOberes Ried 1 | 6833 Klaus | Österreich");
  const [url, setUrl] = useState("www.omicronenergy.com");
  const [quantity, setQuantity] = useState<string>(String(QUANTITIES[1])); // "100"
 const [template, setTemplate] = useState<string>("qrcode");

  /*const generate = async () => {
    const res = await fetch("/api/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, role, email, phone, mobile, company, url, template: "omicron" }),
    });
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = "card.pdf";
    a.click();
    URL.revokeObjectURL(href);
  };*/

const generate = async () => {
  try {
    const res = await fetch("/api/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        role,
        email,
        phone,
        mobile,
        company,
        url,
        template: "omicron",
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "❌ Fehler bei der Bestellung");
      return;
    }

    // ✅ direkt die Blob-URL von Vercel öffnen
    window.open(data.fileUrl, "_blank");
    // oder: location.href = data.url; // gleiche Seite navigiert zum PDF
  } catch (err) {
    console.error("❌ Fehler beim Request:", err);
    alert("Fehler beim Erstellen der Visitenkarte");
  }
};




  return (
    <main className="mx-auto max-w-[1200px] p-6 md:p-8 lg:p-10 space-y-6">
      <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Business Card – Omicron</h1>

      <div className="grid gap-6 lg:grid-cols-[480px_minmax(0,1fr)]">
        {/* Left column: Order info + Details stacked */}
        <div className="space-y-6">
          {/* Order information */}
          <Card className="h-fit">
            <CardHeader className="pb-2">
              <CardTitle className="text-base md:text-lg">Order information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {/* Quantity */}
                <div className="grid gap-2">
                  <Label htmlFor="qty">Quantity</Label>
                  <Select value={quantity} onValueChange={setQuantity}>
                    <SelectTrigger id="qty">
                      <SelectValue placeholder="Select quantity" />
                    </SelectTrigger>
                    <SelectContent>
                      {QUANTITIES.map((q) => (
                        <SelectItem key={q} value={String(q)}>
                          {q.toLocaleString("en-US")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
      
                {/* Template */}
                <div className="grid gap-2">
                  <Label htmlFor="template">Template</Label>
                  <Select value={template} onValueChange={setTemplate}>
                    <SelectTrigger id="template">
                      <SelectValue placeholder="Select template" />
                    </SelectTrigger>
                    <SelectContent>
                      {TEMPLATES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
      
          {/* Details */}
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-base md:text-lg">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={32} />
              </div>
      
              <div className="grid gap-2">
                <Label htmlFor="role">Function / Title</Label>
                <Input id="role" value={role} onChange={(e) => setRole(e.target.value)} maxLength={45} />
              </div>
      
              <div className="grid gap-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={19}/>
              </div>
      
              <div className="grid gap-2">
                <Label htmlFor="mobile">Mobile</Label>
                <Input id="mobile" value={mobile} onChange={(e) => setMobile(e.target.value)} maxLength={19}/>
              </div>
      
              <div className="grid gap-2">
                <Label htmlFor="email">E-Mail</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={50}/>
              </div>
      
              <div className="grid gap-2">
                <Label htmlFor="url">URL</Label>
                <Input id="url" value={url} onChange={(e) => setUrl(e.target.value)}  maxLength={32}/>
              </div>
      
              <div className="grid gap-2">
                <Label htmlFor="company">Company & Address</Label>
                <Textarea
                  id="company"
                  value={company}
                  rows={3} // zeigt 3 Zeilen an
                  onChange={(e) => {
                    const maxLines = 3;
                    const maxPerLine = 48;

                    // split input into lines
                    let lines = e.target.value.split("\n");

                    // limit number of lines
                    lines = lines.slice(0, maxLines);

                    // truncate each line to maxPerLine chars
                    lines = lines.map((line) => line.slice(0, maxPerLine));

                    setCompany(lines.join("\n"));
                  }}
                />
              </div>
      
              <Button onClick={generate} className="w-full">Order Business Card</Button>
            </CardContent>
          </Card>
        </div>
      
        {/* Right column: preview stacked */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Card Front</CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="rounded-lg overflow-hidden">
                <BusinessCardFront
                  templateId={template as any}
                  name={name}
                  role={role}
                  email={email}
                  phone={phone}
                  mobile={mobile}
                  company={company}
                  url={url}
                />
              </div>
            </CardContent>
          </Card>
      
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Card Back</CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="rounded-lg overflow-hidden">
                <BusinessCardBack
                  templateId={template as any}
                  name={name}
                  role={role}
                  email={email}
                  phone={phone}
                  mobile={mobile}
                  company={company}
                  url={url}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
        <Analytics />
    </main>
  );
}
