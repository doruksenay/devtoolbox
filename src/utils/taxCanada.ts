// ─────────────────────────────────────────────
//  Canadian income tax calculator (2024 tax year)
//
//  Estimates federal + provincial/territorial income tax on employment
//  income using the published marginal brackets and the Basic Personal
//  Amount (BPA) non-refundable credit for each jurisdiction. Quebec's
//  16.5% federal tax abatement is applied. This is a simplified estimate
//  (no surtaxes, CPP/EI, or other credits) and not tax advice.
// ─────────────────────────────────────────────

export const TAX_YEAR = 2024

export interface TaxBracket {
  /** Upper bound of the bracket (inclusive of amounts up to this value); Infinity for the top bracket. */
  upTo: number
  rate: number
}

export interface Jurisdiction {
  code: string
  name: string
  /** Basic Personal Amount — income below this is effectively untaxed via a credit at the lowest rate. */
  bpa: number
  brackets: TaxBracket[]
}

export interface BracketDetail {
  rate: number
  from: number
  to: number
  taxableInBracket: number
  tax: number
}

export interface TaxResult {
  income: number
  provinceCode: string
  provinceName: string
  federalTax: number
  provincialTax: number
  totalTax: number
  afterTaxIncome: number
  /** total tax / income */
  averageRate: number
  /** combined federal + provincial marginal rate at this income */
  marginalRate: number
  federalBreakdown: BracketDetail[]
  provincialBreakdown: BracketDetail[]
}

// Quebec residents receive a 16.5% abatement of basic federal tax.
const QUEBEC_ABATEMENT = 0.165

export const FEDERAL: Jurisdiction = {
  code: 'FED',
  name: 'Federal',
  bpa: 15705,
  brackets: [
    { upTo: 55867, rate: 0.15 },
    { upTo: 111733, rate: 0.205 },
    { upTo: 173205, rate: 0.26 },
    { upTo: 246752, rate: 0.29 },
    { upTo: Infinity, rate: 0.33 },
  ],
}

export const PROVINCES: Jurisdiction[] = [
  {
    code: 'AB', name: 'Alberta', bpa: 21885,
    brackets: [
      { upTo: 148269, rate: 0.10 },
      { upTo: 177922, rate: 0.12 },
      { upTo: 237230, rate: 0.13 },
      { upTo: 355845, rate: 0.14 },
      { upTo: Infinity, rate: 0.15 },
    ],
  },
  {
    code: 'BC', name: 'British Columbia', bpa: 12580,
    brackets: [
      { upTo: 47937, rate: 0.0506 },
      { upTo: 95875, rate: 0.077 },
      { upTo: 110076, rate: 0.105 },
      { upTo: 133664, rate: 0.1229 },
      { upTo: 181232, rate: 0.147 },
      { upTo: 252752, rate: 0.168 },
      { upTo: Infinity, rate: 0.205 },
    ],
  },
  {
    code: 'MB', name: 'Manitoba', bpa: 15780,
    brackets: [
      { upTo: 47000, rate: 0.108 },
      { upTo: 100000, rate: 0.1275 },
      { upTo: Infinity, rate: 0.174 },
    ],
  },
  {
    code: 'NB', name: 'New Brunswick', bpa: 13044,
    brackets: [
      { upTo: 49958, rate: 0.094 },
      { upTo: 99916, rate: 0.14 },
      { upTo: 185064, rate: 0.16 },
      { upTo: Infinity, rate: 0.195 },
    ],
  },
  {
    code: 'NL', name: 'Newfoundland and Labrador', bpa: 10818,
    brackets: [
      { upTo: 43198, rate: 0.087 },
      { upTo: 86395, rate: 0.145 },
      { upTo: 154244, rate: 0.158 },
      { upTo: 215943, rate: 0.178 },
      { upTo: 275870, rate: 0.198 },
      { upTo: 551739, rate: 0.208 },
      { upTo: 1103478, rate: 0.213 },
      { upTo: Infinity, rate: 0.218 },
    ],
  },
  {
    code: 'NT', name: 'Northwest Territories', bpa: 16593,
    brackets: [
      { upTo: 50597, rate: 0.059 },
      { upTo: 101198, rate: 0.086 },
      { upTo: 164525, rate: 0.122 },
      { upTo: Infinity, rate: 0.1405 },
    ],
  },
  {
    code: 'NS', name: 'Nova Scotia', bpa: 8481,
    brackets: [
      { upTo: 29590, rate: 0.0879 },
      { upTo: 59180, rate: 0.1495 },
      { upTo: 93000, rate: 0.1667 },
      { upTo: 150000, rate: 0.175 },
      { upTo: Infinity, rate: 0.21 },
    ],
  },
  {
    code: 'NU', name: 'Nunavut', bpa: 18767,
    brackets: [
      { upTo: 53268, rate: 0.04 },
      { upTo: 106537, rate: 0.07 },
      { upTo: 173205, rate: 0.09 },
      { upTo: Infinity, rate: 0.115 },
    ],
  },
  {
    code: 'ON', name: 'Ontario', bpa: 12399,
    brackets: [
      { upTo: 51446, rate: 0.0505 },
      { upTo: 102894, rate: 0.0915 },
      { upTo: 150000, rate: 0.1116 },
      { upTo: 220000, rate: 0.1216 },
      { upTo: Infinity, rate: 0.1316 },
    ],
  },
  {
    code: 'PE', name: 'Prince Edward Island', bpa: 13500,
    brackets: [
      { upTo: 32656, rate: 0.0965 },
      { upTo: 64313, rate: 0.1363 },
      { upTo: 105000, rate: 0.1665 },
      { upTo: 140000, rate: 0.18 },
      { upTo: Infinity, rate: 0.1875 },
    ],
  },
  {
    code: 'QC', name: 'Quebec', bpa: 18056,
    brackets: [
      { upTo: 51780, rate: 0.14 },
      { upTo: 103545, rate: 0.19 },
      { upTo: 126000, rate: 0.24 },
      { upTo: Infinity, rate: 0.2575 },
    ],
  },
  {
    code: 'SK', name: 'Saskatchewan', bpa: 18491,
    brackets: [
      { upTo: 52057, rate: 0.105 },
      { upTo: 148734, rate: 0.125 },
      { upTo: Infinity, rate: 0.145 },
    ],
  },
  {
    code: 'YT', name: 'Yukon', bpa: 15705,
    brackets: [
      { upTo: 55867, rate: 0.064 },
      { upTo: 111733, rate: 0.09 },
      { upTo: 173205, rate: 0.109 },
      { upTo: 500000, rate: 0.128 },
      { upTo: Infinity, rate: 0.15 },
    ],
  },
]

export function getProvince(code: string): Jurisdiction | undefined {
  return PROVINCES.find(p => p.code === code)
}

/** Compute the progressive tax over a set of brackets, returning the total and per-bracket detail. */
export function computeBrackets(income: number, brackets: TaxBracket[]): { total: number; details: BracketDetail[] } {
  const details: BracketDetail[] = []
  let total = 0
  let lower = 0

  for (const bracket of brackets) {
    if (income <= lower) break
    const upper = Math.min(income, bracket.upTo)
    const taxableInBracket = upper - lower
    const tax = taxableInBracket * bracket.rate
    total += tax
    details.push({
      rate: bracket.rate,
      from: lower,
      to: bracket.upTo,
      taxableInBracket,
      tax,
    })
    lower = bracket.upTo
  }

  return { total, details }
}

/** Marginal rate: the rate of the bracket the income falls into. */
export function marginalRate(income: number, brackets: TaxBracket[]): number {
  for (const bracket of brackets) {
    if (income <= bracket.upTo) return bracket.rate
  }
  // Fallback (should not happen since last bracket is Infinity)
  return brackets.length ? brackets[brackets.length - 1].rate : 0
}

/** Non-refundable BPA credit, applied at the lowest bracket rate. */
function bpaCredit(jur: Jurisdiction): number {
  return jur.bpa * jur.brackets[0].rate
}

/**
 * Calculate estimated Canadian income tax for a given annual income and province/territory.
 * Negative or non-finite incomes are treated as 0.
 */
export function calculateCanadianTax(rawIncome: number, provinceCode: string): TaxResult {
  const income = Number.isFinite(rawIncome) && rawIncome > 0 ? rawIncome : 0
  const province = getProvince(provinceCode) ?? PROVINCES.find(p => p.code === 'ON')!
  const isQuebec = province.code === 'QC'

  // Federal
  const fed = computeBrackets(income, FEDERAL.brackets)
  let federalTax = Math.max(0, fed.total - bpaCredit(FEDERAL))
  let fedMarginal = marginalRate(income, FEDERAL.brackets)
  if (isQuebec) {
    federalTax *= 1 - QUEBEC_ABATEMENT
    fedMarginal *= 1 - QUEBEC_ABATEMENT
  }

  // Provincial / territorial
  const prov = computeBrackets(income, province.brackets)
  const provincialTax = Math.max(0, prov.total - bpaCredit(province))
  const provMarginal = marginalRate(income, province.brackets)

  const totalTax = federalTax + provincialTax
  const afterTaxIncome = income - totalTax

  return {
    income,
    provinceCode: province.code,
    provinceName: province.name,
    federalTax,
    provincialTax,
    totalTax,
    afterTaxIncome,
    averageRate: income > 0 ? totalTax / income : 0,
    marginalRate: income > 0 ? fedMarginal + provMarginal : 0,
    federalBreakdown: fed.details,
    provincialBreakdown: prov.details,
  }
}
