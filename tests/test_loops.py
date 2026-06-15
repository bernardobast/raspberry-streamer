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
