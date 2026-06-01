# LIMS Full Stack

- `backend/` — Django Ninja API, PostgreSQL, JWT auth, WIP/dispatch workflow
- `frontend/` — Next.js 16, role-based routing (fab_user / lab_member / lab_manager), server-side API proxy

## Quick Start (Docker Compose)

```bash
cp .env.example .env
docker compose up --build
```

| Service      | URL                            |
|--------------|-------------------------------|
| Frontend     | http://localhost:3000          |
| Backend API  | http://localhost:8000/api      |
| API docs     | http://localhost:8000/api/docs |
| PostgreSQL   | localhost:5432                 |

By default, Docker Compose migrates the database and seeds demo data on startup.
To preserve equipment, recipe, experiment-type, or demo-user edits across local
container rebuilds, set `RUN_DEMO_SEEDS=0` in `.env` after initialization.

### Demo accounts

| Role        | Username      | Password          |
|-------------|---------------|-------------------|
| Lab Manager | `lab_manager` | `eWoN48kU0QrEV8B` |
| Lab Member  | `lab_member`  | `t26fnPyedon6aFz` |
| Fab User    | `fab_user`    | `mcv8uPKSvqz8Yru` |

### Remote server

Set `SERVER_IP`, `BACKEND_PORT`, and `FRONTEND_PORT` in `.env` before running:

```bash
SERVER_IP=192.168.1.100 BACKEND_PORT=8000 FRONTEND_PORT=3000 docker compose up --build
```

---

## Local Development

### Backend

**Prerequisites:** Python 3.12+

```bash
cd backend

# Install with uv (recommended)
uv sync

# Or with pip
pip install -e ".[dev]"
```

```bash
# Configure — SQLite works locally without DATABASE_URL
cp ../.env.example .env

# Migrate + seed demo data
python manage.py migrate
python manage.py seed_demo_users
python manage.py seed_experiment_types
python manage.py seed_equipment
python manage.py seed_recipes

# Run server
python manage.py runserver
```

```bash
# Tests
pytest
pytest tests/test_api.py -v
pytest --cov=src
```

### Frontend

**Prerequisites:** Node 22+

```bash
cd frontend
cp ../.env.example .env.local   # sets LIMS_BACKEND_URL=http://localhost:8000
npm install
npm run dev
```

The frontend proxies all `/api/*` requests server-side to `LIMS_BACKEND_URL`. No browser CORS issues.

```bash
npm run lint    # ESLint
npm run build   # production build
```

---

## Architecture

```
browser → Next.js (3000) → /api/* route handler → Django (8000)
```

All API calls go through the Next.js server-side proxy. `LIMS_BACKEND_URL` controls where the proxy points — `http://localhost:8000` for local dev, `http://backend:8000` inside Docker Compose.

### Role routing

| Role          | Entry point            |
|---------------|------------------------|
| `fab_user`    | `/fab/dashboard`       |
| `lab_member`  | `/lab/dashboard`       |
| `lab_manager` | `/manager/dashboard`   |

Root `/` redirects to the appropriate dashboard based on the stored session, or to `/login` if unauthenticated.

---

## Container startup controls

The backend image keeps migrations and demo seeds separate:

| Variable | Image default | Docker Compose default | Purpose |
|----------|---------------|------------------------|---------|
| `RUN_MIGRATIONS` | `1` | `1` | Apply Django migrations when the backend container starts |
| `RUN_DEMO_SEEDS` | `0` | `1` | Refresh demo users, experiment types, equipment, capabilities, and recipes |

`RUN_DEMO_SEEDS=1` is intended for a fresh local database or a deliberate demo
reset. It updates existing seeded records, so it can overwrite changes made in
the UI.

For Railway, keep:

```text
RUN_MIGRATIONS=1
RUN_DEMO_SEEDS=0
```

For the first Railway initialization only, temporarily set
`RUN_DEMO_SEEDS=1`, redeploy once, then change it back to `0`.
