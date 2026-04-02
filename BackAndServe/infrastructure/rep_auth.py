from datetime import timedelta,datetime,timezone

import jwt
from fastapi import HTTPException, status

from domain.users import UserCookie

class JWTManagerImpl:
    def __init__(self, secret_key:str, algorithm:str, default_expires_minutes:int):
        """
        Inicializa el gestor de JWT.
        :param secret_key: Clave secreta para firmar el token.
        :param algorithm: Algoritmo de encriptación (por defecto HS256).
        :param default_expires_minutes: Tiempo de expiración por defecto en minutos.
        """
        self.secret_key = secret_key 
        self.algorithm = algorithm  
        self.default_expires_minutes = default_expires_minutes

    def create_access_token(self, data: UserCookie, expires_delta: timedelta|None = None) -> str:
        to_encode = data.model_dump(mode='json')
        if expires_delta:
            expire = datetime.now(timezone.utc) + expires_delta
        else:
            expire = datetime.now(timezone.utc) + timedelta(minutes=self.default_expires_minutes)
        to_encode.update({"exp": expire})
        token = jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)
        return token

    def verify_token(self, token: str) -> dict:
        """
        Verifica el token JWT y retorna la carga útil si es válido.
        :param token: Token JWT.
        :return: Payload del token.
        :raises HTTPException: Si el token es inválido o ha expirado.
        """
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            return payload
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                                detail="Token expirado")
        except jwt.PyJWTError:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                                detail="Token inválido")

import bcrypt

class BcryptMnjCrypt:
        
    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """
        Verifica si la contraseña en texto plano corresponde al hash utilizando bcrypt.

        :param plain_password: Contraseña en texto plano.
        :param hashed_password: Contraseña hasheada.
        :return: True si la contraseña es correcta, False en caso contrario.
        """
        try:
            return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
        except ValueError:
            return False
        
    def hash_password(self, plain_password: str) -> str:
        """
        Genera un hash seguro para la contraseña en texto plano usando bcrypt.

        :param plain_password: Contraseña en texto plano.
        :return: Contraseña hasheada como string.
        """
        # Genera un salt automáticamente y luego hashea la contraseña
        hashed = bcrypt.hashpw(plain_password.encode('utf-8'), bcrypt.gensalt())
        return hashed.decode('utf-8')
