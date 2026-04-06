from typing import Optional

from pydantic import BaseModel, Field


class PaymentMethodBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)


class PaymentMethodCreate(PaymentMethodBase):
    pass


class PaymentMethodUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    comentario: Optional[str] = Field(None)


class PaymentMethodResponse(PaymentMethodBase):
    id: int
