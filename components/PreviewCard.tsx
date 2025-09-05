"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";

/** ---------- geometry (mm) ---------- */
const CARD_W_MM = 85;
const CARD_H_MM = 55;

// internal render width; everything else derives from mm
const BASE_W_PX = 1000;
const PX_PER_MM = BASE_W_PX / CARD_W_MM;
const mm = (n: number) => n * PX_PER_MM;
const pt = (n: number) => (n * 96) / 72; // 1pt @96dpi

/** ---------- tweak here to nudge positions/sizes ---------- */
// text column (relative to left/top, like in the PDF)
const TEXT_LEFT_MM = 20.5;   // was 24.4 → further left
const TEXT_TOP_MM  = 20;     // was 24 → higher
const TEXT_COL_W_MM = 85;

// preview text looks a touch smaller than in the PDF at 1:1, so scale slightly
const TEXT_SCALE = 1.15;     // 15% larger visual size

// vertical gaps
const GAP_NAME_MM = 4;
const GAP_BODY_MM = 3.5;

/** back side QR (preview only; PDF keeps 32 mm) */
const QR_MM     = 28;      // was 32 → looked too big in PNG slot
const QR_X_MM   = 56;      // was 52.8 → a tad more to the right
const QR_Y_MM   = 20;      // was 18.85 → a hair higher

/** trim marks (optional) */
function CropMarks() {
  const L = 5; const T = 2;
  const s = { position: "absolute" as const, background: "rgba(0,0,0,.6)" };
  return (
    <>
      <div style={{ ...s, left: mm(T), top: mm(T), width: mm(L), height: 1 }} />
      <div style={{ ...s, left: mm(T), top: mm(T), width: 1, height: mm(L) }} />
      <div style={{ ...s, right: mm(T), top: mm(T), width: mm(L), height: 1 }} />
      <div style={{ ...s, right: mm(T), top: mm(T), width: 1, height: mm(L) }} />
      <div style={{ ...s, left: mm(T), bottom: mm(T), width: mm(L), height: 1 }} />
      <div style={{ ...s, left: mm(T), bottom: mm(T), width: 1, height: mm(L) }} />
      <div style={{ ...s, right: mm(T), bottom: mm(T), width: mm(L), height: 1 }} />
      <div style={{ ...s, right: mm(T), bottom: mm(T), width: 1, height: mm(L) }} />
    </>
  );
}

/** auto-scale wrapper so the card always fits its container */
export function AutoScale({ width, children }: { width: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      setScale(Math.min(1, Math.max(0.3, w / width)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);
  return (
    <div ref={ref} className="w-full">
      <div style={{ width, transform: `scale(${scale})`, transformOrigin: "top left" }}>{children}</div>
    </div>
  );
}

/** vCard helpers (same logic as your /api/pdf) */
const vEscape = (s: string) =>
  s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
function buildVCard3(opts: {
  fullName: string; org?: string; title?: string; email?: string; tel?: string; url?: string; addrLabel?: string;
}) {
  const { fullName, org, title, email, tel, url, addrLabel } = opts;
  const lines = ["BEGIN:VCARD", "VERSION:3.0", `FN:${vEscape(fullName)}`];
  if (org)   lines.push(`ORG:${vEscape(org)}`);
  if (title) lines.push(`TITLE:${vEscape(title)}`);
  if (tel)   lines.push(`TEL;TYPE=WORK,VOICE:${vEscape(tel)}`);
  if (email) lines.push(`EMAIL;TYPE=INTERNET,WORK:${vEscape(email)}`);
  if (url)   lines.push(`URL:${vEscape(url)}`);
  if (addrLabel) lines.push(`ADR;TYPE=WORK;LABEL="${vEscape(addrLabel)}":;;;;;;`);
  lines.push("END:VCARD");
  return lines.join("\r\n");
}

/** ---------- FRONT ---------- */
export function BusinessCardFront(props: {
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  company?: string;
  backgroundSrc: string;
  showTrim?: boolean;
}) {
  const { name, role = "", email = "", phone = "", company = "", backgroundSrc, showTrim } = props;

  const namePx = pt(10 * TEXT_SCALE);
  const rolePx = pt(8  * TEXT_SCALE);
  const bodyPx = pt(8  * TEXT_SCALE);

  const xLeft = mm(TEXT_LEFT_MM);
  const firstBaseY = mm(TEXT_TOP_MM);

  type Line = { text: string; size: number; dyMm: number; className?: string };
  const lines: Line[] = [
    { text: name, size: namePx, dyMm: 0, className: "font-bold" },
  ];
  if (role) lines.push({ text: role, size: rolePx, dyMm: GAP_NAME_MM, className: "italic font-light" });

  // spacer to contacts
  lines.push({ text: "", size: bodyPx, dyMm: 3.25 });

  if (phone) lines.push({ text: `T ${phone}`, size: bodyPx, dyMm: GAP_BODY_MM, className: "font-light" });
  if (email) lines.push({ text: email,       size: bodyPx, dyMm: GAP_BODY_MM, className: "font-light" });

  // spacer to company
  lines.push({ text: "", size: bodyPx, dyMm: 1.9 });

  (company || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter(Boolean)
    .forEach(l => lines.push({ text: l, size: bodyPx, dyMm: GAP_BODY_MM, className: "font-light" }));

  // render (no rounded corners / shadows)
  let y = firstBaseY;

  return (
    <div
      className="relative bg-white"
      style={{ width: BASE_W_PX, height: mm(CARD_H_MM) }}
    >
      <img
        src={backgroundSrc}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        draggable={false}
      />
      <div className="absolute" style={{ left: xLeft, top: 0, width: mm(TEXT_COL_W_MM), height: "100%" }}>
        {lines.map((l, i) => {
          if (i > 0) y += mm(l.dyMm);
          if (!l.text) return null;
          return (
            <div
              key={i}
              className={`font-[300] ${l.className ?? ""}`}
              style={{ position: "absolute", left: 0, top: y, fontSize: l.size, lineHeight: 1, color: "#000", whiteSpace: "pre-wrap" }}
            >
              {l.text}
            </div>
          );
        })}
      </div>
      {showTrim && <CropMarks />}
    </div>
  );
}

/** ---------- BACK ---------- */
export function BusinessCardBack(props: {
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  company?: string;
  url?: string;
  vcard?: boolean;
  backgroundSrc: string;
  showTrim?: boolean;
}) {
  const { name, role = "", email = "", phone = "", company = "", url = "", vcard = true, backgroundSrc, showTrim } = props;

  const org = (company || "").split(/\r?\n/)[0] || "";
  const addr = company || "";
  const payload = vcard
    ? buildVCard3({ fullName: name, org, title: role || undefined, email: email || undefined, tel: phone || undefined, url: url || undefined, addrLabel: addr })
    : (url || (email ? `mailto:${email}` : ""));

  const [qr, setQr] = useState<string>("");
  useEffect(() => {
    if (!payload) return setQr("");
    QRCode.toDataURL(payload, { width: 1024, margin: 0, errorCorrectionLevel: "M" })
      .then(setQr)
      .catch(() => setQr(""));
  }, [payload]);

  return (
    <div className="relative bg-white" style={{ width: BASE_W_PX, height: mm(CARD_H_MM) }}>
      <img
        src={backgroundSrc}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        draggable={false}
      />
      {qr && (
        <img
          src={qr}
          alt="QR"
          className="absolute"
          style={{
            left: mm(QR_X_MM),
            bottom: mm(QR_Y_MM),
            width: mm(QR_MM),
            height: mm(QR_MM),
          }}
          draggable={false}
        />
      )}
      {showTrim && <CropMarks />}
    </div>
  );
}
