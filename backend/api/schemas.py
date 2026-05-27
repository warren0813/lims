"""Shared Ninja schemas used across multiple apps."""

from ninja import Schema


class ErrorOut(Schema):
    """Output schema for error responses."""

    detail: str
