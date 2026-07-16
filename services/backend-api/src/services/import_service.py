"""CSV import parsing and validation for customer bulk upload."""

import csv
import io
import json
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field, ValidationError


class ImportRow(BaseModel):
    email: str = Field(..., max_length=255)
    first_name: str | None = Field(None, max_length=100)
    last_name: str | None = Field(None, max_length=100)
    phone: str | None = Field(None, max_length=50)
    email_subscription_status: str = "subscribed"
    store_credit_pounds: str | None = None  # decimal string like "25.50"
    tags: str | None = None  # comma-separated like "VIP,holiday"


class ImportResult:
    def __init__(self) -> None:
        self.total = 0
        self.created = 0
        self.updated = 0
        self.errors: list[dict[str, Any]] = []

    def add_error(self, row: int, field: str, value: str, message: str) -> None:
        self.errors.append({"row": row, "field": field, "value": value, "message": message})


def parse_csv(content: str) -> list[dict[str, str]]:
    """Parse CSV string into a list of row dicts."""
    reader = csv.DictReader(io.StringIO(content))
    return [row for row in reader]


def validate_rows(rows: list[dict[str, str]], result: ImportResult) -> list[dict[str, Any]]:
    """Validate rows and transform types for DB insertion.
    Returns list of validated customer dicts ready for INSERT."""
    validated: list[dict[str, Any]] = []
    for idx, row in enumerate(rows, start=2):
        try:
            parsed = ImportRow(**row)
        except ValidationError as e:
            for err in e.errors():
                field = ".".join(err["loc"])
                result.add_error(idx, field, row.get(field, ""), err["msg"])
            continue

        tags_dict: dict[str, bool] = {}
        if parsed.tags:
            for tag in parsed.tags.split(","):
                t = tag.strip()
                if t:
                    tags_dict[t] = True

        store_credit = 0
        if parsed.store_credit_pounds:
            try:
                store_credit = round(float(parsed.store_credit_pounds) * 100)
            except ValueError:
                result.add_error(idx, "store_credit_pounds", parsed.store_credit_pounds, "Invalid decimal number")
                continue

        validated.append({
            "email": parsed.email,
            "first_name": parsed.first_name,
            "last_name": parsed.last_name,
            "phone": parsed.phone,
            "email_subscription_status": parsed.email_subscription_status,
            "store_credit": store_credit,
            "tags": json.dumps(tags_dict),
        })

    return validated
