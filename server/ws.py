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
                "mode": "one-shot",
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
