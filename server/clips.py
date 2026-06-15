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
