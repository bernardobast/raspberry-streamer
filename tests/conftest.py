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
