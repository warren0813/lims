# syntax=docker/dockerfile:1.7

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/app/.venv \
    PATH="/app/.venv/bin:$PATH"

COPY --from=ghcr.io/astral-sh/uv:0.9 /uv /uvx /usr/local/bin/

WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY . .

RUN uv sync --frozen --no-dev

RUN sed -i 's/\r$//' /app/docker-start.sh \  
    && chmod +x /app/docker-start.sh

RUN DJANGO_SECRET_KEY=build-only-key \
    DEBUG=False \
    python manage.py collectstatic --noinput

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD python -c "import os, urllib.request; port=os.environ.get('PORT', '8000'); host=os.environ.get('RAILWAY_PUBLIC_DOMAIN') or 'localhost'; req=urllib.request.Request(f'http://127.0.0.1:{port}/api/health', headers={'Host': host}); urllib.request.urlopen(req, timeout=3).read()" || exit 1

CMD ["/app/docker-start.sh"]
