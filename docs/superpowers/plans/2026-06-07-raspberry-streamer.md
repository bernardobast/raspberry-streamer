# raspberry-streamer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a VJ media player for live DJ sets — the Raspberry Pi plays video clips on a TV while a phone browser controls playback in real time with analog-style WebGL transitions.

**Architecture:** A Python FastAPI server manages clip/loop metadata, serves static files, and relays WebSocket commands between the phone controller and the Pi player. Chromium runs fullscreen in kiosk mode on the Pi, rendering video through a WebGL canvas with GLSL shaders for analog-style transitions. The phone opens a 3-panel web controller served by the same FastAPI app.

**Tech Stack:** Python 3.11+, FastAPI 0.115+, uvicorn, Pillow, pytest, pytest-asyncio, httpx, httpx-ws; vanilla JS + WebGL; HTML5 video; ffmpeg (system package, for thumbnails)

**Workflow:** Each task maps to a GitHub issue + feature branch + PR. Create the issue, branch off `main`, implement, open PR, wait for review before merging. Never push directly to `main`.

---

## File Structure

```
raspberry-streamer/
├── server/
│   ├── __init__.py
│   ├── main.py           # FastAPI app entry point, mounts routes + static files
│   ├── models.py         # Pydantic models: Clip, Loop, LoopStep, Metadata, PlayerState
│   ├── store.py          # MetadataStore: load/save data/metadata.json
│   ├── deps.py           # Singletons: store, scanner, path constants
│   ├── clips.py          # ClipScanner: scan videos/, generate thumbnails via ffmpeg
│   ├── clips_routes.py   # GET /clips, GET /videos/{f}, GET /thumbnails/{f}
│   ├── loops_routes.py   # CRUD /loops
│   └── ws.py             # WebSocket endpoint, ConnectionManager, state machine
├── static/
│   ├── player/
│   │   ├── index.html    # Pi kiosk display page
│   │   ├── renderer.js   # WebGL canvas renderer (video textures + shader blending)
│   │   ├── client.js     # WebSocket client + loop sequencer
│   │   └── shaders/
│   │       ├── dissolve.glsl
│   │       ├── vhs.glsl
│   │       ├── film-burn.glsl
│   │       └── glitch.glsl
│   └── controller/
│       ├── index.html    # Phone controller shell + tab nav
│       ├── api.js        # WebSocket + fetch helpers
│       ├── clips.js      # Clips panel: thumbnail grid, tap to play
│       ├── loops.js      # Loops panel: list, create, edit, reorder, activate
│       └── now-playing.js # Now Playing: status, stop, transition picker
├── data/
│   └── metadata.json     # Auto-created on first run
├── videos/               # Drop .mp4 clips here (symlink to /home/pi/videos on Pi)
├── tests/
│   ├── conftest.py
│   ├── test_main.py
│   ├── test_store.py
│   ├── test_clips.py
│   ├── test_loops.py
│   └── test_ws.py
├── scripts/
│   ├── start.sh
│   └── raspberry-streamer.service
├── pytest.ini
├── requirements.txt
└── .gitignore
```

---

### Task 1: Project scaffolding

**Files:**
- Create: `requirements.txt`
- Create: `pytest.ini`
- Create: `server/__init__.py`
- Create: `server/main.py`
- Create: `tests/conftest.py`
- Create: `tests/test_main.py`
- Create: `.gitignore`

- [ ] **Step 1: Create `requirements.txt`**

```
fastapi==0.115.5
uvicorn[standard]==0.32.1
pillow==11.0.0
python-multipart==0.0.12
pytest==8.3.4
pytest-asyncio==0.24.0
httpx==0.28.0
httpx-ws==0.7.0
```

- [ ] **Step 2: Install dependencies**

```bash
pip install -r requirements.txt
```

Expected: all packages install without error.

- [ ] **Step 3: Create directory structure**

```bash
mkdir -p server static/player/shaders static/controller data videos tests scripts
touch data/.gitkeep videos/.gitkeep server/__init__.py
```

- [ ] **Step 4: Create `pytest.ini`**

```ini
[pytest]
asyncio_mode = auto
```

- [ ] **Step 5: Write failing test**

Create `tests/test_main.py`:
```python
import pytest

@pytest.mark.asyncio
async def test_health(client):
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

Create `tests/conftest.py`:
```python
import pytest
from httpx import AsyncClient, ASGITransport
from server.main import app

@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c

@pytest.fixture(autouse=True)
def reset_loops():
    """Restore loop state after each test to avoid inter-test contamination."""
    from server.deps import get_store
    store = get_store()
    meta = store.load()
    original_loops = [l.model_copy() for l in meta.loops]
    yield
    meta = store.load()
    meta.loops = original_loops
    store.save(meta)
```

- [ ] **Step 6: Run test to verify it fails**

```bash
pytest tests/test_main.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'server'`

- [ ] **Step 7: Create `server/main.py`**

```python
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
import pathlib

BASE_DIR = pathlib.Path(__file__).parent.parent

app = FastAPI()
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")

@app.get("/health")
async def health():
    return {"status": "ok"}
```

- [ ] **Step 8: Run test to verify it passes**

```bash
pytest tests/test_main.py -v
```

Expected: PASS

- [ ] **Step 9: Create `.gitignore`**

```
__pycache__/
*.pyc
*.pyo
.pytest_cache/
.venv/
venv/
*.egg-info/
data/metadata.json
data/thumbs/
videos/*
!videos/.gitkeep
```

- [ ] **Step 10: Commit**

```bash
git add requirements.txt pytest.ini server/ tests/ .gitignore data/.gitkeep videos/.gitkeep
git commit -m "feat: project scaffolding, FastAPI skeleton, health endpoint"
```

---

### Task 2: Data models and metadata persistence

**Files:**
- Create: `server/models.py`
- Create: `server/store.py`
- Create: `server/deps.py`
- Create: `tests/test_store.py`

- [ ] **Step 1: Write failing tests**

Create `tests/test_store.py`:
```python
import pytest
import pathlib
from server.models import Metadata, Clip
from server.store import MetadataStore

@pytest.fixture
def store(tmp_path):
    return MetadataStore(tmp_path / "metadata.json")

def test_load_returns_empty_metadata_when_no_file(store):
    meta = store.load()
    assert meta.clips == []
    assert meta.loops == []
    assert meta.default_transition == "dissolve"
    assert meta.default_duration == 1.0

def test_save_and_reload_round_trips_data(store):
    meta = Metadata(
        clips=[Clip(id="abc", filename="a.mp4", name="A", mode="loop",
                    transition_in="dissolve", transition_out="dissolve",
                    transition_duration=1.0)],
        loops=[],
    )
    store.save(meta)
    reloaded = store.load()
    assert len(reloaded.clips) == 1
    assert reloaded.clips[0].id == "abc"
    assert reloaded.clips[0].name == "A"

def test_save_creates_file(store):
    store.save(Metadata())
    assert store.path.exists()
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_store.py -v
```

Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Create `server/models.py`**

```python
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid

class Clip(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    filename: str
    name: str
    mode: str = "loop"          # "loop" | "one-shot"
    transition_in: str = "dissolve"
    transition_out: str = "dissolve"
    transition_duration: float = 1.0

class LoopStep(BaseModel):
    clip_id: str
    transition: Optional[str] = None           # overrides global default if set
    transition_duration: Optional[float] = None

class Loop(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    steps: List[LoopStep] = []

class Metadata(BaseModel):
    clips: List[Clip] = []
    loops: List[Loop] = []
    default_transition: str = "dissolve"
    default_duration: float = 1.0

class PlayerState(BaseModel):
    active_clip_id: Optional[str] = None
    active_loop_id: Optional[str] = None
    loop_step_index: int = 0
    is_playing: bool = False
    transition: str = "dissolve"
    transition_duration: float = 1.0
```

- [ ] **Step 4: Create `server/store.py`**

```python
import pathlib
from server.models import Metadata

class MetadataStore:
    def __init__(self, path: pathlib.Path):
        self.path = path

    def load(self) -> Metadata:
        if not self.path.exists():
            return Metadata()
        return Metadata.model_validate_json(self.path.read_text())

    def save(self, meta: Metadata) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(meta.model_dump_json(indent=2))
```

- [ ] **Step 5: Create `server/deps.py`**

```python
import pathlib
from server.store import MetadataStore
from server.clips import ClipScanner

BASE_DIR = pathlib.Path(__file__).parent.parent
VIDEOS_DIR = BASE_DIR / "videos"
THUMBS_DIR = BASE_DIR / "data" / "thumbs"
DATA_DIR = BASE_DIR / "data"

THUMBS_DIR.mkdir(parents=True, exist_ok=True)

_store = MetadataStore(DATA_DIR / "metadata.json")
_scanner = ClipScanner(VIDEOS_DIR, THUMBS_DIR)

def get_store() -> MetadataStore:
    return _store

def get_scanner() -> ClipScanner:
    return _scanner
```

Note: `deps.py` imports `ClipScanner` — create a stub `server/clips.py` now so the import doesn't fail:

```python
# server/clips.py (stub — full implementation in Task 3)
import pathlib
from typing import List, Optional
from server.models import Clip, Metadata

VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".webm"}

class ClipScanner:
    def __init__(self, videos_dir: pathlib.Path, thumbs_dir: pathlib.Path):
        self.videos_dir = videos_dir
        self.thumbs_dir = thumbs_dir

    def scan(self, existing: Optional[Metadata] = None) -> List[Clip]:
        return []

    def generate_thumbnail(self, filename: str) -> pathlib.Path:
        return self.thumbs_dir / (pathlib.Path(filename).stem + ".jpg")
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
pytest tests/test_store.py -v
```

Expected: all 3 PASS

- [ ] **Step 7: Run full suite**

```bash
pytest tests/ -v
```

Expected: all PASS

- [ ] **Step 8: Commit**

```bash
git add server/models.py server/store.py server/deps.py server/clips.py tests/test_store.py
git commit -m "feat: data models, metadata persistence, dependency singletons"
```

---

### Task 3: Clip scanning and HTTP routes

**Files:**
- Modify: `server/clips.py` (replace stub)
- Create: `server/clips_routes.py`
- Modify: `server/main.py`
- Create: `tests/test_clips.py`

- [ ] **Step 1: Write failing tests**

Create `tests/test_clips.py`:
```python
import pytest
import pathlib
from server.clips import ClipScanner
from server.models import Metadata, Clip

@pytest.fixture
def videos_dir(tmp_path):
    d = tmp_path / "videos"
    d.mkdir()
    (d / "my_clip.mp4").write_bytes(b"fake")
    (d / "not_a_video.txt").write_text("skip")
    return d

@pytest.fixture
def thumbs_dir(tmp_path):
    d = tmp_path / "thumbs"
    d.mkdir()
    return d

def test_scan_finds_video_files(videos_dir, thumbs_dir):
    scanner = ClipScanner(videos_dir, thumbs_dir)
    filenames = [c.filename for c in scanner.scan()]
    assert "my_clip.mp4" in filenames
    assert "not_a_video.txt" not in filenames

def test_scan_derives_name_from_filename(videos_dir, thumbs_dir):
    scanner = ClipScanner(videos_dir, thumbs_dir)
    clips = scanner.scan()
    assert clips[0].name == "my clip"

def test_scan_preserves_existing_metadata(videos_dir, thumbs_dir):
    existing = Metadata(clips=[
        Clip(id="kept-id", filename="my_clip.mp4", name="Custom Name",
             mode="one-shot", transition_in="vhs", transition_out="vhs",
             transition_duration=0.5)
    ])
    scanner = ClipScanner(videos_dir, thumbs_dir)
    clips = scanner.scan(existing)
    assert len(clips) == 1
    assert clips[0].id == "kept-id"
    assert clips[0].name == "Custom Name"
    assert clips[0].mode == "one-shot"

@pytest.mark.asyncio
async def test_get_clips_returns_list(client):
    response = await client.get("/clips")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_clips.py -v
```

Expected: first 3 FAIL (stub returns `[]` but name/preserve tests check real logic); last FAIL (route not mounted)

- [ ] **Step 3: Replace stub `server/clips.py` with full implementation**

```python
import pathlib
import subprocess
from typing import List, Optional
from server.models import Clip, Metadata

VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".webm"}

class ClipScanner:
    def __init__(self, videos_dir: pathlib.Path, thumbs_dir: pathlib.Path):
        self.videos_dir = videos_dir
        self.thumbs_dir = thumbs_dir

    def scan(self, existing: Optional[Metadata] = None) -> List[Clip]:
        by_filename = {c.filename: c for c in (existing.clips if existing else [])}
        clips = []
        for f in sorted(self.videos_dir.iterdir()):
            if f.suffix.lower() not in VIDEO_EXTENSIONS:
                continue
            if f.name in by_filename:
                clips.append(by_filename[f.name])
            else:
                name = f.stem.replace("_", " ").replace("-", " ")
                clips.append(Clip(filename=f.name, name=name))
        return clips

    def generate_thumbnail(self, filename: str) -> pathlib.Path:
        thumb = self.thumbs_dir / (pathlib.Path(filename).stem + ".jpg")
        if thumb.exists():
            return thumb
        video = self.videos_dir / filename
        subprocess.run(
            ["ffmpeg", "-i", str(video), "-ss", "00:00:01",
             "-vframes", "1", "-q:v", "2", str(thumb)],
            capture_output=True, check=False,
        )
        return thumb
```

- [ ] **Step 4: Run scanner tests to verify they pass**

```bash
pytest tests/test_clips.py::test_scan_finds_video_files tests/test_clips.py::test_scan_derives_name_from_filename tests/test_clips.py::test_scan_preserves_existing_metadata -v
```

Expected: all 3 PASS

- [ ] **Step 5: Create `server/clips_routes.py`**

```python
from fastapi import APIRouter
from fastapi.responses import FileResponse
from typing import List
from server.models import Clip
from server.deps import get_store, get_scanner, VIDEOS_DIR, THUMBS_DIR
import pathlib

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
```

- [ ] **Step 6: Update `server/main.py` to mount clip routes and scan on startup**

```python
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
import pathlib
from server.clips_routes import router as clips_router
from server.deps import get_store, get_scanner

BASE_DIR = pathlib.Path(__file__).parent.parent

app = FastAPI()
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
app.include_router(clips_router)

@app.on_event("startup")
async def startup():
    store = get_store()
    scanner = get_scanner()
    meta = store.load()
    meta.clips = scanner.scan(meta)
    store.save(meta)

@app.get("/health")
async def health():
    return {"status": "ok"}
```

- [ ] **Step 7: Run all tests**

```bash
pytest tests/ -v
```

Expected: all PASS

- [ ] **Step 8: Commit**

```bash
git add server/clips.py server/clips_routes.py server/main.py tests/test_clips.py
git commit -m "feat: clip scanning, thumbnail generation, and clip HTTP routes"
```

---

### Task 4: Loop management routes

**Files:**
- Create: `server/loops_routes.py`
- Modify: `server/main.py`
- Create: `tests/test_loops.py`

- [ ] **Step 1: Write failing tests**

Create `tests/test_loops.py`:
```python
import pytest

@pytest.mark.asyncio
async def test_list_loops_returns_list(client):
    response = await client.get("/loops")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

@pytest.mark.asyncio
async def test_create_loop(client):
    payload = {"name": "Test Loop", "steps": [{"clip_id": "clip-1"}]}
    response = await client.post("/loops", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Test Loop"
    assert "id" in data
    assert len(data["steps"]) == 1

@pytest.mark.asyncio
async def test_update_loop(client):
    create = await client.post("/loops", json={"name": "Old", "steps": []})
    loop_id = create.json()["id"]
    update = await client.put(f"/loops/{loop_id}", json={"name": "New", "steps": []})
    assert update.status_code == 200
    assert update.json()["name"] == "New"

@pytest.mark.asyncio
async def test_update_nonexistent_loop_returns_404(client):
    response = await client.put("/loops/no-such-id", json={"name": "X", "steps": []})
    assert response.status_code == 404

@pytest.mark.asyncio
async def test_delete_loop(client):
    create = await client.post("/loops", json={"name": "Bye", "steps": []})
    loop_id = create.json()["id"]
    await client.delete(f"/loops/{loop_id}")
    loops = (await client.get("/loops")).json()
    assert loop_id not in [l["id"] for l in loops]
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_loops.py -v
```

Expected: FAIL — 404 Not Found (routes not mounted)

- [ ] **Step 3: Create `server/loops_routes.py`**

```python
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
```

- [ ] **Step 4: Mount loop routes in `server/main.py`**

Add these two lines to `server/main.py` (after the existing `clips_router` import and `include_router`):

```python
from server.loops_routes import router as loops_router
# ...
app.include_router(loops_router)
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pytest tests/test_loops.py -v
```

Expected: all 5 PASS

- [ ] **Step 6: Run full suite**

```bash
pytest tests/ -v
```

Expected: all PASS

- [ ] **Step 7: Commit**

```bash
git add server/loops_routes.py server/main.py tests/test_loops.py
git commit -m "feat: loop CRUD HTTP routes"
```

---

### Task 5: WebSocket state machine

**Files:**
- Create: `server/ws.py`
- Modify: `server/main.py`
- Create: `tests/test_ws.py`

**Protocol:**

Controller → Server:
```json
{"type": "play_clip", "clip_id": "uuid"}
{"type": "play_loop", "loop_id": "uuid"}
{"type": "stop"}
{"type": "set_transition", "transition": "vhs", "duration": 1.5}
{"type": "clip_ended", "clip_id": "uuid"}
```

Server → All clients (player + controllers):
```json
{"type": "play", "clip_id": "uuid", "loop_id": null,
 "video_url": "/videos/clip.mp4", "mode": "loop",
 "transition": "dissolve", "duration": 1.0}
{"type": "stop"}
{"type": "state", "active_clip_id": "uuid", "active_loop_id": null,
 "loop_step_index": 0, "is_playing": true,
 "transition": "dissolve", "transition_duration": 1.0}
```

`loop_id` is always present in `play` messages (`null` when playing a standalone clip), so controllers can show the active loop name.

- [ ] **Step 1: Write failing tests**

Create `tests/test_ws.py`:
```python
import pytest
from httpx import AsyncClient, ASGITransport
from httpx_ws import aconnect_ws
from server.main import app

@pytest.mark.asyncio
async def test_connect_receives_initial_state():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as http:
        async with aconnect_ws("/ws", http) as ws:
            msg = await ws.receive_json()
            assert msg["type"] == "state"
            assert "active_clip_id" in msg
            assert "is_playing" in msg

@pytest.mark.asyncio
async def test_stop_command_broadcasts_stop():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as http:
        async with aconnect_ws("/ws", http) as ws1, aconnect_ws("/ws", http) as ws2:
            await ws1.receive_json()  # consume initial state
            await ws2.receive_json()
            await ws1.send_json({"type": "stop"})
            msg = await ws2.receive_json()
            assert msg["type"] == "stop"

@pytest.mark.asyncio
async def test_set_transition_updates_state():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as http:
        async with aconnect_ws("/ws", http) as ws:
            await ws.receive_json()
            await ws.send_json({"type": "set_transition", "transition": "glitch", "duration": 0.8})
            # No broadcast expected — just verify no error and state updated in manager
            from server.ws import manager
            assert manager.state.transition == "glitch"
            assert manager.state.transition_duration == 0.8
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_ws.py -v
```

Expected: FAIL — no `/ws` route

- [ ] **Step 3: Create `server/ws.py`**

```python
from fastapi import WebSocket, WebSocketDisconnect
from server.models import PlayerState
from server.deps import get_store

class ConnectionManager:
    def __init__(self):
        self.active: list[WebSocket] = []
        self.state = PlayerState()

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)
        await ws.send_json({"type": "state", **self.state.model_dump()})

    def disconnect(self, ws: WebSocket):
        if ws in self.active:
            self.active.remove(ws)

    async def broadcast(self, msg: dict):
        for ws in list(self.active):
            try:
                await ws.send_json(msg)
            except Exception:
                self.active.remove(ws)

    async def handle(self, data: dict):
        t = data.get("type")
        meta = get_store().load()

        if t == "play_clip":
            clip = next((c for c in meta.clips if c.id == data["clip_id"]), None)
            if not clip:
                return
            self.state.active_clip_id = clip.id
            self.state.active_loop_id = None
            self.state.loop_step_index = 0
            self.state.is_playing = True
            await self.broadcast({
                "type": "play",
                "clip_id": clip.id,
                "loop_id": None,
                "video_url": f"/videos/{clip.filename}",
                "mode": clip.mode,
                "transition": self.state.transition,
                "duration": self.state.transition_duration,
            })

        elif t == "play_loop":
            loop = next((l for l in meta.loops if l.id == data["loop_id"]), None)
            if not loop or not loop.steps:
                return
            step = loop.steps[0]
            clip = next((c for c in meta.clips if c.id == step.clip_id), None)
            if not clip:
                return
            self.state.active_loop_id = loop.id
            self.state.active_clip_id = clip.id
            self.state.loop_step_index = 0
            self.state.is_playing = True
            transition = step.transition or self.state.transition
            duration = step.transition_duration or self.state.transition_duration
            await self.broadcast({
                "type": "play",
                "clip_id": clip.id,
                "loop_id": loop.id,
                "video_url": f"/videos/{clip.filename}",
                "mode": "one-shot",  # sequencer in server advances steps
                "transition": transition,
                "duration": duration,
            })

        elif t == "clip_ended":
            if not self.state.active_loop_id:
                return
            loop = next((l for l in meta.loops if l.id == self.state.active_loop_id), None)
            if not loop:
                return
            next_idx = (self.state.loop_step_index + 1) % len(loop.steps)
            self.state.loop_step_index = next_idx
            step = loop.steps[next_idx]
            clip = next((c for c in meta.clips if c.id == step.clip_id), None)
            if not clip:
                return
            self.state.active_clip_id = clip.id
            transition = step.transition or self.state.transition
            duration = step.transition_duration or self.state.transition_duration
            await self.broadcast({
                "type": "play",
                "clip_id": clip.id,
                "loop_id": loop.id,
                "video_url": f"/videos/{clip.filename}",
                "mode": "one-shot",
                "transition": transition,
                "duration": duration,
            })

        elif t == "stop":
            self.state.is_playing = False
            self.state.active_clip_id = None
            self.state.active_loop_id = None
            await self.broadcast({"type": "stop"})

        elif t == "set_transition":
            self.state.transition = data.get("transition", self.state.transition)
            self.state.transition_duration = data.get("duration", self.state.transition_duration)

manager = ConnectionManager()

async def ws_endpoint(ws: WebSocket):
    await manager.connect(ws)
    try:
        while True:
            data = await ws.receive_json()
            await manager.handle(data)
    except WebSocketDisconnect:
        manager.disconnect(ws)
```

- [ ] **Step 4: Mount WebSocket in `server/main.py`**

Add to `server/main.py`:
```python
from fastapi import WebSocket
from server.ws import ws_endpoint

@app.websocket("/ws")
async def websocket_route(ws: WebSocket):
    await ws_endpoint(ws)
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pytest tests/test_ws.py -v
```

Expected: all 3 PASS

- [ ] **Step 6: Run full suite**

```bash
pytest tests/ -v
```

Expected: all PASS

- [ ] **Step 7: Commit**

```bash
git add server/ws.py server/main.py tests/test_ws.py
git commit -m "feat: WebSocket state machine with loop sequencer"
```

---

### Task 6: Pi player — WebGL renderer and GLSL shaders

**Files:**
- Create: `static/player/index.html`
- Create: `static/player/renderer.js`
- Create: `static/player/shaders/dissolve.glsl`
- Create: `static/player/shaders/vhs.glsl`
- Create: `static/player/shaders/film-burn.glsl`
- Create: `static/player/shaders/glitch.glsl`

The renderer keeps two hidden `<video>` elements as texture sources. A full-screen `<canvas>` renders through WebGL at all times. During idle (no transition), `u_progress = 1.0` so the shader shows the active video at full opacity. During a transition, `u_progress` animates from 0.0 → 1.0 over `duration` seconds, then the active/inactive index swaps.

- [ ] **Step 1: Create `static/player/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>raspberry-streamer</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #000; overflow: hidden; width: 100vw; height: 100vh; }
    canvas { display: block; width: 100%; height: 100%; }
    video { display: none; }
  </style>
</head>
<body>
  <canvas id="gl-canvas"></canvas>
  <video id="video-a" crossorigin="anonymous" playsinline></video>
  <video id="video-b" crossorigin="anonymous" playsinline></video>
  <script type="module" src="/static/player/renderer.js"></script>
  <script type="module" src="/static/player/client.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `static/player/shaders/dissolve.glsl`**

```glsl
precision mediump float;
uniform sampler2D u_from;
uniform sampler2D u_to;
uniform float u_progress;
varying vec2 v_uv;

float rand(vec2 co) {
  return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec4 from = texture2D(u_from, v_uv);
  vec4 to   = texture2D(u_to,   v_uv);
  float grain = (rand(v_uv + u_progress) - 0.5) * 0.08;
  gl_FragColor = mix(from, to, clamp(u_progress + grain, 0.0, 1.0));
}
```

- [ ] **Step 3: Create `static/player/shaders/vhs.glsl`**

```glsl
precision mediump float;
uniform sampler2D u_from;
uniform sampler2D u_to;
uniform float u_progress;
varying vec2 v_uv;

float rand(vec2 co) {
  return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  float scan  = sin(v_uv.y * 400.0) * 0.015 * u_progress;
  float bleed = 0.004 * u_progress;

  vec4 from = vec4(
    texture2D(u_from, vec2(v_uv.x + scan + bleed, v_uv.y)).r,
    texture2D(u_from, vec2(v_uv.x + scan,         v_uv.y)).g,
    texture2D(u_from, vec2(v_uv.x + scan - bleed, v_uv.y)).b,
    1.0
  );
  vec4 to = texture2D(u_to, vec2(v_uv.x - scan, v_uv.y));

  float noise = step(0.97, rand(vec2(
    floor(v_uv.y * 80.0),
    floor(u_progress * 30.0)
  )));
  gl_FragColor = mix(from, to, u_progress) + vec4(noise * 0.15);
}
```

- [ ] **Step 4: Create `static/player/shaders/film-burn.glsl`**

```glsl
precision mediump float;
uniform sampler2D u_from;
uniform sampler2D u_to;
uniform float u_progress;
varying vec2 v_uv;

float rand(vec2 co) {
  return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec4 from = texture2D(u_from, v_uv);
  vec4 to   = texture2D(u_to,   v_uv);

  float burn  = u_progress * 1.6 - v_uv.x * 0.6;
  float noise = rand(v_uv + vec2(u_progress * 3.7)) * 0.25;
  float mask  = clamp(burn + noise, 0.0, 1.0);

  vec4 fire = mix(
    vec4(1.0, 0.35, 0.0, 1.0),
    vec4(1.0, 1.0,  0.9, 1.0),
    smoothstep(0.4, 0.8, mask)
  );

  if (mask < 0.5) {
    gl_FragColor = mix(from, fire, mask * 2.0);
  } else {
    gl_FragColor = mix(fire, to, (mask - 0.5) * 2.0);
  }
}
```

- [ ] **Step 5: Create `static/player/shaders/glitch.glsl`**

```glsl
precision mediump float;
uniform sampler2D u_from;
uniform sampler2D u_to;
uniform float u_progress;
varying vec2 v_uv;

float rand(vec2 co) {
  return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  float block_y = floor(v_uv.y * 24.0) / 24.0;
  float t_block = floor(u_progress * 12.0) / 12.0;
  float offset  = (rand(vec2(block_y, t_block)) - 0.5) * 0.08 * u_progress;

  vec2  uv_g = vec2(fract(v_uv.x + offset), v_uv.y);
  float split = 0.008 * u_progress;

  vec4 from = vec4(
    texture2D(u_from, vec2(uv_g.x + split, uv_g.y)).r,
    texture2D(u_from, uv_g).g,
    texture2D(u_from, vec2(uv_g.x - split, uv_g.y)).b,
    1.0
  );
  gl_FragColor = mix(from, texture2D(u_to, uv_g), u_progress);
}
```

- [ ] **Step 6: Create `static/player/renderer.js`**

```javascript
const VERTEX_SRC = `
  attribute vec2 a_position;
  varying vec2 v_uv;
  void main() {
    v_uv = vec2(a_position.x * 0.5 + 0.5, 0.5 - a_position.y * 0.5);
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
    throw new Error(gl.getShaderInfoLog(s));
  return s;
}

function link(gl, fragSrc) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VERTEX_SRC));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fragSrc));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(p));
  return p;
}

function makeTex(gl) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  return t;
}

export class Renderer {
  constructor(canvas, videoA, videoB) {
    this.canvas = canvas;
    this.videos = [videoA, videoB];
    this.activeIdx = 0;
    this.progress = 1.0;
    this.gl = canvas.getContext('webgl');
    this.programs = {};
    this.textures = [makeTex(this.gl), makeTex(this.gl)];
    this._activeShader = 'dissolve';
    this._setupGeometry();
  }

  _setupGeometry() {
    const gl = this.gl;
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    this._buf = buf;
  }

  async loadAllShaders() {
    const names = ['dissolve', 'vhs', 'film-burn', 'glitch'];
    await Promise.all(names.map(async name => {
      const res = await fetch(`/static/player/shaders/${name}.glsl`);
      this.programs[name] = link(this.gl, await res.text());
    }));
  }

  _frame() {
    const gl = this.gl;
    this.canvas.width  = this.canvas.clientWidth;
    this.canvas.height = this.canvas.clientHeight;
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);

    const prog = this.programs[this._activeShader] || this.programs['dissolve'];
    gl.useProgram(prog);

    const upload = (texIdx, videoIdx) => {
      gl.activeTexture(gl.TEXTURE0 + texIdx);
      gl.bindTexture(gl.TEXTURE_2D, this.textures[videoIdx]);
      const v = this.videos[videoIdx];
      if (v.readyState >= 2)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, v);
    };
    upload(0, this.activeIdx);
    upload(1, 1 - this.activeIdx);

    gl.uniform1i(gl.getUniformLocation(prog, 'u_from'), 0);
    gl.uniform1i(gl.getUniformLocation(prog, 'u_to'),   1);
    gl.uniform1f(gl.getUniformLocation(prog, 'u_progress'), this.progress);

    const loc = gl.getAttribLocation(prog, 'a_position');
    gl.bindBuffer(gl.ARRAY_BUFFER, this._buf);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  startLoop() {
    const tick = () => { this._frame(); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }

  async transition(shaderName, durationSecs) {
    this._activeShader = shaderName;
    const start = performance.now();
    await new Promise(resolve => {
      const tick = (now) => {
        this.progress = Math.min((now - start) / (durationSecs * 1000), 1.0);
        if (this.progress < 1.0) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
    this.activeIdx = 1 - this.activeIdx;
    this.progress = 1.0;
  }
}
```

- [ ] **Step 7: Verify shaders load in browser**

```bash
uvicorn server.main:app --reload --host 0.0.0.0 --port 8000
```

Open `http://localhost:8000/static/player/index.html` in Chromium. Expected: black screen, no JS errors in console, no network errors for `.glsl` files.

- [ ] **Step 8: Commit**

```bash
git add static/player/
git commit -m "feat: Pi player WebGL renderer and GLSL transition shaders"
```

---

### Task 7: Pi player — WebSocket client and loop sequencer

**Files:**
- Create: `static/player/client.js`

- [ ] **Step 1: Create `static/player/client.js`**

```javascript
import { Renderer } from '/static/player/renderer.js';

const canvas  = document.getElementById('gl-canvas');
const videoA  = document.getElementById('video-a');
const videoB  = document.getElementById('video-b');

const renderer = new Renderer(canvas, videoA, videoB);

async function init() {
  await renderer.loadAllShaders();
  renderer.startLoop();
  connect();
}

function connect() {
  const ws = new WebSocket(`ws://${location.host}/ws`);

  ws.onmessage = async (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === 'play') {
      await play(ws, msg);
    } else if (msg.type === 'stop') {
      videoA.pause(); videoA.src = '';
      videoB.pause(); videoB.src = '';
    }
  };

  ws.onclose = () => setTimeout(connect, 2000);
}

async function play(ws, msg) {
  const { clip_id, video_url, mode, transition, duration } = msg;

  const nextIdx   = 1 - renderer.activeIdx;
  const nextVideo = renderer.videos[nextIdx];
  const prevVideo = renderer.videos[renderer.activeIdx];

  nextVideo.src  = video_url;
  nextVideo.loop = (mode === 'loop');

  await new Promise((resolve, reject) => {
    nextVideo.oncanplay = resolve;
    nextVideo.onerror   = reject;
    nextVideo.load();
  });

  nextVideo.play().catch(() => {});
  await renderer.transition(transition, duration);

  prevVideo.pause();
  prevVideo.src = '';

  if (mode === 'one-shot') {
    renderer.videos[renderer.activeIdx].onended = () => {
      ws.send(JSON.stringify({ type: 'clip_ended', clip_id }));
    };
  } else {
    renderer.videos[renderer.activeIdx].onended = null;
  }
}

init();
```

- [ ] **Step 2: End-to-end manual test**

1. Drop a `.mp4` file into `videos/`
2. Start server: `uvicorn server.main:app --reload --host 0.0.0.0 --port 8000`
3. Open `http://localhost:8000/static/player/index.html` in one tab (the "TV")
4. In DevTools console of that tab, open a WebSocket: `const ws = new WebSocket('ws://localhost:8000/ws')`
5. Get the clip id: `fetch('/clips').then(r=>r.json()).then(console.log)`
6. Send play command: `ws.send(JSON.stringify({type:'play_clip', clip_id:'<id>'}))`

Expected: video plays fullscreen with dissolve transition; no errors in console.

- [ ] **Step 3: Test loop sequencer**

1. Create a loop via the API: `fetch('/loops', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({name:'Test', steps:[{clip_id:'<id1>'},{clip_id:'<id1>'}]})})`
2. Play the loop: `ws.send(JSON.stringify({type:'play_loop', loop_id:'<loop_id>'}))`

Expected: clip plays, ends (one-shot), transitions back to the same clip (loop cycles).

- [ ] **Step 4: Commit**

```bash
git add static/player/client.js
git commit -m "feat: Pi player WebSocket client with loop sequencer"
```

---

### Task 8: Phone controller — Clips panel

**Files:**
- Create: `static/controller/index.html`
- Create: `static/controller/api.js`
- Create: `static/controller/clips.js`

- [ ] **Step 1: Create `static/controller/api.js`**

```javascript
let ws;
const _listeners = new Set();

export function connectWS(onMessage) {
  _listeners.add(onMessage);
  if (ws && ws.readyState === WebSocket.OPEN) return;
  ws = new WebSocket(`ws://${location.host}/ws`);
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    _listeners.forEach(fn => fn(msg));
  };
  ws.onclose = () => setTimeout(() => connectWS(onMessage), 2000);
}

export function sendCommand(cmd) {
  if (ws && ws.readyState === WebSocket.OPEN)
    ws.send(JSON.stringify(cmd));
}

export const fetchClips  = () => fetch('/clips').then(r => r.json());
export const fetchLoops  = () => fetch('/loops').then(r => r.json());

export const createLoop = (loop) =>
  fetch('/loops', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(loop) }).then(r => r.json());

export const updateLoop = (id, loop) =>
  fetch(`/loops/${id}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(loop) }).then(r => r.json());

export const deleteLoop = (id) =>
  fetch(`/loops/${id}`, { method: 'DELETE' });
```

- [ ] **Step 2: Create `static/controller/clips.js`**

```javascript
import { fetchClips, sendCommand } from '/static/controller/api.js';

export async function renderClipsPanel(container) {
  const clips = await fetchClips();
  container.innerHTML = '';

  if (clips.length === 0) {
    container.innerHTML = '<p class="empty">No clips found. Add .mp4 files to videos/</p>';
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'clip-grid';

  clips.forEach(clip => {
    const btn = document.createElement('button');
    btn.className = 'clip-card';
    btn.dataset.clipId = clip.id;
    const thumbFile = clip.filename.replace(/\.[^.]+$/, '.jpg');
    btn.innerHTML = `
      <img src="/thumbnails/${thumbFile}" alt="${clip.name}"
           onerror="this.style.display='none'" />
      <span class="clip-name">${clip.name}</span>
      <span class="clip-mode">${clip.mode}</span>
    `;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.clip-card').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      sendCommand({ type: 'play_clip', clip_id: clip.id });
    });
    grid.appendChild(btn);
  });

  container.appendChild(grid);
}
```

- [ ] **Step 3: Create `static/controller/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>VJ Controller</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: monospace; background: #111; color: #eee;
           height: 100dvh; display: flex; flex-direction: column; }

    /* Tab nav */
    nav { display: flex; border-bottom: 1px solid #333; flex-shrink: 0; }
    nav button { flex: 1; padding: 12px 4px; background: none; border: none;
                 color: #666; font: inherit; font-size: 13px; cursor: pointer; }
    nav button.active { color: #fff; border-bottom: 2px solid #fff; }

    /* Panels */
    .panel { flex: 1; overflow-y: auto; padding: 12px; display: none; }
    .panel.active { display: block; }
    .empty { color: #444; text-align: center; margin-top: 48px; font-size: 13px; }

    /* Clips */
    .clip-grid { display: grid;
                 grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); gap: 8px; }
    .clip-card { background: #1c1c1c; border: 1px solid #2a2a2a; border-radius: 6px;
                 padding: 6px; cursor: pointer; color: inherit; font: inherit;
                 text-align: left; width: 100%; }
    .clip-card:active, .clip-card.active { border-color: #fff; background: #2a2a2a; }
    .clip-card img { width: 100%; aspect-ratio: 16/9; object-fit: cover;
                     border-radius: 3px; display: block; background: #000; }
    .clip-name { display: block; margin-top: 4px; font-size: 11px;
                 white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .clip-mode { display: block; font-size: 10px; color: #555; }

    /* Shared form elements */
    .action-btn { display: block; width: 100%; padding: 10px; margin: 8px 0;
                  background: #1c1c1c; border: 1px solid #333; border-radius: 6px;
                  color: #eee; font: inherit; cursor: pointer; }
    .action-btn.primary { border-color: #888; }

    /* Loops */
    .loop-row { display: flex; justify-content: space-between; align-items: flex-start;
                padding: 10px; background: #1a1a1a; border-radius: 6px; margin: 6px 0; }
    .loop-info strong { display: block; font-size: 13px; }
    .loop-steps { font-size: 10px; color: #555; margin-top: 2px; }
    .loop-actions { display: flex; gap: 6px; flex-shrink: 0; }
    .loop-actions button { background: none; border: 1px solid #333; border-radius: 4px;
                           color: #aaa; padding: 4px 8px; cursor: pointer; font: inherit; }
    .step-row { display: flex; gap: 8px; align-items: center;
                padding: 6px 0; border-bottom: 1px solid #1e1e1e; font-size: 13px; }
    .step-row button { background: none; border: 1px solid #333; border-radius: 4px;
                       color: #aaa; padding: 2px 6px; cursor: pointer; font: inherit; font-size: 11px; }
    .loop-name-input, .clip-select {
      width: 100%; padding: 8px; background: #1a1a1a; border: 1px solid #333;
      border-radius: 6px; color: #eee; font: inherit; margin-bottom: 8px; }

    /* Now Playing */
    .np-status { text-align: center; padding: 28px 12px 16px; }
    .np-label { font-size: 10px; color: #444; letter-spacing: 2px; margin-bottom: 6px; }
    .np-name { font-size: 24px; font-weight: bold; min-height: 30px; }
    .np-type { font-size: 11px; color: #666; margin-top: 4px; min-height: 16px; }
    .transition-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
    .t-btn { padding: 10px; background: #1a1a1a; border: 1px solid #2a2a2a;
             border-radius: 6px; color: #777; font: inherit; cursor: pointer; }
    .t-btn.active { border-color: #aaa; color: #eee; background: #222; }
    #duration-slider { width: 100%; margin: 8px 0; accent-color: #fff; }
    #duration-val { text-align: center; font-size: 12px; color: #555; }
  </style>
</head>
<body>
  <nav>
    <button class="tab active" data-panel="clips">Clips</button>
    <button class="tab" data-panel="loops">Loops</button>
    <button class="tab" data-panel="now-playing">Now Playing</button>
  </nav>
  <div id="clips"       class="panel active"></div>
  <div id="loops"       class="panel"></div>
  <div id="now-playing" class="panel"></div>

  <script type="module">
    import { renderClipsPanel    } from '/static/controller/clips.js';
    import { renderLoopsPanel    } from '/static/controller/loops.js';
    import { renderNowPlayingPanel } from '/static/controller/now-playing.js';

    const renderers = {
      clips: renderClipsPanel,
      loops: renderLoopsPanel,
      'now-playing': renderNowPlayingPanel,
    };

    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        const name = tab.dataset.panel;
        const panel = document.getElementById(name);
        panel.classList.add('active');
        renderers[name](panel);
      });
    });

    renderClipsPanel(document.getElementById('clips'));
  </script>
</body>
</html>
```

- [ ] **Step 4: Manual test**

1. Start server: `uvicorn server.main:app --reload --host 0.0.0.0 --port 8000`
2. Add a `.mp4` file to `videos/`
3. Open `http://localhost:8000/static/controller/index.html` on phone or desktop
4. Expected: Clips tab shows a grid with the clip; tapping it plays on the player tab

- [ ] **Step 5: Commit**

```bash
git add static/controller/
git commit -m "feat: controller shell, tab nav, and clips panel"
```

---

### Task 9: Phone controller — Loops panel

**Files:**
- Create: `static/controller/loops.js`

- [ ] **Step 1: Create `static/controller/loops.js`**

```javascript
import { fetchClips, fetchLoops, createLoop, updateLoop, deleteLoop, sendCommand }
  from '/static/controller/api.js';

export async function renderLoopsPanel(container) {
  const [loops, clips] = await Promise.all([fetchLoops(), fetchClips()]);
  const byId = Object.fromEntries(clips.map(c => [c.id, c]));
  container.innerHTML = '';

  const newBtn = document.createElement('button');
  newBtn.className = 'action-btn';
  newBtn.textContent = '+ New Loop';
  newBtn.addEventListener('click', () => showEditor(container, null, clips, byId));
  container.appendChild(newBtn);

  if (loops.length === 0) {
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = 'No loops yet.';
    container.appendChild(p);
    return;
  }

  loops.forEach(loop => {
    const row = document.createElement('div');
    row.className = 'loop-row';
    const stepNames = loop.steps.map(s => byId[s.clip_id]?.name || '?').join(' → ');
    row.innerHTML = `
      <div class="loop-info">
        <strong>${loop.name}</strong>
        <div class="loop-steps">${stepNames || 'empty'}</div>
      </div>
      <div class="loop-actions">
        <button class="play-btn">▶</button>
        <button class="edit-btn">✏</button>
        <button class="del-btn">✕</button>
      </div>
    `;
    row.querySelector('.play-btn').addEventListener('click', () =>
      sendCommand({ type: 'play_loop', loop_id: loop.id }));
    row.querySelector('.edit-btn').addEventListener('click', () =>
      showEditor(container, loop, clips, byId));
    row.querySelector('.del-btn').addEventListener('click', async () => {
      await deleteLoop(loop.id);
      renderLoopsPanel(container);
    });
    container.appendChild(row);
  });
}

function showEditor(container, loop, clips, byId) {
  const steps = loop ? loop.steps.map(s => ({ ...s })) : [];
  container.innerHTML = '';

  const nameInput = document.createElement('input');
  nameInput.className = 'loop-name-input';
  nameInput.placeholder = 'Loop name';
  nameInput.value = loop?.name || '';
  container.appendChild(nameInput);

  const stepsList = document.createElement('div');
  container.appendChild(stepsList);

  function renderSteps() {
    stepsList.innerHTML = '';
    steps.forEach((step, i) => {
      const row = document.createElement('div');
      row.className = 'step-row';
      row.innerHTML = `
        <span style="flex:1">${byId[step.clip_id]?.name || '?'}</span>
        ${i > 0 ? '<button class="up-btn">↑</button>' : ''}
        <button class="rm-btn">✕</button>
      `;
      if (i > 0) row.querySelector('.up-btn').addEventListener('click', () => {
        [steps[i - 1], steps[i]] = [steps[i], steps[i - 1]];
        renderSteps();
      });
      row.querySelector('.rm-btn').addEventListener('click', () => {
        steps.splice(i, 1);
        renderSteps();
      });
      stepsList.appendChild(row);
    });
  }
  renderSteps();

  const select = document.createElement('select');
  select.className = 'clip-select';
  clips.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    select.appendChild(opt);
  });
  container.appendChild(select);

  const addBtn = document.createElement('button');
  addBtn.className = 'action-btn';
  addBtn.textContent = '+ Add Clip';
  addBtn.addEventListener('click', () => {
    steps.push({ clip_id: select.value });
    renderSteps();
  });
  container.appendChild(addBtn);

  const saveBtn = document.createElement('button');
  saveBtn.className = 'action-btn primary';
  saveBtn.textContent = 'Save';
  saveBtn.addEventListener('click', async () => {
    const payload = { name: nameInput.value || 'Untitled', steps };
    if (loop) { payload.id = loop.id; await updateLoop(loop.id, payload); }
    else await createLoop(payload);
    renderLoopsPanel(container);
  });
  container.appendChild(saveBtn);

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'action-btn';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => renderLoopsPanel(container));
  container.appendChild(cancelBtn);
}
```

- [ ] **Step 2: Manual test**

1. Open controller → Loops tab
2. Create a loop with 3 clips (add same clip multiple times to test with one clip)
3. Reorder steps using ↑ button; verify order changes
4. Tap ▶ — expected: Pi player cycles through steps with transitions
5. Edit the loop, delete a step, save
6. Delete the loop — expected: disappears from list

- [ ] **Step 3: Commit**

```bash
git add static/controller/loops.js
git commit -m "feat: loops panel with create, edit, reorder, activate, delete"
```

---

### Task 10: Phone controller — Now Playing panel

**Files:**
- Create: `static/controller/now-playing.js`

- [ ] **Step 1: Create `static/controller/now-playing.js`**

```javascript
import { connectWS, sendCommand, fetchClips, fetchLoops }
  from '/static/controller/api.js';

const TRANSITIONS = ['dissolve', 'vhs', 'film-burn', 'glitch'];

export async function renderNowPlayingPanel(container) {
  const [clips, loops] = await Promise.all([fetchClips(), fetchLoops()]);
  const clipById = Object.fromEntries(clips.map(c => [c.id, c]));
  const loopById = Object.fromEntries(loops.map(l => [l.id, l]));

  container.innerHTML = `
    <div class="np-status">
      <div class="np-label">NOW PLAYING</div>
      <div id="np-name" class="np-name">—</div>
      <div id="np-type" class="np-type"></div>
    </div>
    <button id="np-stop" class="action-btn">■ Stop</button>
    <div style="margin-top:16px">
      <div class="np-label">TRANSITION</div>
      <div class="transition-grid" id="t-grid"></div>
      <div class="np-label" style="margin-top:14px">DURATION</div>
      <input type="range" id="duration-slider" min="0.5" max="2" step="0.1" value="1.0" />
      <div id="duration-val">1.0s</div>
    </div>
  `;

  let activeTransition = 'dissolve';
  let activeDuration   = 1.0;

  const grid = container.querySelector('#t-grid');
  TRANSITIONS.forEach(name => {
    const btn = document.createElement('button');
    btn.className = 't-btn' + (name === activeTransition ? ' active' : '');
    btn.textContent = name;
    btn.addEventListener('click', () => {
      activeTransition = name;
      grid.querySelectorAll('.t-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      sendCommand({ type: 'set_transition', transition: name, duration: activeDuration });
    });
    grid.appendChild(btn);
  });

  const slider  = container.querySelector('#duration-slider');
  const durLabel = container.querySelector('#duration-val');
  slider.addEventListener('input', () => {
    activeDuration = parseFloat(slider.value);
    durLabel.textContent = `${activeDuration.toFixed(1)}s`;
    sendCommand({ type: 'set_transition', transition: activeTransition, duration: activeDuration });
  });

  container.querySelector('#np-stop').addEventListener('click', () =>
    sendCommand({ type: 'stop' }));

  const npName = container.querySelector('#np-name');
  const npType = container.querySelector('#np-type');

  connectWS((msg) => {
    if (msg.type === 'stop') {
      npName.textContent = '—';
      npType.textContent = '';
      return;
    }
    if (msg.type === 'play') {
      const loop = msg.loop_id ? loopById[msg.loop_id] : null;
      const clip = msg.clip_id ? clipById[msg.clip_id] : null;
      if (loop) {
        npName.textContent = loop.name;
        npType.textContent = 'LOOP';
      } else if (clip) {
        npName.textContent = clip.name;
        npType.textContent = clip.mode.toUpperCase();
      }
    }
    if (msg.type === 'state') {
      if (!msg.is_playing) {
        npName.textContent = '—';
        npType.textContent = '';
      } else if (msg.active_loop_id && loopById[msg.active_loop_id]) {
        npName.textContent = loopById[msg.active_loop_id].name;
        npType.textContent = 'LOOP';
      } else if (msg.active_clip_id && clipById[msg.active_clip_id]) {
        npName.textContent = clipById[msg.active_clip_id].name;
        npType.textContent = clipById[msg.active_clip_id].mode.toUpperCase();
      }
    }
  });
}
```

- [ ] **Step 2: Manual test**

1. Play a clip from the Clips tab, switch to Now Playing — expected: clip name and mode shown
2. Play a loop from the Loops tab, switch to Now Playing — expected: loop name shown, type = LOOP
3. Pick a different transition (e.g., VHS), switch a clip — expected: VHS effect plays
4. Drag duration slider to 2.0s — expected: next transition takes ~2 seconds
5. Tap Stop — expected: Pi player goes black

- [ ] **Step 3: Commit**

```bash
git add static/controller/now-playing.js
git commit -m "feat: Now Playing panel with transition picker and stop control"
```

---

### Task 11: Kiosk startup

**Files:**
- Create: `scripts/start.sh`
- Create: `scripts/raspberry-streamer.service`
- Modify: `README.md`

- [ ] **Step 1: Create `scripts/start.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

uvicorn server.main:app --host 0.0.0.0 --port 8000 &
SERVER_PID=$!
trap "kill $SERVER_PID 2>/dev/null" EXIT

until curl -sf http://localhost:8000/health > /dev/null 2>&1; do
  sleep 0.3
done

chromium-browser \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --no-first-run \
  --disable-session-crashed-bubble \
  --autoplay-policy=no-user-gesture-required \
  "http://localhost:8000/static/player/index.html"
```

- [ ] **Step 2: Make executable**

```bash
chmod +x scripts/start.sh
```

- [ ] **Step 3: Create `scripts/raspberry-streamer.service`**

```ini
[Unit]
Description=raspberry-streamer VJ player
After=network.target graphical-session.target

[Service]
User=pi
WorkingDirectory=/home/pi/raspberry-streamer
ExecStart=/home/pi/raspberry-streamer/scripts/start.sh
Restart=on-failure
RestartSec=5

[Install]
WantedBy=graphical-session.target
```

- [ ] **Step 4: Update `README.md`**

```markdown
# raspberry-streamer

A VJ media player for live DJ sets. The Raspberry Pi plays video clips on a TV;
a phone browser controls playback in real time with analog-style transitions.

## Requirements

- Raspberry Pi 4 or 5
- Python 3.11+
- ffmpeg and Chromium installed

```bash
sudo apt install ffmpeg chromium-browser
pip install -r requirements.txt
```

## Add clips

Copy `.mp4` files to the `videos/` folder:

```bash
scp my_clip.mp4 pi@<pi-ip>:/home/pi/raspberry-streamer/videos/
```

## Run manually

```bash
./scripts/start.sh
```

## Install as a service (auto-start on boot)

```bash
sudo cp scripts/raspberry-streamer.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable raspberry-streamer
sudo systemctl start raspberry-streamer
```

## Phone controller

Open `http://<pi-ip>:8000/static/controller/index.html` in your phone browser.
Phone and Pi must be on the same WiFi network.
```

- [ ] **Step 5: Commit**

```bash
git add scripts/ README.md
git commit -m "feat: kiosk startup script, systemd service, and README"
```

---

## Build order summary

| Task | Deliverable |
|------|-------------|
| 1 | FastAPI skeleton + health endpoint |
| 2 | Pydantic models + JSON persistence |
| 3 | Clip scanning + `/clips`, `/videos`, `/thumbnails` routes |
| 4 | Loop CRUD (`/loops`) |
| 5 | WebSocket state machine + loop sequencer |
| 6 | Pi player: WebGL renderer + 4 GLSL shaders |
| 7 | Pi player: WebSocket client (plays commands, reports clip_ended) |
| 8 | Controller: clips panel (grid + tap to play) |
| 9 | Controller: loops panel (create, edit, reorder, activate, delete) |
| 10 | Controller: now playing (status, stop, transition picker) |
| 11 | Kiosk startup script + systemd service |
