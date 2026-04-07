from aiosqlite import IntegrityError
from fastapi import HTTPException, status

from domain.payment_methods import (
    PaymentMethodCreate,
    PaymentMethodResponse,
    PaymentMethodUpdate,
)
from infrastructure.db import SQLiteDB
from infrastructure.utils import CachedRepository


class RepPaymentMethods(CachedRepository[PaymentMethodResponse]):
    def __init__(self, db: SQLiteDB, is_cache: bool):
        super().__init__(is_cache=is_cache)
        self.entity_type = "PAYMENT_METHOD"
        self.db = db

    async def list_all(self) -> list[PaymentMethodResponse]:
        async with self.db.acquire() as conn:
            cursor = await conn.execute(
                """
                SELECT id, name
                FROM payment_methods
                ORDER BY name
                """
            )
            rows = await cursor.fetchall()
            return [PaymentMethodResponse.model_validate(dict(row)) for row in rows]

    async def insert(self, actor: str, method: PaymentMethodCreate) -> bool:
        try:
            async with self.db.transaction() as conn:
                cursor = await conn.execute(
                    """
                    INSERT INTO payment_methods (name)
                    VALUES (?)
                    """,
                    (method.name,)
                )
                method_id = cursor.lastrowid

                await SQLiteDB.insert_audit(
                    conn,
                    actor,
                    "INSERT",
                    self.entity_type,
                    method_id,
                    None,
                    method.model_dump(),
                    "",
                )
        except IntegrityError as i_e:
            if "UNIQUE constraint failed: payment_methods.name" in str(i_e):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="El método de pago ya existe",
                )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=str(i_e),
            )

        if self.is_cache:
            await self.refresh_cache()
        return True

    async def update(self, actor: str, method_id: int, method: PaymentMethodUpdate) -> bool:
        try:
            async with self.db.transaction() as conn:
                cursor = await conn.execute(
                    """
                    SELECT name
                    FROM payment_methods
                    WHERE id = ?
                    """,
                    (method_id,)
                )
                row = await cursor.fetchone()
                if not row:
                    return False

                before = dict(row)
                comentario = method.comentario or ""

                update_data = method.model_dump(exclude_unset=True, exclude={"comentario"})

                if not update_data:
                    return True

                if "name" in update_data:
                    await conn.execute(
                        """
                        UPDATE payment_methods
                        SET name = ?
                        WHERE id = ?
                        """,
                        (update_data["name"], method_id)
                    )

                await SQLiteDB.insert_audit(
                    conn,
                    actor,
                    "UPDATE",
                    self.entity_type,
                    method_id,
                    before,
                    {"name": update_data.get("name", before["name"])},
                    comentario,
                )
        except IntegrityError as i_e:
            if "UNIQUE constraint failed: payment_methods.name" in str(i_e):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="El método de pago ya existe",
                )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=str(i_e),
            )

        if self.is_cache:
            await self.refresh_cache()
        return True

    async def delete(
        self,
        actor: str,
        method_id: int,
        description: str | None = None,
    ) -> bool:
        async with self.db.transaction() as conn:
            cursor = await conn.execute(
                """
                SELECT COUNT(*) AS count
                FROM sales
                WHERE payment_method_id = ?
                """,
                (method_id,)
            )
            count_row = await cursor.fetchone()
            if count_row and count_row["count"] > 0:
                raise ValueError("No se puede eliminar: hay ventas que usan este método de pago")

            cursor = await conn.execute(
                """
                SELECT name
                FROM payment_methods
                WHERE id = ?
                """,
                (method_id,),
            )
            row = await cursor.fetchone()
            if not row:
                return False

            before = dict(row)

            await conn.execute(
                """
                DELETE FROM payment_methods
                WHERE id = ?
                """,
                (method_id,),
            )

            await SQLiteDB.insert_audit(
                conn,
                actor,
                "DELETE",
                self.entity_type,
                method_id,
                before,
                None,
                description or "",
            )

        if self.is_cache:
            await self.refresh_cache()
        return True
