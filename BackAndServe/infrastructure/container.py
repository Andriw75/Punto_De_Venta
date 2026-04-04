import os
from dependency_injector import containers, providers
from infrastructure.db import SQLiteDB
from infrastructure.rep_users import RepUsers
from infrastructure.rep_categories import RepCategories
from infrastructure.rep_products import RepProducts
from infrastructure.rep_auth import JWTManagerImpl,BcryptMnjCrypt
from utils import resource_path

class Container(containers.DeclarativeContainer):
    sqlite_db = providers.Singleton(SQLiteDB, db_path=resource_path(os.environ.get("DB_SQLITE", "database.db")))

    user_repository = providers.Factory(RepUsers, db=sqlite_db)

    jwt_impl = providers.Singleton(JWTManagerImpl,
                                   secret_key=os.getenv("SECRET_KEY"),
                                   algorithm=os.getenv("ALGORITHM"),
                                   default_expires_minutes=15)
    
    by_cript = providers.Singleton(BcryptMnjCrypt)

    category_rep = providers.Factory(RepCategories, db=sqlite_db, is_cache=True)

    products_rep = providers.Factory(RepProducts, db=sqlite_db, is_cache=True)

    


