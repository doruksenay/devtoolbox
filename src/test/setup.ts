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

if (!navigator.clipboard) {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    writable: true,
    value: { writeText: () => Promise.resolve() },
  })
}
