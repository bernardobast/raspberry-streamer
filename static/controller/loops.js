import { fetchClips, fetchLoops, createLoop, updateLoop, deleteLoop, sendCommand }
  from '/static/controller/api.js';

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
    const row = document.createElement('div');
    row.className = 'loop-row';
    const stepNames = loop.steps.map(s => byId[s.clip_id]?.name || '?').join(' → ');
    row.innerHTML = `
      <div class="loop-info">
        <strong>${loop.name}</strong>
        <div class="loop-steps">${stepNames || 'empty'}</div>
      </div>
      <div class="loop-actions">
        <button class="play-btn">▶</button>
        <button class="edit-btn">✏</button>
        <button class="del-btn">✕</button>
      </div>
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
        ${i > 0 ? '<button class="up-btn">↑</button>' : ''}
        <button class="rm-btn">✕</button>
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
