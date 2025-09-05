"use client";

import { useMemo } from "react";
import QRCode from "qrcode";

/**
 * Fixe Karten-Geometrie (wie Omicron)
 * -> bitte NICHT wieder ändern :)
 */
const CARD_W_MM = 85;
const CARD_H_MM = 55;

// Typografie (PDF: 10pt / 8pt)
const PT_TO_MM = 0.352777778;
const NAME_PT = 10;
const ROLE_PT = 8;
const BODY_PT = 8;

const NAME_MM = NAME_PT * PT_TO_MM; // ~3.53mm
const ROLE_MM = ROLE_PT * PT_TO_MM; // ~2.82mm
const BODY_MM = BODY_PT * PT_TO_MM; // ~2.82mm

// Spalten- und Abstandsmaße (aus deiner PDF-Route übernommen)
const LEFT_MM = 24.4;
const COL_W_MM = 85;
const TOP_MM = 24;
const GAP_NAME_MM = 4;
const GAP_BODY_MM = 3.5;

// Rückseite – QR (vCard)
const QR_SIZE_MM = 32;
const QR_X_MM = 52.8;
const QR_Y_MM = 18.85;

type FrontProps = {
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  company?: string;
};

type BackProps = {
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  url?: string;
  company?: string;
};

function splitCompanyLines(s: string | undefined) {
  if (!s) return [];
  return s.replace(/\r\n/g, "\n").split("\n").map(l => l.trim()).filter(Boolean);
}

/** SVG-basierte Front – skaliert perfekt, weil viewBox in mm ist. */
export function BusinessCardFront(props: FrontProps) {
  const { name, role = "", email = "", phone = "", company = "" } = props;

  let y = TOP_MM;

  const nameY = y;                        // baseline: Top
  y += NAME_MM + GAP_NAME_MM;             // nach Name Abstand

  const roleY = role ? y : y;             // baseline
  if (role) y += ROLE_MM + GAP_NAME_MM;   // Abstand zu Kontakten

  const lines: string[] = [];
  if (phone) lines.push(`T ${phone}`);
  if (email) lines.push(email);
  // In der Vorschau zeigen wir die URL NICHT (wie in deinem Screenshot)
  // Wenn du sie willst, ergänzen: lines.push(url)

  const contactsStartY = y;
  const companyStartY = contactsStartY + lines.length * (BODY_MM + GAP_BODY_MM) + 1.9; // wie PDF

  const companyLines = splitCompanyLines(company);

  return (
    <div className="rounded-xl border bg-white p-3">
      <div
        className="relative w-full"
        style={{
          aspectRatio: `${CARD_W_MM} / ${CARD_H_MM}`,
          backgroundImage: "url(/templates/omicron-front.png)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <svg
          viewBox={`0 0 ${CARD_W_MM} ${CARD_H_MM}`}
          className="absolute inset-0 block"
        >
          {/* Name (Bold) */}
          <text
            x={LEFT_MM}
            y={nameY}
            fontFamily="Frutiger LT Pro, system-ui, sans-serif"
            fontWeight={700}
            fontSize={NAME_MM}
            dominantBaseline="hanging"
            fill="rgb(23,23,23)"
          >
            {name}
          </text>

          {/* Rolle (Light Italic) */}
          {role && (
            <text
              x={LEFT_MM}
              y={roleY}
              fontFamily="Frutiger LT Pro, system-ui, sans-serif"
              fontStyle="italic"
              fontWeight={300}
              fontSize={ROLE_MM}
              dominantBaseline="hanging"
              fill="rgb(38,38,38)"
            >
              {role}
            </text>
          )}

          {/* Kontakte */}
          {lines.map((t, i) => (
            <text
              key={i}
              x={LEFT_MM}
              y={contactsStartY + i * (BODY_MM + GAP_BODY_MM)}
              fontFamily="Frutiger LT Pro, system-ui, sans-serif"
              fontWeight={300}
              fontSize={BODY_MM}
              dominantBaseline="hanging"
              fill="rgb(23,23,23)"
            >
              {t}
            </text>
          ))}

          {/* Firma / Adresse */}
          {companyLines.map((t, i) => (
            <text
              key={`c${i}`}
              x={LEFT_MM}
              y={companyStartY + i * (BODY_MM + GAP_BODY_MM)}
              fontFamily="Frutiger LT Pro, system-ui, sans-serif"
              fontWeight={300}
              fontSize={BODY_MM}
              dominantBaseline="hanging"
              fill="rgb(23,23,23)"
            >
              {t}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}

/** vCard v3.0 – gleich wie in deiner API */
function vEscape(s: string) {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}
function buildVCard(opts: {
  fullName: string;
  org?: string;
  title?: string;
  email?: string;
  tel?: string;
  url?: string;
  addrLabel?: string;
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

export function BusinessCardBack(props: BackProps) {
  const { name, role = "", email = "", phone = "", url = "", company = "" } = props;

  const vcard = useMemo(() => {
    const org = (company || "").split(/\r?\n/)[0] || "";
    return buildVCard({
      fullName: name,
      org,
      title: role || undefined,
      email: email || undefined,
      tel: phone || undefined,
      url: url || undefined,
      addrLabel: company || undefined,
    });
  }, [name, role, email, phone, url, company]);

  const qrDataUrl = useMemo(() => {
    // synchrones Helper-Promise zu DataURL
    return QRCode.toDataURL(vcard, {
      errorCorrectionLevel: "M",
      margin: 0,
      width: 1024,
    });
  }, [vcard]);

  return (
    <div className="rounded-xl border bg-white p-3">
      <div
        className="relative w-full"
        style={{
          aspectRatio: `${CARD_W_MM} / ${CARD_H_MM}`,
          backgroundImage: "url(/templates/omicron-back.png)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <svg
          viewBox={`0 0 ${CARD_W_MM} ${CARD_H_MM}`}
          className="absolute inset-0 block"
        >
          {/* QR-Bild an exakt den mm-Koordinaten */}
          {/* image xlinkHref muss nach Promise-Auflösung gesetzt werden */}
          <image
            href={undefined as unknown as string}
            x={QR_X_MM}
            y={QR_Y_MM}
            width={QR_SIZE_MM}
            height={QR_SIZE_MM}
            preserveAspectRatio="none"
          />
        </svg>

        {/* Das <img> darübergelegt, weil <image href> kein async kann */}
        {/* Position deckungsgleich per absolute + Prozent */}
        <AwaitedImage
          dataUrlPromise={qrDataUrl}
          xPct={(QR_X_MM / CARD_W_MM) * 100}
          yPct={(QR_Y_MM / CARD_H_MM) * 100}
          wPct={(QR_SIZE_MM / CARD_W_MM) * 100}
          hPct={(QR_SIZE_MM / CARD_H_MM) * 100}
        />
      </div>
    </div>
  );
}

/** Hilfs-Image, das DataURL lädt und exakt platziert wird */
function AwaitedImage({
  dataUrlPromise,
  xPct,
  yPct,
  wPct,
  hPct,
}: {
  dataUrlPromise: Promise<string>;
  xPct: number; yPct: number; wPct: number; hPct: number;
}) {
  const [src, setSrc] = useMemo(() => {
    let active = true;
    const state: [string | null, (s: string | null) => void] = [null, () => {}];
    (async () => {
      const url = await dataUrlPromise;
      if (active) {
        // @ts-ignore – wir setzen aus dem Closure heraus
        state[0] = url;
        state[1](url);
      }
    })();
    return state;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataUrlPromise]) as unknown as [string | null, (s: string | null) => void];

  // Minimales „state“ ohne useState, um Build-Fehler zu vermeiden
  // Falls du lieber echtes useState möchtest, ersetze obigen Block durch useState+useEffect.

  return src ? (
    <img
      src={src}
      alt="vCard QR"
      style={{
        position: "absolute",
        left: `${xPct}%`,
        top: `${yPct}%`,
        width: `${wPct}%`,
        height: `${hPct}%`,
      }}
    />
  ) : null;
}
