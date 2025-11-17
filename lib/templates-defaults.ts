import type { TemplateDesign } from "./template-design";
import { DEFAULT_TEMPLATE_DESIGN } from "./template-design";

export type TemplateFontStyle = "bold" | "light" | "lightItalic";

export type TemplateTextStyle = {
  font: TemplateFontStyle;
  sizePt: number;
  lineGapMm: number;
  spacingAfterMm?: number;
};

export type TemplatePhotoSlotConfig = {
  side?: "front" | "back";
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  shape?: "circle" | "square" | "rounded";
  borderColor?: string;
  borderWidthMm?: number;
};

export type TemplateConfig = {
  front: {
    textFrame: {
      xMm: number;
      topMm: number;
      columnWidthMm: number;
      name: TemplateTextStyle;
      role?: TemplateTextStyle;
      contacts?: TemplateTextStyle;
      company?: TemplateTextStyle;
    };
    preview?: {
      fontScale?: number;
      maxWidthPx?: number;
      baselineOffsetMm?: number;
      lineHeightScale?: number;
    };
  };
  back: {
    mode: "qr" | "static" | "copyFront";
    qr?: {
      xMm: number;
      yMm: number;
      sizeMm: number;
    };
    preview?: {
      qr?: {
        xMm?: number;
        yMm?: number;
        sizeMm?: number;
      };
    };
  };
  photo?: TemplatePhotoSlotConfig | null;
};

export type TemplatePaperStockDefinition = {
  name: string;
  description?: string;
  finish?: string;
  color?: string;
  weightGsm?: number;
};

export type TemplateDefinition = {
  id?: string;
  key: string;
  label: string;
  description?: string;
  pcmCode?: string | null;
  pdfPath: string;
  previewFrontPath: string;
  previewBackPath: string;
  config: TemplateConfig;
  assets?: TemplateAssetSummary[];
  design?: TemplateDesign;
  paperStock?: TemplatePaperStockDefinition | null;
  hasQrCode?: boolean;
  hasPhotoSlot?: boolean;
};

export type TemplateAssetSummary = {
  type: string;
  storageKey: string;
  publicUrl: string | null;
  version: number;
  updatedAt: string;
  expiresAt?: string;
};

const BASE_TEXT_FRAME = {
  xMm: 24.4,
  topMm: 24,
  columnWidthMm: 85,
  name: { font: "bold", sizePt: 10, lineGapMm: 4 } satisfies TemplateTextStyle,
  role: { font: "lightItalic", sizePt: 8, lineGapMm: 4, spacingAfterMm: 3.25 } satisfies TemplateTextStyle,
  contacts: { font: "light", sizePt: 8, lineGapMm: 3.5, spacingAfterMm: 1.9 } satisfies TemplateTextStyle,
  company: { font: "light", sizePt: 8, lineGapMm: 3.5 } satisfies TemplateTextStyle,
};

const DEFAULT_PREVIEW = {
  fontScale: 0.58,
  maxWidthPx: 960,
  baselineOffsetMm: -2.8,
  lineHeightScale: 0.82,
};

export const DEFAULT_TEMPLATES: Record<string, TemplateDefinition> = {
  qrcode: {
    key: "qrcode",
    label: "QR Code",
    pdfPath: "templates/omicron.pdf",
    previewFrontPath: "/templates/omicron-front.png",
    previewBackPath: "/templates/omicron-back.png",
    hasQrCode: true,
    config: {
      front: {
        textFrame: BASE_TEXT_FRAME,
        preview: DEFAULT_PREVIEW,
      },
      back: {
        mode: "qr",
        qr: { xMm: 52.8, yMm: 18.85, sizeMm: 32 },
        preview: {
          qr: { xMm: 42.9, yMm: 13.9, sizeMm: 31.6 },
        },
      },
    },
    assets: [],
    design: DEFAULT_TEMPLATE_DESIGN,
  },
  claim: {
    key: "claim",
    label: "Claim",
    pdfPath: "templates/omicron.pdf",
    previewFrontPath: "/templates/omicron-front.png",
    previewBackPath: "/templates/claim-back.png",
    hasQrCode: false,
    config: {
      front: {
        textFrame: BASE_TEXT_FRAME,
        preview: DEFAULT_PREVIEW,
      },
      back: {
        mode: "static",
      },
    },
    assets: [],
    design: DEFAULT_TEMPLATE_DESIGN,
  },
  "omicron-lab": {
    key: "omicron-lab",
    label: "Omicron Lab",
    pdfPath: "templates/omicron.pdf",
    previewFrontPath: "/templates/omicron-lab-front.png",
    previewBackPath: "/templates/omicron-back.png",
    hasQrCode: true,
    config: {
      front: {
        textFrame: BASE_TEXT_FRAME,
        preview: DEFAULT_PREVIEW,
      },
      back: {
        mode: "qr",
        qr: { xMm: 52.8, yMm: 18.85, sizeMm: 32 },
        preview: {
          qr: { xMm: 42.9, yMm: 13.9, sizeMm: 31.6 },
        },
      },
    },
    assets: [],
    design: DEFAULT_TEMPLATE_DESIGN,
  },
};

export const DEFAULT_TEMPLATE_LIST = Object.values(DEFAULT_TEMPLATES);
