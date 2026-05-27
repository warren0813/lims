"""Ninja schemas for the experiments app."""

from datetime import datetime

from ninja import Field, Schema

from apps.experiments.models import LabCategory


class ExperimentTypeIn(Schema):
    """Input schema for creating an experiment type."""

    name: str = Field(..., min_length=1, max_length=200)
    description: str = ""
    lab_category: LabCategory


class ExperimentTypeUpdate(Schema):
    """Input schema for partially updating an experiment type."""

    name: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = None
    lab_category: LabCategory | None = None


class ExperimentTypeOut(Schema):
    """Output schema for experiment type responses."""

    id: int
    name: str
    description: str
    lab_category: LabCategory
    is_active: bool
    created_at: datetime
    updated_at: datetime
