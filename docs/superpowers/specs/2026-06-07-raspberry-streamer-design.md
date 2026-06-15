# raspberry-streamer Design

**Date:** 2026-06-07  
**Status:** Approved

## Overview

A VJ media player for live DJ sets. Pre-downloaded short video clips play fullscreen on a Raspberry Pi (HDMI to TV/monitor). A phone browser controls which clip or loop plays in real time, with analog-style transitions between clips.

---

## Architecture

Two processes run on the Pi:

1. **Python FastAPI server** — serves HTTP and WebSocket connections, manages clip/loop state
2. **Chromium in kiosk mode** — fullscreen on the TV, loads the player page from the local server

```
Phone browser ──WebSocket──┐
                           ├── FastAPI server (Pi)
Chromium kiosk ──WebSocket─┘       │
     (TV)                          └── /home/pi/videos/ (local clips)
```

- Phone and Pi must be on the same local WiFi network
- Phone navigates to the Pi's IP address to open the controller UI
- All communication is via WebSocket for low-latency live control

---

## Video Playback & Transitions

**Player (Chromium)**
- Two stacked `<video>` HTML elements rendered in Chromium
- A canvas overlay applies WebGL shaders for transitions
- Outgoing clip fades/transitions out while incoming clip transitions in

**Transition effects (GLSL shaders, one file per effect):**
- `vhs` — scan lines, color bleed, tracking noise
- `film-burn` — orange/white flash wipe
- `glitch` — RGB channel split, pixel shuffle
- `dissolve` — soft crossfade with grain

**Transition configuration:**
- Global default transition and duration selectable in the phone UI
- Per-clip and per-loop transition type and duration override (optional)
- Duration range: 0.5s–2s

---

## Clip Library

Clips are stored locally on the Pi at `/home/pi/videos/`. The FastAPI server scans this folder on startup.

Each clip has:
- Name (derived from filename)
- Thumbnail (auto-generated on first scan)
- Playback mode: `loop` or `one-shot`
- Default transition in/out

To add new clips: copy files to `/home/pi/videos/` via `scp` or USB drive.

---

## Loop Sequencer

A **loop** is an ordered sequence of clips that repeats continuously:  
`[clip_A → clip_B → clip_C] → repeat`

Each loop has:
- A name
- An ordered list of clips (drag to reorder in the UI)
- Optional per-step transition override

Multiple loops can be saved. Switching loops live triggers a transition from the current clip to the first clip of the new loop.

---

## Phone Controller UI

Three panels accessible via bottom tab navigation:

1. **Clips** — grid of all clips with thumbnails; tap to play immediately
2. **Loops** — list of saved loops; tap to activate live; create/edit/delete loops; drag clips to reorder within a loop
3. **Now Playing** — currently active clip/loop name, playback mode indicator, stop/pause control, transition picker

---

## Data Storage

Clip and loop metadata (names, modes, loop definitions, transition preferences) stored in a single `data/metadata.json` file in the project directory on the Pi. No database needed at this scale (~50 clips).

---

## Out of Scope (for now)

- File upload via web UI (add clips via `scp` or USB)
- Pi hotspot mode (requires same local WiFi)
- BPM sync or beat-matching
- Authentication/access control
