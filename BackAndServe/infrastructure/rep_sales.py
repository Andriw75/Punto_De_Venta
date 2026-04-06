import json
from datetime import datetime, timezone

from domain.sales import (
    SaleCreate,
    SaleItemCreate,
    SaleItemResponse,
    SaleItemUpdate,
    SaleResponse,
    SaleUpdate,
)
from infrastructure.db import SQLiteDB


class RepSales:
    entity_type = "SALE"

    def __init__(self, db: SQLiteDB):
        self.db = db

    @staticmethod
    def _normalize_datetime(value: datetime | None) -> str | None:
        if value is None:
            return None

        if value.tzinfo is not None:
            value = value.astimezone(timezone.utc).replace(tzinfo=None)

        return value.strftime("%Y-%m-%d %H:%M:%S")

    async def list_sales(
        self,
        offset: int = 0,
        limit: int = 15,
        start_time: datetime | None = None,
        end_time: datetime | None = None,
    ) -> list[SaleResponse]:
        start_str = self._normalize_datetime(start_time)
        end_str = self._normalize_datetime(end_time)

        async with self.db.acquire() as conn:
            cursor = await conn.execute(
                """
                SELECT id, username, sale_date, data, payment_method_id
                FROM sales
                WHERE (? IS NULL OR sale_date >= ?)
                  AND (? IS NULL OR sale_date <= ?)
                ORDER BY sale_date DESC, id DESC
                LIMIT ? OFFSET ?
                """,
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

        return [self._row_to_sale(row) for row in rows]

    async def count_sales(
        self,
        start_time: datetime | None = None,
        end_time: datetime | None = None,
    ) -> int:
        start_str = self._normalize_datetime(start_time)
        end_str = self._normalize_datetime(end_time)

        async with self.db.acquire() as conn:
            cursor = await conn.execute(
                """
                SELECT COUNT(*) AS total
                FROM sales
                WHERE (? IS NULL OR sale_date >= ?)
                  AND (? IS NULL OR sale_date <= ?)
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

    def _row_to_sale(self, row) -> SaleResponse:
        data = json.loads(row["data"]) if row["data"] else {}
        products = data.get("products", [])

        sale_items = [
            SaleItemResponse(
                product_id=item["product_id"],
                snapshot_id=item["snapshot_id"],
                name=item["name"],
                unit_price=item["unit_price"],
                quantity=item["quantity"],
            )
            for item in products
        ]

        return SaleResponse(
            id=row["id"],
            username=row["username"],
            sale_date=datetime.fromisoformat(row["sale_date"]),
            products=sale_items,
            total_charged=data.get("total_charged", 0),
            payment_method_id=row["payment_method_id"],
        )

    async def _payment_method_exists(self, conn, payment_method_id: int) -> bool:
        cursor = await conn.execute(
            """
            SELECT id
            FROM payment_methods
            WHERE id = ?
            """,
            (payment_method_id,),
        )
        return await cursor.fetchone() is not None

    async def _get_current_snapshot(self, conn, product_id: int):
        cursor = await conn.execute(
            """
            SELECT id, name, price, category_id, stock
            FROM product_snapshot
            WHERE product_id = ?
              AND valid_to IS NULL
            """,
            (product_id,),
        )
        row = await cursor.fetchone()
        if row is None:
            raise ValueError(f"Producto {product_id} no tiene snapshot válido")
        return row

    async def _adjust_stock(self, conn, product_id: int, delta: int):
        current = await self._get_current_snapshot(conn, product_id)
        new_stock = current["stock"] + delta
        if new_stock < 0:
            raise ValueError(f"Stock insuficiente para {current['name']}")

        await conn.execute(
            """
            UPDATE product_snapshot
            SET valid_to = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (current["id"],),
        )

        await conn.execute(
            """
            INSERT INTO product_snapshot
            (product_id, name, price, category_id, stock, valid_from)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            """,
            (
                product_id,
                current["name"],
                current["price"],
                current["category_id"],
                new_stock,
            ),
        )

        return current

    async def _build_sale_items_and_discount(
        self,
        conn,
        products: list[SaleItemCreate] | list[SaleItemUpdate],
    ) -> list[dict]:
        sale_items: list[dict] = []

        for item in products:
            current = await self._adjust_stock(conn, item.product_id, -item.quantity)
            sale_items.append(
                {
                    "product_id": item.product_id,
                    "snapshot_id": current["id"],
                    "name": current["name"],
                    "unit_price": current["price"],
                    "quantity": item.quantity,
                }
            )

        return sale_items

    async def _restore_sale_stock(self, conn, before_data: dict):
        for item in before_data.get("products", []):
            await self._adjust_stock(conn, item["product_id"], item["quantity"])

    async def insert(
        self,
        sale: SaleCreate,
        actor: str = "",
        description: str | None = None,
    ) -> bool:
        async with self.db.transaction() as conn:
            pm_exists = await self._payment_method_exists(conn, sale.payment_method_id)
            if not pm_exists:
                raise ValueError(f"Método de pago {sale.payment_method_id} no existe")

            sale_items = await self._build_sale_items_and_discount(conn, sale.products)

            data_after = {
                "products": sale_items,
                "total_charged": sale.total_charged,
                "payment_method_id": sale.payment_method_id,
            }

            cursor = await conn.execute(
                """
                INSERT INTO sales (sale_date, username, data, payment_method_id)
                VALUES (CURRENT_TIMESTAMP, ?, ?, ?)
                """,
                (
                    actor,
                    json.dumps(data_after),
                    sale.payment_method_id,
                )
            )
            sale_id = cursor.lastrowid

            await SQLiteDB.insert_audit(
                conn,
                actor,
                "INSERT",
                self.entity_type,
                sale_id,
                None,
                data_after,
                description,
            )

        return True

    async def update(
        self,
        sale_id: int,
        sale: SaleUpdate,
        actor: str = "",
        description: str | None = None,
        restore_products: bool = False,
    ) -> bool:
        async with self.db.transaction() as conn:
            cursor = await conn.execute(
                """
                SELECT data, payment_method_id
                FROM sales
                WHERE id = ?
                """,
                (sale_id,),
            )
            row = await cursor.fetchone()
            if not row:
                return False

            before_data = json.loads(row["data"]) if row["data"] else {}
            before_pm_id = row["payment_method_id"]

            if restore_products and sale.products is None:
                raise ValueError("'restore_products' requiere enviar 'products'")

            if sale.products is not None and not restore_products:
                raise ValueError("Para actualizar productos debe activar 'restore_products'")

            new_pm_id = (
                sale.payment_method_id
                if sale.payment_method_id is not None
                else before_pm_id
            )

            if new_pm_id != before_pm_id:
                pm_exists = await self._payment_method_exists(conn, new_pm_id)
                if not pm_exists:
                    raise ValueError(f"Método de pago {new_pm_id} no existe")

            if restore_products:
                await self._restore_sale_stock(conn, before_data)

            if sale.products is not None:
                new_sale_items = await self._build_sale_items_and_discount(conn, sale.products)
            else:
                new_sale_items = before_data.get("products", [])

            new_data = {
                "products": new_sale_items,
                "total_charged": (
                    sale.total_charged
                    if sale.total_charged is not None
                    else before_data.get("total_charged", 0)
                ),
                "payment_method_id": new_pm_id,
            }

            await conn.execute(
                """
                UPDATE sales
                SET data = ?, payment_method_id = ?
                WHERE id = ?
                """,
                (json.dumps(new_data), new_pm_id, sale_id),
            )

            await SQLiteDB.insert_audit(
                conn,
                actor,
                "UPDATE",
                self.entity_type,
                sale_id,
                {**before_data, "payment_method_id": before_pm_id},
                {**new_data, "payment_method_id": new_pm_id},
                description,
            )

        return True

    async def delete(
        self,
        sale_id: int,
        actor: str = "",
        description: str | None = None,
        restore_products: bool = False,
    ) -> bool:
        async with self.db.transaction() as conn:
            cursor = await conn.execute(
                """
                SELECT data
                FROM sales
                WHERE id = ?
                """,
                (sale_id,),
            )
            row = await cursor.fetchone()
            if not row:
                return False

            before = json.loads(row["data"]) if row["data"] else {}

            if restore_products:
                await self._restore_sale_stock(conn, before)

            await conn.execute(
                """
                DELETE FROM sales
                WHERE id = ?
                """,
                (sale_id,),
            )

            await SQLiteDB.insert_audit(
                conn,
                actor,
                "DELETE",
                self.entity_type,
                sale_id,
                before,
                None,
                description,
            )

        return True

    async def migrate_payment_method(
        self,
        origin_id: int,
        target_id: int,
        actor: str = "",
        description: str | None = None,
    ) -> int:
        async with self.db.transaction() as conn:
            cursor = await conn.execute(
                """
                SELECT id, data
                FROM sales
                WHERE payment_method_id = ?
                """,
                (origin_id,),
            )
            rows = await cursor.fetchall()

            if not rows:
                return 0

            ids = [row["id"] for row in rows]

            placeholders = ",".join("?" for _ in ids)
            await conn.execute(
                f"UPDATE sales SET payment_method_id = ? WHERE id IN ({placeholders})",
                (target_id, *ids),
            )

            for row in rows:
                data = json.loads(row["data"]) if row["data"] else {}
                data["payment_method_id"] = target_id
                await conn.execute(
                    """
                    UPDATE sales
                    SET data = ?
                    WHERE id = ?
                    """,
                    (json.dumps(data), row["id"]),
                )

            await SQLiteDB.insert_audit(
                conn,
                actor,
                "MIGRATE",
                "PAYMENT_METHOD",
                origin_id,
                {
                    "origin_id": origin_id,
                    "target_id": target_id,
                    "sale_ids": ids,
                },
                {"affected_sales": len(ids)},
                description or f"Migración de método de pago {origin_id} -> {target_id}",
            )

        return len(ids)
