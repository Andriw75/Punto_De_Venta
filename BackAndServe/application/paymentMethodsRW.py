CHANNEL = "payment_methods"
EVENT = "current_payment_methods"
PERMISO_USER = "VENTAS"

from fastapi import APIRouter, Depends, HTTPException, WebSocket, status
from dependency_injector.wiring import Provide, inject

from application.authR import permission_required, validate_user_ws
from application.mnj_ws import WebSocketManager
from domain.payment_methods import (
    PaymentMethodCreate,
    PaymentMethodResponse,
    PaymentMethodUpdate,
)
from domain.users import UserCookie
from infrastructure.container import Container
from infrastructure.rep_payment_methods import RepPaymentMethods


paymentMethodsRW = APIRouter(prefix="/PaymentMethods", tags=["PaymentMethods"])
ws_manager = WebSocketManager()


@inject
async def notify_payment_methods(
    repo: RepPaymentMethods = Depends(Provide[Container.payment_methods_rep]),
):
    methods = await repo.get()
    await ws_manager.broadcast_channel(
        CHANNEL,
        {
            "event": EVENT,
            "data": [m.model_dump() for m in methods],
        },
    )


@inject
async def subscribe_payment_methods(
    connection_id,
    ws: WebSocket,
    data,
    repo: RepPaymentMethods = Depends(Provide[Container.payment_methods_rep]),
):
    cookies = await validate_user_ws(ws)
    if (not cookies) or (PERMISO_USER not in cookies.permissions):
        await ws_manager.disconnect(connection_id)
        return

    await ws_manager.subscribe(connection_id, CHANNEL)

    methods = await repo.get()
    await ws.send_json(
        {
            "event": EVENT,
            "data": [m.model_dump() for m in methods],
        }
    )


ws_manager.register_message_handler("subscribe_payment_methods", subscribe_payment_methods)


@paymentMethodsRW.get("/", response_model=list[PaymentMethodResponse])
@inject
async def listar(
    current_user: UserCookie = Depends(permission_required(PERMISO_USER)),
    repo: RepPaymentMethods = Depends(Provide[Container.payment_methods_rep]),
):
    return await repo.get()


@paymentMethodsRW.post("/", response_model=bool)
@inject
async def crear(
    method: PaymentMethodCreate,
    current_user: UserCookie = Depends(permission_required(PERMISO_USER)),
    repo: RepPaymentMethods = Depends(Provide[Container.payment_methods_rep]),
):
    await repo.insert(current_user.name, method)
    await notify_payment_methods()
    return True


@paymentMethodsRW.put("/", response_model=bool)
@inject
async def actualizar(
    method_id: int,
    method: PaymentMethodUpdate,
    current_user: UserCookie = Depends(permission_required(PERMISO_USER)),
    repo: RepPaymentMethods = Depends(Provide[Container.payment_methods_rep]),
):
    updated = await repo.update(current_user.name, method_id, method)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Método de pago no encontrado",
        )

    await notify_payment_methods()
    return True


@paymentMethodsRW.delete("/", response_model=bool)
@inject
async def eliminar(
    method_id: int,
    comentario: str | None = None,
    current_user: UserCookie = Depends(permission_required(PERMISO_USER)),
    repo: RepPaymentMethods = Depends(Provide[Container.payment_methods_rep]),
):
    try:
        deleted = await repo.delete(current_user.name, method_id, description=comentario)
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(err),
        )

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Método de pago no encontrado",
        )

    await notify_payment_methods()
    return True
