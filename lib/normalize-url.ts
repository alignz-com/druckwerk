export function normalizeWebUrl(value?: string | null) {
  if (!value) return "";
  let trimmed = value.trim();
  if (!trimmed) return "";

  if (trimmed.startsWith("//")) {
    trimmed = `https:${trimmed}`;
  } else if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }

  return trimmed;
}
