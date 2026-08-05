import { useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import {
  calculateAllRegions,
  calculateSalesTax,
  getRegion,
  SALES_TAX_REGIONS,
  SALES_TAX_YEAR,
  type SalesTaxResult,
} from '../../utils/salesTaxCanada'

const PRESETS = [10, 50, 100, 500, 1000]

function fmtCurrency(n: number): string {
  return n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 })
}

function fmtCurrency2(n: number): string {
  return n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtPct(n: number): string {
  const pct = n * 100
  return `${Number.isInteger(pct) ? pct : pct.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')}%`
}

/** Human-readable description of the taxes that apply in a region. */
function taxLabel(r: SalesTaxResult): string {
  const parts: string[] = []
  if (r.region.hst > 0) parts.push(`HST ${fmtPct(r.region.hst)}`)
  if (r.region.gst > 0) parts.push(`GST ${fmtPct(r.region.gst)}`)
  if (r.region.pst > 0) parts.push(`${r.region.pstKind} ${fmtPct(r.region.pst)}`)
  return parts.length ? parts.join(' + ') : 'No sales tax'
}

export function TaxTab() {
  const { state, dispatch } = useApp()

  const amount = useMemo(() => {
    const n = parseFloat(state.taxAmount.replace(/[,\s$]/g, ''))
    return Number.isFinite(n) ? n : 0
  }, [state.taxAmount])

  const selected = useMemo(
    () => calculateSalesTax(amount, getRegion(state.taxProvince) ?? SALES_TAX_REGIONS[0], state.taxIncludesTax),
    [amount, state.taxProvince, state.taxIncludesTax]
  )

  const all = useMemo(
    () => calculateAllRegions(amount, state.taxIncludesTax),
    [amount, state.taxIncludesTax]
  )

  const hasInput = state.taxAmount.trim().length > 0 && amount > 0

  return (
    <div className="tax-tab">
      {/* Inputs */}
      <div className="cron-tab__section">
        <div className="cron-tab__section-title">Amount &amp; Region ({SALES_TAX_YEAR} rates)</div>
        <div className="tax-inputs">
          <div className="tax-field">
            <label className="tax-field__label" htmlFor="tax-amount">Amount (CAD)</label>
            <input
              id="tax-amount"
              className="tax-field__input"
              inputMode="decimal"
              value={state.taxAmount}
              onChange={e => dispatch({ type: 'SET_TAX_AMOUNT', amount: e.target.value })}
              placeholder="e.g. 100"
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
              {SALES_TAX_REGIONS.map(r => (
                <option key={r.code} value={r.code}>{r.name}</option>
              ))}
            </select>
          </div>
          <div className="tax-field">
            <span className="tax-field__label">Amount type</span>
            <label className="tax-toggle">
              <input
                type="checkbox"
                checked={state.taxIncludesTax}
                onChange={e => dispatch({ type: 'SET_TAX_INCLUDES_TAX', included: e.target.checked })}
              />
              <span>Amount already includes tax</span>
            </label>
          </div>
          <button
            className="btn btn-danger tax-clear-btn"
            onClick={() => dispatch({ type: 'CLEAR_TAX' })}
            disabled={state.taxAmount.trim().length === 0}
          >
            Clear
          </button>
        </div>
        <div className="tax-presets">
          {PRESETS.map(p => (
            <button
              key={p}
              className={`cron-preset-btn${amount === p ? ' cron-preset-btn--active' : ''}`}
              onClick={() => dispatch({ type: 'SET_TAX_AMOUNT', amount: String(p) })}
            >
              <span className="cron-preset-btn__label">{fmtCurrency(p)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Summary for the selected region */}
      <div className="cron-tab__section">
        <div className="cron-tab__section-title">{selected.region.name} — {taxLabel(selected)}</div>
        {!hasInput ? (
          <div className="cron-runs-empty">Enter an amount above to see the sales tax in each region.</div>
        ) : (
          <>
            <div className="tax-cards">
              <div className="tax-card">
                <span className="tax-card__label">Subtotal</span>
                <span className="tax-card__value">{fmtCurrency2(selected.subtotal)}</span>
              </div>
              {selected.region.hst > 0 && (
                <div className="tax-card">
                  <span className="tax-card__label">HST {fmtPct(selected.region.hst)}</span>
                  <span className="tax-card__value">{fmtCurrency2(selected.hstAmount)}</span>
                </div>
              )}
              {selected.region.gst > 0 && (
                <div className="tax-card">
                  <span className="tax-card__label">GST {fmtPct(selected.region.gst)}</span>
                  <span className="tax-card__value">{fmtCurrency2(selected.gstAmount)}</span>
                </div>
              )}
              {selected.region.pst > 0 && (
                <div className="tax-card">
                  <span className="tax-card__label">{selected.region.pstKind} {fmtPct(selected.region.pst)}</span>
                  <span className="tax-card__value">{fmtCurrency2(selected.pstAmount)}</span>
                </div>
              )}
              <div className="tax-card tax-card--total">
                <span className="tax-card__label">Total tax</span>
                <span className="tax-card__value">{fmtCurrency2(selected.totalTax)}</span>
              </div>
              <div className="tax-card tax-card--net">
                <span className="tax-card__label">Total price</span>
                <span className="tax-card__value">{fmtCurrency2(selected.total)}</span>
              </div>
            </div>
            <div className="tax-rates">
              <div className="tax-rates__item">
                <span className="tax-rates__label">Combined rate</span>
                <span className="tax-rates__value">{fmtPct(selected.combinedRate)}</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* All regions */}
      {hasInput && (
        <div className="cron-tab__section">
          <div className="cron-tab__section-title">All Provinces &amp; Territories</div>
          <table className="url-params-table tax-breakdown__table">
            <thead>
              <tr>
                <th>Region</th>
                <th>Taxes</th>
                <th>Subtotal</th>
                <th>Tax</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {all.map(r => (
                <tr key={r.region.code} className={r.region.code === selected.region.code ? 'tax-row--active' : undefined}>
                  <td className="url-params-table__key">{r.region.name}</td>
                  <td className="url-params-table__val">{taxLabel(r)}</td>
                  <td className="url-params-table__val">{fmtCurrency2(r.subtotal)}</td>
                  <td className="url-params-table__val">{fmtCurrency2(r.totalTax)}</td>
                  <td className="url-params-table__val">{fmtCurrency2(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="tax-disclaimer">
        GST / HST / PST / QST rates as published for {SALES_TAX_YEAR}. Some goods and services are
        zero-rated or exempt. For informational purposes only — not tax advice.
      </p>
    </div>
  )
}
