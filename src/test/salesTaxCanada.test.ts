import { describe, it, expect } from 'vitest'
import {
  calculateSalesTax,
  calculateAllRegions,
  combinedRate,
  getRegion,
  DEFAULT_TAX_REGION,
  SALES_TAX_REGIONS,
} from '../utils/salesTaxCanada'

const ON = getRegion('ON')!
const QC = getRegion('QC')!

describe('calculateSalesTax', () => {
  it('applies HST in Ontario', () => {
    const r = calculateSalesTax(100, ON)
    expect(r.hstAmount).toBeCloseTo(13, 6)
    expect(r.gstAmount).toBe(0)
    expect(r.pstAmount).toBe(0)
    expect(r.total).toBeCloseTo(113, 6)
  })

  it('applies GST + QST in Quebec', () => {
    const r = calculateSalesTax(100, QC)
    expect(r.gstAmount).toBeCloseTo(5, 6)
    expect(r.pstAmount).toBeCloseTo(9.975, 6)
    expect(r.total).toBeCloseTo(114.975, 6)
  })

  it('reverses tax when the amount already includes it', () => {
    const r = calculateSalesTax(113, ON, true)
    expect(r.subtotal).toBeCloseTo(100, 6)
    expect(r.totalTax).toBeCloseTo(13, 6)
    expect(r.total).toBeCloseTo(113, 6)
  })

  it('treats negative / non-finite amounts as zero', () => {
    expect(calculateSalesTax(-10, ON).total).toBe(0)
    expect(calculateSalesTax(NaN, ON).total).toBe(0)
  })

  it('subtotal plus tax always equals the total', () => {
    for (const region of SALES_TAX_REGIONS) {
      const r = calculateSalesTax(249.99, region)
      expect(r.subtotal + r.totalTax).toBeCloseTo(r.total, 6)
    }
  })
})

describe('region data', () => {
  it('never combines HST with GST or a provincial tax', () => {
    for (const r of SALES_TAX_REGIONS) {
      if (r.hst > 0) {
        expect(r.gst).toBe(0)
        expect(r.pst).toBe(0)
      }
    }
  })

  it('combinedRate sums all components', () => {
    expect(combinedRate(QC)).toBeCloseTo(0.14975, 6)
  })

  it('getRegion resolves known codes only', () => {
    expect(getRegion('ON')?.name).toBe('Ontario')
    expect(getRegion('BC')).toBeUndefined()
    expect(getRegion('zz')).toBeUndefined()
  })

  it('only supports Quebec and Ontario', () => {
    expect(SALES_TAX_REGIONS.map(r => r.code)).toEqual(['QC', 'ON'])
  })

  it('defaults to Quebec, which is also the first-listed fallback region', () => {
    expect(DEFAULT_TAX_REGION).toBe('QC')
    expect(SALES_TAX_REGIONS[0].code).toBe(DEFAULT_TAX_REGION)
  })

  it('calculateAllRegions covers every region', () => {
    expect(calculateAllRegions(100)).toHaveLength(SALES_TAX_REGIONS.length)
  })
})
