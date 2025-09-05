"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import * as QRCode from "qrcode";

/* ---------- Geometrie & Helpers (mm/pt/px) ---------- */

// Kartengröße (beschnitten) – 85 × 55 mm
const CARD_W_MM = 85;
const CARD_H_MM = 55;

// mm → px (CSS 96dpi)
const mm2px = (mm: number) => (mm * 96) / 25.4;
// pt → px (1pt = 1/72in)
const pt2px = (pt: number) => (pt * 96) / 72;

// Werte wie in der PDF-Route
const COL_LEFT_MM = 24.4;
const COL_WIDTH_MM = 85;
const TOP_FIRSTLINE_MM = 24;
const GAP_NAME_MM = 4;
const GAP_BODY_MM = 3.5;

// Fonts (wie in globals.css registriert)
const FONT_FAMILY = `"Frutiger LT Pro", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans"`;

type FrontProps = {
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  company?: string; // mehrzeilig
};

type BackProps = {
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  company?: string; // mehrzeilig, 1. Zeile = ORG
  url?: string;     // optional zusätzlich in vCard
};

/* ---------- Responsive Stage (misst verfügbare Breite) ---------- */

function useScale(containerRef: React.RefObject<HTMLDivElement>) {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const baseW = mm2px(CARD_W_MM); // Breite in CSS-Pixeln (96dpi)
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      setScale(Math.min(1, w / baseW)); // nie größer als 1 – kleiner wird skaliert
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef]);
  return scale;
}

/* ---------- vCard Helper (wie in API) ---------- */

function vEscape(s: string) {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
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
    `FN:${vEscape(fullName)}`,
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

/* ---------- Front (Canvas) ---------- */

export function BusinessCardFront(props: FrontProps) {
  const { name, role = "", email = "", phone = "", company = "" } = props;
  const wrapRef = useRef<HTMLDivElement>(null);
  const scale = useScale(wrapRef);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const Wpx = mm2px(CARD_W_MM);
  const Hpx = mm2px(CARD_H_MM);

  useEffect(() => {
    const run = async () => {
      // sicherstellen, dass Webfonts geladen sind
      // @ts-ignore
      if (document.fonts && document.fonts.ready) await document.fonts.ready;

      const cvs = canvasRef.current;
      if (!cvs) return;
      const dpr = Math.max(1, window.devicePixelRatio || 1);

      // CSS Größe
      cvs.style.width = `${Wpx * scale}px`;
      cvs.style.height = `${Hpx * scale}px`;

      // interne Pixelgröße (HiDPI)
      cvs.width = Math.round(Wpx * scale * dpr);
      cvs.height = Math.round(Hpx * scale * dpr);

      const ctx = cvs.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // dpr-Scale
      ctx.clearRect(0, 0, Wpx * scale, Hpx * scale);

      // Hintergrund (PNG) unterlegen – exakt skaliert
      const img = new Image();
      img.src = "/templates/omicron-front.png";
      await img.decode().catch(() => {});
      ctx.drawImage(img, 0, 0, Wpx * scale, Hpx * scale);

      // Text-Setup (alphabetic = PDF-Baseline sehr ähnlich)
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = "#000";

      // Maße in Pixel (inkl. scale)
      const colLeft = mm2px(COL_LEFT_MM) * scale;
      const colWidth = mm2px(COL_WIDTH_MM) * scale;
      let y = mm2px(TOP_FIRSTLINE_MM) * scale;

      // Schriftgrößen (pt → px → scale)
      const sizeName = pt2px(10) * scale;
      const sizeRole = pt2px(8) * scale;
      const sizeBody = pt2px(8) * scale;

      // Name (Bold)
      ctx.font = `700 ${sizeName}px ${FONT_FAMILY}`;
      ctx.fillText(name, colLeft, y);

      // Rolle (LightItalic)
      y += mm2px(GAP_NAME_MM) * scale;
      if (role) {
        ctx.font = `300 italic ${sizeRole}px ${FONT_FAMILY}`;
        ctx.fillText(role, colLeft, y);
      }

      // Abstand zu Kontakten
      y += mm2px(3.25) * scale;

      // Kontakte
      ctx.font = `300 ${sizeBody}px ${FONT_FAMILY}`;
      const contactLines = [
        phone ? `T ${phone}` : "",
        email || "",
        // URL wird in PDF ebenfalls mitgedruckt – hier spiegeln
        props["url" as never] || "",
      ].filter(Boolean);

      for (const line of contactLines) {
        drawWrappedLine(ctx, line, colLeft, y, colWidth, sizeBody);
        y += mm2px(GAP_BODY_MM) * scale;
      }

      // Abstand + Firma/Adresse
      y += mm2px(1.9) * scale;

      const addrLines = (company || "")
        .replace(/\r\n/g, "\n")
        .split("\n")
        .map((s) => s.trimEnd())
        .filter(Boolean);

      for (const line of addrLines) {
        drawWrappedLine(ctx, line, colLeft, y, colWidth, sizeBody);
        y += mm2px(GAP_BODY_MM) * scale;
      }
    };

    run();
  }, [name, role, email, phone, company, scale]); // eslint-disable-line

  return (
    <div ref={wrapRef} className="w-full">
      <div
        style={{
          width: `${Wpx * scale}px`,
          height: `${Hpx * scale}px`,
        }}
      >
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}

// einfache Wortumbruch-Funktion auf Canvas-Basis
function drawWrappedLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  baselineY: number,
  maxWidth: number,
  sizePx: number
) {
  const words = text.split(/\s+/);
  let line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    const wpx = ctx.measureText(test).width;
    if (wpx <= maxWidth) {
      line = test;
    } else {
      if (line) ctx.fillText(line, x, baselineY);
      // Wort selbst zu lang -> sehr einfacher Hard-Break
      if (ctx.measureText(w).width > maxWidth) {
        let cut = "";
        for (const ch of w) {
          const t = cut + ch;
          if (ctx.measureText(t).width > maxWidth) {
            ctx.fillText(cut, x, baselineY);
            baselineY += sizePx; // minimaler Schritt, wir sind in einer Notsituation
            cut = ch;
          } else cut = t;
        }
        line = cut;
      } else {
        line = w;
      }
      baselineY += sizePx; // kleine Zusatzhöhe falls wir sehr eng umbrechen mussten
    }
  }
  if (line) ctx.fillText(line, x, baselineY);
}

/* ---------- Back (Canvas mit vCard-QR) ---------- */

export function BusinessCardBack(props: BackProps) {
  const { name, role = "", email = "", phone = "", company = "", url = "" } = props;
  const wrapRef = useRef<HTMLDivElement>(null);
  const scale = useScale(wrapRef);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const Wpx = mm2px(CARD_W_MM);
  const Hpx = mm2px(CARD_H_MM);

  useEffect(() => {
    const run = async () => {
      // @ts-ignore
      if (document.fonts && document.fonts.ready) await document.fonts.ready;

      const cvs = canvasRef.current;
      if (!cvs) return;
      const dpr = Math.max(1, window.devicePixelRatio || 1);

      // CSS Größe
      cvs.style.width = `${Wpx * scale}px`;
      cvs.style.height = `${Hpx * scale}px`;
      // interne Größe
      cvs.width = Math.round(Wpx * scale * dpr);
      cvs.height = Math.round(Hpx * scale * dpr);

      const ctx = cvs.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, Wpx * scale, Hpx * scale);

      // Hintergrund
      const img = new Image();
      img.src = "/templates/omicron-back.png";
      await img.decode().catch(() => {});
      ctx.drawImage(img, 0, 0, Wpx * scale, Hpx * scale);

      // vCard generieren
      const orgName = (company || "").split(/\r?\n/)[0] || "";
      const vcard = buildVCard3({
        fullName: name,
        org: orgName,
        title: role || undefined,
        email: email || undefined,
        tel: phone || undefined,
        url: url || undefined,
        addrLabel: company || undefined,
      });

      // QR erzeugen (DataURL) – gleiche Eckdaten wie in der PDF
      const dataUrl = await QRCode.toDataURL(vcard, {
        width: 1024,
        margin: 0,
        errorCorrectionLevel: "M",
      });

      const qrImg = new Image();
      qrImg.src = dataUrl;
      await qrImg.decode().catch(() => {});

      const qrSizePx = mm2px(32) * scale;
      const qx = mm2px(52.8) * scale;
      const qyFromBottom = mm2px(18.85) * scale;

      // In der PDF ist (x,y) unten links – auf Canvas ist y nach unten positiv:
      const yTop = (Hpx * scale) - (qyFromBottom + qrSizePx);

      ctx.drawImage(qrImg, qx, yTop, qrSizePx, qrSizePx);
    };

    run();
  }, [name, role, email, phone, company, url, scale]);

  return (
    <div ref={wrapRef} className="w-full">
      <div
        style={{
          width: `${Wpx * scale}px`,
          height: `${Hpx * scale}px`,
        }}
      >
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
