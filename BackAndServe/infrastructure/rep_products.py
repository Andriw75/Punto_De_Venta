from fastapi.exceptions import HTTPException
import json
from typing import Optional

from domain.products import ProductRealTime, ProductCreate, ProductUpdate
from infrastructure.db import SQLiteDB
from infrastructure.utils import CachedRepository


class RepProducts(CachedRepository[ProductRealTime]):
    """
    Repo de productos:
    - products: datos base
    - product_snapshot: estado versionado actual e historial
    """

    def __init__(self, db: SQLiteDB, is_cache: bool):
        super().__init__(is_cache=is_cache)
        self.entity_type = "PRODUCT"
        self.db = db

    def _parse_metadata(self, value):
        if not value:
            return None
        if isinstance(value, dict):
            return value
        return json.loads(value)

    def _row_to_product(self, row) -> ProductRealTime:
        data = dict(row)
        data["metadata"] = self._parse_metadata(data.get("metadata"))
        return ProductRealTime.model_validate(data)

    async def list_all(self) -> list[ProductRealTime]:
        async with self.db.acquire() as conn:
            cursor = await conn.execute(
                """
                SELECT
                    p.id,
                    ps.name,
                    p.description,
                    p.metadata,
                    p.barcode,
                    ps.stock,
                    ps.price,
                    ps.category_id
                FROM products p
                JOIN product_snapshot ps
                    ON ps.product_id = p.id
                WHERE ps.valid_to IS NULL
                ORDER BY ps.name
                """
            )
            rows = await cursor.fetchall()
            return [self._row_to_product(row) for row in rows]

    async def insert(
        self,
        product: ProductCreate,
        actor: str = "",
        description: Optional[str] = None
    ) -> bool:
        async with self.db.transaction() as conn:
            cursor = await conn.execute(
                """
                INSERT INTO products (description, metadata, barcode)
                VALUES (?, ?, ?)
                """,
                (
                    product.description,
                    json.dumps(product.metadata) if product.metadata is not None else None,
                    product.barcode,
                )
            )
            product_id = cursor.lastrowid

            await conn.execute(
                """
                INSERT INTO product_snapshot
                (product_id, name, price, category_id, stock, valid_from)
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                """,
                (
                    product_id,
                    product.name,
                    product.price,
                    product.category_id,
                    product.stock,
                )
            )

            await SQLiteDB.insert_audit(
                conn,
                actor,
                "INSERT",
                self.entity_type,
                product_id,
                None,
                {
                    "name": product.name,
                    "description": product.description,
                    "metadata": product.metadata,
                    "barcode": product.barcode,
                    "price": product.price,
                    "category_id": product.category_id,
                    "stock": product.stock,
                },
                description
            )

        if self.is_cache:
            await self.refresh_cache()

        return True

    async def update(
        self,
        product_id: int,
        product: ProductUpdate,
        actor: str = ""
    ) -> bool:
        async with self.db.transaction() as conn:
            cursor = await conn.execute(
                """
                SELECT
                    p.id,
                    p.description,
                    p.metadata,
                    p.barcode,
                    ps.id AS snapshot_id,
                    ps.name,
                    ps.price,
                    ps.category_id,
                    ps.stock
                FROM products p
                JOIN product_snapshot ps
                    ON ps.product_id = p.id
                WHERE p.id = ?
                  AND ps.valid_to IS NULL
                """,
                (product_id,)
            )
            row = await cursor.fetchone()
            if row is None:
                raise HTTPException(404, "Categoría no encontrada")

            before_row = dict(row)
            before_row["metadata"] = self._parse_metadata(before_row.get("metadata"))

            update_data = product.model_dump(exclude_unset=True)

            base_updates = {}
            snapshot_updates = {}

            for field in ("description", "metadata", "barcode"):
                if field in update_data:
                    base_updates[field] = update_data[field]

            for field in ("name", "price", "category_id", "stock"):
                if field in update_data:
                    snapshot_updates[field] = update_data[field]

            if not base_updates and not snapshot_updates:
                return True

            # Validación manual para campos del snapshot que no deberían ser NULL
            for field in ("name", "price", "stock"):
                if field in snapshot_updates and snapshot_updates[field] is None:
                    raise ValueError(f"'{field}' no puede ser null")

            # Actualizar tabla base
            if base_updates:
                set_parts = []
                values = []

                if "description" in base_updates:
                    set_parts.append("description = ?")
                    values.append(base_updates["description"])

                if "metadata" in base_updates:
                    set_parts.append("metadata = ?")
                    values.append(
                        json.dumps(base_updates["metadata"])
                        if base_updates["metadata"] is not None
                        else None
                    )

                if "barcode" in base_updates:
                    set_parts.append("barcode = ?")
                    values.append(base_updates["barcode"])

                values.append(product_id)

                await conn.execute(
                    f"""
                    UPDATE products
                    SET {", ".join(set_parts)}
                    WHERE id = ?
                    """,
                    values
                )

            # Si cambió algo del snapshot, cerramos el actual y creamos uno nuevo
            if snapshot_updates:
                await conn.execute(
                    """
                    UPDATE product_snapshot
                    SET valid_to = CURRENT_TIMESTAMP
                    WHERE product_id = ?
                      AND valid_to IS NULL
                    """,
                    (product_id,)
                )

                new_name = snapshot_updates.get("name", before_row["name"])
                new_price = snapshot_updates.get("price", before_row["price"])
                new_category = snapshot_updates.get("category_id", before_row["category_id"])
                new_stock = snapshot_updates.get("stock", before_row["stock"])

                await conn.execute(
                    """
                    INSERT INTO product_snapshot
                    (product_id, name, price, category_id, stock, valid_from)
                    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    """,
                    (
                        product_id,
                        new_name,
                        new_price,
                        new_category,
                        new_stock,
                    )
                )
            else:
                new_name = before_row["name"]
                new_price = before_row["price"]
                new_category = before_row["category_id"]
                new_stock = before_row["stock"]

            after_row = {
                "id": product_id,
                "name": new_name,
                "description": base_updates.get("description", before_row["description"]),
                "metadata": base_updates.get("metadata", before_row["metadata"]),
                "barcode": base_updates.get("barcode", before_row["barcode"]),
                "price": new_price,
                "category_id": new_category,
                "stock": new_stock,
            }

            await SQLiteDB.insert_audit(
                conn,
                actor,
                "UPDATE",
                self.entity_type,
                product_id,
                {
                    "id": before_row["id"],
                    "name": before_row["name"],
                    "description": before_row["description"],
                    "metadata": before_row["metadata"],
                    "barcode": before_row["barcode"],
                    "price": before_row["price"],
                    "category_id": before_row["category_id"],
                    "stock": before_row["stock"],
                },
                after_row,
                update_data.get('comentario') or ""
            )

        if self.is_cache:
            await self.refresh_cache()

        return True

    async def delete(
        self,
        product_id: int,
        actor: str = "",
        description: Optional[str] = None
    ) -> bool:
        async with self.db.transaction() as conn:
            cursor = await conn.execute(
                """
                SELECT
                    p.id,
                    p.description,
                    p.metadata,
                    p.barcode,
                    ps.name,
                    ps.price,
                    ps.category_id,
                    ps.stock
                FROM products p
                JOIN product_snapshot ps
                    ON ps.product_id = p.id
                WHERE p.id = ?
                  AND ps.valid_to IS NULL
                """,
                (product_id,)
            )
            row = await cursor.fetchone()
            if row is None:
                raise HTTPException(404, "Categoría no encontrada")

            before = dict(row)
            before["metadata"] = self._parse_metadata(before.get("metadata"))

            # Cerramos el snapshot activo para que el producto deje de aparecer como vigente
            await conn.execute(
                """
                UPDATE product_snapshot
                SET valid_to = CURRENT_TIMESTAMP
                WHERE product_id = ?
                  AND valid_to IS NULL
                """,
                (product_id,)
            )

            # Conservamos products para no romper historial.
            await SQLiteDB.insert_audit(
                conn,
                actor,
                "DELETE",
                self.entity_type,
                product_id,
                before,
                None,
                description
            )

        if self.is_cache:
            await self.refresh_cache()

        return True