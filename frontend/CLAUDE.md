# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this repo is

`LIMS_0-8-1.html` is a single-page React frontend for the LIMS Django backend
(`github.com/c-cf/lims-backend`). It uses React 18 + Babel via CDN — there is no
build step, no bundler, no `package.json`. JSX modules are loaded by the browser
and transpiled in-place by `@babel/standalone`.

## File layout

```
LIMS_0-8-1.html         standalone single-file build (all assets inlined, ~1.8MB)
LIMS_0-8-1.dev.html     dev entrypoint — loads src/ + fonts/ + api.js
src/
  api.js                fetch wrapper + status-enum adapters between BE and FE
  icons.jsx             shared icon set (window.I)
  primitives.jsx        shared components (window.UI)
  shell.jsx             app frame + sidebar + role routing
  login.jsx             login page (calls window.api.auth.login)
  postlogin.jsx         landing after login
  fab.jsx               fab_user pages (dashboard, my requests, new request, …)
  lab.jsx               lab_staff pages (samples, WIP, dispatches, equipment, …)
  mgr.jsx               lab_manager pages (all requests, recipes, reports, …)
  tweaks-panel.jsx      design-time theme tweaker (dev only)
fonts/                  Inter, JetBrains Mono, Space Grotesk (woff2)
INTEGRATION_GAPS.md     backend ↔ frontend gap analysis (read this first)
```

## Conventions

- Each role file is wrapped in an IIFE so its internal `const Pill`, `const Page`, etc. don't leak globally and clobber each other (this was a real bug — see chat history in the design bundle if curious).
- Public exports go on `window.*` at the bottom of the file (`window.LoginPage`, `window.FabRoot`, etc.). Use this pattern, don't add ES modules.
- Status pills, urgency pills, sample pills all use the in-file `PILL` / `STATUS_LABEL` / `URGENCY_LABEL` maps. Adapter in `src/api.js` already normalizes backend enums to the frontend's narrower set — components consume the normalized values.
- IDs: backend uses integers. Frontend displays them as `WIP-7700`, `DP-3308` via `wipCode(id)` / `dispatchCode(id)` in `api.js`. The integer `id` is always the canonical key.
- HTTP: never call `fetch` directly from a component. Always go through `window.api`. If `window.api.X.foo` doesn't exist for what you need, add it to `src/api.js` first, then consume it.

## Local testing

```bash
# backend (in lims-backend, separate terminal)
uv run python manage.py runserver           # → http://localhost:8000

# frontend
cd ~/Documents/GitHub/lims-frontend
python3 -m http.server 8080                 # → http://localhost:8080/LIMS_0-8-1.dev.html
```

Point the frontend at local API by editing the one-line override at the top of
`LIMS_0-8-1.dev.html`:

```html
<script>window.LIMS_API_BASE = 'http://localhost:8000/api';</script>
```

For cross-origin (`:8080 → :8000`) the browser blocks fetch unless CORS is
configured on Django. Quick local workaround: open the page in a separate
Chrome instance with web security off:

```bash
open -na "Google Chrome" --args --disable-web-security \
  --user-data-dir=/tmp/chrome-lims-dev \
  http://localhost:8080/LIMS_0-8-1.dev.html
```

## Pre-commit checks

There is no automated linter for this repo (yet). Before committing:

1. Reload the page in the browser — confirm the components you touched still render
2. Sign in as `fab_user`, `lab_staff`, `lab_manager` (passwords seeded by the backend) and click through the pages you changed
3. Check the browser DevTools console — no red errors, no React key warnings
4. `git diff` — every line of change is intentional

If a change adds a new function or branch to `src/api.js`, smoke-test it with the live backend before committing.
