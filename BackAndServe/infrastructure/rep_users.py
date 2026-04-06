import json
from datetime import datetime, timezone
from aiosqlite import IntegrityError
from fastapi import HTTPException, status
from domain.users import UserCreate, UserUpdate, UserDb, UserAdmin
from infrastructure.db import SQLiteDB


class RepUsers:

    def __init__(self, db: SQLiteDB):
        self.entity_type = "USER"
        self.db = db

    @staticmethod
    def _normalize_datetime(value: datetime | None) -> str | None:
        if value is None:
            return None

        if value.tzinfo is not None:
            value = value.astimezone(timezone.utc).replace(tzinfo=None)

        return value.strftime("%Y-%m-%d %H:%M:%S")

    async def list_users_len(
        self,
        start_time: datetime | None = None,
        end_time: datetime | None = None,
    ) -> int:
        start_str = self._normalize_datetime(start_time)
        end_str = self._normalize_datetime(end_time)

        async with self.db.acquire() as conn:
            cursor = await conn.execute(
                """
                WITH user_created AS (
                    SELECT entity_id, MIN(created_at) AS created_at
                    FROM audit_log
                    WHERE entity_type = 'USER' AND action_type = 'INSERT'
                    GROUP BY entity_id
                )
                SELECT COUNT(*) AS total
                FROM "User" u
                LEFT JOIN user_created uc ON uc.entity_id = CAST(u.id AS TEXT)
                WHERE (? IS NULL OR uc.created_at >= ?)
                  AND (? IS NULL OR uc.created_at <= ?)
                """,
                (
                    start_str,
                    start_str,
                    end_str,
                    end_str,
                )
            )

            row = await cursor.fetchone()
            return int(row["total"]) if row else 0

    async def list_users(
        self,
        offset: int = 0,
        limit: int = 100,
        start_time: datetime | None = None,
        end_time: datetime | None = None,
    ) -> list[UserAdmin]:
        start_str = self._normalize_datetime(start_time)
        end_str = self._normalize_datetime(end_time)

        async with self.db.acquire() as conn:
            cursor = await conn.execute(
                """
                WITH user_created AS (
                    SELECT entity_id, MIN(created_at) AS created_at
                    FROM audit_log
                    WHERE entity_type = 'USER' AND action_type = 'INSERT'
                    GROUP BY entity_id
                )
                SELECT u.id, u.username AS name, u.permissions
                FROM "User" u
                LEFT JOIN user_created uc ON uc.entity_id = CAST(u.id AS TEXT)
                WHERE (? IS NULL OR uc.created_at >= ?)
                  AND (? IS NULL OR uc.created_at <= ?)
                ORDER BY u.id DESC
                LIMIT ? OFFSET ?
                """
                ,
                (
                    start_str,
                    start_str,
                    end_str,
                    end_str,
                    limit,
                    offset,
                )
            )
            rows = await cursor.fetchall()

            users: list[UserAdmin] = []
            for row in rows:
                data = dict(row)
                data["permissions"] = json.loads(data["permissions"])
                users.append(UserAdmin.model_validate(data))

            return users

    async def get_user(self, user_name: str) -> UserDb | None:
        async with self.db.acquire() as conn:
            cursor = await conn.execute(
                """
                SELECT id, username AS name, password, permissions
                FROM "User"
                WHERE username = ?
                """,
                (user_name,)
            )
            row = await cursor.fetchone()
            if row is None:
                return None
            data = dict(row)
            data["permissions"] = json.loads(data["permissions"])
            return UserDb.model_validate(data)

    async def create_user(
        self,
        user: UserCreate,
        actor: str,
        description: str | None = None
    ) -> int:
        async with self.db.transaction() as conn:
            try:
                cursor = await conn.execute(
                    """
                    INSERT INTO "User" (username, password, permissions)
                    VALUES (?, ?, ?)
                    """,
                    (user.name, user.password, json.dumps(user.permissions))
                )
                user_id = cursor.lastrowid

                await self.db.insert_audit(
                    conn,
                    actor,
                    "INSERT",
                    self.entity_type,
                    user_id,
                    None,
                    {"username": user.name, "permissions": user.permissions},
                    description
                )

                return user_id
            except IntegrityError as e:
                if "UNIQUE constraint failed: User.username" in str(e):
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="El usuario ya existe",
                    )
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Error de integridad en base de datos",
                )

    async def update_user(
        self,
        user_id: int,
        user: UserUpdate,
        actor: str,
        description: str | None = None
    ):
        async with self.db.transaction() as conn:
            cursor = await conn.execute(
                "SELECT username, permissions FROM 'User' WHERE id = ?",
                (user_id,)
            )
            row = await cursor.fetchone()
            if row is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

            before = dict(row)
            before["permissions"] = json.loads(before["permissions"])

            fields = []
            values = []

            if user.name is not None:
                fields.append("username = ?")
                values.append(user.name)
            if user.password is not None:
                fields.append("password = ?")
                values.append(user.password)
            if user.permissions is not None:
                fields.append("permissions = ?")
                values.append(json.dumps(user.permissions))

            if not fields:
                return

            values.append(user_id)
            query = f"UPDATE 'User' SET {', '.join(fields)} WHERE id = ?"
            await conn.execute(query, values)

            after = {
                "username": user.name if user.name else before["username"],
                "permissions": user.permissions if user.permissions else before["permissions"]
            }

            await self.db.insert_audit(
                conn,
                actor,
                "UPDATE",
                self.entity_type,
                user_id,
                before,
                after,
                description
            )

    async def delete_user(
        self,
        user_id: int,
        actor: str,
        description: str | None = None
    ):
        async with self.db.transaction() as conn:
            cursor = await conn.execute(
                "SELECT username, permissions FROM 'User' WHERE id = ?",
                (user_id,)
            )
            row = await cursor.fetchone()
            if row is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

            before = dict(row)
            before["permissions"] = json.loads(before["permissions"])

            await conn.execute("DELETE FROM 'User' WHERE id = ?", (user_id,))

            await self.db.insert_audit(
                conn,
                actor,
                "DELETE",
                self.entity_type,
                user_id,
                before,
                None,
                description
            )
