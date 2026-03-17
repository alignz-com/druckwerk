// ─── New model: match against ProductFormat (Format dimensions) ──────────────

export type ProductFormatForMatching = {
  id: string              // ProductFormat.id
  productId: string
  productName: string
  productNameEn: string | null
  productNameDe: string | null
  formatName: string      // from Format
  formatNameDe: string | null // from Format
  trimWidthMm: number     // from Format
  trimHeightMm: number    // from Format
  toleranceMm: number     // from Format
  defaultBleedMm: number  // from Format
  minPages: number | null // from ProductFormat
  maxPages: number | null // from ProductFormat
}

export function getFormatLabel(pf: ProductFormatForMatching, locale: string): string {
  if (locale === "de" && pf.formatNameDe) return pf.formatNameDe
  return pf.formatName
}

/**
 * Find the best matching ProductFormat for detected PDF dimensions + page count.
 * Returns single best match or null.
 */
export function matchProductFormat(
  trimWidthMm: number,
  trimHeightMm: number,
  pages: number,
  productFormats: ProductFormatForMatching[]
): ProductFormatForMatching | null {
  const matches = productFormats.filter((pf) => {
    const tol = pf.toleranceMm
    const fitsNormal =
      Math.abs(trimWidthMm - pf.trimWidthMm) <= tol &&
      Math.abs(trimHeightMm - pf.trimHeightMm) <= tol
    const fitsRotated =
      Math.abs(trimWidthMm - pf.trimHeightMm) <= tol &&
      Math.abs(trimHeightMm - pf.trimWidthMm) <= tol
    if (!fitsNormal && !fitsRotated) return false
    if (pf.minPages != null && pages < pf.minPages) return false
    if (pf.maxPages != null && pages > pf.maxPages) return false
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
 * Returns all ProductFormats whose Format dimensions match (portrait or landscape).
 * Does NOT filter by page count — used to populate the per-file product picker.
 * If only one result → caller can auto-select.
 */
export function getProductFormatsForSize(
  trimWidthMm: number,
  trimHeightMm: number,
  productFormats: ProductFormatForMatching[]
): ProductFormatForMatching[] {
  return productFormats.filter((pf) => {
    const tol = pf.toleranceMm
    const fitsNormal =
      Math.abs(trimWidthMm - pf.trimWidthMm) <= tol &&
      Math.abs(trimHeightMm - pf.trimHeightMm) <= tol
    const fitsRotated =
      Math.abs(trimWidthMm - pf.trimHeightMm) <= tol &&
      Math.abs(trimHeightMm - pf.trimWidthMm) <= tol
    return fitsNormal || fitsRotated
  })
}

export function getProductFormatLabel(pf: ProductFormatForMatching, locale: string): string {
  if (locale === "de" && pf.productNameDe) return pf.productNameDe
  if (pf.productNameEn) return pf.productNameEn
  return pf.productName
}

// ─── Legacy aliases (kept while old Product-based code is being removed) ─────

/** @deprecated Use ProductFormatForMatching */
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

/** @deprecated Use matchProductFormat */
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
  return (
    matches.sort((a, b) => {
      const aSpec = (a.minPages != null ? 1 : 0) + (a.maxPages != null ? 1 : 0)
      const bSpec = (b.minPages != null ? 1 : 0) + (b.maxPages != null ? 1 : 0)
      return bSpec - aSpec
    })[0] ?? null
  )
}

/** @deprecated Use getProductFormatsForSize */
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

/** @deprecated Use getProductFormatLabel */
export function getProductLabel(product: ProductForMatching, locale: string): string {
  if (locale === "de" && product.nameDe) return product.nameDe
  if (product.nameEn) return product.nameEn
  return product.name
}
