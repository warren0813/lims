# LIMS Full Stack

This repository contains the rebuilt LIMS MVP:

- `backend`: Django Ninja API, PostgreSQL schema, JWT auth, WIP/dispatch workflow, Celery equipment simulation, SSE, and reports.
- `frontend`: role-routed Next.js frontend connected to the live API.

## Run With Docker Compose

```bash
cp .env.example .env
docker compose up --build
```

Services (expose these port if you are on remote):

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000/api
- API docs: http://localhost:8000/api/docs
- PostgreSQL: localhost:5432
- Redis: localhost:6379

The application starts with a clean database. On first launch, create the first
lab manager from the login screen. After that, use the manager account APIs/UI to
create fab and lab users. Expose

## Local Development

### Backend Setup

**Prerequisites:**
- Python 3.10+
- PostgreSQL 12+ (or Docker)
- Redis (optional, for Celery workers)

**Installation:**

```bash
cd backend

# Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -e .
pip install pytest pytest-django factory-boy ruff
```

**Configuration:**

```bash
# Copy environment file from root and update with your settings
cp ../.env.example .env
# Edit .env to configure:
# - DJANGO_SECRET_KEY (generate with: python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())')
# - DEBUG=True for development
# - DATABASE_URL=postgres://user:password@localhost:5432/lims (if using PostgreSQL)
```

**Database Setup:**

```bash
# Run migrations
python manage.py migrate

# Create superuser (lab manager) for first login
python manage.py createsuperuser

# Optional: Load demo data for testing
python manage.py seed_demo
```

**Running the Server:**

```bash
# Basic development server
python manage.py runserver

# With Celery workers (background tasks)
celery -A config worker --loglevel=info  # In another terminal

# Simulated experiment duration for all Celery equipment workers
EXPERIMENT_DURATION_SECONDS=15 celery -A config worker --loglevel=info

# Without Redis/Celery (eager task execution)
CELERY_TASK_ALWAYS_EAGER=True python manage.py runserver
```

**Testing:**

```bash
# Run all tests
pytest

# Run specific test file
pytest tests/test_api.py -v

# With coverage
pytest --cov=src
```

**API Documentation:**

Once running, access the interactive API docs at: http://localhost:8000/api/docs

### Frontend Setup

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

For a single-process local backend without Redis/Celery workers, run the backend with `CELERY_TASK_ALWAYS_EAGER=True`.
For Docker Compose, set `EXPERIMENT_DURATION_SECONDS` in `.env`, then restart `backend` and all `worker-*` services.
