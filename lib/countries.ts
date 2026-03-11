export const COUNTRY_CODES = [
  "AF","AX","AL","DZ","AS","AD","AO","AI","AQ","AG","AR","AM","AW","AU","AT","AZ",
  "BS","BH","BD","BB","BY","BE","BZ","BJ","BM","BT","BO","BQ","BA","BW","BV","BR","IO","BN","BG","BF","BI",
  "CV","KH","CM","CA","KY","CF","TD","CL","CN","CX","CC","CO","KM","CG","CD","CK","CR","CI","HR","CU","CW",
  "CY","CZ","DK","DJ","DM","DO","EC","EG","SV","GQ","ER","EE","SZ","ET","FK","FO","FJ","FI","FR","GF","PF",
  "TF","GA","GM","GE","DE","GH","GI","GR","GL","GD","GP","GU","GT","GG","GN","GW","GY","HT","HM","VA","HN",
  "HK","HU","IS","IN","ID","IR","IQ","IE","IM","IL","IT","JM","JP","JE","JO","KZ","KE","KI","KP","KR","KW",
  "KG","LA","LV","LB","LS","LR","LY","LI","LT","LU","MO","MG","MW","MY","MV","ML","MT","MH","MQ","MR","MU",
  "YT","MX","FM","MD","MC","MN","ME","MS","MA","MZ","MM","NA","NR","NP","NL","NC","NZ","NI","NE","NG","NU",
  "NF","MK","MP","NO","OM","PK","PW","PS","PA","PG","PY","PE","PH","PN","PL","PT","PR","QA","RE","RO","RU",
  "RW","BL","SH","KN","LC","MF","PM","VC","WS","SM","ST","SA","SN","RS","SC","SL","SG","SX","SK","SI","SB",
  "SO","ZA","GS","SS","ES","LK","SD","SR","SJ","SE","CH","SY","TW","TJ","TZ","TH","TL","TG","TK","TO","TT",
  "TN","TR","TM","TC","TV","UG","UA","AE","GB","US","UM","UY","UZ","VU","VE","VN","VG","VI","WF","EH","YE",
  "ZM","ZW"
] as const;

const hasDisplayNames = typeof Intl.DisplayNames !== "undefined";
const displayNamesCache = new Map<string, Intl.DisplayNames>();

function getDisplayNames(locale: string) {
  if (!hasDisplayNames) return null;
  const normalized = locale === "de" ? "de-DE" : "en-US";
  if (!displayNamesCache.has(normalized)) {
    displayNamesCache.set(normalized, new Intl.DisplayNames([normalized], { type: "region" }));
  }
  return displayNamesCache.get(normalized)!;
}

export function getCountryLabel(locale: "en" | "de", code: string) {
  const names = getDisplayNames(locale);
  return names ? names.of(code) ?? code : code;
}

export function findCountryCodeByName(name?: string | null) {
  if (!name) return undefined;
  const lowered = name.trim().toLowerCase();
  if (!lowered) return undefined;
  if (hasDisplayNames) {
    for (const code of COUNTRY_CODES) {
      const en = getCountryLabel("en", code)?.toLowerCase();
      const de = getCountryLabel("de", code)?.toLowerCase();
      if (en === lowered || de === lowered) {
        return code;
      }
    }
  }
  return undefined;
}
