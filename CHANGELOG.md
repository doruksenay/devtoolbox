# Changelog

## [Unreleased]

### Added
- **Repair broken JSON**: `⋯ More → Repair JSON` in the editor takes the trailing commas, `//` and `/* */` comments, single quotes, unquoted keys, smart quotes, `NaN`/`Infinity`/`undefined` and unclosed brackets that real-world payloads arrive with, and proposes a fix. It never rewrites silently: the panel lists what it would change and waits for **Apply**, and the proposal retires as soon as the document changes so it cannot overwrite newer work. Repeats of the same fix fold into one line with a count — "removed a trailing comma (×12)" reads as the single decision it is. Content inside strings is never touched.
- **Unescape stringified JSON**: `⋯ More → Unescape string` turns `"{\"a\":1}"` back into JSON, peeling repeatedly when a payload was stringified more than once and reporting how many layers came off. The same item offers the reverse when the document is ordinary JSON.
- **JSONL / NDJSON**: `⋯ More` converts a JSONL document into an array and an array back into JSONL. Parse errors name the offending line, counted the way the editor gutter counts it.
- **Generate a JSON Schema from your data**: The schema panel gained `Generate from data`, which infers a draft 2020-12 schema from the current document — integers separated from numbers, nullable fields as unions, `required` limited to keys present in every sample.
- **Import CSV into Grid View**: The grid exported CSV but could not read it. `Import CSV` parses RFC 4180 input (quoted delimiters, embedded newlines, doubled quotes), auto-detects comma, semicolon or tab, converts numbers, booleans and nulls, and reports the row and column count.
- **Crash recovery**: A tool that throws no longer blanks the whole app. Each tool pane renders inside an error boundary that offers a retry and a reload, and the header and sidebar stay outside it so navigation keeps working — switching tools also clears the crash. The same screen covers a tool chunk that fails to download, which a stale tab can hit after a deploy.
- **Component tests**: The suite had 258 tests, all of them over pure functions and reducers, so the component layer — where this release's regressions actually happened — was untested. 74 tests now cover the command palette, sidebar, header and tree view against the real provider stack, including keyboard navigation, focus, persistence round-trips and inline editing.
- **Input limits**: Uploads are refused above 50 MB (5 MB for diagram imports) instead of freezing the tab, and `Load from URL` now times out after 30 seconds, caps the response at 50 MB, and can be cancelled while it runs.
- **Grid View overhaul**: The grid is now something you can work in rather than only look at.
  - **Search** across keys and values, reusing the tree view's matcher, with matching rows highlighted and their ancestors auto-expanded.
  - **Expand All / Collapse All**, now that expansion is tracked centrally instead of inside each node.
  - **Sortable columns** — click a header to cycle ascending → descending → document order. Sorting is type-aware (numbers numerically, strings with natural collation so `item2` precedes `item10`), and blanks always sink to the bottom in both directions. The `#` column keeps showing each row's position in the underlying document.
  - **Column show/hide** per table, with a count of what is visible.
  - **CSV export** of the array you are looking at: current sort order, visible columns only, RFC 4180 quoting and a guard against spreadsheet formula injection.
  - **Editable cells and row removal**, using the same edit contract as the tree view.
  - **Copy value / copy path** on every row and cell, and a breadcrumb showing the selected node's path.
  - **Click a cell to reveal it in the JSON on the left** — the raw text is scanned for the node's exact character range, so it works against your own formatting rather than a re-serialized guess.
  - **Large payloads**: rows are chunked at 100 with a "Show more" button, and parsing is debounced and routed through the existing web worker above 1 MB instead of re-parsing the whole document on every keystroke.
  - **Mixed arrays** now render as tables when at least 80% of their elements are objects; a single stray `null` no longer demotes a thousand-row response to an indented list. Non-object elements keep their row.
  - Truncated cells carry a `title`, and a key absent from a row is shown as `—` rather than being indistinguishable from an empty value.
- **Editable tree view**: In the JSON Editor's tree view, click any value or key to edit it in place. Each row also carries copy, add and remove buttons that appear on hover. Strings are edited as plain text; other types are read back as JSON literals, which is also how a value changes type. Adding an entry appends `null` under a placeholder key (or at the end of an array) and opens its editor straight away, expanding the node if it was collapsed. Removing an array element splices it out, so later indices shift down. Edits are written straight back to the document, so Code view shows them already applied and `Ctrl+Z` undoes them. Renames keep key order and are rejected when the name is empty or already taken. The tree stays read-only in JSON Compare, where copy still works.
- **Project documentation**: A `README.md` covering the tool catalogue, setup, environment variables, scripts, architecture and contribution steps.
- **Linting and formatting**: ESLint (typescript-eslint, react-hooks, react-refresh, jsx-a11y) and Prettier with `lint`, `lint:fix`, `format`, `format:check` and `typecheck` scripts.
- **Continuous integration**: A `CI` workflow that runs lint, type-check, unit tests, build and the Playwright end-to-end suite on every pull request, plus Dependabot updates for npm and GitHub Actions.
- **Canada Tax Calculator tool**: New utility that calculates Canadian sales tax on an amount. Enter a price and choose a province to see the per-tax breakdown, total tax and total price, plus a Quebec/Ontario comparison table. Supports reverse calculation when the amount already includes tax.
- **Text Cleaner tool**: New utility that decodes HTML entities (`&amp;`, `&#10;`, `&nbsp;`, …) and detects/removes invisible or "problematic" characters — non-breaking spaces, zero-width spaces, BOM, soft hyphens, and more. Shows a live report of everything found in the pasted text, with toggle options for each cleaning pass.

### Removed
- **Dead Grid state**: `gridPath` / `SET_GRID_PATH` were declared, reduced and persisted but never dispatched or read, and `gridParsed` / `gridError` were permanently `null` because the Grid parses locally. All three are gone, including from the saved payload.
- **Five tools retired**: XML Compare, Convert (XML ↔ JSON), SOAP / WSDL, Base64 and URL Encoder have been removed along with their state, reducers, icons and styles. The toolbox is now 12 focused tools.
- **YAML ↔ JSON tool retired**: Removed along with its state, reducer, icon and the now-unused shared mode-toggle styles. With it gone the *Transform* sidebar group is empty, so the group is dropped and JSON Compare moves under *Edit & View*.
- **Dead line diff**: `compareLines` was computed on every comparison with the `diff` package but no component ever read it — the Compare view derives its own path-level diff, and equality was already established separately. The state field, the `DiffLine` type and the `diff` / `@types/diff` dependencies are gone.

### Changed
- **The tree view is windowed**: A long array used to stop at 100 entries behind a `Show more` button — reaching the end of a 50,000-item document meant clicking it 500 times, and every click added that many more rows to the page. The tree now renders only the rows on screen: a 5,000-object document scrolls continuously through ~25,000 rows while ~30 of them exist in the DOM at any moment. Getting there meant rebuilding how the tree is drawn — expansion moved out of the individual nodes into one place (the model the Grid already uses, now shared), and the rows are produced as a flat list rather than by recursion, since windowing has to know what is at a given scroll position without rendering everything above it. Indentation and the guide lines are drawn from each row's depth instead of from being nested inside a parent, and the layout is unchanged to the pixel.
- **Expand All / Collapse All apply immediately**: The prop behind them was only read when a node first appeared, so it worked solely because the callers threw the whole tree away and rebuilt it. It is now live state.
- **Stylesheet split by area**: `src/index.css` had grown to 3,562 lines — about a third of the source — and every style change meant scrolling through all of it. The rules now live in 23 files under `src/styles`, one per area of the app, with `index.css` reduced to the import list that fixes their cascade order. The compiled stylesheet is byte-for-byte identical to before the split.
- **Accessibility pass over every tool**: 75 outstanding `jsx-a11y` findings are resolved and none were silenced to get there. Unlabelled inputs, selects and icon buttons gained accessible names taken from the text already on screen; clickable `div`s became real buttons, or kept their element and gained a role, a tab stop and key handling where the semantics required it (HAR request rows stay table rows and use a roving tab stop, so a 500-request capture does not add 500 tab stops). The three drag-to-resize handles are now operable with the arrow keys, Home and End. Modals gained `role="dialog"`, a title association and Escape-to-close, and every `autoFocus` was replaced with explicit focus management rather than being dropped.
- **ESLint accessibility rules keep their options**: The config rebuilt the `jsx-a11y` recommended set by mapping over rule *names*, which discarded each rule's options object and silently made several rules stricter than upstream intends — `table` could not take `role="grid"`, for one. Options are preserved now.
- **Tests no longer configure Supabase**: `vitest.config.ts` injected placeholder credentials, which switched account features *on* during tests and made every component test reach for the client. They were added when `lib/supabase.ts` created the client at module load and threw without a valid URL; the client is lazy now, so the placeholders are gone and no test needs a stub.
- **Live validation runs off the main thread**: Auto-validation re-parses on every typing pause, but it called `JSON.parse` synchronously regardless of size — a 7.7 MB document blocked the main thread for ~70 ms every time the user paused. It now goes through the existing worker hook, which keeps the synchronous path for documents under 1 MB where spawning a worker costs more than it saves. Late results are discarded if the text has moved on.
- **The parse worker is reused**: `useWorkerParse` created a worker per call and terminated it afterwards. That was acceptable for the Grid's one-off parse but not for validation firing on every typing pause, so the worker is now long-lived and requests carry an id so replies can be matched and superseded ones dropped.
- **The tree no longer re-renders on every keystroke**: `TreeView` subscribed to the whole app state through `useApp()`, so typing in the editor re-rendered the entire tree even though the parsed document had not changed. It now selects only the two theme fields it needs and is wrapped in `memo`. `ToastProvider` also memoizes its context value, which was a fresh object on every render and would have defeated that memoization whenever a toast appeared.
- **Persistence is debounced**: State was written out on every keystroke — a full serialize plus a Supabase round-trip per character for signed-in users, and a synchronous `localStorage` write for everyone else. Writes now wait for an 800 ms pause, and any pending write is flushed when the tab is hidden or the app unmounts so nothing is lost.
- **Editor no longer serializes twice per keystroke**: The JSON and XML editors echoed their own edits back through the value-sync effect, re-serializing the whole document and comparing it in full on every key press. Each editor now recognizes its own echo and skips the work; externally driven changes (Beautify, Minify, file load, document switch) are unaffected.
- **Smaller initial bundle**: `jsonpath-plus`, `ajv` / `ajv-formats` and `@supabase/supabase-js` were all reaching the critical path — the first two through the eagerly loaded `AppContext` and the default Editor tab, the third because the client was created at module load even though most visitors never sign in. All are now imported on demand: when a JSONPath query runs, when schema validation runs, and when an account feature is first used. `src/lib/supabase.ts` exposes `getSupabase()` in place of the eager `supabase` export.
- **Slice-based subscription**: `useApp()` hands out the whole state tree, so every one of its consumers re-rendered on each keystroke. A new `useAppSelector()` subscribes to a single field via `useSyncExternalStore`, and the shell — `App`, `Sidebar`, `Header` and the command palette — now uses it. The app-wide effect hooks moved into a render-free `AppEffects` component so their editor subscriptions no longer re-render the shell either. `useApp()` is unchanged for the tool panes.
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
- **Diagram undo acting on stale state**: `pushUndo` and `undo` were recreated on every render but left out of the dependency arrays of the mouse-up handler and the keyboard effect, so both listeners closed over an outdated set of shapes and connections. Undo could therefore restore the wrong snapshot.
- **Clearing from a tree view**: Clearing the JSON Editor now returns to Code view instead of leaving an empty tree telling you to switch. In JSON Compare, a pane whose results disappear — because either side was cleared or its JSON stopped parsing — falls back to text mode, so its content stays reachable; previously it was stranded on an empty state with the tree button disabled.
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
