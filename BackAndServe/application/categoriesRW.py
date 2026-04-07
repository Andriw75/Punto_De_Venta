CHANNEL = "categories"
EVENT = "current_categories"
PERMISO_USER = "CATEGORIAS"

from fastapi import APIRouter, WebSocket, Depends, HTTPException, status
from dependency_injector.wiring import inject, Provide

from domain.users import UserCookie
from domain.categories import (
    CategoryCreate,
    CategoryUpdate
)

from infrastructure.container import Container
from infrastructure.rep_categories import RepCategories
from application.authR import permission_required,validate_user_ws
from application.mnj_ws import WebSocketManager


categoriesR = APIRouter(prefix="/Categories", tags=["Categories"])

ws_manager = WebSocketManager()

@inject
async def notify_categories(
    repo: RepCategories = Depends(Provide[Container.category_rep]),
):

    categories = await repo.get()

    await ws_manager.broadcast_channel(
        CHANNEL,
        {
            "event": EVENT,
            "data": [c.model_dump() for c in categories]
        }
    )

@inject
async def subscribe_categories(
    connection_id,
    ws:WebSocket,
    data,
    repo: RepCategories = Depends(Provide[Container.category_rep]),
    ):
    cookies = await validate_user_ws(ws)
    
    if (not cookies) or (PERMISO_USER not in cookies.permissions):
        await ws_manager.disconnect(connection_id)
        return

    await ws_manager.subscribe(connection_id, CHANNEL)

    categories = await repo.get()

    await ws.send_json({
        "event": EVENT,
        "data": [c.model_dump() for c in categories]
    })

ws_manager.register_message_handler("subscribe_categories", subscribe_categories)

@categoriesR.post("/", response_model=bool)
@inject
async def crear(category: CategoryCreate, 
                current_user: UserCookie = Depends(permission_required(PERMISO_USER)),
                repo: RepCategories = Depends(Provide[Container.category_rep]),
                ):

    await repo.insert(current_user.name,category)
    await notify_categories()

    return True

@categoriesR.put("/", response_model=bool)
@inject
async def actualizar(
    category_id: int,
    category: CategoryUpdate,
    current_user: UserCookie = Depends(permission_required(PERMISO_USER)),
    repo: RepCategories = Depends(Provide[Container.category_rep]),
):

    await repo.update(current_user.name, category_id, category)

    await notify_categories()
    return True

@categoriesR.delete("/", response_model=bool)
@inject
async def eliminar(
    category_id: int,
    comentario: str | None = None,
    current_user: UserCookie = Depends(permission_required(PERMISO_USER)),
    repo: RepCategories = Depends(Provide[Container.category_rep]),
):

    await repo.delete(current_user.name, category_id, description=comentario)

    await notify_categories()
    return True

