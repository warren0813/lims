# LIMS Frontend — Quickstart

Single-page React SPA for the LIMS demo. Talks to [`lims-backend`](https://github.com/lee81116/lims-backend) over REST. No build step — React 18 + Babel via CDN, served as static files.

## Prerequisites

- Python 3 (just for `http.server` — any static file server works)
- A modern browser (Chrome, Firefox, Safari)
- **`lims-backend` running at `http://localhost:8000`** — set that up first via its [QUICKSTART](https://github.com/lee81116/lims-backend/blob/feat/frontend-integration-v2/QUICKSTART.md).

## 2-minute setup

```bash
# 1. Clone + branch
git clone https://github.com/lee81116/lims-frontend.git
cd lims-frontend
git checkout feat/frontend-integration

# 2. Serve the dev HTML (any static server)
python3 -m http.server 8080
```

Open `http://localhost:8080/LIMS_0-8-1.dev.html` in your browser. **Open DevTools (F12) and tick "Disable cache" on the Network tab** — without that, browser caching of `.jsx` files will hide subsequent edits.

The dev HTML is hard-coded to point at `http://localhost:8000/api`. If you need to point at a different backend, edit line 737:

```html
<script>window.LIMS_API_BASE = 'http://localhost:8000/api';</script>
```

## Demo accounts

The same three accounts as the backend seed. Click the chips on the login page to auto-fill.

| Username | Password | Role |
|---|---|---|
| `fab_user` | `mcv8uPKSvqz8Yru` | Fab user |
| `lab_member` | `t26fnPyedon6aFz` | Lab staff |
| `lab_manager` | `eWoN48kU0QrEV8B` | Lab manager |

## First walkthrough

Follow steps **1–10 in the backend QUICKSTART**. The whole loop (Fab submits → Manager approves → Fab ships → Lab receives → Lab dispatches → Lab records result → per-wafer verdict surfaces back to Fab) takes about 5 minutes once equipment + recipes are in.

The signature visual is the **20-second countdown** on a running dispatch:

> Lab → Dispatch detail → Start Running. The lifecycle stepper, the pink progress bar, and the "13s left" counter all tick in lockstep. After unload + record result, per-wafer pass/fail (random 80/20) appears inline.

## File layout

```
LIMS_0-8-1.dev.html      dev entrypoint — loads src/*.jsx + fonts/ + api.js
LIMS_0-8-1.html          standalone offline-demo build (no backend needed; mock data only)
src/
  api.js                 fetch wrapper + status-enum adapters
  shell.jsx              sidebar + topbar + role routing
  login.jsx              login page + offline ACCOUNTS fallback
  postlogin.jsx          landing after login
  fab.jsx                fab_user pages (dashboard, my requests, drafts, …)
  lab.jsx                lab_staff pages (samples, WIP, dispatches, equipment)
  mgr.jsx                lab_manager pages (all requests, recipes, reports, …)
  primitives.jsx         shared UI components (`window.UI`)
  icons.jsx              shared icon set (`window.I`)
fonts/                   Inter, JetBrains Mono, Space Grotesk (woff2)
INTEGRATION_GAPS.md      backend ↔ frontend gap analysis (read this if confused about adapter shapes)
CLAUDE.md                conventions for this repo
```

## Standalone offline demo

If you just want to see the UI without setting up the backend, open:

```bash
open LIMS_0-8-1.html
```

This is a single 1.8 MB HTML file with everything inlined + mock data. Login chips, sample data, and the 20-second countdown all work; nothing persists.

## Troubleshooting

- **"Failed to fetch" on login**: backend isn't running, or it's running but the dev HTML is pointing at the wrong URL. Check the Network tab → the `/api/auth/login` request should hit `localhost:8000`.
- **Login succeeds but UI shows mock-looking data (`lab_member`, dates from 2026-05-11)**: you opened `LIMS_0-8-1.html` (offline build) instead of `LIMS_0-8-1.dev.html`. Open the right one.
- **Changes to `.jsx` don't show up after refresh**: browser cache. Hard refresh with `Cmd+Shift+R` and confirm DevTools' "Disable cache" is ticked.
- **"Sample cannot perform 'receive' from status 'created'"**: the wafer hasn't been shipped from fab yet. Login as `fab_user`, open the approved request, click `Ship Wafers`.

## Tests

There's no automated test runner for the SPA. Manual smoke before commits:

1. Reload the dev HTML — confirm the components you touched still render.
2. Sign in as each role and click through the pages you changed.
3. Check the DevTools console — no red errors, no React key warnings.
4. `git diff` — every line of change is intentional.

See `CLAUDE.md` for code conventions (no-build-step rule, IIFE pattern, `window.api` for all backend calls).
