import json
from datetime import datetime, timezone

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

    async def list_audit(
        self,
        offset: int = 0,
        limit: int = 20,
        start_time: datetime | None = None,
        end_time: datetime | None = None,
        username: str | None = None,
        entity_type: AuditEntityType | None = None,
        action_type: AuditActionType | None = None,
    ) -> list[AuditLogResponse]:
        start_str = self._normalize_datetime(start_time)
        end_str = self._normalize_datetime(end_time)
        entity_value = entity_type.value if entity_type else None
        action_value = action_type.value if action_type else None

        async with self.db.acquire() as conn:
            cursor = await conn.execute(
                """
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
                WHERE (? IS NULL OR created_at >= ?)
                  AND (? IS NULL OR created_at <= ?)
                  AND (? IS NULL OR username = ?)
                  AND (? IS NULL OR entity_type = ?)
                  AND (? IS NULL OR action_type = ?)
                ORDER BY created_at DESC, id DESC
                LIMIT ? OFFSET ?
                """,
                (
                    start_str,
                    start_str,
                    end_str,
                    end_str,
                    username,
                    username,
                    entity_value,
                    entity_value,
                    action_value,
                    action_value,
                    limit,
                    offset,
                ),
            )
            rows = await cursor.fetchall()

        return [self._row_to_audit(row) for row in rows]

    async def count_audit(
        self,
        start_time: datetime | None = None,
        end_time: datetime | None = None,
        username: str | None = None,
        entity_type: AuditEntityType | None = None,
        action_type: AuditActionType | None = None,
    ) -> int:
        start_str = self._normalize_datetime(start_time)
        end_str = self._normalize_datetime(end_time)
        entity_value = entity_type.value if entity_type else None
        action_value = action_type.value if action_type else None

        async with self.db.acquire() as conn:
            cursor = await conn.execute(
                """
                SELECT COUNT(*) AS total
                FROM audit_log
                WHERE (? IS NULL OR created_at >= ?)
                  AND (? IS NULL OR created_at <= ?)
                  AND (? IS NULL OR username = ?)
                  AND (? IS NULL OR entity_type = ?)
                  AND (? IS NULL OR action_type = ?)
                """,
                (
                    start_str,
                    start_str,
                    end_str,
                    end_str,
                    username,
                    username,
                    entity_value,
                    entity_value,
                    action_value,
                    action_value,
                ),
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
