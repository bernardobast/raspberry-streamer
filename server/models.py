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
    transition: Optional[str] = None
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
    always_on_effect: str = "none"
