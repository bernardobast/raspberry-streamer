let ws;
const _listeners = new Set();

export function connectWS(onMessage) {
  _listeners.add(onMessage);
  if (ws && ws.readyState === WebSocket.OPEN) return;
  ws = new WebSocket(`ws://${location.host}/ws`);
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    _listeners.forEach(fn => fn(msg));
  };
  ws.onclose = () => setTimeout(() => connectWS(onMessage), 2000);
}

export function sendCommand(cmd) {
  if (ws && ws.readyState === WebSocket.OPEN)
    ws.send(JSON.stringify(cmd));
}

export const fetchClips  = () => fetch('/clips').then(r => r.json());
export const fetchLoops  = () => fetch('/loops').then(r => r.json());

export const createLoop = (loop) =>
  fetch('/loops', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(loop) }).then(r => r.json());

export const updateLoop = (id, loop) =>
  fetch(`/loops/${id}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(loop) }).then(r => r.json());

export const deleteLoop = (id) =>
  fetch(`/loops/${id}`, { method: 'DELETE' });
