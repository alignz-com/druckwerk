export const DEFAULT_TIME_ZONE = "Europe/Vienna";

export function formatDateTime(
  value: Date | string | number,
  locale?: string | string[],
  options?: Intl.DateTimeFormatOptions,
) {
  const date = typeof value === "string" || typeof value === "number" ? new Date(value) : value;
  const hasCustomFormat = options ? Object.keys(options).some((key) => key !== "timeZone") : false;
  const baseOptions: Intl.DateTimeFormatOptions = hasCustomFormat
    ? { timeZone: DEFAULT_TIME_ZONE }
    : { dateStyle: "medium", timeStyle: "short", timeZone: DEFAULT_TIME_ZONE };
  const formatter = new Intl.DateTimeFormat(locale ?? undefined, {
    ...baseOptions,
    ...options,
  });
  return formatter.format(date);
}
