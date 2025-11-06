import { addBusinessDays } from "./date-utils";

export const DELIVERY_OPTIONS = {
  express: { businessDays: 5 },
  standard: { businessDays: 15 },
} as const;

export type DeliveryOption = keyof typeof DELIVERY_OPTIONS;

export function estimateDeliveryDate(option: DeliveryOption, start: Date = new Date()) {
  const cfg = DELIVERY_OPTIONS[option] ?? DELIVERY_OPTIONS.standard;
  return addBusinessDays(start, cfg.businessDays);
}

