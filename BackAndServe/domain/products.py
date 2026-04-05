from typing import Optional
from pydantic import BaseModel, Field

class ProductBase(BaseModel):
    description: Optional[str] = None
    metadata: Optional[dict] = None
    barcode: Optional[str] = None

class ProductCreate(ProductBase):
    name: str = Field(..., min_length=1)
    stock: int = Field(..., ge=0)
    price: float = Field(..., gt=0)
    category_id: Optional[int] = None

class ProductUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1)
    description: Optional[str] = None
    metadata: Optional[dict] = None
    barcode: Optional[str] = None
    stock: Optional[int] = Field(None, ge=0)
    price: Optional[float] = Field(None, gt=0)
    category_id: Optional[int] = None

    comentario: Optional[str] = Field(None)

class ProductRealTime(ProductBase):
    id: int
    name: str
    stock: int
    category_id: Optional[int] = None
    price: float = Field(..., gt=0)