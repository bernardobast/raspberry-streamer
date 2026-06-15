from fastapi import APIRouter, HTTPException
from typing import List
from server.models import Loop
from server.deps import get_store

router = APIRouter(prefix="/loops")

@router.get("", response_model=List[Loop])
async def list_loops():
    return get_store().load().loops

@router.post("", response_model=Loop)
async def create_loop(loop: Loop):
    store = get_store()
    meta = store.load()
    meta.loops.append(loop)
    store.save(meta)
    return loop

@router.put("/{loop_id}", response_model=Loop)
async def update_loop(loop_id: str, loop: Loop):
    store = get_store()
    meta = store.load()
    for i, l in enumerate(meta.loops):
        if l.id == loop_id:
            loop.id = loop_id
            meta.loops[i] = loop
            store.save(meta)
            return loop
    raise HTTPException(status_code=404, detail="Loop not found")

@router.delete("/{loop_id}")
async def delete_loop(loop_id: str):
    store = get_store()
    meta = store.load()
    meta.loops = [l for l in meta.loops if l.id != loop_id]
    store.save(meta)
    return {"ok": True}
