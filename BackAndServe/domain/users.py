from typing import  Optional
from pydantic import BaseModel, Field, field_validator

def validate_password_strength(password: str) -> str:
    """Valida la contraseña según tus reglas"""
    if len(password) < 6:
        raise ValueError("El password debe tener al menos 6 caracteres")
    return password

class UserResponse(BaseModel):
    """Modelo de salida: información pública del usuario"""
    name: str
    permissions: list[str] = Field(default_factory=list)

class UserCookie(UserResponse):
    """Modelo para sesión / JWT"""
    id: int

class UserDb(UserCookie):
    """Modelo interno de base de datos, incluye password hasheado"""
    password: str

class UserCreate(BaseModel):
    name: str
    permissions: list[str] = Field(default_factory=list)
    password: str

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        return validate_password_strength(v)

class UserUpdate(BaseModel):
    name: Optional[str] = None
    permissions: Optional[list[str]] = None
    password: Optional[str] = None

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            return validate_password_strength(v)
        return v

class UserAdmin(BaseModel):
    """Modelo para administración de usuarios (CRUD)"""
    id: int
    name: str
    permissions: list[str] = Field(default_factory=list)
