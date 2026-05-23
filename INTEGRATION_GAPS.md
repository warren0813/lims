# LIMS Frontend ↔ Backend Integration — Gap Analysis

_As of 2026-05-19. Backend: Django + Ninja at `https://lims.cchuml.com/api/`. Frontend: `LIMS_0-8-1.html` (standalone) and `LIMS_0-8-1.dev.html` (multi-file, with `src/` + `fonts/`)._

This document maps every frontend feature to a backend endpoint and flags what's missing on each side. Items are tagged `[FE]` (frontend work), `[BE]` (backend work), or `[BOTH]`.

> **Status update (2026-05-19, post-handoff):** Backend tasks §2.2, §2.3, §2.4, §2.5, §2.6 all landed on `feat/frontend-integration` as five commits (`2535fcc`, `a13f949`, `c893c9f`, `0a39799`, `270311a`). Test count went 437 → 472. `src/api.js` adapter updated to consume the new fields. The frontend wiring work (section 6 below) is now unblocked. Section 2 entries are kept for history with ✅ markers.

---

## 1. Endpoint inventory (backend)

All routes mounted on `/api/`. Auth: JWT bearer, `Authorization: Bearer <access_token>`.

| Group | Method + Path | Purpose |
|---|---|---|
| Auth | `POST /auth/login` | Username + password → `{access_token, refresh_token, id, username, role, department}` |
| Auth | `POST /auth/refresh` | Refresh token rotation |
| Auth | `POST /auth/logout` | Revoke refresh token |
| Auth | `GET  /auth/me` | Current user |
| Experiments | `GET/POST/PATCH/DELETE /experiment-types/[/:id]` | Catalogue of TCT, HAST, CP, FT, BTC, etc. |
| Equipment | `GET/POST/PATCH /equipment/[/:id]` | Machines |
| Equipment | `POST /equipment/:id/capabilities` | Set supported experiment types |
| Recipes | `GET/POST/PATCH/DELETE /recipes/[/:id]` | Recipes (currently requires `equipment_id`) |
| Requests | `GET/POST /requests/` `GET/PATCH /requests/:id` | List/create/get/edit |
| Requests | `POST /requests/:id/{submit,approve,return,reject,ship,cancel,close}` | State transitions |
| Samples | `GET /samples/[/:id]` | List + detail |
| Samples | `POST /samples/:id/{receive,reject-receiving,report-lost,void,return}` | State transitions |
| WIPs | `GET/POST /wips/[/:id]` | List/create/get |
| WIPs | `POST /wips/:id/dispatches/` | Create a dispatch |
| WIPs | `POST /wips/:id/{complete,abort}` | WIP transitions |
| Dispatches | `GET /dispatches/[/:id]` | List + detail |
| Dispatches | `POST /dispatches/:id/{start,unload,record-result,complete,report-exception,redispatch,abort}` | State transitions |
| Automation | `POST /automation/equipment-result/` | Equipment-driven result submission |
| Reports | `GET /reports/equipment-utilization` | Range + per-equipment dispatch counts |
| Reports | `GET /reports/request-statistics` | Counts by status + avg TAT (hours) |

---

## 2. Hard mismatches (must fix before integration works)

### 2.1 Role name `lab_member` vs `lab_staff`  `[FE]`
- Backend `Role` enum: `fab_user`, `lab_staff`, `lab_manager`.
- Frontend `login.jsx` & shell routing: `fab_user`, `lab_member`, `lab_manager`.
- **Resolution:** keep `lab_staff` as the wire value; map `lab_staff → lab_member` for display in the new `src/api.js` adapter. The shell's role check (`role === 'lab_member'`) gets normalized at the auth boundary.

### 2.2 ✅ Request `urgency` field is frontend-only  `[BE]` **major** — _resolved in 2535fcc_
- Frontend stores `urgency: '3d' | '1w' | '2w'` on every request and renders Urgency pills everywhere (My Requests, request detail, sample list as countdown).
- Backend `Request` model has no urgency / priority / due-date field.
- **Resolution:** add `urgency` (`CharField(choices=['3d','1w','2w'], default='1w')`) to `Request`, expose it in `RequestIn`, `RequestUpdateIn`, `RequestListOut`, `RequestDetailOut`. Until then the frontend can either hide urgency or treat everything as `1w`.

### 2.3 ✅ Recipes are equipment-agnostic  `[BE]` **major** — _completed on `feat/frontend-integration-v2`_

The chat-design model is fully restored on the backend across 5 commits (`6960d4a`, `94de543`, `dafa466`, `87e4410`, `d4c1690`). 477 tests passing, ruff clean. `src/api.js` adapter is in sync. ✅ `DispatchBriefOut` (nested inside `WIPDetailOut.dispatches`) now also includes `equipment_id`/`equipment_name`, so the WIP detail page can render equipment per dispatch row without N extra `/dispatches/:id` calls.



**Decision history:**

1. **a13f949 (original chat design):** decouple recipes from equipment. WIP picks experiment; dispatch picks equipment + recipe.
2. **PR #34 merged to main (`766fe60`):** opposite direction — WIP picks equipment + multi-sample batch; dispatch inherits equipment; recipes pinned to equipment.
3. **2026-05-19 morning pivot:** adopted PR #34's model, dropped a13f949.
4. **2026-05-19 afternoon reverse-pivot — current direction:** the frontend chat-design wins. Backend layered on top of v2 to restore the chat-design model. PR #34 is not reverted; new commits supersede its shape.

**Target model (what the backend must look like after this branch ships):**

- `WIP`: has `experiment_type` (FK, required); **keeps PR #34's multi-sample shape** — `samples` (M2M via `WIPSample`); no `equipment` field. Constraint: every sample in the M2M must have `wip.experiment_type` in its request's `request_experiments`.
- `Dispatch`: has `equipment` (FK, required); has `recipe` (FK, required); `experiment_type` derived from the parent WIP, not in the input payload.
- `Recipe`: has `experiment_type`; **no `equipment` field at all** (drop the column). Dispatch validates that `dispatch.equipment` has `wip.experiment_type` as a capability AND `recipe.experiment_type == wip.experiment_type`.
- `apps/web/` templates updated to match.

**Migration path (layer-on-top, no revert of PR #34):**

The branch keeps the 6 existing commits and adds new commits on top that reshape the model. `WIPSample` stays; we're just swapping equipment for experiment_type at the WIP level and putting equipment back on Dispatch.

1. Add `WIP.experiment_type` (nullable initially). Data-migrate by inferring from `WIP.dispatches.first().experiment_type` per WIP; fallback to the experiment_type from any sample's `request_experiments`.
2. Add `Dispatch.equipment` (FK, nullable initially). Data-migrate by copying `dispatch.wip.equipment_id`.
3. Make `WIP.experiment_type` and `Dispatch.equipment` non-null.
4. Drop `WIP.equipment` column.
5. Drop `Recipe.equipment` column. Update validation in `create_dispatch`: equipment capability + recipe.experiment_type matches WIP.experiment_type.
6. Update `WIPIn` to accept `{experiment_type_id, sample_ids: list[int], note}` with the constraint that every sample's request has the experiment_type.
7. Update `DispatchIn` to accept `{equipment_id, recipe_id, note}` — drop `experiment_type_id` from the payload (derived from parent WIP server-side).
8. Update `apps/web/` templates referencing `wip.equipment`, recipe-equipment dropdowns, or dispatch.experiment_type-as-input. Multi-sample iteration in templates stays.

`src/api.js` adapter adjustments after this lands: `normalizeWip` adds `experimentId`, drops `equipmentId`; `normalizeRecipe` drops `equipmentId`/`equipmentName`. Dispatch normalizer stays as-is (already exposes `equipmentId`).
- Frontend (final design decision in chat #5): "Remove selecting equipment for the recipes. A recipe doesn't need to be assigned to equipment. Equipment is chosen at dispatch time."
- Backend `Recipe.equipment` is a non-null FK and `RecipeIn.equipment_id` is required.
- **Resolution:** make `Recipe.equipment` nullable; make `equipment_id` optional in `RecipeIn`; relax `Dispatch` validation: instead of `recipe must belong to equipment`, require `recipe.experiment_type == equipment.capability`.
- Frontend then lists/creates/edits recipes without an `equipment_id`.

### 2.4 ✅ Equipment "alterable parameters"  `[BE]` — _resolved in 270311a_
- Chat #6: manager equipment-create form asks for "parameters that can be altered". Backend `Equipment` has no `parameters` JSONField.
- **Resolution:** add `Equipment.parameters = JSONField(default=dict)` for an admin-defined schema of which dispatch parameters the equipment exposes.
- _Lower priority — UI ships fine without this until manager flow is exercised._

### 2.5 ✅ Sample countdown (`time remaining`) needs an explicit clock  `[BE]` — _resolved in c893c9f_
- Frontend Samples list shows a countdown derived from `arrivedAt + urgency_duration`.
- Backend has `Sample.created_at` and `updated_at` but no dedicated `received_at` timestamp; the moment a sample transitions to `received` is recoverable only via approval logs / state-machine history, neither of which is exposed.
- **Resolution:** add `Sample.received_at = DateTimeField(null=True)`; set it inside `receive_sample` view; expose on `SampleListOut` + `SampleDetailOut`.

### 2.6 ✅ Dispatch operator on list rows  `[BE]` _small_ — _resolved in 0a39799_
- Frontend Dispatches list shows operator (the lab member who created the dispatch).
- `Dispatch.created_by` exists on the model but `DispatchListOut` doesn't include it.
- **Resolution:** add `created_by: {id, username}` to `DispatchListOut` and `DispatchDetailOut`.

### 2.7 Dispatch estimated duration / countdown  `[BE]` _small_
- Frontend's running countdown assumes a hardcoded 24h cycle.
- Backend has no `estimated_duration` on `Dispatch` or `Recipe`.
- **Resolution (optional):** add `Recipe.estimated_duration_minutes = PositiveIntegerField(null=True)`. Frontend falls back to 24h if absent.

### 2.8 ✅ Wafer / Sample experiments view  `[BOTH]` — _resolved 2026-05-22_
- **Resolved 2026-05-22** — backend's `GET /samples/:id/experiments`
  (apps/commissions/api.py:679) hands back the rollup as
  `[{experiment_type:{id,name}, status:'done'|'pending'|'running',
  dispatch_id, result:{summary,verdict,data,...}|null}]`. Frontend
  wires it through `api.samples.getExperiments(id)` + a
  `normalizeSampleExperiments` adapter in `src/api.js`.
- `useWaferDetail` now co-fetches the rollup alongside sample +
  request; `LabWaferDetail` renders the Experiments card as fab-style
  clickable chips (Done = green check, Running = pulsing purple dot,
  Pending = grey dashed dot; click → `lab_dispatch_detail`).
- `FabRequestDetail` adds `useSampleExperimentsForRequest`, a per-sample
  parallel fetch keyed by sample id. The Experiments-by-Wafer card
  drives doneCount + chip render from the real rollup instead of the
  hardcoded `doneCount = 0` placeholder.
- Follow-up: `useWaferDetail` still scans `/wips/?status=in_progress`
  to find the WIP that owns this sample (only used for a breadcrumb).
  When `SampleDetailOut.wip_id` lands (separate gap) the scan loop
  can drop entirely.

### 2.9 ✅ `RequestUpdateIn` accepts samples + experiment_type_ids on drafts  `[BE]` _small_ — _resolved 2026-05-22 by lims-backend SHA `6c187f4`_
- **Resolved 2026-05-22 by lims-backend SHA `6c187f4`** — PATCH
  `/requests/:id` now accepts `experiment_type_ids` + `samples` on
  draft requests (the through-table rows + Sample rows get replaced
  inside a `transaction.atomic`). Non-draft requests return 422 if
  those fields are present, and an empty `samples` list also 422s
  (min_length=1).
- Frontend lockdown removed in commit-on-this-branch: FabNewRequest's
  isEdit mode is fully editable again, and `handle()`'s isEdit branch
  sends the full create-shape payload via `api.requests.update`.
- _History:_ originally surfaced 2026-05-19 during Fab New Request
  wiring; confirmed again 2026-05-22 that PATCH was silently dropping
  `samples`. The frontend had locked the wafer/experiment block as
  read-only as a workaround.

---

## 3. Soft mismatches (cosmetic / adapter-fixable in frontend)

### 3.1 Request status enum
Backend has more states than the frontend renders:

| Backend status | Frontend treatment |
|---|---|
| `draft` | `draft` |
| `pending_approval` | `submitted` |
| `approved` | `in_progress` (frontend collapses approved + sample_shipped + in_progress) |
| `sample_shipped` | `in_progress` |
| `in_progress` | `in_progress` |
| `exception` | (no FE equivalent — show as `In Progress · Exception` tag) |
| `completed` | `completed` |
| `closed` | `completed` (or add a "Closed" pill — minor design call) |
| `returned` | `returned` |
| `rejected` | `rejected` |
| `cancelled` | `cancelled` |

Adapter lives in `src/api.js#normalizeRequest`.

### 3.2 Sample status enum
| Backend | Frontend |
|---|---|
| `created` | (FE doesn't have this — pre-ship state. Map to `incoming`) |
| `shipped` | `incoming` |
| `received` | `received` |
| `receiving_exception` | `rejected` (with reason banner) |
| `split` | `received` (or new pill — minor) |
| `processing_exception` | `in_wip` (with exception flag) |
| `completed` | `completed` |
| `lost` | `rejected` (with reason "lost") |
| `returned` | `returned` |
| `voided` | `cancelled` |

Backend has no `in_wip` — frontend derives it: `if sample has any non-terminal WIP → in_wip`. Adapter does this when WIP list is also loaded, otherwise falls back to backend status.

### 3.3 Dispatch status enum
Frontend uses 6 states; backend has 9 (adds `completed`, `execution_exception`, `pending_redispatch`, `aborted`). The new ones can render as `result_recorded` (for `completed`), `exception` (for `execution_exception` and `pending_redispatch`), `aborted` (new pill — trivial to add).

### 3.4 Equipment status
Backend: `available | maintenance | disabled`. Frontend: `idle | running | maintenance`. The frontend's `running` is _computed_ (does the equipment have any non-terminal dispatch?) — backend doesn't model it. **Resolution:** adapter computes `running` client-side; `available → idle`, `disabled → maintenance` (or add a new "Disabled" pill in frontend).

### 3.5 IDs are integers, frontend uses display strings
Frontend uses `WIP-7700`, `DP-3308`, `QA-TCT-01` as primary keys. Backend uses integer PKs. **Resolution:** carry integer PK as the real id; the human-readable code is `WIP-${id.toString().padStart(4, '0')}` for display. Same for dispatch (`DP-${id}`). Equipment can use `equipment.name` for display.

### 3.6 Recipe `params` vs `parameters`
Frontend uses `recipe.params`, backend `recipe.parameters`. Adapter renames.

### 3.7 Sample wafer fields
Frontend: `{ id, size, requestId, urgency, arrivedAt, status, wipId, expIds }`. Backend `SampleListOut`: `{ id, wafer_id, wafer_size, status, request_id, ... }`. Mapping: `wafer_id → frontend.id` (label), the integer PK becomes the real id; `arrivedAt`, `urgency`, `expIds`, `wipId` are not on the sample — they come from the parent request + the WIP table.

---

## 4. Missing endpoints (frontend uses, backend doesn't have)

| Frontend usage | Suggested endpoint | Notes |
|---|---|---|
| ✅ **Sample count on `RequestListOut`** | `sample_count: int` annotated server-side | _Landed_ — adapter exposes as `r.sampleCount`, consumed by Drafts panel and My Requests list. |
| ✅ Dispatch count on `WIPListOut` | `dispatch_count: int` annotated server-side | _Landed_ — adapter exposes as `w.dispatchCount`, replaces the "—" placeholder on the Lab WIP list. |
| ✅ WIP count on `SampleListOut` | `has_wip: bool` (Exists subquery) | _Landed_ — adapter derives `in_wip` status from `has_wip && raw=='received'`, so the Lab Samples "In WIP" tab gets real rows without a second round-trip. |
| Lab manager dashboard trend chart | `GET /reports/trends?metric=requests_per_day&days=30` | Currently the chart in `MgrDashboard` is faked. |
| Manager "Awaiting your Response" count badge | `GET /requests/?status=pending_approval` | Already supported — just call it. |
| Dashboard tile counts (In Progress / Drafts / etc.) | reuse `GET /requests/?status=…` per tile, or add `GET /requests/summary` | 4 parallel calls is fine for v1. |
| Per-wafer experiment rollup | `GET /samples/:id/experiments` (see §2.8) | |
| Recent activity feed | `GET /activity/?limit=20` | Doesn't exist. For v1 the frontend can stitch `requests` + `dispatches` ordered by `updated_at`. |

---

## 5. Frontend changes required regardless

These are independent of backend gaps — needed to call the live API at all:

1. **API client module** (`src/api.js`) — fetch wrapper that:
   - Reads/writes JWT in `localStorage` (but standalone artifacts can't use storage — see §5.3).
   - Sets `Authorization: Bearer …` on every call.
   - On 401, runs the refresh flow once and retries; on second 401, kicks user back to login.
   - Provides typed functions: `auth.login`, `requests.list`, `requests.create`, etc.
   - Normalizes status/role between backend and frontend conventions (see §3.1–3.4).

2. **Login wired to backend** — `login.jsx` calls `api.auth.login(username, password)`, stores tokens, sets the user. The hard-coded `ACCOUNTS` map is replaced; the "Demo accounts" UI either reads usernames from a public seed-list endpoint or is removed for the live build.

3. **Data hydration on every page** — each top-level page (FabDashboard, LabSamples, LabWips, LabDispatches, MgrAllRequests, etc.) currently consumes its `*_SEED` const directly. Replace with a `useEffect` that calls the corresponding `api.*.list()` and stores the result in component state.

4. **Storage strategy** — JWT lives in `localStorage` for normal hosting. The "Browser Storage Restriction" only applies to claude.ai artifacts; this is a real frontend, so localStorage is fine. For the standalone artifact (`LIMS_0-8-1.html`) it stays demo-only.

5. **CORS** — backend must allow the frontend origin. Already in scope on the Django side (`django-cors-headers` is in `pyproject.toml`); just confirm `CORS_ALLOWED_ORIGINS` includes wherever the static HTML is served from.

6. **Status-pill maps** — each role file has its own `PILL`/`STATUS_LABEL` map; once backend statuses are mapped to frontend display values in the adapter, the existing pill maps work as-is. No design change needed.

---

## 6. Per-page integration checklist

### `LoginPage`
- [x] design exists
- [ ] swap `ACCOUNTS` lookup for `POST /auth/login`
- [ ] store tokens, role, department
- [ ] map `lab_staff` → `lab_member` for routing

### Fab `Dashboard`
- [ ] `GET /requests/` → compute counts for tiles
- [ ] `GET /requests/?status=pending_approval` for "Waiting Approval"
- [ ] activity feed = top 5 by `updated_at` (client-side join until backend feed exists)

### Fab `My Requests`, `Drafts`
- [ ] `GET /requests/` (already filtered server-side by requester for fab users)
- [x] urgency pill (§2.2 ✅ landed — `r.urgency` is now in the response)

### Fab `New Request`
- [ ] `GET /experiment-types/` for the picker (drop the hardcoded `RA_EXPERIMENTS` list)
- [ ] `POST /requests/` with `{title, note, experiment_type_ids, experiment_parameters, samples}`
- [ ] Save Draft = create without `submit`; Submit = create then `POST /requests/:id/submit`

### Fab `Request Detail`
- [ ] `GET /requests/:id`
- [ ] cancel button → `POST /requests/:id/cancel`
- [ ] approval log already on the response

### Lab `Dashboard`
- [ ] `GET /samples/?status=shipped` (To Receive)
- [ ] `GET /wips/?status=in_progress`
- [ ] `GET /dispatches/?status=unloaded` (To Record)

### Lab `Samples`
- [ ] `GET /samples/`
- [ ] receive / reject-receiving buttons → corresponding sample actions
- [x] urgency / time-remaining (§2.2 + §2.5 ✅ landed — urgency from parent request, `received_at` from sample)

### Lab `WIP` list + detail
- [ ] `GET /wips/`, `GET /wips/:id`
- [ ] Create WIP modal → `POST /wips/` with `sample_id` + `note`
- [ ] Add Dispatch → `POST /wips/:id/dispatches/` with `{experiment_type_id, equipment_id, recipe_id, note}`
- [ ] Complete / Abort buttons → corresponding WIP actions

### Lab `Dispatches` list + detail
- [ ] `GET /dispatches/`, `GET /dispatches/:id`
- [x] operator column (§2.6 ✅ landed — `created_by` exposed on both list + detail)
- [ ] start / unload / record-result / complete buttons → corresponding actions

### Lab `Equipment`
- [ ] `GET /equipment/`
- [ ] running status: client-computed via dispatches list (§3.4)

### Manager `All Requests` (+ Pending tab)
- [ ] `GET /requests/?status=pending_approval`
- [ ] approve / return / reject → `POST /requests/:id/{approve,return,reject}` with `comment`

### Manager `Recipes`
- [ ] `GET /recipes/`
- [ ] New / Edit / Delete recipe → corresponding endpoints
- [x] §2.3 ✅ landed — `equipment_id` is optional in `RecipeIn`; modal drops the equipment field per the user's design decision

### Manager `Equipment`
- [ ] `POST /equipment/` from the create-equipment modal
- [ ] Setting capabilities → `POST /equipment/:id/capabilities`
- [x] "alterable parameters" UI (§2.4 ✅ landed — `Equipment.parameters` JSONField is in EquipmentIn/EquipmentOut)

### Manager `Reports`
- [ ] `GET /reports/equipment-utilization?period=…&start_date=…&end_date=…`
- [ ] `GET /reports/request-statistics?start_date=…&end_date=…`

### Manager `Dashboard`
- [ ] tile counts: see Fab Dashboard pattern
- [ ] trend chart: needs §4 trends endpoint or stitch client-side

---

## 7. Suggested ordering

1. ~~**Backend, two PRs:** §2.1–§2.6.~~ ✅ **Done** — landed as 5 commits on `feat/frontend-integration` (2535fcc, a13f949, c893c9f, 0a39799, 270311a). §2.1 (role rename) handled by FE adapter in `src/api.js`.
2. ~~**Frontend, one PR:** add `src/api.js`, wire `LoginPage` end-to-end, add status/role adapters.~~ ✅ **Done** — `src/api.js` exists, `login.jsx` calls it.
3. **Frontend, next:** wire each list page (fab requests, lab samples/wips/dispatches/equipment, manager requests/recipes/reports). State transitions call API, on success refetch. ⬅ _we are here_
4. **Frontend, after that:** form pages (new request, new WIP, add dispatch, new/edit recipe, new equipment, approve/return/reject modals). Validation goes through Ninja's 400 responses.
5. **Backend, follow-up:** §2.7 recipe duration, §2.8 wafer rollup, §4 trends + activity endpoints. These are quality-of-life — frontend ships without them.

---

## 8. Open questions for the user

- **Approval comment requirement:** frontend "approve" doesn't ask for a comment, but backend `approve` doesn't accept one either. Backend's `return` and `reject` both require a `comment` (`min_length=1`). The current manager modal in `mgr.jsx` matches this. Keep as-is.
- **Wafer ID uniqueness:** backend enforces `(request, wafer_id)` unique-together. Frontend's New Request flow does not yet validate against duplicate wafer IDs within the same request. Easy add.
- **Login demo accounts:** keep the "Demo accounts" panel in `LoginPage` for staging, drop it for production. Make it env-driven (`window.LIMS_API_BASE` controls API URL; same flag can toggle demo panel).
