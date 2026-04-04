from typing import Optional
from pydantic import BaseModel, Field

class CategoryBase(BaseModel):
    """Modelo base para categorías"""
    name: str = Field(..., min_length=1, max_length=100, description="Nombre de la categoría")
    color: str  = Field(..., min_length=1, max_length=7, description="Color de la categoría en hexadecimal")

class CategoryCreate(CategoryBase):
    """Modelo usado al crear una categoría"""
    pass

class CategoryUpdate(BaseModel):
    """Modelo usado para actualizar una categoría"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    color: Optional[str] = Field(None, min_length=1, max_length=7)

    comentario: Optional[str] = Field(None)

class CategoryResponse(CategoryBase):
    """Modelo de salida de categoría"""
    id: int
