from fastapi import FastAPI, WebSocket
from fastapi.staticfiles import StaticFiles
import pathlib
from server.clips_routes import router as clips_router
from server.loops_routes import router as loops_router
from server.ws import ws_endpoint
from server.deps import get_store, get_scanner

BASE_DIR = pathlib.Path(__file__).parent.parent

app = FastAPI()
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
app.include_router(clips_router)
app.include_router(loops_router)

@app.on_event("startup")
async def startup():
    store = get_store()
    scanner = get_scanner()
    meta = store.load()
    meta.clips = scanner.scan(meta)
    store.save(meta)

@app.websocket("/ws")
async def websocket_route(ws: WebSocket):
    await ws_endpoint(ws)

@app.get("/health")
async def health():
    return {"status": "ok"}
