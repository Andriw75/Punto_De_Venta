from dotenv import load_dotenv
load_dotenv()

from contextlib import asynccontextmanager
import uvicorn
from fastapi import FastAPI, WebSocket

from infrastructure.container import Container

container = Container()
container.wire(packages=["application"])

@asynccontextmanager
async def lifespan(app: FastAPI):
    db = container.sqlite_db()
    await db.init()
    yield

app = FastAPI(lifespan=lifespan)

# SOLO DESARROLLO
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from application.mnj_ws import WebSocketManager
manager = WebSocketManager()
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    
    connection_id = await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_json()
            await manager.handle_message(connection_id, data)
    except Exception as e:
        print("---WS---")
        print(e)
        print("--------")
    finally:
        await manager.disconnect(connection_id)

from application.authR import authR
app.include_router(authR)

from application.categoriesR import categoriesR
app.include_router(categoriesR)

#####################################################
import sys
import os

if sys.stdout is None:
    sys.stdout = open(os.devnull, "w")
if sys.stderr is None:
    sys.stderr = open(os.devnull, "w")

import uvicorn
import threading
import socket

server_thread = None
server_instance = None

HOST = None
PORT = 8000

def get_local_ip():
    ip = "127.0.0.1"
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
    except Exception:
        pass
    finally:
        try:
            s.close()
        except:
            pass
    return ip


def run_server():
    global server_instance
    config = uvicorn.Config(
        app,
        host=HOST,
        port=PORT,
        # log_level="critical"
    )

    server_instance = uvicorn.Server(config)
    server_instance.run()


def start_server():
    global server_thread, HOST

    if server_thread is None or not server_thread.is_alive():

        # HOST = get_local_ip()
        HOST = 'localhost'
        url = f"http://{HOST}:{PORT}"

        server_thread = threading.Thread(
            target=run_server,
            daemon=True
        )
        server_thread.start()

        return url

    return None


def stop_server():
    global server_instance
    if server_instance:
        server_instance.should_exit = True