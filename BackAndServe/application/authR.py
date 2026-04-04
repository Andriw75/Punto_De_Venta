import os

KEY_TOKEN = "AccessToken" + os.getenv('NAME_PROYECT')
TOKEN_RENEW_THRESHOLD = 300     # segundos antes de expirar para renovar token
TOKEN_MAX_AGE = 900             # 15 minutos
SECURE = False

from datetime import datetime, timezone
from dependency_injector.wiring import inject, Provide

from fastapi import (
    APIRouter,  Depends, Header,
    Request, Response, HTTPException, status, WebSocket
)
from fastapi.security import OAuth2PasswordRequestForm

from domain.users import UserResponse, UserCookie

from application.mnj_ws import WebSocketManager

from infrastructure.container import Container
from infrastructure.rep_auth import JWTManagerImpl, BcryptMnjCrypt
from infrastructure.rep_users import RepUsers

@inject
async def get_current_user(
    request: Request,
    response: Response,
    jwt_impl: JWTManagerImpl = Depends(Provide[Container.jwt_impl]),
    ) -> UserCookie:
    token = request.cookies.get(KEY_TOKEN)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="No se encontró token de autenticación")
    try:
        payload = jwt_impl.verify_token(token)
        exp_timestamp = payload.get("exp")
        user_cokie = UserCookie.model_validate(payload)

        if exp_timestamp:
            now = datetime.now(timezone.utc).timestamp()
            if exp_timestamp - now < TOKEN_RENEW_THRESHOLD:
                # Renovar token si está próximo a expirar
                new_token = jwt_impl.create_access_token(data=user_cokie)
                _set_access_cookie(response, new_token)

        return user_cokie
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Token inválido o expirado")
    
@inject
async def validate_user_ws(
    ws: WebSocket,
    jwt_impl: JWTManagerImpl = Depends(Provide[Container.jwt_impl]),
    ) -> UserCookie | None:
    """
    Valida un usuario a través de WebSocket usando la cookie JWT.

    Args:
        ws (WebSocket): Conexión WebSocket.

    Returns:
        UserCookie | None: Usuario autenticado o None si inválido.
    """
    token = ws.cookies.get(KEY_TOKEN)
    if not token:
        return None
    try:
        payload = jwt_impl.verify_token(token)
        user = UserCookie(**payload)
        return user
    except Exception:
        return None

def _set_access_cookie(response: Response, token: str):
    response.set_cookie(
        key=KEY_TOKEN,
        value=token,
        httponly=True,
        max_age=TOKEN_MAX_AGE,
        secure=SECURE,
        samesite="none" if SECURE else "Lax"
    )

def _delete_access_cookie(response: Response):
    response.delete_cookie(
        key=KEY_TOKEN,
        secure=SECURE,
        samesite="none" if SECURE else "Lax"
    )

def permission_required(permission: str):
    """
    Crea dependencia que valida permisos de usuario.

    Args:
        permission (str): Permiso requerido.

    Returns:
        Callable: Dependencia para usar en rutas.

    Uso:
        @router.get("/admin")
        async def admin_route(current_user=Depends(auth.permission_required("admin"))):
            ...
    """
    def dependency(current: UserCookie = Depends(get_current_user)):
        if permission not in current.permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permiso '{permission}' requerido"
            )
        return current
    return dependency
    
def api_key_required():
    """
    Crea dependencia que valida API Key en headers.

    Returns:
        Callable: Dependencia para usar en rutas protegidas por API Key.

    Uso:
        @router.get("/external")
        async def external_route(api_key=Depends(auth.api_key_required())):
            ...
    """
    async def dependency(x_api_key: str = Header(..., alias="x-api-key")):
        if x_api_key != os.getenv("SUPER_API_KEY"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="API Key inválida o no autorizada"
            )
        return x_api_key
    return dependency

#------------------------------------------------------------------------------------#

authR = APIRouter(tags=["auth"], prefix="/auth")

@authR.get("/me", response_model=UserResponse)
async def me_route(current_user:UserCookie=Depends(get_current_user)): 
    """ Endpoint para obtener información del usuario actual. Uso: GET /auth/me """ 
    return UserResponse(**current_user.model_dump())

@authR.post("/token", response_model=UserResponse)
@inject
async def token_route(
                        response: Response,
                        form_data: OAuth2PasswordRequestForm = Depends(),
                        rep_user: RepUsers = Depends(Provide[Container.user_repository]),
                        crypt_manager: BcryptMnjCrypt = Depends(Provide[Container.by_cript]),
                        jwt_impl: JWTManagerImpl = Depends(Provide[Container.jwt_impl]),
                        ): 
    """ Endpoint de login: autentica usuario y genera JWT en cookie HTTP-only. Uso: POST /auth/token Body: form-data con 'username' y 'password' """ 
    user = await rep_user.get_user(form_data.username)
    if not user or not crypt_manager.verify_password(form_data.password, user.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)

    access_token = jwt_impl.create_access_token(data=UserCookie(**user.model_dump()))
    _set_access_cookie(response, access_token)
    return UserResponse(**user.model_dump())

@authR.post("/logout")
async def logout_route(response: Response): 
    """ Endpoint de logout: elimina cookie de acceso. Uso: POST /auth/logout """ 
    _delete_access_cookie(response)
    return {"detail": "Sesión cerrada"}

@authR.get("/show-ws-data")
async def show_ws_data(x_api_key:str =Depends(api_key_required())):
    return await WebSocketManager().get_all_data()


