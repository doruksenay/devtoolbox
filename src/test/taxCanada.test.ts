import { describe, it, expect } from 'vitest'
import {
  calculateCanadianTax,
  computeBrackets,
  marginalRate,
  getProvince,
  PROVINCES,
  FEDERAL,
} from '../utils/taxCanada'

describe('computeBrackets', () => {
  it('returns zero for zero income', () => {
    const { total, details } = computeBrackets(0, FEDERAL.brackets)
    expect(total).toBe(0)
    expect(details).toHaveLength(0)
  })

  it('taxes only within the first bracket for low income', () => {
    const { total } = computeBrackets(10000, FEDERAL.brackets)
    expect(total).toBeCloseTo(1500, 5) // 10000 * 0.15
  })

  it('applies progressive rates across bracket boundaries', () => {
    // 55867 @ 15% + (60000-55867) @ 20.5%
    const { total } = computeBrackets(60000, FEDERAL.brackets)
    expect(total).toBeCloseTo(55867 * 0.15 + (60000 - 55867) * 0.205, 5)
  })
})

describe('marginalRate', () => {
  it('returns the rate of the bracket the income falls into', () => {
    expect(marginalRate(10000, FEDERAL.brackets)).toBe(0.15)
    expect(marginalRate(60000, FEDERAL.brackets)).toBe(0.205)
    expect(marginalRate(300000, FEDERAL.brackets)).toBe(0.33)
  })
})

describe('calculateCanadianTax', () => {
  it('returns zero tax for zero income', () => {
    const r = calculateCanadianTax(0, 'ON')
    expect(r.federalTax).toBe(0)
    expect(r.provincialTax).toBe(0)
    expect(r.totalTax).toBe(0)
    expect(r.afterTaxIncome).toBe(0)
    expect(r.averageRate).toBe(0)
    expect(r.marginalRate).toBe(0)
  })

  it('treats negative / non-finite income as zero', () => {
    expect(calculateCanadianTax(-5000, 'ON').totalTax).toBe(0)
    expect(calculateCanadianTax(NaN, 'ON').totalTax).toBe(0)
  })

  it('applies the basic personal amount so low incomes owe little/no tax', () => {
    // Income below both federal and Ontario BPA → no tax
    const r = calculateCanadianTax(10000, 'ON')
    expect(r.federalTax).toBe(0)
    expect(r.provincialTax).toBe(0)
  })

  it('computes Ontario tax at $60,000 (hand-calculated)', () => {
    const r = calculateCanadianTax(60000, 'ON')
    // Federal: 55867*0.15 + 4133*0.205 - 15705*0.15
    const expectedFed = 55867 * 0.15 + (60000 - 55867) * 0.205 - 15705 * 0.15
    // Ontario: 51446*0.0505 + 8554*0.0915 - 12399*0.0505
    const expectedProv = 51446 * 0.0505 + (60000 - 51446) * 0.0915 - 12399 * 0.0505
    expect(r.federalTax).toBeCloseTo(expectedFed, 4)
    expect(r.provincialTax).toBeCloseTo(expectedProv, 4)
    expect(r.totalTax).toBeCloseTo(expectedFed + expectedProv, 4)
    expect(r.marginalRate).toBeCloseTo(0.205 + 0.0915, 6)
    expect(r.averageRate).toBeCloseTo((expectedFed + expectedProv) / 60000, 6)
  })

  it('applies the Quebec federal abatement (16.5%)', () => {
    const on = calculateCanadianTax(80000, 'ON')
    const qc = calculateCanadianTax(80000, 'QC')
    // Quebec federal tax equals the un-abated federal tax * (1 - 0.165)
    const expectedQcFed = on.federalTax * (1 - 0.165)
    expect(qc.federalTax).toBeCloseTo(expectedQcFed, 4)
  })

  it('falls back to Ontario for an unknown province code', () => {
    const unknown = calculateCanadianTax(60000, 'ZZ')
    const on = calculateCanadianTax(60000, 'ON')
    expect(unknown.provinceCode).toBe('ON')
    expect(unknown.totalTax).toBeCloseTo(on.totalTax, 6)
  })

  it('after-tax income plus total tax equals gross income', () => {
    const r = calculateCanadianTax(123456, 'BC')
    expect(r.afterTaxIncome + r.totalTax).toBeCloseTo(123456, 4)
  })
})

describe('province data integrity', () => {
  it('every province has a top bracket that extends to Infinity', () => {
    for (const p of PROVINCES) {
      expect(p.brackets[p.brackets.length - 1].upTo).toBe(Infinity)
    }
  })

  it('getProvince resolves known codes', () => {
    expect(getProvince('QC')?.name).toBe('Quebec')
    expect(getProvince('zz')).toBeUndefined()
  })
})
