// ─────────────────────────────────────────────
//  Canadian sales tax calculator (GST / HST / PST / QST)
//
//  Given an amount, computes the sales tax payable in each province and
//  territory. Supports calculating forward (amount is before tax) or
//  reverse (amount already includes tax). Rates as published for 2024.
// ─────────────────────────────────────────────

export const SALES_TAX_YEAR = 2024

export type ProvincialTaxKind = 'PST' | 'QST' | 'RST' | 'HST' | 'NONE'

export interface SalesTaxRegion {
  code: string
  name: string
  /** Federal GST rate (0 when the region uses HST, which already includes the federal part). */
  gst: number
  /** Harmonized sales tax rate (0 when the region uses GST + a provincial tax). */
  hst: number
  /** Provincial tax rate (PST / QST / RST), 0 when none applies. */
  pst: number
  /** Label used for the provincial component. */
  pstKind: ProvincialTaxKind
}

export interface SalesTaxResult {
  region: SalesTaxRegion
  /** Amount before tax. */
  subtotal: number
  gstAmount: number
  hstAmount: number
  pstAmount: number
  totalTax: number
  total: number
  /** Combined tax rate applied to the subtotal. */
  combinedRate: number
}

export const SALES_TAX_REGIONS: SalesTaxRegion[] = [
  { code: 'AB', name: 'Alberta', gst: 0.05, hst: 0, pst: 0, pstKind: 'NONE' },
  { code: 'BC', name: 'British Columbia', gst: 0.05, hst: 0, pst: 0.07, pstKind: 'PST' },
  { code: 'MB', name: 'Manitoba', gst: 0.05, hst: 0, pst: 0.07, pstKind: 'RST' },
  { code: 'NB', name: 'New Brunswick', gst: 0, hst: 0.15, pst: 0, pstKind: 'HST' },
  { code: 'NL', name: 'Newfoundland and Labrador', gst: 0, hst: 0.15, pst: 0, pstKind: 'HST' },
  { code: 'NT', name: 'Northwest Territories', gst: 0.05, hst: 0, pst: 0, pstKind: 'NONE' },
  { code: 'NS', name: 'Nova Scotia', gst: 0, hst: 0.15, pst: 0, pstKind: 'HST' },
  { code: 'NU', name: 'Nunavut', gst: 0.05, hst: 0, pst: 0, pstKind: 'NONE' },
  { code: 'ON', name: 'Ontario', gst: 0, hst: 0.13, pst: 0, pstKind: 'HST' },
  { code: 'PE', name: 'Prince Edward Island', gst: 0, hst: 0.15, pst: 0, pstKind: 'HST' },
  { code: 'QC', name: 'Quebec', gst: 0.05, hst: 0, pst: 0.09975, pstKind: 'QST' },
  { code: 'SK', name: 'Saskatchewan', gst: 0.05, hst: 0, pst: 0.06, pstKind: 'PST' },
  { code: 'YT', name: 'Yukon', gst: 0.05, hst: 0, pst: 0, pstKind: 'NONE' },
]

export function getRegion(code: string): SalesTaxRegion | undefined {
  return SALES_TAX_REGIONS.find(r => r.code === code)
}

/** Combined rate applied on top of the pre-tax amount. */
export function combinedRate(region: SalesTaxRegion): number {
  return region.gst + region.hst + region.pst
}

/**
 * Compute the sales tax for one region.
 *
 * @param amount    The monetary amount entered by the user.
 * @param region    Region whose rates should be applied.
 * @param included  When true the amount already includes tax and the
 *                  pre-tax subtotal is derived from it.
 */
export function calculateSalesTax(
  amount: number,
  region: SalesTaxRegion,
  included = false,
): SalesTaxResult {
  const safeAmount = Number.isFinite(amount) && amount > 0 ? amount : 0
  const rate = combinedRate(region)
  const subtotal = included ? safeAmount / (1 + rate) : safeAmount

  const gstAmount = subtotal * region.gst
  const hstAmount = subtotal * region.hst
  const pstAmount = subtotal * region.pst
  const totalTax = gstAmount + hstAmount + pstAmount

  return {
    region,
    subtotal,
    gstAmount,
    hstAmount,
    pstAmount,
    totalTax,
    total: subtotal + totalTax,
    combinedRate: rate,
  }
}

/** Compute the sales tax for every province and territory. */
export function calculateAllRegions(amount: number, included = false): SalesTaxResult[] {
  return SALES_TAX_REGIONS.map(r => calculateSalesTax(amount, r, included))
}
