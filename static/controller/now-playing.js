import { connectWS, sendCommand, fetchClips, fetchLoops }
  from '/static/controller/api.js';

const TRANSITIONS = ['dissolve', 'vhs', 'film-burn', 'glitch'];

export async function renderNowPlayingPanel(container) {
  const [clips, loops] = await Promise.all([fetchClips(), fetchLoops()]);
  const clipById = Object.fromEntries(clips.map(c => [c.id, c]));
  const loopById = Object.fromEntries(loops.map(l => [l.id, l]));

  container.innerHTML = `
    <div class="np-status">
      <div class="np-label">NOW PLAYING</div>
      <div id="np-name" class="np-name">—</div>
      <div id="np-type" class="np-type"></div>
    </div>
    <button id="np-stop" class="action-btn">■ Stop</button>
    <div style="margin-top:16px">
      <div class="np-label">TRANSITION</div>
      <div class="transition-grid" id="t-grid"></div>
      <div class="np-label" style="margin-top:14px">DURATION</div>
      <input type="range" id="duration-slider" min="0.5" max="2" step="0.1" value="1.0" />
      <div id="duration-val">1.0s</div>
    </div>
  `;

  let activeTransition = 'dissolve';
  let activeDuration   = 1.0;

  const grid = container.querySelector('#t-grid');
  TRANSITIONS.forEach(name => {
    const btn = document.createElement('button');
    btn.className = 't-btn' + (name === activeTransition ? ' active' : '');
    btn.textContent = name;
    btn.addEventListener('click', () => {
      activeTransition = name;
      grid.querySelectorAll('.t-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      sendCommand({ type: 'set_transition', transition: name, duration: activeDuration });
    });
    grid.appendChild(btn);
  });

  const slider   = container.querySelector('#duration-slider');
  const durLabel = container.querySelector('#duration-val');
  slider.addEventListener('input', () => {
    activeDuration = parseFloat(slider.value);
    durLabel.textContent = `${activeDuration.toFixed(1)}s`;
    sendCommand({ type: 'set_transition', transition: activeTransition, duration: activeDuration });
  });

  container.querySelector('#np-stop').addEventListener('click', () =>
    sendCommand({ type: 'stop' }));

  const npName = container.querySelector('#np-name');
  const npType = container.querySelector('#np-type');

  connectWS((msg) => {
    if (msg.type === 'stop') {
      npName.textContent = '—';
      npType.textContent = '';
      return;
    }
    if (msg.type === 'play') {
      const loop = msg.loop_id ? loopById[msg.loop_id] : null;
      const clip = msg.clip_id ? clipById[msg.clip_id] : null;
      if (loop) {
        npName.textContent = loop.name;
        npType.textContent = 'LOOP';
      } else if (clip) {
        npName.textContent = clip.name;
        npType.textContent = clip.mode.toUpperCase();
      }
    }
    if (msg.type === 'state') {
      if (!msg.is_playing) {
        npName.textContent = '—';
        npType.textContent = '';
      } else if (msg.active_loop_id && loopById[msg.active_loop_id]) {
        npName.textContent = loopById[msg.active_loop_id].name;
        npType.textContent = 'LOOP';
      } else if (msg.active_clip_id && clipById[msg.active_clip_id]) {
        npName.textContent = clipById[msg.active_clip_id].name;
        npType.textContent = clipById[msg.active_clip_id].mode.toUpperCase();
      }
    }
  });
}
