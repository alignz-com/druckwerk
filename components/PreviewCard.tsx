"use client";

import { useEffect, useMemo, useState } from "react";

// Card size
const CARD_W = "85mm";
const CARD_H = "55mm";

// ---------- FRONT (pure CSS flow; mm/pt for exact spacing) ----------
export function BusinessCardFront({
  name,
  role = "",
  email = "",
  phone = "",
  company = "",
  url = "",
}: {
  name: string; role?: string; email?: string; phone?: string; company?: string; url?: string;
}) {
  return (
    <div
      className="relative select-none font-frutiger"
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
      {/* Position the text block once; let normal flow handle lines */}
      <div
        className="absolute"
        style={{
          left: "24.4mm",     // LEFT
          top:  "24mm",       // TOP baseline area
          width: "85mm",      // column width (adjust if needed)
        }}
      >
        {/* Name */}
        <div style={{ fontSize: "10pt", lineHeight: 1.15, fontWeight: 700 }}>{name}</div>

        {/* Role */}
        {role && (
          <div style={{ marginTop: "4mm", fontSize: "8pt", lineHeight: 1.2, fontStyle: "italic", fontWeight: 300 }}>
            {role}
          </div>
        )}

        {/* Contacts */}
        <div style={{ marginTop: "3.25mm", fontSize: "8pt", lineHeight: 1.2, fontWeight: 300 }}>
          {phone && <div>{`T ${phone}`}</div>}
          {email && <div>{email}</div>}
          {url   && <div>{url}</div>}
        </div>

        {/* Company / Address */}
        {company && (
          <div
            style={{
              marginTop: "1.9mm",
              fontSize: "8pt",
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

// ---------- BACK (QR @ 27 mm) ----------
export function BusinessCardBack({ email, url }: { email?: string; url?: string }) {
  const target = useMemo(() => (url ? url : email ? `mailto:${email}` : ""), [url, email]);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!target) { setQrDataUrl(""); return; }
      const { toDataURL } = await import("qrcode");
      const dataUrl = await toDataURL(target, { width: 512, margin: 0, errorCorrectionLevel: "M" });
      if (!cancel) setQrDataUrl(dataUrl);
    })();
    return () => { cancel = true; };
  }, [target]);

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
            left: "52.8mm",   // adjust if your white box demands it
            top:  "18.85mm",
            width: "27mm",    // ← smaller QR
            height: "27mm",
          }}
        />
      )}
    </div>
  );
}
