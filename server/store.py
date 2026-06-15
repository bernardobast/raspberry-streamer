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
