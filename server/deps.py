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
