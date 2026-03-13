export type ProductForMatching = {
  id: string
  name: string
  nameEn: string | null
  nameDe: string | null
  trimWidthMm: number
  trimHeightMm: number
  toleranceMm: number
  minPages: number | null
  maxPages: number | null
}

/**
 * Find the best matching product for a given PDF file.
 * Matches by dimensions (both portrait and landscape orientation) within tolerance,
 * then by page count constraints. More specific matches (with page constraints) win.
 */
export function matchProduct(
  trimWidthMm: number,
  trimHeightMm: number,
  pages: number,
  products: ProductForMatching[]
): ProductForMatching | null {
  const matches = products.filter((p) => {
    const tol = p.toleranceMm
    const fitsNormal =
      Math.abs(trimWidthMm - p.trimWidthMm) <= tol &&
      Math.abs(trimHeightMm - p.trimHeightMm) <= tol
    const fitsRotated =
      Math.abs(trimWidthMm - p.trimHeightMm) <= tol &&
      Math.abs(trimHeightMm - p.trimWidthMm) <= tol
    if (!fitsNormal && !fitsRotated) return false
    if (p.minPages != null && pages < p.minPages) return false
    if (p.maxPages != null && pages > p.maxPages) return false
    return true
  })

  // Prefer most specific match (most page constraints set)
  return (
    matches.sort((a, b) => {
      const aSpec = (a.minPages != null ? 1 : 0) + (a.maxPages != null ? 1 : 0)
      const bSpec = (b.minPages != null ? 1 : 0) + (b.maxPages != null ? 1 : 0)
      return bSpec - aSpec
    })[0] ?? null
  )
}

/**
 * Returns all products whose dimensions match (portrait or landscape, within tolerance).
 * Does NOT filter by page count — used to populate the per-file dropdown.
 */
export function getProductsForSize(
  trimWidthMm: number,
  trimHeightMm: number,
  products: ProductForMatching[]
): ProductForMatching[] {
  return products.filter((p) => {
    const tol = p.toleranceMm
    const fitsNormal =
      Math.abs(trimWidthMm - p.trimWidthMm) <= tol &&
      Math.abs(trimHeightMm - p.trimHeightMm) <= tol
    const fitsRotated =
      Math.abs(trimWidthMm - p.trimHeightMm) <= tol &&
      Math.abs(trimHeightMm - p.trimWidthMm) <= tol
    return fitsNormal || fitsRotated
  })
}

export function getProductLabel(product: ProductForMatching, locale: string): string {
  if (locale === "de" && product.nameDe) return product.nameDe
  if (product.nameEn) return product.nameEn
  return product.name
}
