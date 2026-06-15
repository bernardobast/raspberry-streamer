import { fetchClips, fetchLoops, createLoop, updateLoop, deleteLoop, sendCommand }
  from '/static/controller/api.js';

const ICONS = {
  play: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="5,3 19,12 5,21"/></svg>`,
  edit: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  trash: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>`,
  up:   `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>`,
  x:    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
};

export async function renderLoopsPanel(container) {
  const [loops, clips] = await Promise.all([fetchLoops(), fetchClips()]);
  const byId = Object.fromEntries(clips.map(c => [c.id, c]));
  container.innerHTML = '';

  const newBtn = document.createElement('button');
  newBtn.className = 'action-btn';
  newBtn.textContent = '+ New Loop';
  newBtn.addEventListener('click', () => showEditor(container, null, clips, byId));
  container.appendChild(newBtn);

  if (loops.length === 0) {
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = 'No loops yet.';
    container.appendChild(p);
    return;
  }

  loops.forEach(loop => {
    const filmstripHTML = loop.steps.length
      ? loop.steps.map(s => {
          const clip = byId[s.clip_id];
          if (!clip) return '';
          const thumb = clip.filename.replace(/\.[^.]+$/, '.jpg');
          return `<div class="filmstrip-thumb">
            <img src="/thumbnails/${thumb}" alt="${clip.name}" onerror="this.style.display='none'" />
            <span>${clip.name}</span>
          </div>`;
        }).join('')
      : '<span style="color:var(--text-dim);font-size:12px;padding:8px 0">empty</span>';

    const row = document.createElement('div');
    row.className = 'loop-row';
    row.innerHTML = `
      <div class="loop-header">
        <div class="loop-info">
          <strong>${loop.name}</strong>
        </div>
        <div class="loop-actions">
          <button class="icon-btn accent play-btn" title="Play">${ICONS.play}</button>
          <button class="icon-btn edit-btn" title="Edit">${ICONS.edit}</button>
          <button class="icon-btn del-btn" title="Delete">${ICONS.trash}</button>
        </div>
      </div>
      <div class="filmstrip">${filmstripHTML}</div>
    `;

    row.querySelector('.play-btn').addEventListener('click', () =>
      sendCommand({ type: 'play_loop', loop_id: loop.id }));
    row.querySelector('.edit-btn').addEventListener('click', () =>
      showEditor(container, loop, clips, byId));
    row.querySelector('.del-btn').addEventListener('click', async () => {
      await deleteLoop(loop.id);
      renderLoopsPanel(container);
    });
    container.appendChild(row);
  });
}

function showEditor(container, loop, clips, byId) {
  const steps = loop ? loop.steps.map(s => ({ ...s })) : [];
  container.innerHTML = '';

  const nameInput = document.createElement('input');
  nameInput.className = 'loop-name-input';
  nameInput.placeholder = 'Loop name';
  nameInput.value = loop?.name || '';
  container.appendChild(nameInput);

  const stepsList = document.createElement('div');
  container.appendChild(stepsList);

  function renderSteps() {
    stepsList.innerHTML = '';
    steps.forEach((step, i) => {
      const row = document.createElement('div');
      row.className = 'step-row';
      row.innerHTML = `
        <span style="flex:1">${byId[step.clip_id]?.name || '?'}</span>
        ${i > 0 ? `<button class="icon-btn up-btn" title="Move up">${ICONS.up}</button>` : ''}
        <button class="icon-btn rm-btn" title="Remove">${ICONS.x}</button>
      `;
      if (i > 0) row.querySelector('.up-btn').addEventListener('click', () => {
        [steps[i - 1], steps[i]] = [steps[i], steps[i - 1]];
        renderSteps();
      });
      row.querySelector('.rm-btn').addEventListener('click', () => {
        steps.splice(i, 1);
        renderSteps();
      });
      stepsList.appendChild(row);
    });
  }
  renderSteps();

  const select = document.createElement('select');
  select.className = 'clip-select';
  clips.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    select.appendChild(opt);
  });
  container.appendChild(select);

  const addBtn = document.createElement('button');
  addBtn.className = 'action-btn';
  addBtn.textContent = '+ Add Clip';
  addBtn.addEventListener('click', () => {
    steps.push({ clip_id: select.value });
    renderSteps();
  });
  container.appendChild(addBtn);

  const saveBtn = document.createElement('button');
  saveBtn.className = 'action-btn primary';
  saveBtn.textContent = 'Save';
  saveBtn.addEventListener('click', async () => {
    const payload = { name: nameInput.value || 'Untitled', steps };
    if (loop) { payload.id = loop.id; await updateLoop(loop.id, payload); }
    else await createLoop(payload);
    renderLoopsPanel(container);
  });
  container.appendChild(saveBtn);

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'action-btn';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => renderLoopsPanel(container));
  container.appendChild(cancelBtn);
}
