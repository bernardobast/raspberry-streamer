const VERTEX_SRC = `
  attribute vec2 a_position;
  varying vec2 v_uv;
  void main() {
    v_uv = vec2(a_position.x * 0.5 + 0.5, 0.5 - a_position.y * 0.5);
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
    throw new Error(gl.getShaderInfoLog(s));
  return s;
}

function link(gl, fragSrc) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VERTEX_SRC));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fragSrc));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(p));
  return {
    program: p,
    locs: {
      a_position: gl.getAttribLocation(p, 'a_position'),
      u_from:     gl.getUniformLocation(p, 'u_from'),
      u_to:       gl.getUniformLocation(p, 'u_to'),
      u_progress: gl.getUniformLocation(p, 'u_progress'),
    },
  };
}

function makeTex(gl) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  return t;
}

export class Renderer {
  constructor(canvas, videoA, videoB, overlayCanvas) {
    this.canvas   = canvas;
    this.videos   = [videoA, videoB];
    this.activeIdx  = 0;
    this.progress   = 0.0;
    this.gl         = canvas.getContext('webgl');
    this.programs   = {};
    this.textures   = [makeTex(this.gl), makeTex(this.gl)];
    this._activeShader    = 'dissolve';
    this._alwaysOnEffect  = 'none';
    this._overlay = overlayCanvas || null;
    this._fxCtx   = overlayCanvas ? overlayCanvas.getContext('2d') : null;
    this._setupGeometry();
  }

  _setupGeometry() {
    const gl = this.gl;
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    this._buf = buf;
  }

  async loadAllShaders() {
    const names = ['dissolve', 'vhs', 'film-burn', 'glitch',
                   'white-static', 'channel-switch', 'vhs-rewind'];
    await Promise.all(names.map(async name => {
      const res = await fetch(`/static/player/shaders/${name}.glsl`);
      this.programs[name] = link(this.gl, await res.text());
    }));
  }

  setAlwaysOnEffect(name) {
    this._alwaysOnEffect = name;
    if (this._fxCtx && name === 'none') {
      this._fxCtx.clearRect(0, 0,
        this._overlay.width, this._overlay.height);
    }
  }

  _syncCanvasSize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width  = w;
      this.canvas.height = h;
    }
  }

  _frame() {
    const gl = this.gl;
    this._syncCanvasSize();
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);

    const entry = this.programs[this._activeShader] || this.programs['dissolve'];
    gl.useProgram(entry.program);
    const { locs } = entry;

    const upload = (texIdx, videoIdx) => {
      gl.activeTexture(gl.TEXTURE0 + texIdx);
      gl.bindTexture(gl.TEXTURE_2D, this.textures[videoIdx]);
      const v = this.videos[videoIdx];
      if (v.readyState >= 2)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, v);
    };
    upload(0, this.activeIdx);
    upload(1, 1 - this.activeIdx);

    gl.uniform1i(locs.u_from, 0);
    gl.uniform1i(locs.u_to,   1);
    gl.uniform1f(locs.u_progress, this.progress);

    gl.bindBuffer(gl.ARRAY_BUFFER, this._buf);
    gl.enableVertexAttribArray(locs.a_position);
    gl.vertexAttribPointer(locs.a_position, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  _fxFrame() {
    if (!this._fxCtx || this._alwaysOnEffect === 'none') return;
    const ctx = this._fxCtx;
    const w = this._overlay.clientWidth;
    const h = this._overlay.clientHeight;
    if (this._overlay.width !== w)  this._overlay.width  = w;
    if (this._overlay.height !== h) this._overlay.height = h;
    ctx.clearRect(0, 0, w, h);
    switch (this._alwaysOnEffect) {
      case 'scanlines':    this._drawScanlines(ctx, w, h);    break;
      case 'vhs-tracking': this._drawVhsTracking(ctx, w, h);  break;
      case 'film-grain':   this._drawFilmGrain(ctx, w, h);    break;
      case 'databend':     this._drawDatabend(ctx, w, h);     break;
    }
  }

  _drawScanlines(ctx, w, h) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 2);
  }

  _drawVhsTracking(ctx, w, h) {
    if (Math.random() < 0.06) {
      const y = Math.random() * h;
      ctx.fillStyle = `rgba(255,255,255,${(Math.random() * 0.08 + 0.02).toFixed(3)})`;
      ctx.fillRect(0, y, w, Math.random() * 12 + 2);
    }
    if (Math.random() < 0.03) {
      const y = h * 0.8 + Math.random() * h * 0.2;
      ctx.fillStyle = 'rgba(0,100,255,0.06)';
      ctx.fillRect(0, y, w, 8);
    }
  }

  _drawFilmGrain(ctx, w, h) {
    const count = Math.floor(w * h * 0.004);
    for (let i = 0; i < count; i++) {
      const b = Math.random() > 0.5 ? 255 : 0;
      ctx.fillStyle = `rgba(${b},${b},${b},0.25)`;
      ctx.fillRect(Math.random() * w | 0, Math.random() * h | 0, 1, 1);
    }
  }

  _drawDatabend(ctx, w, h) {
    const shift = 3 + (Math.random() * 2 | 0);
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = 'rgba(255,0,0,0.04)';
    ctx.fillRect(shift, 0, w, h);
    ctx.fillStyle = 'rgba(0,0,255,0.04)';
    ctx.fillRect(-shift, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
    if (Math.random() < 0.08) {
      const y = Math.random() * h | 0;
      ctx.fillStyle = `rgba(255,255,255,${(Math.random() * 0.06).toFixed(3)})`;
      ctx.fillRect(0, y, w, Math.random() * 3 + 1);
    }
  }

  startLoop() {
    const errEl = document.getElementById('err');
    const dbgEl = document.getElementById('dbg');
    let frames = 0;
    const tick = () => {
      try {
        this._frame();
        this._fxFrame();
        frames++;
        if (dbgEl) {
          const va = this.videos[0], vb = this.videos[1];
          dbgEl.textContent =
            `frames:${frames} activeIdx:${this.activeIdx} progress:${this.progress.toFixed(2)} fx:${this._alwaysOnEffect} | ` +
            `A rs=${va.readyState} paused=${va.paused} src=${va.src ? '✓' : '✗'} | ` +
            `B rs=${vb.readyState} paused=${vb.paused} src=${vb.src ? '✓' : '✗'}`;
        }
      } catch (e) {
        if (errEl) { errEl.style.display = 'block'; errEl.textContent += e + '\n'; }
      }
      requestAnimationFrame(tick);
    };
    this.canvas.addEventListener('webglcontextlost', e => {
      e.preventDefault();
      if (errEl) { errEl.style.display = 'block'; errEl.textContent += 'WebGL context lost\n'; }
    });
    this.canvas.addEventListener('webglcontextrestored', () => this.loadAllShaders());
    requestAnimationFrame(tick);
  }

  async transition(shaderName, durationSecs) {
    if (shaderName === 'none') {
      this.activeIdx = 1 - this.activeIdx;
      this.progress  = 0.0;
      return;
    }
    this._activeShader = shaderName;
    const start = performance.now();
    await new Promise(resolve => {
      const tick = (now) => {
        this.progress = Math.min((now - start) / (durationSecs * 1000), 1.0);
        if (this.progress < 1.0) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
    this.activeIdx = 1 - this.activeIdx;
    this.progress  = 0.0;
  }
}
