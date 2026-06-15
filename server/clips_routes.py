from fastapi import APIRouter
from fastapi.responses import FileResponse
from typing import List
import pathlib
from server.models import Clip
from server.deps import get_store, get_scanner, VIDEOS_DIR, THUMBS_DIR

router = APIRouter()

@router.get("/clips", response_model=List[Clip])
async def list_clips():
    return get_store().load().clips

@router.get("/videos/{filename}")
async def serve_video(filename: str):
    return FileResponse(VIDEOS_DIR / filename)

@router.get("/thumbnails/{filename}")
async def serve_thumbnail(filename: str):
    thumb = THUMBS_DIR / filename
    if not thumb.exists():
        stem = pathlib.Path(filename).stem
        get_scanner().generate_thumbnail(stem + ".mp4")
    return FileResponse(thumb)
