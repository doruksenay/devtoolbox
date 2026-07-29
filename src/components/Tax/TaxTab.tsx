import { useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import { calculateCanadianTax, PROVINCES, TAX_YEAR, type BracketDetail } from '../../utils/taxCanada'

const PRESETS = [40000, 60000, 80000, 100000, 150000, 250000]

function fmtCurrency(n: number): string {
  return n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 })
}

function fmtCurrency2(n: number): string {
  return n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(2)}%`
}

function fmtRange(d: BracketDetail): string {
  const from = fmtCurrency(d.from)
  if (d.to === Infinity) return `${from}+`
  return `${from} – ${fmtCurrency(d.to)}`
}

export function TaxTab() {
  const { state, dispatch } = useApp()

  const income = useMemo(() => {
    const n = parseFloat(state.taxIncome.replace(/[,\s$]/g, ''))
    return Number.isFinite(n) ? n : 0
  }, [state.taxIncome])

  const result = useMemo(
    () => calculateCanadianTax(income, state.taxProvince),
    [income, state.taxProvince]
  )

  const hasInput = state.taxIncome.trim().length > 0 && income > 0

  return (
    <div className="cron-tab tax-tab">
      {/* Inputs */}
      <div className="cron-tab__section">
        <div className="cron-tab__section-title">Annual Income &amp; Province ({TAX_YEAR} tax year)</div>
        <div className="tax-inputs">
          <div className="tax-field">
            <label className="tax-field__label" htmlFor="tax-income">Annual taxable income (CAD)</label>
            <input
              id="tax-income"
              className="tax-field__input"
              inputMode="decimal"
              value={state.taxIncome}
              onChange={e => dispatch({ type: 'SET_TAX_INCOME', income: e.target.value })}
              placeholder="e.g. 75000"
              spellCheck={false}
            />
          </div>
          <div className="tax-field">
            <label className="tax-field__label" htmlFor="tax-province">Province / Territory</label>
            <select
              id="tax-province"
              className="tax-field__input"
              value={state.taxProvince}
              onChange={e => dispatch({ type: 'SET_TAX_PROVINCE', province: e.target.value })}
            >
              {PROVINCES.map(p => (
                <option key={p.code} value={p.code}>{p.name}</option>
              ))}
            </select>
          </div>
          <button
            className="btn btn-danger tax-clear-btn"
            onClick={() => dispatch({ type: 'CLEAR_TAX' })}
            disabled={state.taxIncome.trim().length === 0}
          >
            Clear
          </button>
        </div>
        <div className="tax-presets">
          {PRESETS.map(p => (
            <button
              key={p}
              className={`cron-preset-btn${income === p ? ' cron-preset-btn--active' : ''}`}
              onClick={() => dispatch({ type: 'SET_TAX_INCOME', income: String(p) })}
            >
              <span className="cron-preset-btn__label">{fmtCurrency(p)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="cron-tab__section">
        <div className="cron-tab__section-title">Estimated Tax Summary</div>
        {!hasInput ? (
          <div className="cron-runs-empty">Enter an income above to estimate your {result.provinceName} taxes.</div>
        ) : (
          <>
            <div className="tax-cards">
              <div className="tax-card">
                <span className="tax-card__label">Federal tax</span>
                <span className="tax-card__value">{fmtCurrency2(result.federalTax)}</span>
              </div>
              <div className="tax-card">
                <span className="tax-card__label">{result.provinceName} tax</span>
                <span className="tax-card__value">{fmtCurrency2(result.provincialTax)}</span>
              </div>
              <div className="tax-card tax-card--total">
                <span className="tax-card__label">Total tax</span>
                <span className="tax-card__value">{fmtCurrency2(result.totalTax)}</span>
              </div>
              <div className="tax-card tax-card--net">
                <span className="tax-card__label">After-tax income</span>
                <span className="tax-card__value">{fmtCurrency2(result.afterTaxIncome)}</span>
              </div>
            </div>
            <div className="tax-rates">
              <div className="tax-rates__item">
                <span className="tax-rates__label">Average tax rate</span>
                <span className="tax-rates__value">{fmtPct(result.averageRate)}</span>
              </div>
              <div className="tax-rates__item">
                <span className="tax-rates__label">Marginal tax rate</span>
                <span className="tax-rates__value">{fmtPct(result.marginalRate)}</span>
              </div>
              <div className="tax-rates__item">
                <span className="tax-rates__label">Monthly after-tax</span>
                <span className="tax-rates__value">{fmtCurrency2(result.afterTaxIncome / 12)}</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Breakdown */}
      {hasInput && (
        <div className="cron-tab__section">
          <div className="cron-tab__section-title">Bracket Breakdown</div>
          <div className="tax-breakdown">
            <div className="tax-breakdown__col">
              <div className="tax-breakdown__heading">Federal</div>
              <BreakdownTable details={result.federalBreakdown} />
            </div>
            <div className="tax-breakdown__col">
              <div className="tax-breakdown__heading">{result.provinceName}</div>
              <BreakdownTable details={result.provincialBreakdown} />
            </div>
          </div>
        </div>
      )}

      <p className="tax-disclaimer">
        Estimates for the {TAX_YEAR} tax year using published marginal brackets and the Basic Personal Amount.
        Excludes surtaxes, CPP/EI, and other credits. For informational purposes only — not tax advice.
      </p>
    </div>
  )
}

function BreakdownTable({ details }: { details: BracketDetail[] }) {
  if (details.length === 0) {
    return <div className="cron-runs-empty">No tax in this jurisdiction.</div>
  }
  return (
    <table className="url-params-table tax-breakdown__table">
      <thead>
        <tr>
          <th>Bracket</th>
          <th>Rate</th>
          <th>Taxable</th>
          <th>Tax</th>
        </tr>
      </thead>
      <tbody>
        {details.map((d, i) => (
          <tr key={i}>
            <td className="url-params-table__key">{fmtRange(d)}</td>
            <td className="url-params-table__val">{fmtPct(d.rate)}</td>
            <td className="url-params-table__val">{fmtCurrency2(d.taxableInBracket)}</td>
            <td className="url-params-table__val">{fmtCurrency2(d.tax)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
