from typing import TypeVar, Generic
from abc import ABC, abstractmethod
import asyncio

T = TypeVar("T")

class CachedRepository(ABC, Generic[T]):
    def __init__(self, is_cache: bool = True):
        self.is_cache = is_cache
        self._cache: list[T] | None = None
        self._lock = asyncio.Lock()

    async def get(self) -> list[T]:
        """Devuelve la cache si está habilitada; si está vacía, la refresca."""
        if not self.is_cache:
            return await self.list_all()

        async with self._lock:
            if self._cache is None:
                await self.refresh_cache()
            return self._cache

    async def refresh_cache(self):
        """Refresca la cache solo si está habilitada"""
        if self.is_cache:
            self._cache = await self.list_all()

    @abstractmethod
    async def list_all(self) -> list[T]:
        """Método abstracto para listar todos los datos del repositorio"""
        pass

    @abstractmethod
    async def insert(self, item: T) -> bool:
        pass

    @abstractmethod
    async def update(self, item_id: int, item: T) -> bool:
        pass

    @abstractmethod
    async def delete(self, item_id: int) -> bool:
        pass