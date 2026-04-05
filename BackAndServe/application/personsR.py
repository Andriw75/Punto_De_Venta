PERMISO_USER = "USUARIOS"

from fastapi import APIRouter, Depends
from dependency_injector.wiring import inject, Provide

from domain.users import UserAdmin, UserCreate, UserUpdate, UserCookie
from infrastructure.container import Container
from infrastructure.rep_users import RepUsers
from infrastructure.rep_auth import BcryptMnjCrypt
from application.authR import permission_required


personsR = APIRouter(prefix="/Persons", tags=["Persons"])


@personsR.get("/", response_model=list[UserAdmin])
@inject
async def listar_usuarios(
    current_user: UserCookie = Depends(permission_required(PERMISO_USER)),
    repo: RepUsers = Depends(Provide[Container.user_repository]),
):
    return await repo.get_all_users()


@personsR.post("/", response_model=bool)
@inject
async def crear_usuario(
    user: UserCreate,
    current_user: UserCookie = Depends(permission_required(PERMISO_USER)),
    repo: RepUsers = Depends(Provide[Container.user_repository]),
    crypt_manager: BcryptMnjCrypt = Depends(Provide[Container.by_cript]),
):
    user_to_create = UserCreate(
        name=user.name,
        permissions=user.permissions,
        password=crypt_manager.hash_password(user.password),
    )

    await repo.create_user(user_to_create, actor=current_user.name)
    return True


@personsR.put("/", response_model=bool)
@inject
async def actualizar_usuario(
    user_id: int,
    user: UserUpdate,
    current_user: UserCookie = Depends(permission_required(PERMISO_USER)),
    repo: RepUsers = Depends(Provide[Container.user_repository]),
    crypt_manager: BcryptMnjCrypt = Depends(Provide[Container.by_cript]),
):
    payload = user.model_dump(exclude_unset=True)

    if "password" in payload and payload["password"] is not None:
        payload["password"] = crypt_manager.hash_password(payload["password"])

    user_to_update = UserUpdate(**payload)

    await repo.update_user(user_id, user_to_update, actor=current_user.name)
    return True


@personsR.delete("/", response_model=bool)
@inject
async def eliminar_usuario(
    user_id: int,
    current_user: UserCookie = Depends(permission_required(PERMISO_USER)),
    repo: RepUsers = Depends(Provide[Container.user_repository]),
):
    await repo.delete_user(user_id, actor=current_user.name)
    return True
