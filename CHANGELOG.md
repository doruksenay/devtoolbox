# Changelog

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
