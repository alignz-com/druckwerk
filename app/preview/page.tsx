"use client";
import { useState } from "react";

export default function PreviewPage() {
  const [name, setName]   = useState("Pascal Rossi");
  const [role, setRole]   = useState("CEO & Founder");
  const [email, setEmail] = useState("pascal@alignz.com");
  const [phone, setPhone] = useState("+41 79 530 74 60");
  const [url, setUrl]     = useState("https://alignz.com/pascal");

  const generate = async () => {
    const res = await fetch("/api/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, role, email, phone, url, template: "basic" }),
    });
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href; a.download = "card.pdf"; a.click();
    URL.revokeObjectURL(href);
  };

  return (
    <main className="mx-auto max-w-xl p-6 space-y-4">
      <h1 className="text-2xl font-semibold">PDF Test</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input className="border rounded p-2" value={name} onChange={e=>setName(e.target.value)} placeholder="Name" />
        <input className="border rounded p-2" value={role} onChange={e=>setRole(e.target.value)} placeholder="Role" />
        <input className="border rounded p-2" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" />
        <input className="border rounded p-2" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Phone" />
        <input className="border rounded p-2 md:col-span-2" value={url} onChange={e=>setUrl(e.target.value)} placeholder="URL (für QR)" />
      </div>
      <button className="rounded bg-black text-white px-4 py-2" onClick={generate}>Generate PDF</button>
    </main>
  );
}
