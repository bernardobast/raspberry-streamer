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
