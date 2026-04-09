import json
from datetime import datetime, timezone
from typing import Sequence

from domain.audit import (
    AuditActionType,
    AuditChanges,
    AuditEntityType,
    AuditLogResponse,
)
from infrastructure.db import SQLiteDB


class RepAudit:
    def __init__(self, db: SQLiteDB):
        self.db = db

    @staticmethod
    def _normalize_datetime(value: datetime | None) -> str | None:
        if value is None:
            return None

        if value.tzinfo is not None:
            value = value.astimezone(timezone.utc).replace(tzinfo=None)

        return value.strftime("%Y-%m-%d %H:%M:%S")

    @staticmethod
    def _parse_changes(raw: str | None) -> AuditChanges:
        if not raw:
            return AuditChanges()
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                return AuditChanges.model_validate(parsed)
        except Exception:
            pass
        return AuditChanges()

    @staticmethod
    def _row_to_audit(row) -> AuditLogResponse:
        return AuditLogResponse(
            id=row["id"],
            username=row["username"],
            description=row["description"],
            action_type=AuditActionType(row["action_type"]),
            entity_type=AuditEntityType(row["entity_type"]),
            entity_id=row["entity_id"],
            changes=RepAudit._parse_changes(row["changes"]),
            created_at=datetime.fromisoformat(row["created_at"]),
        )

    @staticmethod
    def _normalize_text_filters(values: Sequence[str] | None) -> list[str]:
        if not values:
            return []
        clean = [value.strip() for value in values if value and value.strip()]
        return list(dict.fromkeys(clean))

    @staticmethod
    def _build_in_clause(column: str, values: Sequence[str]) -> tuple[str, list[str]]:
        placeholders = ", ".join(["?"] * len(values))
        return f"{column} IN ({placeholders})", list(values)

    def _build_where_clause(
        self,
        start_time: datetime | None,
        end_time: datetime | None,
        usernames: Sequence[str] | None,
        entity_types: Sequence[AuditEntityType] | None,
        action_types: Sequence[AuditActionType] | None,
    ) -> tuple[str, list]:
        clauses: list[str] = []
        params: list = []

        start_str = self._normalize_datetime(start_time)
        if start_str is not None:
            clauses.append("created_at >= ?")
            params.append(start_str)

        end_str = self._normalize_datetime(end_time)
        if end_str is not None:
            clauses.append("created_at <= ?")
            params.append(end_str)

        clean_usernames = self._normalize_text_filters(usernames)
        if clean_usernames:
            clause, values = self._build_in_clause("username", clean_usernames)
            clauses.append(clause)
            params.extend(values)

        entity_values = [item.value for item in (entity_types or [])]
        if entity_values:
            clause, values = self._build_in_clause("entity_type", entity_values)
            clauses.append(clause)
            params.extend(values)

        action_values = [item.value for item in (action_types or [])]
        if action_values:
            clause, values = self._build_in_clause("action_type", action_values)
            clauses.append(clause)
            params.extend(values)

        if not clauses:
            return "", params

        return "WHERE " + " AND ".join(clauses), params

    async def list_audit(
        self,
        offset: int = 0,
        limit: int = 20,
        start_time: datetime | None = None,
        end_time: datetime | None = None,
        usernames: Sequence[str] | None = None,
        entity_types: Sequence[AuditEntityType] | None = None,
        action_types: Sequence[AuditActionType] | None = None,
    ) -> list[AuditLogResponse]:
        where_clause, params = self._build_where_clause(
            start_time=start_time,
            end_time=end_time,
            usernames=usernames,
            entity_types=entity_types,
            action_types=action_types,
        )

        async with self.db.acquire() as conn:
            cursor = await conn.execute(
                f"""
                SELECT
                    id,
                    username,
                    description,
                    action_type,
                    entity_type,
                    entity_id,
                    changes,
                    created_at
                FROM audit_log
                {where_clause}
                ORDER BY created_at DESC, id DESC
                LIMIT ? OFFSET ?
                """,
                [*params, limit, offset],
            )
            rows = await cursor.fetchall()

        return [self._row_to_audit(row) for row in rows]

    async def count_audit(
        self,
        start_time: datetime | None = None,
        end_time: datetime | None = None,
        usernames: Sequence[str] | None = None,
        entity_types: Sequence[AuditEntityType] | None = None,
        action_types: Sequence[AuditActionType] | None = None,
    ) -> int:
        where_clause, params = self._build_where_clause(
            start_time=start_time,
            end_time=end_time,
            usernames=usernames,
            entity_types=entity_types,
            action_types=action_types,
        )

        async with self.db.acquire() as conn:
            cursor = await conn.execute(
                f"""
                SELECT COUNT(*) AS total
                FROM audit_log
                {where_clause}
                """,
                params,
            )
            row = await cursor.fetchone()
            return int(row["total"]) if row else 0

    async def list_usernames(self) -> list[str]:
        async with self.db.acquire() as conn:
            cursor = await conn.execute(
                """
                SELECT DISTINCT username
                FROM audit_log
                WHERE username IS NOT NULL
                  AND TRIM(username) <> ''
                ORDER BY username COLLATE NOCASE ASC
                """
            )
            rows = await cursor.fetchall()
            return [row["username"] for row in rows]
