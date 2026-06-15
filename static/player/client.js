import { Renderer } from '/static/player/renderer.js';

const canvas   = document.getElementById('gl-canvas');
const overlay  = document.getElementById('fx-overlay');
const videoA   = document.getElementById('video-a');
const videoB   = document.getElementById('video-b');

const renderer = new Renderer(canvas, videoA, videoB, overlay);

async function init() {
  await renderer.loadAllShaders();
  renderer.startLoop();
  connect();
}

function connect() {
  const ws = new WebSocket(`ws://${location.host}/ws`);

  ws.onmessage = async (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === 'play') {
      await play(ws, msg);
    } else if (msg.type === 'stop') {
      videoA.pause(); videoA.src = '';
      videoB.pause(); videoB.src = '';
    } else if (msg.type === 'set_always_on') {
      renderer.setAlwaysOnEffect(msg.effect);
    } else if (msg.type === 'state' && msg.always_on_effect) {
      renderer.setAlwaysOnEffect(msg.always_on_effect);
    }
  };

  ws.onclose = () => setTimeout(connect, 2000);
}

async function play(ws, msg) {
  const { clip_id, video_url, mode, transition, duration } = msg;

  const nextIdx   = 1 - renderer.activeIdx;
  const nextVideo = renderer.videos[nextIdx];
  const prevVideo = renderer.videos[renderer.activeIdx];

  nextVideo.src  = video_url;
  nextVideo.loop = (mode === 'loop');

  await new Promise((resolve, reject) => {
    nextVideo.oncanplay = resolve;
    nextVideo.onerror   = reject;
    nextVideo.load();
  });

  nextVideo.play().catch(() => {});
  await renderer.transition(transition, duration);

  prevVideo.pause();
  prevVideo.src = '';

  if (mode === 'one-shot') {
    renderer.videos[renderer.activeIdx].onended = () => {
      ws.send(JSON.stringify({ type: 'clip_ended', clip_id }));
    };
  } else {
    renderer.videos[renderer.activeIdx].onended = null;
  }
}

init();
