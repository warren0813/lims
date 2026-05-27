# Contributing to LIMS Backend

Welcome! This guide covers everything you need to contribute to the LIMS backend project, built with **Django 6.0** and **Django Ninja 1.6**.

## Table of Contents

- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Test-Driven Development (TDD)](#test-driven-development-tdd)
- [Django Ninja Conventions](#django-ninja-conventions)
- [Code Style](#code-style)
- [Git Workflow](#git-workflow)

---

## Getting Started

### Prerequisites

- Python 3.12+
- [uv](https://docs.astral.sh/uv/) (package manager)

### Setup

```bash
# Clone the repository
git clone <repo-url>
cd lims-backend

# Install dependencies
uv sync

# Copy environment variables
cp .env.example .env
# Edit .env and set your own DJANGO_SECRET_KEY:
# uv run python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())'

# Run migrations
uv run python manage.py migrate

# Start the development server
uv run python manage.py runserver
```

Visit `http://localhost:8000/api/docs` to see the interactive API documentation.

---

## Project Structure

```
lims-backend/
├── api/                # API layer (routers, schemas)
│   ├── router.py       # Root NinjaAPI instance
│   └── __init__.py
├── config/             # Django project settings
│   ├── settings.py
│   ├── urls.py
│   ├── wsgi.py
│   └── asgi.py
├── pyproject.toml      # Dependencies and project metadata
├── manage.py
└── .env.example
```

As the project grows, we organize code **by domain** (feature), not by type:

```
# Good: organized by domain
samples/
├── models.py
├── schemas.py
├── api.py
├── services.py
└── tests/
    ├── test_api.py
    └── test_services.py

# Bad: organized by type
models/
    samples.py
    instruments.py
views/
    samples.py
    instruments.py
```

---

## Development Workflow

We follow a strict **TDD (Test-Driven Development)** workflow. Every feature or bug fix starts with a test.

### The Red-Green-Refactor Cycle

```
1. RED    — Write a failing test that describes the expected behavior
2. GREEN  — Write the minimal code to make the test pass
3. REFACTOR — Clean up the code while keeping all tests green
```

This may feel slow at first, but it catches bugs early and produces better-designed code.

---

## Test-Driven Development (TDD)

### Installing Test Dependencies

Make sure `pytest` and `pytest-django` are available. If not yet added to the project, install them:

```bash
uv add --dev pytest pytest-django pytest-cov
```

### Configuring pytest

Add to `pyproject.toml`:

```toml
[tool.pytest.ini_options]
DJANGO_SETTINGS_MODULE = "config.settings"
python_files = ["test_*.py"]
python_classes = ["Test*"]
python_functions = ["test_*"]
addopts = "--cov --cov-report=term-missing -v"
```

### Example: Adding a New Feature with TDD

Let's walk through adding a `GET /api/samples/` endpoint step by step.

#### Step 1: RED — Write the Failing Test

Create `samples/tests/test_api.py`:

```python
"""Tests for the Samples API endpoints."""

import pytest
from django.test import Client


@pytest.mark.django_db
class TestListSamples:
    """Tests for GET /api/samples/."""

    def test_returns_empty_list_when_no_samples(self, client: Client):
        """Should return an empty list when no samples exist."""
        response = client.get("/api/samples/")

        assert response.status_code == 200
        assert response.json() == {"items": []}

    def test_returns_all_samples(self, client: Client):
        """Should return all samples in the database."""
        # Arrange: create test data
        from samples.models import Sample

        Sample.objects.create(name="Sample A", status="pending")
        Sample.objects.create(name="Sample B", status="approved")

        # Act
        response = client.get("/api/samples/")

        # Assert
        data = response.json()
        assert response.status_code == 200
        assert len(data["items"]) == 2
        assert data["items"][0]["name"] == "Sample A"
```

Run the test — it **should fail** (RED):

```bash
uv run pytest samples/tests/test_api.py -v
```

#### Step 2: GREEN — Write Minimal Code to Pass

Create the model in `samples/models.py`:

```python
"""Sample models for the LIMS system."""

from django.db import models


class Sample(models.Model):
    """Represents a laboratory sample."""

    name = models.CharField(max_length=255)
    status = models.CharField(max_length=50, default="pending")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.name
```

Create the schema in `samples/schemas.py`:

```python
"""Pydantic schemas for Sample serialization."""

from datetime import datetime

from ninja import Schema


class SampleOut(Schema):
    """Output schema for a Sample."""

    id: int
    name: str
    status: str
    created_at: datetime


class SampleListOut(Schema):
    """Output schema for a list of Samples."""

    items: list[SampleOut]
```

Create the API endpoint in `samples/api.py`:

```python
"""API endpoints for Samples."""

from ninja import Router

from samples.models import Sample
from samples.schemas import SampleListOut, SampleOut

router = Router(tags=["Samples"])


@router.get("/", response=SampleListOut)
def list_samples(request):
    """Return all samples."""
    samples = Sample.objects.all()
    return {"items": list(samples)}
```

Register the router in `api/router.py`:

```python
from ninja import NinjaAPI

from samples.api import router as samples_router

api = NinjaAPI(
    title="LIMS API",
    version="1.0.0",
    description="Laboratory Information Management System API",
)

api.add_router("/samples/", samples_router)


@api.get("/health", tags=["System"])
def health_check(request):
    return {"status": "ok"}
```

Run migrations and then the test — it **should pass** (GREEN):

```bash
uv run python manage.py makemigrations samples
uv run python manage.py migrate
uv run pytest samples/tests/test_api.py -v
```

#### Step 3: REFACTOR — Improve Without Breaking Tests

Now clean up: extract shared test fixtures, add docstrings, simplify logic — but run the tests after every change to make sure nothing breaks.

### Running Tests

```bash
# Run all tests
uv run pytest

# Run tests for a specific app
uv run pytest samples/

# Run with coverage report
uv run pytest --cov --cov-report=term-missing

# Run a single test
uv run pytest samples/tests/test_api.py::TestListSamples::test_returns_empty_list_when_no_samples
```

### Coverage Requirement

We aim for **80%+ test coverage**. The CI pipeline will report coverage on every pull request.

---

## Django Ninja Conventions

### Router Organization

Each Django app has its own `api.py` with a `Router`, registered in `api/router.py`:

```python
# samples/api.py
from ninja import Router

router = Router(tags=["Samples"])

@router.get("/")
def list_samples(request):
    ...

# api/router.py
from samples.api import router as samples_router
api.add_router("/samples/", samples_router)
```

### Schemas (Input/Output Validation)

Use Ninja's `Schema` (built on Pydantic) for all request and response data:

```python
from ninja import Schema


class SampleIn(Schema):
    """Input schema for creating a Sample."""

    name: str
    status: str = "pending"


class SampleOut(Schema):
    """Output schema for a Sample."""

    id: int
    name: str
    status: str
```

- **Always** define separate `In` and `Out` schemas (even if they look similar now).
- Use type annotations on every field.
- Add a docstring to every schema class.

### Error Handling

Return explicit error responses — never let exceptions bubble up unhandled:

```python
from django.shortcuts import get_object_or_404
from ninja import Router

router = Router()


@router.get("/{sample_id}", response={200: SampleOut, 404: ErrorOut})
def get_sample(request, sample_id: int):
    """Retrieve a single sample by ID."""
    sample = get_object_or_404(Sample, id=sample_id)
    return sample
```

### Path Parameters and Query Filters

```python
from ninja import Query, Schema


class SampleFilter(Schema):
    """Query parameters for filtering samples."""

    status: str | None = None
    search: str | None = None


@router.get("/", response=SampleListOut)
def list_samples(request, filters: Query[SampleFilter]):
    """List samples with optional filters."""
    qs = Sample.objects.all()
    if filters.status:
        qs = qs.filter(status=filters.status)
    if filters.search:
        qs = qs.filter(name__icontains=filters.search)
    return {"items": list(qs)}
```

---

## Code Style

### General Rules

- Write **docstrings in English** for all modules, classes, and public functions.
- Write **comments in English**.
- Use **type hints** everywhere.
- Keep functions under **50 lines**.
- Keep files under **800 lines** — split into smaller modules if needed.

### Docstring Format

We use Google-style docstrings:

```python
def create_sample(name: str, status: str = "pending") -> Sample:
    """Create a new sample with the given name.

    Args:
        name: The display name for the sample.
        status: Initial status. Defaults to "pending".

    Returns:
        The newly created Sample instance.

    Raises:
        ValidationError: If the name is empty.
    """
    ...
```

### Immutability

Prefer creating new objects over mutating existing ones:

```python
# Good: return a new dict
def with_status(sample_data: dict, status: str) -> dict:
    """Return a copy of sample_data with the status updated."""
    return {**sample_data, "status": status}

# Bad: mutate in place
def set_status(sample_data: dict, status: str) -> None:
    sample_data["status"] = status  # Side effect!
```

### Linting and Formatting

We recommend using [Ruff](https://docs.astral.sh/ruff/) for both linting and formatting:

```bash
# Install as dev dependency
uv add --dev ruff

# Format code
uv run ruff format .

# Lint code
uv run ruff check .

# Lint and auto-fix
uv run ruff check --fix .
```

---

## Git Workflow

### Branch Naming

```
feat/short-description     # New features
fix/short-description      # Bug fixes
refactor/short-description # Refactoring
docs/short-description     # Documentation
test/short-description     # Test additions
```

### Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>: <description>

<optional body>
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`

Examples:

```
feat: add sample listing endpoint
fix: handle empty query string in sample filter
test: add integration tests for sample creation
docs: update contributing guide with TDD examples
```

### Pull Request Process

1. Create a feature branch from `main`.
2. Follow the TDD workflow (write tests first!).
3. Make sure all tests pass: `uv run pytest`
4. Push your branch and open a PR against `main`.
5. Fill in the PR template with a summary and test plan.
6. Request a review from at least one team member.

---

## Quick Reference

| Task | Command |
|------|---------|
| Install dependencies | `uv sync` |
| Run dev server | `uv run python manage.py runserver` |
| Run all tests | `uv run pytest` |
| Run tests with coverage | `uv run pytest --cov` |
| Create migrations | `uv run python manage.py makemigrations` |
| Apply migrations | `uv run python manage.py migrate` |
| Format code | `uv run ruff format .` |
| Lint code | `uv run ruff check .` |
| API docs | `http://localhost:8000/api/docs` |
