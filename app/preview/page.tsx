"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { BusinessCardFront, BusinessCardBack } from "@/components/PreviewCard";

export default function PreviewPage() {
  // Demo-Defaults
  const [name, setName] = useState("Pascal Rossi");
  const [role, setRole] = useState("CEO & Founder");
  const [email, setEmail] = useState("pascal@alignz.com");
  const [phone, setPhone] = useState("+41 79 530 74 60");
  const [mobile, setMobile] = useState("+41 79 530 74 60");
  const [company, setCompany] = useState("Alignz AG\nSeestrasse 12\n8000 Zürich");
  const [url, setUrl] = useState("https://alignz.com/pascal");

  const generate = async () => {
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
  };

  return (
    <main className="mx-auto max-w-[1200px] p-6 md:p-8 lg:p-10 space-y-6">
      <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Business Card – Omicron</h1>

      <div className="grid gap-6 lg:grid-cols-[480px_minmax(0,1fr)]">
        {/* Left: form */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base md:text-lg">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="role">Function / Title</Label>
              <Input id="role" value={role} onChange={(e) => setRole(e.target.value)} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="phone">Mobile</Label>
              <Input id="mobile" value={mobile} onChange={(e) => setMobile(e.target.value)} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="email">E-Mail</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="url">URL</Label>
              <Input id="url" value={url} onChange={(e) => setUrl(e.target.value)} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="company">Company & Address</Label>
              <Textarea
                id="company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                rows={5}
              />
            </div>



            <Button onClick={generate} className="w-full">Generate PDF</Button>
          </CardContent>
        </Card>

        {/* Right: preview */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Card Front</CardTitle>
            </CardHeader>
            {/* nur 1 Rahmen – innen KEINE zusätzliche Shadow/Borders */}
            <CardContent className="pt-2">
              <div className="rounded-lg overflow-hidden">
                <BusinessCardFront name={name} role={role} email={email} phone={phone} mobile={mobile} company={company} url={url} />
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
                  name={name}
                  role={role}
                  email={email}
                  phone={phone}
                  mobile={mobile}
                  company={company}
                  url={url}
                  /* bei Bedarf live feintunen: */
                  // qrOverride={{ xMm: 49.2, yMm: 17.9, sizeMm: 27.2 }}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
