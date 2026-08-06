# DevToolbox

A fast, browser-based collection of developer utilities built with React, TypeScript and Vite.
Everything runs client-side — your data never leaves the browser unless you explicitly sign in
to sync your workspace.

## Tools

| Tool | Description |
| --- | --- |
| Editor | JSON editor with beautify, minify, validation, JSON Schema check and URL fetch |
| Compare | Side-by-side JSON diff with line-level statistics |
| XML | XML validator and formatter |
| XML Compare | Side-by-side XML diff |
| Grid | Tabular view of JSON arrays with sorting, filtering and CSV export |
| Query | JSONPath query runner with examples |
| Convert | XML ↔ JSON conversion |
| YAML | YAML ↔ JSON conversion |
| Base64 | Base64 encode/decode, including files |
| URL Encode | URL encode/decode with query parameter table |
| JWT | JWT decoder (header, payload, claims) |
| HAR | HAR file viewer with request filtering |
| Cron | Cron expression explainer |
| SOAP | SOAP envelope inspector |
| Draw | Lightweight diagram sketching canvas |
| Clean | HTML entity decoder and invisible character cleaner |
| Tax | Canadian sales tax (GST/HST/PST/QST/RST) calculator |

Extras: command palette (`Ctrl+K`), keyboard shortcuts (`Ctrl+B` beautify, `Ctrl+M` minify,
`Ctrl+S` copy, `Ctrl+Z`/`Ctrl+Y` undo/redo), dark/light themes, toast notifications and
collapsible sidebar navigation.

## Getting started

```bash
npm install
cp .env.example .env.local   # optional: only needed for account sync
npm run dev
```

The app runs at the URL printed by Vite (default `http://localhost:5173`).

### Environment variables

Supabase powers optional accounts and cross-device workspace sync. Without these variables the
app still works fully; only sign-in features are unavailable.

| Variable | Description |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key |

Database objects are defined in [`supabase-schema.sql`](./supabase-schema.sql).

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview the production build |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Run ESLint with autofix |
| `npm run format` | Format sources with Prettier |
| `npm run format:check` | Verify formatting |
| `npm run typecheck` | Type-check without emitting |
| `npm test` | Run unit tests (Vitest) |
| `npm run test:e2e` | Run end-to-end tests (Playwright) |

## Architecture

```
src/
  App.tsx               # Shell: header + sidebar + lazily loaded tool panes
  context/
    AppContext.tsx      # Global state provider and derived tool actions
    AuthContext.tsx     # Supabase session handling
    reducers/           # One reducer slice per tool, combined in reducers/index.ts
  components/<Tool>/    # UI for each tool
  components/shared/    # CodeMirror editors and reusable pieces
  hooks/                # Keyboard shortcuts, URL state, undo/redo, worker parsing
  utils/                # Pure helpers (diff, tree search, text cleaning, tax rules)
  workers/              # Web worker used for parsing large JSON payloads
```

State lives in a single reducer tree. `AppProvider` exposes the state through `useApp()` and the
dispatch function through `useAppDispatch()`; components that only dispatch should prefer the
latter so they do not re-render on unrelated state updates. Tool panes are code-split with
`React.lazy`, so opening the app only downloads the active tool.

## Testing

Unit tests live in `src/test` and run on jsdom via Vitest. End-to-end flows live in `e2e` and run
with Playwright. Both suites run in CI on every pull request.

## Deployment

Pushes to `main` build the app and publish it to GitHub Pages via
[`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml). Supabase values are injected
from repository secrets at build time.

## Contributing

1. Create a branch from `main`.
2. Make your change and keep it focused.
3. Run `npm run lint`, `npm run typecheck` and `npm test` before opening a pull request.
4. Add a note to [`CHANGELOG.md`](./CHANGELOG.md) under `[Unreleased]`.
