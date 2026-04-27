import { useState, useMemo, useRef } from 'react'
import { useApp } from '../../context/AppContext'
import { useToast } from '../Toast/ToastProvider'

// ── Domain types ─────────────────────────────────────────────────────────────

interface WsdlMessagePart {
  name: string
  type?: string
  element?: string
}

interface WsdlMessage {
  name: string
  parts: WsdlMessagePart[]
}

interface WsdlOperation {
  name: string
  documentation?: string
  soapAction?: string
  style?: string
  inputMessage?: string
  outputMessage?: string
  faultMessages: string[]
}

interface WsdlEndpoint {
  portName: string
  binding: string
  soapAddress?: string
}

interface WsdlResult {
  kind: 'wsdl'
  version: '1.1' | '2.0'
  serviceName?: string
  targetNamespace?: string
  endpoints: WsdlEndpoint[]
  operations: WsdlOperation[]
  messages: WsdlMessage[]
}

interface SoapAttr {
  name: string
  value: string
}

interface SoapNode {
  localName: string
  attributes: SoapAttr[]
  text?: string
  children: SoapNode[]
}

interface SoapResult {
  kind: 'soap'
  version: '1.1' | '1.2' | 'unknown'
  headerNodes: SoapNode[]
  bodyNodes: SoapNode[]
}

type ParsedResult = WsdlResult | SoapResult

// ── XML parsing helpers ──────────────────────────────────────────────────────

function stripPrefix(ref: string | null): string | undefined {
  if (!ref) return undefined
  const i = ref.indexOf(':')
  return i >= 0 ? ref.slice(i + 1) : ref
}

function elementToSoapNode(el: Element): SoapNode {
  const attributes = Array.from(el.attributes)
    .filter(a => !a.name.startsWith('xmlns'))
    .map(a => ({ name: a.name, value: a.value }))
  const children = Array.from(el.children).map(elementToSoapNode)
  const text = el.children.length === 0 ? (el.textContent?.trim() || undefined) : undefined
  return { localName: el.localName, attributes, text, children }
}

function parseWsdl11(doc: Document): WsdlResult {
  const defs = doc.documentElement
  const serviceName = defs.getAttribute('name') ?? undefined
  const targetNamespace = defs.getAttribute('targetNamespace') ?? undefined

  // soapActions from <binding>
  const bindingMeta: Record<string, { soapAction?: string; style?: string }> = {}
  for (const binding of Array.from(doc.getElementsByTagNameNS('*', 'binding'))) {
    if (binding.localName !== 'binding') continue
    if (binding.parentElement?.localName !== 'definitions') continue
    for (const op of Array.from(binding.children)) {
      if (op.localName !== 'operation') continue
      const name = op.getAttribute('name') ?? ''
      const soapOp = Array.from(op.getElementsByTagNameNS('*', 'operation')).find(
        e => e.localName === 'operation'
      )
      bindingMeta[name] = {
        soapAction: soapOp?.getAttribute('soapAction') ?? undefined,
        style: soapOp?.getAttribute('style') ?? undefined,
      }
    }
  }

  // operations from <portType>
  const operations: WsdlOperation[] = []
  for (const pt of Array.from(doc.getElementsByTagNameNS('*', 'portType'))) {
    for (const op of Array.from(pt.children)) {
      if (op.localName !== 'operation') continue
      const name = op.getAttribute('name') ?? ''
      const docEl = op.getElementsByTagNameNS('*', 'documentation')[0]
      const inputEl = op.getElementsByTagNameNS('*', 'input')[0]
      const outputEl = op.getElementsByTagNameNS('*', 'output')[0]
      const faults = Array.from(op.getElementsByTagNameNS('*', 'fault'))
      const meta = bindingMeta[name] ?? {}
      operations.push({
        name,
        documentation: docEl?.textContent?.trim() || undefined,
        soapAction: meta.soapAction,
        style: meta.style,
        inputMessage: stripPrefix(inputEl?.getAttribute('message') ?? null),
        outputMessage: stripPrefix(outputEl?.getAttribute('message') ?? null),
        faultMessages: faults
          .map(f => stripPrefix(f.getAttribute('message')) ?? '')
          .filter(Boolean),
      })
    }
  }

  // messages
  const messages: WsdlMessage[] = []
  for (const msg of Array.from(doc.getElementsByTagNameNS('*', 'message'))) {
    if (msg.parentElement?.localName !== 'definitions') continue
    messages.push({
      name: msg.getAttribute('name') ?? '',
      parts: Array.from(msg.getElementsByTagNameNS('*', 'part')).map(p => ({
        name: p.getAttribute('name') ?? '',
        type: p.getAttribute('type') ? stripPrefix(p.getAttribute('type')) : undefined,
        element: p.getAttribute('element') ? stripPrefix(p.getAttribute('element')) : undefined,
      })),
    })
  }

  // endpoints
  const endpoints: WsdlEndpoint[] = []
  for (const svc of Array.from(doc.getElementsByTagNameNS('*', 'service'))) {
    for (const port of Array.from(svc.getElementsByTagNameNS('*', 'port'))) {
      const addr = port.getElementsByTagNameNS('*', 'address')[0]
      endpoints.push({
        portName: port.getAttribute('name') ?? '',
        binding: stripPrefix(port.getAttribute('binding')) ?? '',
        soapAddress: addr?.getAttribute('location') ?? undefined,
      })
    }
  }

  return { kind: 'wsdl', version: '1.1', serviceName, targetNamespace, endpoints, operations, messages }
}

function parseSoapEnvelope(doc: Document): SoapResult {
  const envelope = doc.documentElement
  const ns = envelope.namespaceURI ?? ''
  let version: '1.1' | '1.2' | 'unknown' = 'unknown'
  if (ns === 'http://schemas.xmlsoap.org/soap/envelope/') version = '1.1'
  else if (ns === 'http://www.w3.org/2003/05/soap-envelope') version = '1.2'

  const headerEl = Array.from(envelope.children).find(c => c.localName === 'Header') ?? null
  const bodyEl = Array.from(envelope.children).find(c => c.localName === 'Body') ?? null

  return {
    kind: 'soap',
    version,
    headerNodes: headerEl ? Array.from(headerEl.children).map(elementToSoapNode) : [],
    bodyNodes: bodyEl ? Array.from(bodyEl.children).map(elementToSoapNode) : [],
  }
}

function parseInput(raw: string): { result: ParsedResult | null; error: string | null } {
  if (!raw.trim()) return { result: null, error: null }

  const parser = new DOMParser()
  const doc = parser.parseFromString(raw, 'application/xml')
  const parseError = doc.querySelector('parsererror')
  if (parseError) {
    return { result: null, error: parseError.textContent?.trim() ?? 'Invalid XML' }
  }

  const rootName = doc.documentElement.localName.toLowerCase()

  if (rootName === 'definitions') return { result: parseWsdl11(doc), error: null }
  if (rootName === 'envelope') return { result: parseSoapEnvelope(doc), error: null }

  return {
    result: null,
    error: `Unknown root element <${doc.documentElement.tagName}>. Expected a WSDL <definitions> or a SOAP <Envelope>.`,
  }
}

// ── Sub-components ───────────────────────────────────────────────────────────

function SoapNodeTree({ node, depth = 0 }: { node: SoapNode; depth?: number }) {
  const [open, setOpen] = useState(depth < 2)
  const hasChildren = node.children.length > 0

  return (
    <div className="soap-node" style={{ paddingLeft: depth > 0 ? 16 : 0 }}>
      <div className="soap-node__head">
        {hasChildren ? (
          <button className="soap-node__toggle" onClick={() => setOpen(o => !o)}>
            <span className="soap-node__caret">{open ? '▾' : '▸'}</span>
            <span className="soap-node__tag">&lt;{node.localName}&gt;</span>
          </button>
        ) : (
          <span className="soap-node__tag soap-node__tag--leaf">&lt;{node.localName}&gt;</span>
        )}
        {node.attributes.map(a => (
          <span key={a.name} className="soap-node__attr">
            <span className="soap-node__attr-name"> {a.name}</span>
            <span className="soap-node__attr-eq">=</span>
            <span className="soap-node__attr-val">"{a.value}"</span>
          </span>
        ))}
        {!hasChildren && node.text && (
          <span className="soap-node__text"> {node.text}</span>
        )}
      </div>
      {hasChildren && open && (
        <div className="soap-node__children">
          {node.children.map((child, i) => (
            <SoapNodeTree key={i} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

function MessageCard({ label, msg }: { label: string; msg: WsdlMessage }) {
  return (
    <div className="soap-msg-card">
      <span className={`soap-msg-card__label soap-msg-card__label--${label.toLowerCase()}`}>
        {label}
      </span>
      <span className="soap-msg-card__name">{msg.name}</span>
      {msg.parts.length > 0 && (
        <div className="soap-msg-card__parts">
          {msg.parts.map((p, i) => (
            <div key={i} className="soap-msg-card__part">
              <span className="soap-msg-card__part-name">{p.name}</span>
              {(p.type || p.element) && (
                <span className="soap-msg-card__part-type">{p.element ?? p.type}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function WsdlOperationRow({ op, messages }: { op: WsdlOperation; messages: WsdlMessage[] }) {
  const [open, setOpen] = useState(false)
  const inputMsg = messages.find(m => m.name === op.inputMessage)
  const outputMsg = messages.find(m => m.name === op.outputMessage)
  const faultMsgs = op.faultMessages
    .map(fm => messages.find(m => m.name === fm))
    .filter((m): m is WsdlMessage => m !== undefined)

  return (
    <div className={`soap-op${open ? ' soap-op--open' : ''}`}>
      <button className="soap-op__head" onClick={() => setOpen(o => !o)}>
        <span className="soap-op__caret">{open ? '▾' : '▸'}</span>
        <span className="soap-op__name">{op.name}</span>
        {op.soapAction && (
          <span className="soap-op__action" title="SOAPAction">{op.soapAction}</span>
        )}
        {op.style && (
          <span className="soap-op__style">{op.style}</span>
        )}
      </button>
      {open && (
        <div className="soap-op__body">
          {op.documentation && (
            <p className="soap-op__doc">{op.documentation}</p>
          )}
          <div className="soap-op__msgs">
            {inputMsg && <MessageCard label="Input" msg={inputMsg} />}
            {outputMsg && <MessageCard label="Output" msg={outputMsg} />}
            {faultMsgs.map(fm => (
              <MessageCard key={fm.name} label="Fault" msg={fm} />
            ))}
            {!inputMsg && !outputMsg && faultMsgs.length === 0 && (
              <span className="soap-op__no-msgs">No message definitions found</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function CollapsibleSection({
  title,
  badge,
  children,
  defaultOpen = true,
}: {
  title: string
  badge?: number | string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="soap-section">
      <button className="soap-section__head" onClick={() => setOpen(o => !o)}>
        <span className="soap-section__caret">{open ? '▾' : '▸'}</span>
        <span className="soap-section__title">{title}</span>
        {badge !== undefined && (
          <span className="soap-section__badge">{badge}</span>
        )}
      </button>
      {open && <div className="soap-section__body">{children}</div>}
    </div>
  )
}

function WsdlViewer({ result }: { result: WsdlResult }) {
  return (
    <div className="soap-viewer">
      {/* Summary */}
      <div className="soap-summary">
        <div className="soap-summary__row">
          <span className="soap-summary__label">WSDL</span>
          <span className="soap-summary__value soap-summary__value--badge">v{result.version}</span>
        </div>
        {result.serviceName && (
          <div className="soap-summary__row">
            <span className="soap-summary__label">Service</span>
            <span className="soap-summary__value">{result.serviceName}</span>
          </div>
        )}
        {result.targetNamespace && (
          <div className="soap-summary__row">
            <span className="soap-summary__label">Namespace</span>
            <span className="soap-summary__value soap-summary__value--mono">{result.targetNamespace}</span>
          </div>
        )}
        <div className="soap-summary__row">
          <span className="soap-summary__label">Operations</span>
          <span className="soap-summary__value">{result.operations.length}</span>
        </div>
      </div>

      {/* Endpoints */}
      {result.endpoints.length > 0 && (
        <CollapsibleSection title="Endpoints" badge={result.endpoints.length}>
          <table className="soap-table">
            <thead>
              <tr>
                <th>Port</th>
                <th>Binding</th>
                <th>SOAP Address</th>
              </tr>
            </thead>
            <tbody>
              {result.endpoints.map((ep, i) => (
                <tr key={i}>
                  <td>{ep.portName}</td>
                  <td><span className="soap-mono">{ep.binding}</span></td>
                  <td>
                    {ep.soapAddress
                      ? <span className="soap-mono soap-address">{ep.soapAddress}</span>
                      : <span className="soap-empty">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CollapsibleSection>
      )}

      {/* Operations */}
      {result.operations.length > 0 && (
        <CollapsibleSection title="Operations" badge={result.operations.length}>
          <div className="soap-ops-list">
            {result.operations.map(op => (
              <WsdlOperationRow key={op.name} op={op} messages={result.messages} />
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Messages */}
      {result.messages.length > 0 && (
        <CollapsibleSection title="Messages" badge={result.messages.length} defaultOpen={false}>
          <div className="soap-msgs-list">
            {result.messages.map(msg => (
              <div key={msg.name} className="soap-msg-def">
                <span className="soap-msg-def__name">{msg.name}</span>
                {msg.parts.length > 0 && (
                  <div className="soap-msg-def__parts">
                    {msg.parts.map((p, i) => (
                      <div key={i} className="soap-msg-def__part">
                        <span className="soap-msg-def__part-name">{p.name}</span>
                        {(p.type || p.element) && (
                          <span className="soap-msg-def__part-type">{p.element ?? p.type}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}
    </div>
  )
}

function SoapViewer({ result }: { result: SoapResult }) {
  return (
    <div className="soap-viewer">
      <div className="soap-summary">
        <div className="soap-summary__row">
          <span className="soap-summary__label">SOAP</span>
          <span className="soap-summary__value soap-summary__value--badge">
            {result.version === 'unknown' ? 'Unknown version' : `v${result.version}`}
          </span>
        </div>
        <div className="soap-summary__row">
          <span className="soap-summary__label">Header</span>
          <span className="soap-summary__value">
            {result.headerNodes.length > 0 ? `${result.headerNodes.length} element(s)` : 'Empty'}
          </span>
        </div>
        <div className="soap-summary__row">
          <span className="soap-summary__label">Body</span>
          <span className="soap-summary__value">
            {result.bodyNodes.length > 0
              ? result.bodyNodes.map(n => n.localName).join(', ')
              : 'Empty'}
          </span>
        </div>
      </div>

      {result.headerNodes.length > 0 && (
        <CollapsibleSection title="Header" badge={result.headerNodes.length}>
          <div className="soap-tree">
            {result.headerNodes.map((node, i) => (
              <SoapNodeTree key={i} node={node} />
            ))}
          </div>
        </CollapsibleSection>
      )}

      {result.bodyNodes.length > 0 && (
        <CollapsibleSection title="Body" badge={result.bodyNodes.length}>
          <div className="soap-tree">
            {result.bodyNodes.map((node, i) => (
              <SoapNodeTree key={i} node={node} />
            ))}
          </div>
        </CollapsibleSection>
      )}
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

const WSDL_EXAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<definitions name="StockQuote"
  targetNamespace="http://example.com/stockquote.wsdl"
  xmlns="http://schemas.xmlsoap.org/wsdl/"
  xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/"
  xmlns:tns="http://example.com/stockquote.wsdl"
  xmlns:xsd="http://www.w3.org/2001/XMLSchema">

  <message name="GetLastTradePriceInput">
    <part name="tickerSymbol" type="xsd:string"/>
  </message>
  <message name="GetLastTradePriceOutput">
    <part name="price" type="xsd:float"/>
  </message>

  <portType name="StockQuotePortType">
    <operation name="GetLastTradePrice">
      <input message="tns:GetLastTradePriceInput"/>
      <output message="tns:GetLastTradePriceOutput"/>
    </operation>
  </portType>

  <binding name="StockQuoteSoapBinding" type="tns:StockQuotePortType">
    <soap:binding style="document" transport="http://schemas.xmlsoap.org/soap/http"/>
    <operation name="GetLastTradePrice">
      <soap:operation soapAction="http://example.com/GetLastTradePrice" style="document"/>
      <input><soap:body use="literal"/></input>
      <output><soap:body use="literal"/></output>
    </operation>
  </binding>

  <service name="StockQuoteService">
    <port name="StockQuotePort" binding="tns:StockQuoteSoapBinding">
      <soap:address location="http://example.com/stockquote"/>
    </port>
  </service>
</definitions>`

const SOAP_EXAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:tns="http://example.com/stockquote">
  <soap:Header>
    <tns:Auth>
      <tns:Token>abc123</tns:Token>
    </tns:Auth>
  </soap:Header>
  <soap:Body>
    <tns:GetLastTradePrice>
      <tns:tickerSymbol>IBM</tns:tickerSymbol>
    </tns:GetLastTradePrice>
  </soap:Body>
</soap:Envelope>`

export function SoapTab() {
  const { state, dispatch } = useApp()
  const { addToast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)

  const { result, error } = useMemo(
    () => parseInput(state.soapInput),
    [state.soapInput]
  )

  const hasInput = state.soapInput.trim().length > 0

  function handleCopy() {
    if (!state.soapInput) return
    navigator.clipboard.writeText(state.soapInput).then(() => addToast('Copied to clipboard'))
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      dispatch({ type: 'SET_SOAP_INPUT', input: ev.target?.result as string })
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="soap-tab">
      <div className="soap-tab__toolbar">
        <button
          className="btn btn-ghost"
          onClick={() => dispatch({ type: 'SET_SOAP_INPUT', input: WSDL_EXAMPLE })}
        >
          WSDL Example
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => dispatch({ type: 'SET_SOAP_INPUT', input: SOAP_EXAMPLE })}
        >
          SOAP Example
        </button>
        <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
          Load File
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".wsdl,.xml,.soap"
          style={{ display: 'none' }}
          onChange={handleFile}
        />
        <div className="toolbar-sep" />
        <button className="btn btn-ghost" onClick={handleCopy} disabled={!hasInput}>
          Copy XML
        </button>
        <button
          className="btn btn-danger"
          onClick={() => dispatch({ type: 'CLEAR_SOAP' })}
          disabled={!hasInput}
        >
          Clear
        </button>
        {error && (
          <span className="status-badge status-badge--invalid" title={error}>
            ✗ {error.length > 60 ? error.slice(0, 60) + '…' : error}
          </span>
        )}
        {result && !error && (
          <span className="status-badge status-badge--valid">
            ✓ {result.kind === 'wsdl'
              ? `WSDL ${result.version} · ${result.operations.length} operation${result.operations.length !== 1 ? 's' : ''}`
              : `SOAP ${result.version}`}
          </span>
        )}
      </div>

      <div className="soap-tab__panels">
        {/* Input panel */}
        <div className="panel soap-tab__pane">
          <div className="panel__header">
            <span className="panel__label">WSDL / SOAP XML</span>
            {hasInput && (
              <span className="text-xs text-muted mono">{state.soapInput.length} chars</span>
            )}
          </div>
          <div className="panel__body">
            <textarea
              className="json-textarea"
              value={state.soapInput}
              onChange={e => dispatch({ type: 'SET_SOAP_INPUT', input: e.target.value })}
              placeholder={`Paste a WSDL <definitions> or SOAP <Envelope> document here…\n\nUse the "WSDL Example" or "SOAP Example" buttons to load a sample.`}
              spellCheck={false}
            />
          </div>
        </div>

        {/* Output panel */}
        <div className="panel soap-tab__pane">
          <div className="panel__header">
            <span className="panel__label">
              {result
                ? result.kind === 'wsdl'
                  ? `WSDL — ${result.serviceName ?? 'Service'}`
                  : 'SOAP Envelope'
                : 'Parsed View'}
            </span>
          </div>
          <div className="panel__body soap-tab__output">
            {!hasInput && (
              <div className="empty-state">
                <span className="empty-state__icon">📄</span>
                <span className="empty-state__title">SOAP / WSDL Viewer</span>
                <span>
                  Paste a WSDL document to explore services, endpoints, and operations.
                  <br />
                  Or paste a SOAP Envelope to inspect its Header and Body.
                </span>
              </div>
            )}
            {hasInput && error && (
              <div className="empty-state">
                <span className="empty-state__icon">⚠️</span>
                <span className="empty-state__title">Parse Error</span>
                <span className="soap-error-detail">{error}</span>
              </div>
            )}
            {result && !error && result.kind === 'wsdl' && <WsdlViewer result={result} />}
            {result && !error && result.kind === 'soap' && <SoapViewer result={result} />}
          </div>
        </div>
      </div>
    </div>
  )
}
