PERMISO_USER = "VENTAS"
PRODUCT_CHANNEL = "PRODUCTOS"
PRODUCT_EVENT = "current_products"

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from dependency_injector.wiring import Provide, inject

from application.authR import permission_required
from application.mnj_ws import WebSocketManager
from domain.sales import SaleCreate, SaleResponse, SaleUpdate
from domain.users import UserCookie
from infrastructure.container import Container
from infrastructure.rep_payment_methods import RepPaymentMethods
from infrastructure.rep_products import RepProducts
from infrastructure.rep_sales import RepSales


salesRW = APIRouter(prefix="/Sales", tags=["Sales"])
ws_manager = WebSocketManager()


@inject
async def notify_products(
    repo: RepProducts = Depends(Provide[Container.products_rep]),
):
    products = await repo.get()
    await ws_manager.broadcast_channel(
        PRODUCT_CHANNEL,
        {
            "event": PRODUCT_EVENT,
            "data": [p.model_dump() for p in products],
        },
    )


@salesRW.get("/", response_model=list[SaleResponse])
@inject
async def listar_ventas(
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=15, ge=1, le=200),
    start_time: Optional[datetime] = Query(default=None),
    end_time: Optional[datetime] = Query(default=None),
    current_user: UserCookie = Depends(permission_required(PERMISO_USER)),
    repo: RepSales = Depends(Provide[Container.sales_rep]),
):
    return await repo.list_sales(
        offset=offset,
        limit=limit,
        start_time=start_time,
        end_time=end_time,
    )


@salesRW.get("/count", response_model=int)
@inject
async def contar_ventas(
    start_time: Optional[datetime] = Query(default=None),
    end_time: Optional[datetime] = Query(default=None),
    current_user: UserCookie = Depends(permission_required(PERMISO_USER)),
    repo: RepSales = Depends(Provide[Container.sales_rep]),
):
    return await repo.count_sales(
        start_time=start_time,
        end_time=end_time,
    )


@salesRW.post("/", response_model=bool)
@inject
async def crear_venta(
    sale: SaleCreate,
    current_user: UserCookie = Depends(permission_required(PERMISO_USER)),
    repo_sales: RepSales = Depends(Provide[Container.sales_rep]),
    repo_products: RepProducts = Depends(Provide[Container.products_rep]),
):
    try:
        await repo_sales.insert(sale, actor=current_user.name)
    except ValueError as err:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(err))

    await repo_products.refresh_cache()
    await notify_products()
    return True


@salesRW.put("/", response_model=bool)
@inject
async def actualizar_venta(
    sale_id: int,
    sale_update: SaleUpdate,
    restore_products: bool = False,
    current_user: UserCookie = Depends(permission_required(PERMISO_USER)),
    repo_sales: RepSales = Depends(Provide[Container.sales_rep]),
    repo_products: RepProducts = Depends(Provide[Container.products_rep]),
):
    try:
        updated = await repo_sales.update(
            sale_id,
            sale_update,
            actor=current_user.name,
            description=sale_update.comentario,
            restore_products=restore_products,
        )
    except ValueError as err:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(err))

    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Venta no encontrada",
        )

    await repo_products.refresh_cache()
    await notify_products()
    return True


@salesRW.delete("/", response_model=bool)
@inject
async def eliminar_venta(
    sale_id: int,
    restore_products: bool = False,
    current_user: UserCookie = Depends(permission_required(PERMISO_USER)),
    repo_sales: RepSales = Depends(Provide[Container.sales_rep]),
    repo_products: RepProducts = Depends(Provide[Container.products_rep]),
):
    try:
        deleted = await repo_sales.delete(
            sale_id,
            actor=current_user.name,
            restore_products=restore_products,
        )
    except ValueError as err:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(err))

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Venta {sale_id} no encontrada",
        )

    await repo_products.refresh_cache()
    await notify_products()
    return True


@salesRW.post("/migrate-payment-method", response_model=dict)
@inject
async def migrar_metodo_pago(
    origin_id: int,
    target_id: int,
    current_user: UserCookie = Depends(permission_required(PERMISO_USER)),
    repo_sales: RepSales = Depends(Provide[Container.sales_rep]),
    repo_pm: RepPaymentMethods = Depends(Provide[Container.payment_methods_rep]),
):
    if origin_id == target_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El método origen y destino no pueden ser iguales",
        )

    methods = await repo_pm.get()
    origin = next((m for m in methods if m.id == origin_id), None)
    target = next((m for m in methods if m.id == target_id), None)

    if not origin or not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Método de pago no encontrado",
        )

    count = await repo_sales.migrate_payment_method(
        origin_id,
        target_id,
        actor=current_user.name,
        description=f"Migración solicitada por {current_user.name}",
    )

    return {
        "message": f"Se migraron {count} ventas",
        "origin": origin.name,
        "target": target.name,
        "affected_sales": count,
    }
