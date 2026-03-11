export const DEFAULT_ORDER_QUANTITIES = [50, 100, 250, 500, 1000];

type BrandQuantityRules = {
  quantityMin?: number | null;
  quantityMax?: number | null;
  quantityStep?: number | null;
  quantityOptions?: number[] | null;
};

export function resolveAllowedQuantities(brand?: BrandQuantityRules | null) {
  const explicit = Array.isArray(brand?.quantityOptions)
    ? Array.from(new Set(brand!.quantityOptions.filter((value) => Number.isFinite(value) && value > 0)))
    : [];
  if (explicit.length > 0) {
    return explicit.sort((a, b) => a - b);
  }
  const min = brand?.quantityMin ?? null;
  const max = brand?.quantityMax ?? null;
  const step = brand?.quantityStep ?? 1;
  if (
    min !== null &&
    max !== null &&
    Number.isFinite(min) &&
    Number.isFinite(max) &&
    min > 0 &&
    max >= min &&
    step > 0
  ) {
    const values: number[] = [];
    for (let current = min; current <= max; current += step) {
      values.push(current);
    }
    if (values.length > 0) return values;
  }
  return DEFAULT_ORDER_QUANTITIES;
}
