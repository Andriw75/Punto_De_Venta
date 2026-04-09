import json
import aiosqlite
import asyncio
import logging
from contextlib import asynccontextmanager
from utils import resource_path

logging.basicConfig(level=logging.INFO)


class SQLiteDB:
    """
    Clase que gestiona la conexión a SQLite usando un pool simple
    y configuraciones de entorno.
    """

    def __init__(self, db_path: str):
        # Ruta de la DB
        self._db_path = resource_path(db_path)
        self._connection: aiosqlite.Connection | None = None
        self._lock = asyncio.Lock()
        self._initialized = False

    async def init(self):
        """Inicializa la conexión si no existe (similar a un singleton interno)."""
        if not self._initialized:
            async with self._lock:
                if not self._initialized:
                    self._connection = await aiosqlite.connect(self._db_path)
                    await self._connection.execute("PRAGMA foreign_keys = ON")
                    await self._connection.execute("PRAGMA journal_mode = WAL")
                    await self._connection.execute("PRAGMA synchronous = NORMAL")
                    await self.create_schem()
                    self._connection.row_factory = aiosqlite.Row
                    self._initialized = True

    async def create_schem(self):
        tables = []

        sql = """
CREATE TABLE IF NOT EXISTS User (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(250) UNIQUE NOT NULL,
    password VARCHAR(250) NOT NULL,
    permissions TEXT NOT NULL DEFAULT '{}'
);
"""
        tables.append(sql)
        
        sql = """
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL UNIQUE,
    color VARCHAR(7) NULL
);
"""
        tables.append(sql)

        sql = """
CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR,
    description TEXT,
    action_type VARCHAR,
    entity_type VARCHAR,
    entity_id VARCHAR,
    changes TEXT,
    created_at TIMESTAMP
);
"""
        tables.append(sql)

        sql = """
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at
ON audit_log (created_at DESC);
"""
        tables.append(sql)

        sql = """
CREATE INDEX IF NOT EXISTS idx_audit_log_entity_action
ON audit_log (entity_type, action_type);
"""
        tables.append(sql)

        sql = """
CREATE INDEX IF NOT EXISTS idx_audit_log_username
ON audit_log (username);
"""
        tables.append(sql)

        sql = """
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    barcode VARCHAR UNIQUE,
    description TEXT,
    metadata TEXT
);
"""
        tables.append(sql)

        sql = """
CREATE TABLE IF NOT EXISTS product_snapshot (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    name VARCHAR NOT NULL,
    price DECIMAL NOT NULL,
    category_id INTEGER,
    stock INTEGER NOT NULL,
    valid_from TIMESTAMP NOT NULL,
    valid_to TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);
"""
        tables.append(sql)

        sql = """
CREATE TABLE IF NOT EXISTS payment_methods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);
"""
        tables.append(sql)

        sql = """
CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_date TIMESTAMP NOT NULL,
    username VARCHAR,
    data TEXT NOT NULL,
    payment_method_id INTEGER NOT NULL,
    FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id)
);
"""
        tables.append(sql)



        for t in tables:
            await self._connection.execute(t)

        cursor = await self._connection.execute("SELECT COUNT(*) FROM payment_methods")
        row = await cursor.fetchone()
        count = row[0] if row else 0
        if count == 0:
            await self._connection.execute(
                "INSERT INTO payment_methods (name) VALUES (?)",
                ("Efectivo",)
            )
            await self._connection.commit()
            

    @asynccontextmanager    
    async def acquire(self):
        """Context manager para obtener la conexión SQLite."""
        if not self._initialized:
            await self.init()
        assert self._connection is not None, "La conexión no fue inicializada"

        try:
            yield self._connection
        except Exception as e:
            # logging.error(f"Error en conexión SQLite: {e}")
            raise

    @asynccontextmanager
    async def transaction(self):
        """Context manager para ejecutar transacciones."""
        async with self.acquire() as conn:
            try:
                await conn.execute("BEGIN")
                yield conn
                await conn.commit()
            except Exception as e:
                await conn.rollback()
                # logging.warning(f"Transacción revertida: {e}")
                raise

    # -------------------------
    # Métodos de ayuda para queries
    # -------------------------
    async def fetchrow(self, query: str, *args):
        async with self.acquire() as conn:
            async with conn.execute(query, args) as cursor:
                return await cursor.fetchone()

    async def fetchall(self, query: str, *args):
        async with self.acquire() as conn:
            async with conn.execute(query, args) as cursor:
                return await cursor.fetchall()

    async def execute(self, query: str, *args):
        async with self.acquire() as conn:
            cursor = await conn.execute(query, args)
            await conn.commit()
            return cursor.lastrowid
    
    @staticmethod
    async def insert_audit(
        conn,
        actor: str,
        action: str,
        entity_type: str,
        entity_id: int,
        data_before: dict | None,
        data_after: dict | None,
        description: str | None = None
    ):

        changes = {
            "data_before": data_before or {},
            "data_after": data_after or {}
        }

        await conn.execute(
            """
            INSERT INTO audit_log
            (username, description, action_type, entity_type, entity_id, changes, created_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            """,
            (
                actor,
                description,
                action,
                entity_type,
                str(entity_id),
                json.dumps(changes)
            )
        )
