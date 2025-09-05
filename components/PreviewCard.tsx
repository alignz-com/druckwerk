"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import * as QRCode from "qrcode";

// ---------- Konstanten ----------
const CARD_W_MM = 85;
const CARD_H_MM = 55;
const L_MM = 24.4;
const W_MM = 85;
const TOP_MM = 24;

const GAP_NAME_ROLE_MM = 4;
const GAP_BODY_MM = 3.5;
const GAP_TO_CONTACTS_MM = 3.25;
const GAP_TO_COMPANY_MM = 1.9;

const QR_SIZE_MM = 32;
const QR_X_MM = 52.8;
const QR_Y_MM = 18.85;

const PT2PX = 96 / 72;
const NAME_PX = 10 * PT2PX;
const ROLE_PX = 8 * PT2PX;
const BODY_PX = 8 * PT2PX;

const pxPerMm = 4;
const mm = (val: number) => val * pxPerMm;

// ---------- Hook ----------
function useFitScale(ref: React.RefObject<HTMLDivElement | null>, baseWidthPx: number) {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const ro = new ResizeObserver(() => {
      const wrapW = el.clientWidth;
      if (!wrapW) return;
      setScale(wrapW / baseWidthPx);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, baseWidthPx]);
  return scale;
}

// ---------- vCard ----------
function vEscape(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}
function buildVCard3(opts: {
  fullName: string;
  org?: string;
  title?: string;
  email?: string;
  tel?: string;
  url?: string;
  addrLabel?: string;
}) {
  const { fullName, org, title, email, tel, url, addrLabel } = opts;
  const lines: string[] = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${vEscape(fullName)}`
  ];
  if (org) lines.push(`ORG:${vEscape(org)}`);
  if (title) lines.push(`TITLE:${vEscape(title)}`);
  if (tel) lines.push(`TEL;TYPE=WORK,VOICE:${vEscape(tel)}`);
  if (email) lines.push(`EMAIL;TYPE=INTERNET,WORK:${vEscape(email)}`);
  if (url) lines.push(`URL:${vEscape(url)}`);
  if (addrLabel) lines.push(`ADR;TYPE=WORK;LABEL="${vEscape(addrLabel)}":;;;;;;`);
  lines.push("END:VCARD");
  return lines.join("\r\n");
}

// ---------- Front ----------
export function BusinessCardFront(props: {
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  company?: string;
  bgSrc?: string;
}) {
  const { name, role = "", email = "", phone = "", company = "", bgSrc = "/templates/omicron_front.png" } = props;

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const scale = useFitScale(wrapRef, mm(CARD_W_MM));

  const y0 = TOP_MM;
  let y = y0;
  const lines: React.ReactElement[] = [];

  // Name
  lines.push(
    <div key="name" style={{
      position: "absolute",
      left: mm(L_MM),
      top: mm(y),
      width: mm(W_MM),
      fontFamily: "Frutiger LT Pro",
      fontWeight: 700,
      fontSize: NAME_PX,
      lineHeight: 1,
    }}>{name}</div>
  );
  y += GAP_NAME_ROLE_MM;

  // Rolle
  if (role) {
    lines.push(
      <div key="role" style={{
        position: "absolute",
        left: mm(L_MM),
        top: mm(y),
        width: mm(W_MM),
        fontFamily: "Frutiger LT Pro",
        fontStyle: "italic",
        fontWeight: 300,
        fontSize: ROLE_PX,
        lineHeight: 1,
      }}>{role}</div>
    );
    y += GAP_NAME_ROLE_MM;
  }

  y += GAP_TO_CONTACTS_MM;

  // Kontakte
  if (phone) {
    lines.push(<div key="phone" style={{
      position: "absolute", left: mm(L_MM), top: mm(y),
      fontFamily: "Frutiger LT Pro", fontWeight: 300, fontSize: BODY_PX
    }}>T {phone}</div>);
    y += GAP_BODY_MM;
  }
  if (email) {
    lines.push(<div key="email" style={{
      position: "absolute", left: mm(L_MM), top: mm(y),
      fontFamily: "Frutiger LT Pro", fontWeight: 300, fontSize: BODY_PX
    }}>{email}</div>);
    y += GAP_BODY_MM;
  }

  y += GAP_TO_COMPANY_MM;

  if (company) {
    const addrLines = company.split(/\r?\n/);
    for (const [i, t] of addrLines.entries()) {
      lines.push(<div key={`addr-${i}`} style={{
        position: "absolute", left: mm(L_MM), top: mm(y),
        fontFamily: "Frutiger LT Pro", fontWeight: 300, fontSize: BODY_PX
      }}>{t}</div>);
      y += GAP_BODY_MM;
    }
  }

  return (
    <div ref={wrapRef} className="w-full">
      <div style={{
        position: "relative",
        width: mm(CARD_W_MM),
        height: mm(CARD_H_MM),
        transform: `scale(${scale})`,
        transformOrigin: "top left"
      }}>
        <img src={bgSrc} alt="Card Front" style={{
          position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover"
        }} />
        {lines}
      </div>
    </div>
  );
}

// ---------- Back ----------
export function BusinessCardBack(props: {
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  company?: string;
  url?: string;
  bgSrc?: string;
}) {
  const { name, role = "", email = "", phone = "", company = "", url = "", bgSrc = "/templates/omicron_back.png" } = props;

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const scale = useFitScale(wrapRef, mm(CARD_W_MM));

  const org = (company || "").split(/\r?\n/)[0] || "";
  const vcardStr = useMemo(() => buildVCard3({
    fullName: name, org: org || undefined, title: role || undefined,
    email: email || undefined, tel: phone || undefined, url: url || undefined, addrLabel: company || undefined
  }), [name, org, role, email, phone, url, company]);

  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  useEffect(() => {
    let active = true;
    (async () => {
      const dataUrl = await QRCode.toDataURL(vcardStr, { width: 1024, margin: 0, errorCorrectionLevel: "M" });
      if (active) setQrDataUrl(dataUrl);
    })();
    return () => { active = false; };
  }, [vcardStr]);

  return (
    <div ref={wrapRef} className="w-full">
      <div style={{
        position: "relative",
        width: mm(CARD_W_MM),
        height: mm(CARD_H_MM),
        transform: `scale(${scale})`,
        transformOrigin: "top left"
      }}>
        <img src={bgSrc} alt="Card Back" style={{
          position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover"
        }} />
        {qrDataUrl && (
          <img src={qrDataUrl} alt="vCard QR" style={{
            position: "absolute",
            left: mm(QR_X_MM),
            top: mm(QR_Y_MM),
            width: mm(QR_SIZE_MM),
            height: mm(QR_SIZE_MM)
          }} />
        )}
      </div>
    </div>
  );
}
