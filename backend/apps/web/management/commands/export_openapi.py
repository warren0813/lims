"""Export the LIMS OpenAPI 3.1 schema as a JSON file.

Used by the frontend to regenerate `frontend/lib/api/types.gen.ts` via
`openapi-typescript`. The schema is the contract; this command makes it
explicit and reproducible.

    uv run python manage.py export_openapi

Writes to ``backend/openapi.json`` by default. Pass ``--output PATH`` to
override.
"""

from __future__ import annotations

import json
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandParser

from api.router import api


class Command(BaseCommand):
    help = "Export the LIMS OpenAPI 3.1 schema to backend/openapi.json."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument(
            "--output",
            type=Path,
            default=None,
            help="Output path (defaults to backend/openapi.json).",
        )

    def handle(self, *_: object, **options: object) -> None:
        output: Path = options["output"] or Path(settings.BASE_DIR) / "openapi.json"
        schema = api.get_openapi_schema()
        payload = (
            json.dumps(schema, indent=2, ensure_ascii=False, sort_keys=True) + "\n"
        )
        output.write_text(payload, encoding="utf-8")
        self.stdout.write(
            self.style.SUCCESS(f"Wrote {output} ({len(payload):,} bytes)")
        )
