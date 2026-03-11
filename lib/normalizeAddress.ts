// /lib/normalizeAddress.ts
const ORG_HINTS = [
  "gmbh", "gmbh & co. kg", "ag", "inc", "llc", "ltd", "sàrl", "sarl", "bv",
  "nv", "oy", "ab", "as", "spa", "sas", "kg", "kgaa", "oyj", "plc"
];

const COUNTRY_HINTS = [
  "austria", "österreich", "germany", "deutschland", "switzerland", "schweiz",
  "suisse", "svizzera", "liechtenstein", "italy", "france", "spain", "netherlands",
  "belgium", "luxembourg", "czech republic", "slovakia", "poland", "uk", "united kingdom"
];

function looksLikeOrg(s: string) {
  const t = s.trim().toLowerCase();
  return ORG_HINTS.some(h => t.includes(h));
}
function looksLikeCountry(s: string) {
  const t = s.trim().toLowerCase();
  return COUNTRY_HINTS.some(h => t === h || t.endsWith(h));
}
function isPostalCity(s: string) {
  // 4–5-stellige PLZ + Stadt (recht tolerant)
  return /\b\d{4,5}\b/.test(s);
}

export type NormalizedAddress = {
  org?: string;
  street?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  /** Adresszeilen ohne org (für Anzeige unter den Kontaktdaten) */
  lines: string[];
  /** Mehrzeiliges Label für vCard (ORG getrennt, nur die eigentliche Adresse) */
  label: string;
};

/** Nimmt Eingaben wie
 *  "OMICRON electronics GmbH\nOberes Ried 1 | 6833 Klaus | Austria"
 *   oder einzeilig "OMICRON electronics GmbH | Oberes Ried 1 | 6833 Klaus | Austria"
 *   oder bereits sauber mehrzeilig und normalisiert sie.
 */
export function normalizeAddress(raw?: string): NormalizedAddress {
  const input = (raw ?? "").replace(/\r\n/g, "\n").trim();

  // In Blöcke aufspalten: erst Zeilen, dann innerhalb von Zeilen per "|"
  const chunks = input
    .split("\n")
    .flatMap(line => line.split("|"))
    .map(s => s.trim())
    .filter(Boolean);

  if (chunks.length === 0) {
    return { lines: [], label: "" };
  }

  // Heuristik: Wenn erstes Chunk eine Org ist (oder großgeschrieben/enthält Rechtsform), als ORG nehmen
  let org: string | undefined;
  const first = chunks[0];
  if (looksLikeOrg(first) || /[A-Z].*[A-Z]/.test(first)) {
    // z.B. "OMICRON electronics GmbH" – Groß/Kleinschreibung tolerieren
    org = first;
  }

  // Restliche Teile als Adressbestandteile
  const rest = org ? chunks.slice(1) : chunks.slice(0);

  // Versuche "street", "postal/city", "country" zu erkennen
  let street: string | undefined;
  let postalCode: string | undefined;
  let city: string | undefined;
  let country: string | undefined;

  for (const part of rest) {
    if (!street && /\d/.test(part)) {
      // Enthält Hausnummer → häufig die Straße
      street = part;
      continue;
    }
    if (!postalCode && isPostalCity(part)) {
      // Teile bei erster Zifferngruppe
      const m = part.match(/(\d{4,5})\s+(.+)/);
      if (m) {
        postalCode = m[1];
        city = m[2].trim();
        continue;
      }
    }
    if (!country && looksLikeCountry(part)) {
      country = part;
      continue;
    }
  }

  // Fallbacks: wenn etwas übrig blieb oder Patterns nicht gegriffen haben,
  // nimm einfach die restlichen Chunks als display lines in Originalreihenfolge
  const displayLines: string[] = [];
  if (street) displayLines.push(street);
  if (postalCode || city) displayLines.push([postalCode, city].filter(Boolean).join(" "));
  if (country) displayLines.push(country);

  // Wenn obige Heuristik nichts ergeben hat, nimm die restlichen Teile "as is"
  if (displayLines.length === 0) {
    displayLines.push(...rest);
  } else {
    // Mögliche übrig gebliebene Teile, die nicht als street/pc+city/country erkannt wurden
    const leftovers = rest.filter(p =>
      p !== street &&
      p !== country &&
      ![`${postalCode ?? ""} ${city ?? ""}`.trim(), `${postalCode ?? ""}${city ? ` ${city}` : ""}`.trim()].includes(p)
    );
    displayLines.unshift(...leftovers);
  }

  // vCard-Label: nur die Adresszeilen (ohne ORG), mehrzeilig
  const label = displayLines.join("\n");

  return {
    org,
    street,
    postalCode,
    city,
    country,
    lines: displayLines,
    label,
  };
}
