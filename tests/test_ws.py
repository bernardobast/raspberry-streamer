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
            await ws1.receive_json()
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
            from server.ws import manager
            assert manager.state.transition == "glitch"
            assert manager.state.transition_duration == 0.8
