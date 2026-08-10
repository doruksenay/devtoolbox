import { useMemo } from 'react'
import { useApp } from '../../context/AppContext'

// ── Cron parser ──────────────────────────────────────────────────────────────

interface ParsedCron {
  minutes: number[]
  hours: number[]
  doms: number[]
  months: number[]
  dows: number[]
  domStar: boolean
  dowStar: boolean
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DOW_NAMES   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const DOW_FULL    = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

function parseField(
  field: string,
  min: number,
  max: number,
  names?: string[]
): number[] | null {
  const results = new Set<number>()

  const parts = field.split(',')
  for (const part of parts) {
    if (part === '*') {
      for (let i = min; i <= max; i++) results.add(i)
      continue
    }

    const stepMatch = part.match(/^(.+)\/(\d+)$/)
    if (stepMatch) {
      const [, range, stepStr] = stepMatch
      const step = parseInt(stepStr, 10)
      if (step < 1) return null
      let start = min
      let end = max
      if (range !== '*') {
        const dashMatch = range.match(/^(\d+)-(\d+)$/)
        if (dashMatch) {
          start = parseInt(dashMatch[1], 10)
          end   = parseInt(dashMatch[2], 10)
        } else {
          start = parseInt(range, 10)
          end   = max
        }
      }
      for (let i = start; i <= end; i += step) results.add(i)
      continue
    }

    const dashMatch = part.match(/^(.+)-(.+)$/)
    if (dashMatch) {
      const a = nameToNum(dashMatch[1], names) ?? parseInt(dashMatch[1], 10)
      const b = nameToNum(dashMatch[2], names) ?? parseInt(dashMatch[2], 10)
      if (isNaN(a) || isNaN(b)) return null
      for (let i = a; i <= b; i++) results.add(i)
      continue
    }

    const n = nameToNum(part, names) ?? parseInt(part, 10)
    if (isNaN(n) || n < min || n > max) return null
    results.add(n)
  }

  const arr = [...results].sort((a, b) => a - b)
  return arr.length ? arr : null
}

function nameToNum(s: string, names?: string[]): number | null {
  if (!names) return null
  const idx = names.findIndex(n => n.toLowerCase() === s.toLowerCase())
  return idx >= 0 ? idx : null
}

function parseCron(expr: string): { parsed: ParsedCron; error: null } | { parsed: null; error: string } {
  const parts = expr.trim().split(/\s+/)
  if (parts.length !== 5) return { parsed: null, error: 'Cron expression must have 5 fields: minute hour dom month dow' }

  const [minStr, hourStr, domStr, monStr, dowStr] = parts
  const minutes = parseField(minStr,  0, 59)
  const hours   = parseField(hourStr, 0, 23)
  const doms    = parseField(domStr,  1, 31)
  const months  = parseField(monStr,  1, 12, MONTH_NAMES)
  const dows    = parseField(dowStr,  0,  6, DOW_NAMES)

  if (!minutes) return { parsed: null, error: `Invalid minute field: "${minStr}"` }
  if (!hours)   return { parsed: null, error: `Invalid hour field: "${hourStr}"` }
  if (!doms)    return { parsed: null, error: `Invalid day-of-month field: "${domStr}"` }
  if (!months)  return { parsed: null, error: `Invalid month field: "${monStr}"` }
  if (!dows)    return { parsed: null, error: `Invalid day-of-week field: "${dowStr}"` }

  return {
    parsed: {
      minutes, hours, doms, months, dows,
      domStar: domStr === '*',
      dowStar: dowStr === '*',
    },
    error: null,
  }
}


function humanReadable(p: ParsedCron): string {
  const parts: string[] = []

  // Minutes
  if (p.minutes.length === 60) {
    parts.push('every minute')
  } else if (p.minutes.length === 1 && p.minutes[0] === 0) {
    parts.push('at minute 0')
  } else {
    parts.push(`at minute${p.minutes.length > 1 ? 's' : ''} ${p.minutes.join(', ')}`)
  }

  // Hours
  if (p.hours.length < 24) {
    const hStrs = p.hours.map(h => {
      const ampm = h < 12 ? 'am' : 'pm'
      const disp = h % 12 === 0 ? 12 : h % 12
      return `${disp}${ampm}`
    })
    parts.push(`of hour${p.hours.length > 1 ? 's' : ''} ${hStrs.join(', ')}`)
  }

  // DOM / DOW
  if (!p.domStar && !p.dowStar) {
    parts.push(`on day${p.doms.length > 1 ? 's' : ''} ${p.doms.join(', ')} of the month`)
    parts.push(`when weekday is ${p.dows.map(d => DOW_FULL[d]).join(', ')}`)
  } else if (!p.domStar) {
    parts.push(`on day${p.doms.length > 1 ? 's' : ''} ${p.doms.join(', ')} of the month`)
  } else if (!p.dowStar) {
    parts.push(`on ${p.dows.map(d => DOW_FULL[d]).join(', ')}`)
  }

  // Months
  if (p.months.length < 12) {
    const mNames = p.months.map(m => MONTH_NAMES[m - 1])
    parts.push(`in ${mNames.join(', ')}`)
  }

  return parts.join(', ')
}

function getNextRuns(parsed: ParsedCron, count = 10): Date[] {
  const results: Date[] = []
  const now = new Date()
  now.setSeconds(0, 0)
  now.setMinutes(now.getMinutes() + 1) // start from next minute

  const limit = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000) // 1 year max search
  const cur = new Date(now)

  while (results.length < count && cur < limit) {
    const month = cur.getMonth() + 1 // 1-based
    const dom   = cur.getDate()
    const dow   = cur.getDay()
    const hour  = cur.getHours()
    const min   = cur.getMinutes()

    if (!parsed.months.includes(month)) {
      cur.setMonth(cur.getMonth() + 1)
      cur.setDate(1)
      cur.setHours(0, 0, 0, 0)
      continue
    }

    // DOM/DOW matching: if both are specified, either condition can match
    const domMatch = parsed.domStar || parsed.doms.includes(dom)
    const dowMatch = parsed.dowStar || parsed.dows.includes(dow)
    const dayMatch = (!parsed.domStar && !parsed.dowStar)
      ? (domMatch || dowMatch)
      : (parsed.domStar ? dowMatch : domMatch)

    if (!dayMatch) {
      cur.setDate(cur.getDate() + 1)
      cur.setHours(0, 0, 0, 0)
      continue
    }

    if (!parsed.hours.includes(hour)) {
      const nextHour = parsed.hours.find(h => h > hour)
      if (nextHour === undefined) {
        cur.setDate(cur.getDate() + 1)
        cur.setHours(0, 0, 0, 0)
      } else {
        cur.setHours(nextHour, 0, 0, 0)
      }
      continue
    }

    const nextMin = parsed.minutes.find(m => m >= min)
    if (nextMin === undefined) {
      const nextHour = parsed.hours.find(h => h > hour)
      if (nextHour === undefined) {
        cur.setDate(cur.getDate() + 1)
        cur.setHours(0, 0, 0, 0)
      } else {
        cur.setHours(nextHour, 0, 0, 0)
      }
      continue
    }

    results.push(new Date(cur.getFullYear(), cur.getMonth(), cur.getDate(), hour, nextMin))

    // Advance to next minute after this one
    const minIdx = parsed.minutes.indexOf(nextMin)
    if (minIdx + 1 < parsed.minutes.length) {
      cur.setMinutes(parsed.minutes[minIdx + 1])
    } else {
      const nextHour = parsed.hours.find(h => h > hour)
      if (nextHour === undefined) {
        cur.setDate(cur.getDate() + 1)
        cur.setHours(0, 0, 0, 0)
      } else {
        cur.setHours(nextHour, parsed.minutes[0], 0, 0)
      }
    }
  }

  return results
}

function fmtDate(d: Date): string {
  return d.toLocaleString(undefined, {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ── Presets ──────────────────────────────────────────────────────────────────

const PRESETS: { label: string; expr: string }[] = [
  { label: 'Every minute',       expr: '* * * * *'    },
  { label: 'Every 5 minutes',    expr: '*/5 * * * *'  },
  { label: 'Every 15 minutes',   expr: '*/15 * * * *' },
  { label: 'Every 30 minutes',   expr: '*/30 * * * *' },
  { label: 'Every hour',         expr: '0 * * * *'    },
  { label: 'Every 6 hours',      expr: '0 */6 * * *'  },
  { label: 'Weekdays at 9am',    expr: '0 9 * * 1-5'  },
  { label: 'Every Monday 9am',   expr: '0 9 * * 1'    },
  { label: 'Sundays midnight',   expr: '0 0 * * 0'    },
  { label: '1st of month 00:00', expr: '0 0 1 * *'    },
]

// ── Field-by-field editor ────────────────────────────────────────────────────

interface FieldMeta {
  key: string
  label: string
  min: number
  max: number
  names?: string[]
}

const FIELDS: FieldMeta[] = [
  { key: 'minute',  label: 'Minute',      min: 0,  max: 59  },
  { key: 'hour',    label: 'Hour',        min: 0,  max: 23  },
  { key: 'dom',     label: 'Day (month)', min: 1,  max: 31  },
  { key: 'month',   label: 'Month',       min: 1,  max: 12, names: MONTH_NAMES },
  { key: 'dow',     label: 'Weekday',     min: 0,  max: 6,  names: DOW_NAMES   },
]

function splitExpr(expr: string): string[] {
  const parts = expr.trim().split(/\s+/)
  while (parts.length < 5) parts.push('*')
  return parts.slice(0, 5)
}

// ── Component ────────────────────────────────────────────────────────────────

export function CronTab() {
  const { state, dispatch } = useApp()
  const expr = state.cronExpression

  const { parsed, error } = useMemo(() => parseCron(expr), [expr])
  const nextRuns = useMemo(() => parsed ? getNextRuns(parsed, 10) : [], [parsed])
  const human    = useMemo(() => parsed ? humanReadable(parsed) : '', [parsed])

  const fields = splitExpr(expr)

  function setField(idx: number, val: string) {
    const newFields = [...fields]
    newFields[idx] = val || '*'
    dispatch({ type: 'SET_CRON_EXPRESSION', expression: newFields.join(' ') })
  }

  return (
    <div className="cron-tab">
      {/* Main expression input */}
      <div className="cron-tab__section cron-expr-section">
        <div className="cron-tab__section-title" id="cron-expr-label">Cron Expression</div>
        <div className="cron-expr-section__main">
          <input
            className={`cron-expr-input${error ? ' cron-expr-input--error' : ''}`}
            value={expr}
            onChange={e => dispatch({ type: 'SET_CRON_EXPRESSION', expression: e.target.value })}
            spellCheck={false}
            placeholder="* * * * *"
            aria-labelledby="cron-expr-label"
          />
          {error && <div className="cron-error">{error}</div>}
          {!error && human && <div className="cron-human">{human}</div>}
        </div>

        {/* Field labels */}
        <div className="cron-expr-section__field-labels">
          {FIELDS.map((f, i) => (
            <div className="cron-field" key={f.key}>
              <div className="cron-field__label" id={`cron-field-label-${f.key}`}>{f.label}</div>
              <input
                className="cron-field__editor"
                value={fields[i]}
                onChange={e => setField(i, e.target.value)}
                aria-labelledby={`cron-field-label-${f.key}`}
              />
              <div className="cron-field__hint">{f.min}–{f.max}{f.names ? ` or ${f.names.join(',')}` : ''}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Presets */}
      <div className="cron-tab__section">
        <div className="cron-tab__section-title">Presets</div>
        <div className="cron-presets">
          <div className="cron-presets__list">
            {PRESETS.map(p => (
              <button
                key={p.expr}
                className={`cron-preset-btn${expr === p.expr ? ' cron-preset-btn--active' : ''}`}
                onClick={() => dispatch({ type: 'SET_CRON_EXPRESSION', expression: p.expr })}
              >
                <span className="cron-preset-btn__label">{p.label}</span>
                <code className="cron-preset-btn__expr">{p.expr}</code>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Next runs */}
      <div className="cron-tab__section">
        <div className="cron-tab__section-title">Next 10 Scheduled Runs</div>
        {error && <div className="cron-runs-empty">Fix the expression above to see upcoming runs.</div>}
        {!error && nextRuns.length === 0 && (
          <div className="cron-runs-empty">No runs found in the next year.</div>
        )}
        {!error && nextRuns.length > 0 && (
          <ol className="cron-runs-list">
            {nextRuns.map((d, i) => (
              <li key={i} className="cron-runs-list__item">
                <span className="cron-runs-list__index">#{i + 1}</span>
                <span className="cron-runs-list__date">{fmtDate(d)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* Field reference */}
      <div className="cron-tab__section">
        <div className="cron-tab__section-title">Quick Reference</div>
        <table className="cron-ref-table">
          <thead><tr><th>Expression</th><th>Meaning</th></tr></thead>
          <tbody>
            <tr><td><code>*</code></td><td>Every value</td></tr>
            <tr><td><code>*/n</code></td><td>Every n-th value</td></tr>
            <tr><td><code>a-b</code></td><td>Range from a to b</td></tr>
            <tr><td><code>a,b,c</code></td><td>List of specific values</td></tr>
            <tr><td><code>a-b/n</code></td><td>Every n-th value in range a–b</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
