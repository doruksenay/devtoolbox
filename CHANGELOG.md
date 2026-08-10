# Changelog

## [Unreleased]

### Added
- **Editable tree view**: In the JSON Editor's tree view, click any value or key to edit it in place, and copy any field or whole subtree with the copy button that appears on the row. Strings are edited as plain text; other types are read back as JSON literals, which is also how a value changes type. Edits are written straight back to the document, so Code view shows them already applied. Renames keep key order and are rejected when the name is empty or already taken. The tree stays read-only in JSON Compare.
- **Project documentation**: A `README.md` covering the tool catalogue, setup, environment variables, scripts, architecture and contribution steps.
- **Linting and formatting**: ESLint (typescript-eslint, react-hooks, react-refresh, jsx-a11y) and Prettier with `lint`, `lint:fix`, `format`, `format:check` and `typecheck` scripts.
- **Continuous integration**: A `CI` workflow that runs lint, type-check, unit tests, build and the Playwright end-to-end suite on every pull request, plus Dependabot updates for npm and GitHub Actions.
- **Canada Tax Calculator tool**: New utility that calculates Canadian sales tax on an amount. Enter a price and choose a province to see the per-tax breakdown, total tax and total price, plus a Quebec/Ontario comparison table. Supports reverse calculation when the amount already includes tax.
- **Text Cleaner tool**: New utility that decodes HTML entities (`&amp;`, `&#10;`, `&nbsp;`, …) and detects/removes invisible or "problematic" characters — non-breaking spaces, zero-width spaces, BOM, soft hyphens, and more. Shows a live report of everything found in the pasted text, with toggle options for each cleaning pass.

### Removed
- **Five tools retired**: XML Compare, Convert (XML ↔ JSON), SOAP / WSDL, Base64 and URL Encoder have been removed along with their state, reducers, icons and styles. The toolbox is now 12 focused tools.
- **YAML ↔ JSON tool retired**: Removed along with its state, reducer, icon and the now-unused shared mode-toggle styles. With it gone the *Transform* sidebar group is empty, so the group is dropped and JSON Compare moves under *Edit & View*.

### Changed
- **Tax Calculator scope**: Now covers Quebec (GST + QST) and Ontario (HST) only, and defaults to Quebec. Persisted state referencing a removed tool or province falls back to the JSON Editor and Quebec instead of leaving the app with nothing to render.
- **Code splitting**: Tool panes are now loaded on demand with `React.lazy`, so the initial download contains only the app shell and the active tool.
- **State layer**: `AppProvider` memoizes its context value and exposes a separate `useAppDispatch()` hook, so dispatch-only components no longer re-render on unrelated state changes.
- **Parsing helpers**: `parseJson`, `parseXml` and `formatXml` moved to `src/utils/parsers.ts` (still re-exported from `AppContext` for compatibility).
- **Package metadata**: Renamed to `devtoolbox` and aligned the version with the changelog.
- **JSONPath**: New **Copy All** button next to the expression input copies every matched value at once, comma separated (e.g. `1, 2, 3, 4, 5`), instead of copying results one by one.
- **From Editor**: When more than one editor document (tab) is open, the "From Editor" button in JSONPath and Grid View now shows a bar asking which tab to pull the JSON from, using the tabs' (possibly renamed) names. With a single tab it behaves as before.
- **HAR Viewer**: "Open in Editor" now opens the request/response payload in the next editor tab instead of overwriting the first one (an empty lone tab is still reused).
- **Grid View**: Nested objects and arrays inside array-of-objects tables can now be expanded in place, so deeply nested data is reachable instead of showing an inert `[n]` / `{…}` tag.
- **Editor search UX**: The in-editor search panel (JSON & XML editors) now appears at the top instead of the bottom, shows a live match count next to the query, and highlights matches more prominently.

### Fixed
- **Startup without Supabase**: The app no longer crashes when `VITE_SUPABASE_*` variables are missing; account features are simply disabled and local preferences still persist.
- **End-to-end tests**: Updated selectors that still targeted the removed horizontal tab bar so the Playwright suite passes again.

## [0.3.0] - 2026-04-21

### Added
- **Sidebar Navigation**: Replaced horizontal tab bar with a collapsible vertical sidebar (VS Code-style). Each tool has an SVG icon. Sidebar can be toggled to icon-only mode.
- **SVG Icons**: Clean 18×18 inline SVG icons for every tool replacing Unicode placeholders.
- **Command Palette**: `Ctrl+K` opens a searchable command palette to instantly switch between all tools. Supports keyboard navigation (↑↓ arrows, Enter, Esc).
- **Toast Notifications**: Non-blocking bottom-right toast messages for Copy, Download, and Convert actions.
- **YAML ↔ JSON Tool**: New tab for bidirectional YAML/JSON conversion using `js-yaml`.
- **Base64 Encoder/Decoder**: Encode text to Base64 or decode Base64 back to text. Supports file encoding.
- **URL Encoder/Decoder**: URL-encode or decode strings with auto-parsed query parameter table.

### Fixed
- **Draw Tab label bug**: Double-clicking a shape to edit its label now correctly finds the element ID using `closest('[data-id]')` instead of the incorrect `closest('.draw-shape')`.
- **Editor copy feedback**: Replaced flashing "Copied!" button label with toast notification.

### Changed
- **Project renamed**: "JSON Workbench" → "DevToolbox" (title, meta, localStorage key, header branding).
- **App shell layout**: Switched from column-only flex to header + sidebar + content layout.
- **Design tokens**: Added `--surface`, `--surface-2`, `--text` CSS variable aliases for full legacy HAR/Cron/JWT CSS compatibility.

## [0.2.0] - 2026-04-20

### Added
- **Keyboard Shortcuts**: `Ctrl+B` beautify, `Ctrl+M` minify, `Ctrl+S` copy to clipboard
- **Live Validation**: Auto-validates JSON with 500ms debounce as you type
- **Theme Animation**: Smooth CSS transitions when switching dark/light theme
- **Enhanced Mobile Support**: Better responsive layout for screens < 640px
- **JSON Schema Validation**: Validate your JSON against any JSON Schema (using ajv)
- **CSV Download**: Export grid data as downloadable CSV file
- **XML ↔ JSON Converter**: New Convert tab for bidirectional conversion
- **URL Fetch**: Load JSON from any URL directly in the Editor
- **Diff Statistics**: Line-level +/- counts in Compare tab
- **Web Worker Parsing**: Large JSON (>1MB) parsed in background thread
- **URL State**: Active tab synced to URL hash for permalinks
- **Undo/Redo**: `Ctrl+Z` / `Ctrl+Y` history for Editor
- **CodeMirror Integration**: Real code editor with syntax highlighting, line numbers, bracket matching
- **E2E Tests**: Playwright test suite for critical user flows
- **CI Test Step**: Tests must pass before deploy
- **Semantic Versioning**: Auto-release workflow on version bump

## [0.1.0] - Initial Release

### Features
- JSON Editor with Beautify/Minify/Validate
- Side-by-side JSON Compare with tree diff highlighting
- XML Validator with format/upload/download
- JSON Grid view with sort/filter
- JSONPath Query with examples
- Dark/Light theme
- Local storage persistence
