import pytest
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
