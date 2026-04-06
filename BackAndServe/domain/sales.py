from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class SaleItemCreate(BaseModel):
    product_id: int = Field(..., ge=1)
    quantity: int = Field(..., ge=1)


class SaleItemUpdate(BaseModel):
    product_id: int = Field(..., ge=1)
    quantity: int = Field(..., ge=1)


class SaleCreate(BaseModel):
    products: list[SaleItemCreate] = Field(..., min_length=1)
    total_charged: float = Field(..., gt=0)
    payment_method_id: int = Field(..., ge=1)


class SaleUpdate(BaseModel):
    products: Optional[list[SaleItemUpdate]] = None
    total_charged: Optional[float] = Field(None, gt=0)
    payment_method_id: Optional[int] = Field(None, ge=1)
    comentario: Optional[str] = Field(None)


class SaleItemResponse(BaseModel):
    product_id: int
    snapshot_id: int
    name: str
    unit_price: float
    quantity: int


class SaleResponse(BaseModel):
    id: int
    username: Optional[str] = None
    sale_date: datetime
    products: list[SaleItemResponse] = Field(default_factory=list)
    total_charged: float
    payment_method_id: int
