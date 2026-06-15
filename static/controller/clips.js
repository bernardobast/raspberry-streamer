import { fetchClips, sendCommand } from '/static/controller/api.js';

export async function renderClipsPanel(container) {
  const clips = await fetchClips();
  container.innerHTML = '';

  if (clips.length === 0) {
    container.innerHTML = '<p class="empty">No clips found. Add .mp4 files to videos/</p>';
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'clip-grid';

  clips.forEach(clip => {
    const btn = document.createElement('button');
    btn.className = 'clip-card';
    btn.dataset.clipId = clip.id;
    const thumbFile = clip.filename.replace(/\.[^.]+$/, '.jpg');
    btn.innerHTML = `
      <img src="/thumbnails/${thumbFile}" alt="${clip.name}"
           onerror="this.style.display='none'" />
      <span class="clip-name">${clip.name}</span>
      <span class="clip-mode">${clip.mode}</span>
    `;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.clip-card').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      sendCommand({ type: 'play_clip', clip_id: clip.id });
    });
    grid.appendChild(btn);
  });

  container.appendChild(grid);
}
