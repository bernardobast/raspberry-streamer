import pytest
from server.models import PlayerState
from server.ws import ConnectionManager

def test_player_state_always_on_effect_defaults_to_none():
    state = PlayerState()
    assert state.always_on_effect == 'none'

def test_player_state_always_on_effect_serialises():
    state = PlayerState()
    d = state.model_dump()
    assert 'always_on_effect' in d
    assert d['always_on_effect'] == 'none'

@pytest.mark.asyncio
async def test_set_always_on_updates_state():
    manager = ConnectionManager()
    await manager.handle({'type': 'set_always_on', 'effect': 'scanlines'})
    assert manager.state.always_on_effect == 'scanlines'

@pytest.mark.asyncio
async def test_set_always_on_resets_to_none():
    manager = ConnectionManager()
    await manager.handle({'type': 'set_always_on', 'effect': 'film-grain'})
    await manager.handle({'type': 'set_always_on', 'effect': 'none'})
    assert manager.state.always_on_effect == 'none'

@pytest.mark.asyncio
async def test_set_always_on_ignores_invalid_effect():
    manager = ConnectionManager()
    await manager.handle({'type': 'set_always_on', 'effect': 'invalid-effect'})
    assert manager.state.always_on_effect == 'none'
