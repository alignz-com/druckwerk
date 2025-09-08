// lib/cardTemplates.ts
export type TemplateId = "qrcode" | "doublesided" | "claim" | "omicron-lab";

type BackMode = "qr" | "sameAsFront" | "claim";

export type TemplateConfig = {
  id: TemplateId;
  label: string;
  frontPng: string;             // background for front
  backPng?: string;             // optional background for back
  backMode: BackMode;           // what to render on the back
  qr?: { xMm: number; yMm: number; sizeMm: number }; // only used if backMode = "qr"
  claimPng?: string;            // used if backMode = "claim"
};

export const TEMPLATE_REGISTRY: Record<TemplateId, TemplateConfig> = {
  // current behavior renamed
  "qrcode": {
    id: "qrcode",
    label: "QR Code",
    frontPng: "/templates/omicron-front.png",
    backPng: "/templates/omicron-back.png",
    backMode: "qr",
    qr: { xMm: 45, yMm: 15, sizeMm: 25 },
  },

  // same content (text) on back as on front; usually same background
  "doublesided": {
    id: "doublesided",
    label: "Doublesided",
    frontPng: "/templates/omicron-front.png",
    backPng: "/templates/omicron-front.png",
    backMode: "sameAsFront",
  },

  // back shows a claim image only; front same as QR Code front; no QR/data
  "claim": {
    id: "claim",
    label: "Claim",
    frontPng: "/templates/omicron-front.png",
    backPng: "/templates/claim-back.png", // <- your claim artwork
    backMode: "claim",
    claimPng: "/templates/claim-back.png",
  },

  // different front logo; back identical to QR template (with QR)
  "omicron-lab": {
    id: "omicron-lab",
    label: "Omicron Lab",
    frontPng: "/templates/omicron-lab-front.png",
    backPng: "/templates/omicron-back.png",
    backMode: "qr",
    qr: { xMm: 45, yMm: 15, sizeMm: 25 },
  },
};