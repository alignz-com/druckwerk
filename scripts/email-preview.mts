import { writeFileSync } from "node:fs";

const mod = await import("../lib/order-confirmation-email.ts");
const buildOrderConfirmation: typeof import("../lib/order-confirmation-email.ts").buildOrderConfirmation =
  (mod as any).buildOrderConfirmation ?? (mod as any).default?.buildOrderConfirmation;

const common = {
  userName: "Pascal Rossi",
  brandLabel: "DTH",
  deliveryDate: new Date("2026-05-01"),
  addressSummary: null,
  orderUrl: "https://druckwerk-stage.dth.at/orders?detail=demo",
  company: {
    name: "Thurnher Druckerei GmbH",
    street: "Beispielstraße 12",
    postalCode: "6830",
    city: "Rankweil",
    logoUrl: null,
    logoDarkUrl: null,
  },
} as const;

const bcDe = buildOrderConfirmation({
  ...common,
  locale: "de",
  referenceCode: "2026-00042",
  quantity: 250,
  customerReference: "PR-2026-04",
  order: { kind: "bc", cardHolderName: "Maria Muster", templateLabel: "Visitenkarte Klassik", mockupPngBuffer: null },
});

const pdfDe = buildOrderConfirmation({
  ...common,
  locale: "de",
  referenceCode: "2026-00043",
  quantity: null,
  customerReference: null,
  order: {
    kind: "upload",
    items: [
      { filename: "flyer-frontback.pdf", quantity: 500, pages: 2, productName: "Flyer", formatLabel: "A5", thumbnailPngBuffer: null },
      { filename: "brochure-final.pdf", quantity: 200, pages: 16, productName: "Broschüre", formatLabel: "A4", thumbnailPngBuffer: null },
      { filename: "poster.pdf", quantity: 50, pages: 1, productName: "Plakat", formatLabel: "A2", thumbnailPngBuffer: null },
    ],
  },
});

const bcEn = buildOrderConfirmation({ ...common, locale: "en", referenceCode: "2026-00044", quantity: 100, customerReference: null,
  order: { kind: "bc", cardHolderName: "John Doe", templateLabel: "Classic Business Card", mockupPngBuffer: null } });

// Both-logo variant: lets you inspect the CSS swap
const bcWithLogos = buildOrderConfirmation({
  ...common,
  company: { ...common.company, logoUrl: "https://placehold.co/200x60/ffffff/111827?text=Light+Logo", logoDarkUrl: "https://placehold.co/200x60/111827/ffffff?text=Dark+Logo" },
  locale: "en",
  referenceCode: "2026-00045",
  quantity: 50,
  customerReference: null,
  order: { kind: "bc", cardHolderName: "Jane Example", templateLabel: "Classic", mockupPngBuffer: null },
});
writeFileSync("/tmp/email-bc-dualLogo.html", bcWithLogos.html);

writeFileSync("/tmp/email-bc-de.html", bcDe.html);
writeFileSync("/tmp/email-pdf-de.html", pdfDe.html);
writeFileSync("/tmp/email-bc-en.html", bcEn.html);
console.log("BC DE subject:", bcDe.subject);
console.log("PDF DE subject:", pdfDe.subject);
console.log("BC EN subject:", bcEn.subject);
console.log("\nWrote /tmp/email-bc-de.html, /tmp/email-pdf-de.html, /tmp/email-bc-en.html");
console.log("\n--- BC DE TEXT ---\n" + bcDe.text);
console.log("\n--- PDF DE TEXT ---\n" + pdfDe.text);
