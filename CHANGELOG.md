# Changelog

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
