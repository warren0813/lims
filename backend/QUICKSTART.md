# LIMS Backend — Quickstart

Django + Ninja REST API backend for the LIMS demo. Pair this with the [`lims-frontend`](https://github.com/lee81116/lims-frontend) SPA to see the UI.

## Prerequisites

- Python 3.12+
- [`uv`](https://docs.astral.sh/uv/) — `curl -LsSf https://astral.sh/uv/install.sh | sh`

## 5-minute setup

```bash
# 1. Clone + branch
git clone https://github.com/lee81116/lims-backend.git
cd lims-backend
git checkout feat/frontend-integration-v2

# 2. Install dependencies
uv sync

# 3. Environment
cp .env.example .env
# Generate a fresh secret key
echo "DJANGO_SECRET_KEY=$(uv run python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())')" >> .env

# 4. Database
uv run python manage.py migrate

# 5. Seed
uv run python manage.py seed_demo_users          # creates fab_user, lab_member, lab_manager
uv run python manage.py seed_experiment_types    # creates 7 canonical experiment types
uv run python manage.py seed_equipment           # creates equipment and capabilities
uv run python manage.py seed_recipes             # creates recipes

# 6. Start
uv run python manage.py runserver                # http://localhost:8000
```

API docs live at `http://localhost:8000/api/docs`.

## Demo accounts

| Username | Password | Role | What they do |
|---|---|---|---|
| `fab_user` | `mcv8uPKSvqz8Yru` | Fab user | Submit & track commission requests |
| `lab_member` | `t26fnPyedon6aFz` | Lab staff | Receive wafers, run WIPs/dispatches |
| `lab_manager` | `eWoN48kU0QrEV8B` | Lab manager | Approve requests, manage equipment + recipes, view reports |

These are also the offline-demo credentials baked into `lims-frontend/src/login.jsx`, so the chips on the login page work whether or not the backend is reachable.

## First-run walkthrough (~5 min)

After the SPA is running (see `lims-frontend` QUICKSTART):

1. **lab_manager → Equipment** → confirm the seeded equipment exists (e.g., `QA-TCT-01`, `QA-HAST-01`, `QA-CP-A`).
2. **lab_manager → Recipes** → confirm the seeded recipes exist (e.g., `TCT_Standard_500_v1`, `HAST_85_85_168h`).
3. **fab_user → New Request** → fill in wafers + experiments → Submit.
4. **lab_manager → All Requests** → pending one → Approve.
5. **fab_user → request detail** → Ship Wafers.
6. **lab_member → Samples** → Receive each shipped wafer.
7. **lab_member → WIP → + New WIP** → pick experiment + wafers → Create.
8. **WIP detail → + Create Dispatch** → pick equipment + recipe → tap `[20s]` chip → Create.
9. **Dispatch detail → Start Running** → watch the countdown → Mark Unloaded → Record Result (add comment) → submit.
10. Verdict is random (~80% pass / 20% fail). Walk back to fab_user's request to see the per-wafer pass/fail rollup.

## Tests + lint

```bash
uv run ruff check .
uv run ruff format --check .
uv run pytest
```

Should see ~530 tests passing.

## Troubleshooting

- **CORS error in browser**: the SPA needs to be served from `localhost:8080` (the dev port whitelisted in `config/settings.py`). If you serve from a different origin, add it to `CORS_ALLOWED_ORIGINS` in `.env`.
- **`Migration 'experiments.0002_consolidate_experiment_types' aborted`**: an older test DB has `FIB` or `XRD` rows with foreign-key references. Either reassign those to a canonical experiment or delete them; see `experiments/migrations/0002_consolidate_experiment_types.py` for the merge logic.
- **Empty dashboard for lab_member**: no equipment + recipes seeded. Run through the manager setup steps above.

## Architecture sketch

```
apps/
  accounts/       User + UserProfile (role: fab_user / lab_staff / lab_manager)
  experiments/    ExperimentType + LabCategory (RA / MA / FA / TM)
  equipment/      Equipment + Recipe + EquipmentCapability
  commissions/    Request + Sample + SampleExperimentStatus (per-wafer verdict lives here)
  wip/            WIP + Dispatch + ExperimentResult (the lab-side workflow)
  reports/        Read-only rollups for the manager dashboard
  web/            Django-templated admin views (kept in lockstep with the SPA)
api/router.py     NinjaAPI mounting all app routers
```

See `CLAUDE.md` for coding conventions and `prds/DESIGN.md` for the original product spec.
