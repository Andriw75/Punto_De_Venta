from datetime import datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field


class AuditEntityType(StrEnum):
    USER = "USER"
    CATEGORY = "CATEGORY"
    PRODUCT = "PRODUCT"
    PAYMENT_METHOD = "PAYMENT_METHOD"
    SALE = "SALE"


class AuditActionType(StrEnum):
    INSERT = "INSERT"
    UPDATE = "UPDATE"
    DELETE = "DELETE"
    MIGRATE = "MIGRATE"


class AuditChanges(BaseModel):
    data_before: dict[str, Any] = Field(default_factory=dict)
    data_after: dict[str, Any] = Field(default_factory=dict)


class AuditLogResponse(BaseModel):
    id: int
    username: str | None = None
    description: str | None = None
    action_type: AuditActionType
    entity_type: AuditEntityType
    entity_id: str | None = None
    changes: AuditChanges
    created_at: datetime
