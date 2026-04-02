
import json
from fastapi import HTTPException, status
from domain.users import UserCreate, UserUpdate, UserDb, UserAdmin
from infrastructure.db import SQLiteDB

class RepUsers:

    def __init__(self, db: SQLiteDB):
        self.entity_type = "USER"
        self.db = db

    async def get_all_users(self) -> list[UserAdmin]:
        async with self.db.acquire() as conn:
            cursor = await conn.execute(
                """
                SELECT id, username AS name, permissions
                FROM "User"
                """
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
