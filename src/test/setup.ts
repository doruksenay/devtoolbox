import '@testing-library/jest-dom'
// Registers the jest-dom matchers on Vitest's `expect` *and* their type
// augmentation, so `toBeInTheDocument()` & friends typecheck in component tests.
import '@testing-library/jest-dom/vitest'

// ── jsdom gaps exercised by component tests ─────────────────────────────
// Both APIs are called from effects/handlers in real components (TreeView
// scrolls the active search match into view and copies values), and jsdom
// implements neither. They are stubbed once here so every component test does
// not have to; individual tests can still spy on `navigator.clipboard`.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoViewStub() {
    /* no-op */
  }
}

// The virtualized tree watches its scroll container for size changes, and jsdom
// has no ResizeObserver at all.
if (!('ResizeObserver' in globalThis)) {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    writable: true,
    value: ResizeObserverStub,
  })
}

// jsdom runs no layout, so every element reports `offsetHeight`/`offsetWidth`
// as 0. The virtualizer reads exactly those to size its viewport and its rows,
// and a zero-height viewport holds zero rows — which would make every tree test
// assert against an empty container. Substitute plausible numbers: a scrolling
// pane gets a viewport's worth, anything else gets a single text row.
const VIRTUAL_PANE_CLASS = 'tree-view'
const PANE_SIZE = { height: 600, width: 800 }
const ROW_SIZE = { height: 21, width: 400 }

for (const [prop, key] of [
  ['offsetHeight', 'height'],
  ['offsetWidth', 'width'],
] as const) {
  Object.defineProperty(HTMLElement.prototype, prop, {
    configurable: true,
    get(this: HTMLElement) {
      return this.classList.contains(VIRTUAL_PANE_CLASS) ? PANE_SIZE[key] : ROW_SIZE[key]
    },
  })
}

if (!navigator.clipboard) {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    writable: true,
    value: { writeText: () => Promise.resolve() },
  })
}
