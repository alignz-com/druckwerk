"use client";

import { useEffect, useMemo, useState } from "react";

/* ====== constants ====== */
const CARD_W = "85mm";
const CARD_H = "55mm";

/* === spacing and positions (same as your API) === */
const LEFT_MM = 24.4;     // column left
const TOP_MM  = 24;       // first baseline offset from top
const COL_W_MM = 85;      // column width
const NAME_PT = 10;
const ROLE_PT = 8;
const BODY_PT = 8;
const GAP_HEAD_MM = 4;     // name/role line gap
const GAP_BODY_MM = 3.5;   // contact/company line gap
const CONTACT_SPACER_MM = 3.25;
const COMPANY_SPACER_MM = 1.9;

/* === QR on back (same as API) === */
const QR_SIZE_MM = 32;
const QR_X_MM = 52.8;
const QR_Y_MM = 18.85;

/* ====== vCard helpers (same as API) ====== */
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
    `FN:${vEscape(fullName)}`
  ];
  if (org)   lines.push(`ORG:${vEscape(org)}`);
  if (title) lines.push(`TITLE:${vEscape(title)}`);
  if (tel)   lines.push(`TEL;TYPE=WORK,VOICE:${vEscape(tel)}`);
  if (email) lines.push(`EMAIL;TYPE=INTERNET,WORK:${vEscape(email)}`);
  if (url)   lines.push(`URL:${vEscape(url)}`);
  if (addrLabel) lines.push(`ADR;TYPE=WORK;LABEL="${vEscape(addrLabel)}":;;;;;;`);
  lines.push("END:VCARD");
  return lines.join("\r\n"); // CRLF
}

/* ====== FRONT ====== */
export function BusinessCardFront({
  name,
  role = "",
  email = "",
  phone = "",
  company = "",
  url = "",
}: {
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  company?: string;
  url?: string;
}) {
  return (
    <div
      className="relative select-none font-frutiger antialiased"
      style={{
        width: CARD_W,
        height: CARD_H,
        backgroundImage: "url(/templates/omicron-front.png)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      {/* One positioned container; normal flow handles the line order */}
      <div
        className="absolute"
        style={{
          left: `${LEFT_MM}mm`,
          top:  `${TOP_MM}mm`,
          width: `${COL_W_MM}mm`,
        }}
      >
        {/* Name */}
        <div style={{ fontSize: `${NAME_PT}pt`, lineHeight: 1.15, fontWeight: 700 }}>
          {name}
        </div>

        {/* Role */}
        {role && (
          <div
            style={{
              marginTop: `${GAP_HEAD_MM}mm`,
              fontSize: `${ROLE_PT}pt`,
              lineHeight: 1.2,
              fontStyle: "italic",
              fontWeight: 300,
            }}
          >
            {role}
          </div>
        )}

        {/* Contacts */}
        <div
          style={{
            marginTop: `${CONTACT_SPACER_MM}mm`,
            fontSize: `${BODY_PT}pt`,
            lineHeight: 1.2,
            fontWeight: 300,
          }}
        >
          {phone && <div>{`T ${phone}`}</div>}
          {email && <div>{email}</div>}
          {url   && <div>{url}</div>}
        </div>

        {/* Company / Address */}
        {company && (
          <div
            style={{
              marginTop: `${COMPANY_SPACER_MM}mm`,
              fontSize: `${BODY_PT}pt`,
              lineHeight: 1.2,
              fontWeight: 300,
              whiteSpace: "pre-line",
            }}
          >
            {company}
          </div>
        )}
      </div>
    </div>
  );
}

/* ====== BACK (vCard QR, 32 mm) ====== */
export function BusinessCardBack({
  name,
  role = "",
  email = "",
  phone = "",
  company = "",
  url = "",
}: {
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  company?: string;
  url?: string;
}) {
  const orgName   = (company || "").split(/\r?\n/)[0] || "";
  const addrLabel = company || "";

  const vcard = useMemo(
    () =>
      buildVCard3({
        fullName: name,
        org: orgName || undefined,
        title: role || undefined,
        email: email || undefined,
        tel: phone || undefined,
        url: url || undefined,
        addrLabel,
      }),
    [name, orgName, role, email, phone, url, addrLabel]
  );

  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!vcard) { setQrDataUrl(""); return; }
      const { toDataURL } = await import("qrcode");
      const dataUrl = await toDataURL(vcard, {
        width: 1024,
        margin: 0,
        errorCorrectionLevel: "M",
      });
      if (!cancel) setQrDataUrl(dataUrl);
    })();
    return () => { cancel = true; };
  }, [vcard]);

  return (
    <div
      className="relative select-none"
      style={{
        width: CARD_W,
        height: CARD_H,
        backgroundImage: "url(/templates/omicron-back.png)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      {qrDataUrl && (
        <img
          src={qrDataUrl}
          alt="QR"
          style={{
            position: "absolute",
            left: `${QR_X_MM}mm`,
            top:  `${QR_Y_MM}mm`,
            width: `${QR_SIZE_MM}mm`,
            height: `${QR_SIZE_MM}mm`,
          }}
        />
      )}
    </div>
  );
}
