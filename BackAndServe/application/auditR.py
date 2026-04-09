PERMISO_USER = "AUDITORIA"

from datetime import datetime
from typing import Optional

from dependency_injector.wiring import Provide, inject
from fastapi import APIRouter, Depends, Query

from application.authR import permission_required
from domain.audit import AuditActionType, AuditEntityType, AuditLogResponse
from domain.users import UserCookie
from infrastructure.container import Container
from infrastructure.rep_audit import RepAudit


auditR = APIRouter(prefix="/Audit", tags=["Audit"])


@auditR.get("/", response_model=list[AuditLogResponse])
@inject
async def list_audit_logs(
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=200),
    start_time: Optional[datetime] = Query(default=None),
    end_time: Optional[datetime] = Query(default=None),
    username: Optional[str] = Query(default=None),
    entity_type: Optional[AuditEntityType] = Query(default=None),
    action_type: Optional[AuditActionType] = Query(default=None),
    current_user: UserCookie = Depends(permission_required(PERMISO_USER)),
    repo: RepAudit = Depends(Provide[Container.audit_rep]),
):
    return await repo.list_audit(
        offset=offset,
        limit=limit,
        start_time=start_time,
        end_time=end_time,
        username=username,
        entity_type=entity_type,
        action_type=action_type,
    )


@auditR.get("/count", response_model=int)
@inject
async def count_audit_logs(
    start_time: Optional[datetime] = Query(default=None),
    end_time: Optional[datetime] = Query(default=None),
    username: Optional[str] = Query(default=None),
    entity_type: Optional[AuditEntityType] = Query(default=None),
    action_type: Optional[AuditActionType] = Query(default=None),
    current_user: UserCookie = Depends(permission_required(PERMISO_USER)),
    repo: RepAudit = Depends(Provide[Container.audit_rep]),
):
    return await repo.count_audit(
        start_time=start_time,
        end_time=end_time,
        username=username,
        entity_type=entity_type,
        action_type=action_type,
    )


@auditR.get("/usernames", response_model=list[str])
@inject
async def list_audit_usernames(
    current_user: UserCookie = Depends(permission_required(PERMISO_USER)),
    repo: RepAudit = Depends(Provide[Container.audit_rep]),
):
    return await repo.list_usernames()
