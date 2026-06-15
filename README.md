# raspberry-streamer

A VJ media player for live DJ sets. The Raspberry Pi plays video clips on a TV;
a phone browser controls playback in real time with analog-style transitions.

## Requirements

- Raspberry Pi 4 or 5
- Python 3.11+
- ffmpeg and Chromium

```bash
sudo apt install ffmpeg chromium-browser python3-pip
pip install -r requirements.txt
```

## Add clips

Copy `.mp4` files to the `videos/` folder:

```bash
scp my_clip.mp4 pi@<pi-ip>:/home/pi/raspberry-streamer/videos/
```

## Run manually

```bash
./scripts/start.sh
```

## Install as a service (auto-start on boot)

```bash
sudo cp scripts/raspberry-streamer.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable raspberry-streamer
sudo systemctl start raspberry-streamer
```

## Phone controller

Open `http://<pi-ip>:8000/static/controller/index.html` in your phone browser.
Phone and Pi must be on the same WiFi network.

## Run tests

```bash
pytest tests/ -v
```
