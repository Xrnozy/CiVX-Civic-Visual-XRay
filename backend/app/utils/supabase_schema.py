"""Helpers when optional DB columns (migration 011) are not applied yet."""

from __future__ import annotations

from typing import Any

ADDRESS_EXTENSION_FIELDS = ("street", "city", "province")


def strip_address_extension_fields(row: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in row.items() if key not in ADDRESS_EXTENSION_FIELDS}


def is_missing_address_columns_error(exc: BaseException) -> bool:
    message = str(exc).lower()
    if "pgrst204" not in message and "could not find the" not in message:
        return False
    return any(field in message for field in ADDRESS_EXTENSION_FIELDS)


def insert_row(sb, table: str, payload: dict[str, Any]) -> dict[str, Any]:
    try:
        result = sb.table(table).insert(payload).execute()
    except Exception as exc:
        if not is_missing_address_columns_error(exc):
            raise
        result = sb.table(table).insert(strip_address_extension_fields(payload)).execute()
    rows = result.data or []
    if not rows:
        raise RuntimeError(f"Insert into {table} returned no rows")
    return rows[0]


def update_row(sb, table: str, payload: dict[str, Any], **filters: Any) -> None:
    query = sb.table(table).update(payload)
    for key, value in filters.items():
        query = query.eq(key, value)
    try:
        query.execute()
    except Exception as exc:
        if not is_missing_address_columns_error(exc):
            raise
        fallback = strip_address_extension_fields(payload)
        if not fallback:
            return
        retry = sb.table(table).update(fallback)
        for key, value in filters.items():
            retry = retry.eq(key, value)
        retry.execute()
