"""Tests for the export_openapi management command."""

from __future__ import annotations

import json
from io import StringIO
from pathlib import Path

import pytest
from django.core.management import call_command


@pytest.mark.django_db
def test_export_openapi_writes_valid_schema(tmp_path: Path) -> None:
    output = tmp_path / "openapi.json"
    stdout = StringIO()

    call_command("export_openapi", f"--output={output}", stdout=stdout)

    assert output.exists(), "command should write the spec to --output"
    schema = json.loads(output.read_text(encoding="utf-8"))
    assert schema["openapi"].startswith("3."), "should be an OpenAPI 3.x document"
    assert "components" in schema, "should include component schemas"
    assert "paths" in schema and schema["paths"], "should include at least one route"
    assert f"Wrote {output}" in stdout.getvalue()
