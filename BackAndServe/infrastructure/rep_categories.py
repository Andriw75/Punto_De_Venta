from domain.categories import CategoryResponse,CategoryCreate,CategoryUpdate
from infrastructure.db import SQLiteDB
from aiosqlite import IntegrityError
from infrastructure.utils import CachedRepository
from fastapi.exceptions import HTTPException
from fastapi import status



class RepCategories(CachedRepository[CategoryResponse]):

    def __init__(self,
                db: SQLiteDB, 
                is_cache: bool
                ):
        super().__init__(is_cache=is_cache)
        self.entity_type = "CATEGORY"
        self.db = db

    async def list_all(self)->list[CategoryResponse]:

        async with self.db.acquire() as conn:

            cursor = await conn.execute(
                """
                SELECT id, name, color
                FROM categories
                ORDER BY name
                """
            )

            rows = await cursor.fetchall()

            return [
                CategoryResponse.model_validate(dict(row))
                for row in rows
            ]

    async def insert(self, actor:str, category:CategoryCreate):
        try:
            async with self.db.transaction() as conn:

                cursor = await conn.execute(
                    """
                    INSERT INTO categories (name,color)
                    VALUES (?,?)
                    """,
                    (category.name,category.color)
                )

                category_id = cursor.lastrowid

                await SQLiteDB.insert_audit(
                    conn,
                    actor,
                    "INSERT",
                    self.entity_type,
                    category_id,
                    None,
                    {
                        "name": category.name
                    },
                    ''
                )
        except IntegrityError as i_e:
            if str(i_e) == "UNIQUE constraint failed: categories.name":
                raise HTTPException(status.HTTP_409_CONFLICT, detail="El nombre ya existe")
            else:
                raise HTTPException(500, detail=str(i_e))
            
        except Exception as e:
            raise HTTPException(500, detail=str(e))

            

        if self._cache:
            await self.refresh_cache()

    async def update(self, actor: str, category_id: int, category: CategoryUpdate):

        async with self.db.transaction() as conn:

            cursor = await conn.execute(
                """
                SELECT name,color
                FROM categories
                WHERE id = ?
                """,
                (category_id,)
            )

            row = await cursor.fetchone()

            if row is None:
                raise HTTPException(404,"Categoría no encontrada")

            before = dict(row)

            fields = []
            values = []

            if category.name is not None:
                fields.append("name = ?")
                values.append(category.name)
            
            if category.color is not None:
                fields.append("color = ?")
                values.append(category.color)

            if not fields:
                return True

            values.append(category_id)

            query = f"""
            UPDATE categories
            SET {", ".join(fields)}
            WHERE id = ?
            """

            await conn.execute(query, values)

            after = {
                "name": category.name if category.name else before["name"],
                "color": category.color if category.color else before["color"],
            }

            await SQLiteDB.insert_audit(
                conn,
                actor,
                "UPDATE",
                self.entity_type,
                category_id,
                before,
                after,
                ""
            )


        if self._cache:
            await self.refresh_cache()

        return True

    async def delete(
        self,
        actor: str,
        category_id: int
    ):
        
        async with self.db.transaction() as conn:

            cursor = await conn.execute(
                """
                SELECT name
                FROM categories
                WHERE id = ?
                """,
                (category_id,)
            )

            row = await cursor.fetchone()

            if row is None:
                raise HTTPException(404,"Categoría no encontrada")

            before = dict(row)

            await conn.execute(
                """
                DELETE FROM categories
                WHERE id = ?
                """,
                (category_id,)
            )

            await SQLiteDB.insert_audit(
                conn,
                actor,
                "DELETE",
                self.entity_type,
                category_id,
                before,
                None,
                ""
            )

        if self._cache:
            await self.refresh_cache()

        return True

