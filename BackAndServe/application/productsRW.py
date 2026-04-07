CHANNEL = "PRODUCTOS"
EVENT = "current_products"
PERMISO_USER = "PRODUCTOS"

from fastapi import APIRouter, WebSocket, Depends, HTTPException, status
from dependency_injector.wiring import inject, Provide

from infrastructure.container import Container
from domain.users import UserCookie
from domain.products import ProductCreate, ProductUpdate
from infrastructure.rep_products import RepProducts
from application.authR import permission_required
from application.mnj_ws import WebSocketManager


productsRW = APIRouter(prefix="/Products", tags=["Products"])
ws_manager = WebSocketManager()

@inject
async def notify_products(
    repo: RepProducts = Depends(Provide[Container.products_rep]),
):
    products = await repo.get()
    await ws_manager.broadcast_channel(
        CHANNEL,
        {
            "event": EVENT,
            "data": [p.model_dump() for p in products]
        }
    )

@inject
async def subscribe_products(
    connection_id,
    ws:WebSocket,
    data,
    repo: RepProducts = Depends(Provide[Container.products_rep]),
):
    await ws_manager.subscribe(connection_id, CHANNEL)

    products = await repo.get()
    await ws.send_json({
        "event": EVENT,
        "data": [p.model_dump() for p in products]
    })

ws_manager.register_message_handler("subscribe_products", subscribe_products)

@productsRW.post("/", response_model=bool)
@inject
async def crear(product: ProductCreate,
                current_user: UserCookie = Depends(permission_required("PRODUCTOS")),
                repo: RepProducts = Depends(Provide[Container.products_rep]),
                ):

    await repo.insert(product, actor=current_user.name)
    await notify_products()
    return True

@productsRW.put("/", response_model=bool)
@inject
async def actualizar(
    product_id: int,
    product: ProductUpdate,
    current_user: UserCookie = Depends(permission_required("PRODUCTOS")),
    repo: RepProducts = Depends(Provide[Container.products_rep]),
):

    await repo.update(product_id, product, actor=current_user.name)

    await notify_products()
    return True

@productsRW.delete("/", response_model=bool)
@inject
async def eliminar(
    product_id: int,
    comentario: str | None = None,
    current_user: UserCookie = Depends(permission_required("PRODUCTOS")),
    repo: RepProducts = Depends(Provide[Container.products_rep]),
):

    await repo.delete(product_id, actor=current_user.name, description=comentario)

    await notify_products()
    return True

