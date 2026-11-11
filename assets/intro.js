// z3r0 intro: the public ledger scrolls, a shield sweeps across it and redacts everything, a slashed zero rises out of the noise and spins in 3D,
// it settles into its place in z3rØ, then you dive through the zero and land in the terminal. All characters on a canvas; sound written in code.
(() => {
  'use strict';
  const el = document.getElementById('intro'), FX = window.ZFX, SND = FX.snd, RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const atHome = location.hash.replace(/^#\/?/, '') === '';
  window.ZI = { active: false };
  if (!el || !atHome || RM) { if (el) el.remove(); return; }
  window.ZI.active = true; document.documentElement.classList.add('pre-app');
  const cv = el.querySelector('canvas'), g = cv.getContext('2d'), B58 = FX.B58, SCR = '░▒▓█', GL = FX.GLY, RAMP = ' .:-=+*#%@';
  const rnd = s => s[Math.floor(Math.random() * s.length)], ease = k => 1 - Math.pow(1 - k, 3), eio = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  let W, H, D, fs, cw, ch, cols, rows, grid, alpha, word = [], t0 = 0, done = false, raf = 0;
  const T = { sweep: 2.3, spin: 4.0, morph: 7.0, hold: 8.3, dive: 9.1, end: 10.3 };
  // ---------------------------------------------------------------- layout
  function size() { D = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; cv.width = W * D; cv.height = H * D; g.setTransform(D, 0, 0, D, 0, 0);
    fs = clamp(Math.round(W / 118), 10, 15); cw = fs * .6; ch = fs * 1.18; cols = Math.ceil(W / cw); rows = Math.ceil(H / ch);
    grid = new Array(cols * rows).fill(' '); alpha = new Float32Array(cols * rows); buildWord(); if (!lines.length) for (let i = 0; i < Math.floor(rows * .72); i++) { const L = newLine(); L.at -= 20000; L.a *= .7; lines.push(L); } }
  // the wordmark, sampled from glyphs drawn off-screen: z3r + a slashed zero
  function buildWord() { const ww = Math.min(W * .74, 1180), wh = ww / 2.55, o = document.createElement('canvas'), oc = o.getContext('2d'); o.width = Math.ceil(ww); o.height = Math.ceil(wh); oc.fillStyle = '#000'; oc.fillRect(0, 0, o.width, o.height); oc.fillStyle = '#fff';
    const fh = wh * 1.02; oc.font = `700 ${fh}px ID, Inter, sans-serif`; oc.textBaseline = 'middle'; const tw = oc.measureText('z3r').width, ow = fh * .6, gap = fh * .03, total = tw + gap + ow, x0 = (o.width - total) / 2; oc.fillText('z3r', x0, o.height * .53);
    const zx = x0 + tw + gap + ow / 2, zy = o.height * .515, rx = ow * .38, ry = fh * .36, sw = fh * .12; oc.lineWidth = sw; oc.strokeStyle = '#fff'; oc.beginPath(); oc.ellipse(zx, zy, rx, ry, 0, 0, Math.PI * 2); oc.stroke();
    oc.beginPath(); oc.moveTo(zx - rx * .82, zy + ry * .82); oc.lineTo(zx + rx * .82, zy - ry * .82); oc.lineWidth = sw * .9; oc.stroke();
    const wc = Math.floor(ww / cw), wr = Math.floor(wh / ch), d = oc.getImageData(0, 0, o.width, o.height).data, ox = Math.floor((cols - wc) / 2), oy = Math.floor((rows - wr) / 2);
    word = []; for (let y = 0; y < wr; y++) for (let x = 0; x < wc; x++) { let s = 0, n = 0; const px0 = Math.floor(x * cw), py0 = Math.floor(y * ch);
      for (let yy = 0; yy < ch; yy += 2) for (let xx = 0; xx < cw; xx += 2) { const i = ((py0 + Math.floor(yy)) * o.width + px0 + Math.floor(xx)) * 4; s += d[i] || 0; n++; } const v = s / n / 255;
      const inZero = (x * cw) > zx - ow * .62; if (v > .07) word.push({ tx: ox + x, ty: oy + y, c: RAMP[Math.min(9, Math.round(v * 9))], v, z: inZero, sx: Math.random() * cols, sy: Math.random() * rows, dl: Math.random() * .9 }); }
    word.cx = (ox + (zx / ww) * wc) * cw; word.cy = (oy + (zy / wh) * wr) * ch; word.gx = ox + (zx / ww) * wc; word.gy = oy + (zy / wh) * wr; word.oh = (2 * ry + sw) / ch; }
  // ---------------------------------------------------------------- the ledger: rows of hashes and addresses typed out and scrolling up
  let lines = [], lastScroll = 0, lastTick = 0;
  const newLine = () => { let s = ''; while (s.length < cols + 8) { const n = 4 + Math.floor(Math.random() * 40); s += Array.from({ length: n }, () => rnd(B58)).join('') + (Math.random() < .3 ? '  →  ' : '   '); } return { s, at: performance.now(), sp: 140 + Math.random() * 240, a: .16 + Math.random() * .34 }; };
  function ledger(now) { if (now - lastScroll > 90) { lastScroll = now; lines.push(newLine()); if (lines.length > rows) lines.shift(); }
    grid.fill(' '); alpha.fill(0); const base = rows - lines.length;
    lines.forEach((L, i) => { const y = base + i, k = Math.min(L.s.length, Math.floor((now - L.at) / 1000 * L.sp)); for (let x = 0; x < Math.min(cols, k); x++) { const c = L.s[x]; if (c === ' ') continue; const j = y * cols + x; grid[j] = c; alpha[j] = L.a * (x > k - 3 ? 1.8 : 1); } });
    if (now - lastTick > 55) { lastTick = now; SND.tick(.018 + Math.random() * .02, 3000 + Math.random() * 5000); } }
  // ---------------------------------------------------------------- the shield: a line sweeps across and redacts everything behind it
  function sweep(t) { const k = (t - T.sweep) / (T.spin - T.sweep), sx = k * (cols + 30) - 10;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) { const j = y * cols + x, d = sx - x; if (d < 0) continue; if (grid[j] === ' ') { if (Math.random() < .002) { grid[j] = '·'; alpha[j] = .08; } continue; }
      if (d < 3) { grid[j] = rnd(SCR); alpha[j] = .95; } else if (d < 9) { grid[j] = rnd(SCR); alpha[j] = .5 - d * .03; } else if (d < 16) { grid[j] = '█'; alpha[j] = .12; } else { grid[j] = Math.random() < .3 ? '·' : ' '; alpha[j] = .07; } }
    return sx; }
  // ---------------------------------------------------------------- draw a grid in ten bands of brightness
  const LV = 10;
  function paintGrid(Gc, A, clear = true) { if (clear) { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); } g.font = `400 ${fs}px JB, monospace`; g.textBaseline = 'top';
    for (let L = 1; L <= LV; L++) { const lo = (L - 1) / LV, hi = L / LV; g.fillStyle = `rgba(240,240,240,${(hi * .97).toFixed(3)})`;
      for (let j = 0; j < Gc.length; j++) { const a = A[j]; if (a <= lo || a > hi || Gc[j] === ' ') continue; g.fillText(Gc[j], (j % cols) * cw, Math.floor(j / cols) * ch); } } }
  // a glitch: bands of the screen slip sideways, with a red and a cyan ghost
  function glitch(amt) { const n = 3 + Math.floor(Math.random() * 5); for (let i = 0; i < n; i++) { const y = Math.random() * H, h = 4 + Math.random() * 40, dx = (Math.random() - .5) * 60 * amt; try { g.drawImage(cv, 0, y * D, W * D, h * D, dx, y, W, h); } catch (e) { } }
    g.globalCompositeOperation = 'lighter'; g.globalAlpha = .18 * amt; g.fillStyle = '#ff2a4a'; g.fillRect(0, Math.random() * H, W, 2 + Math.random() * 3); g.fillStyle = '#21f0ff'; g.fillRect(0, Math.random() * H, W, 2 + Math.random() * 3); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
  // ---------------------------------------------------------------- the timeline
  let swept = false, spun = false, morphed = false, landed = false, dove = false, nextG = 0, cleared = false;
  function frame(now) { if (done) return; raf = requestAnimationFrame(frame); if (!t0) t0 = now; const t = (now - t0) / 1000;
    if (t < T.sweep) { ledger(now); paintGrid(grid, alpha); return; }
    if (t < T.spin) { if (!swept) { swept = true; SND.whoosh(2.1, .11, true); } const sx = sweep(t); paintGrid(grid, alpha); const x = sx * cw, gr = g.createLinearGradient(x - 60, 0, x + 6, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,.22)'); g.fillStyle = gr; g.fillRect(x - 60, 0, 66, H); g.fillStyle = '#fff'; g.fillRect(x, 0, 2, H);
      if (Math.random() < .5) SND.tick(.03, 1200 + Math.random() * 2000); return; }
    // the zero rises out of the noise and spins
    if (t < T.morph) { if (!spun) { spun = true; SND.thump(.3); SND.whoosh(2.8, .06, true); SND.droneLevel(.1, 1.5); }
      const k = (t - T.spin) / (T.morph - T.spin), ay = t * 2.4 + Math.sin(t * .7) * .5, ax = .32 + Math.sin(t * 1.3) * .22, Z = FX.zero3d(cols, rows, ay, ax, { scale: 1.12 + .06 * Math.sin(t * 2), aspect: ch / cw, fine: true });
      for (let j = 0; j < alpha.length; j++) alpha[j] *= .93; const fade = clamp(k / .18, 0, 1), A = new Float32Array(alpha.length), Gc = new Array(alpha.length);
      for (let j = 0; j < Gc.length; j++) { if (Z.out[j] !== ' ' && Math.random() < fade) { Gc[j] = Math.random() < .015 ? rnd(GL) : Z.out[j]; A[j] = .22 + Z.lum[j] * .78; } else { Gc[j] = grid[j]; A[j] = alpha[j] * .8; } }
      paintGrid(Gc, A); if (now > nextG) { nextG = now + 500 + Math.random() * 900; glitch(1); SND.tick(.06, 900); SND.tick(.04, 7000); } else if (Math.random() < .06) glitch(.4); return; }
    // it settles into its place as the letters fall in around it
    if (t < T.dive) { if (!morphed) { morphed = true; SND.whoosh(1.2, .09, false); grid.fill(' '); alpha.fill(0); }
      const k = clamp((t - T.morph) / (T.hold - T.morph), 0, 1), e = eio(k), held = t >= T.hold;
      if (!landed && held) { landed = true; SND.thump(.36); }
      g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
      if (k < 1) { const base = rows * .72 * 2 * 2.73 / 6, target = word.oh / base, sc = 1.12 + (target - 1.12) * e, spinLeft = (1 - e) * 3.2, Z = FX.zero3d(cols, rows, 6.2832 * 3 + spinLeft, .32 * (1 - e), { scale: sc, aspect: ch / cw, fine: e < .5, cx: cols / 2 + (word.gx - cols / 2) * e, cy: rows / 2 + (word.gy - rows / 2) * e }), A = new Float32Array(Z.lum.length);
        for (let j = 0; j < A.length; j++) A[j] = Z.out[j] === ' ' ? 0 : (.22 + Z.lum[j] * .78) * (1 - Math.max(0, (k - .7) / .3)); paintGrid(Z.out, A, false); }
      g.font = `400 ${fs}px JB, monospace`; g.textBaseline = 'top';
      for (const p of word) { if (p.z && k < .7) continue; const kk = clamp((k * 1.3 - p.dl * .3), 0, 1), ee = ease(kk), x = (p.sx + (p.tx - p.sx) * ee) * cw, y = (p.sy + (p.ty - p.sy) * ee) * ch;
        const c = kk >= 1 ? (held && Math.random() < .004 ? rnd(GL) : p.c) : rnd(GL), a = p.z ? clamp((k - .7) / .3, 0, 1) * (.4 + p.v * .6) : kk >= 1 ? .4 + p.v * .6 : .25 + .5 * kk; if (a <= 0) continue; g.fillStyle = `rgba(245,245,245,${a.toFixed(3)})`; g.fillText(c, p.z ? p.tx * cw : x, p.z ? p.ty * ch : y); }
      if (held) { const sy = ((t - T.hold) / (T.dive - T.hold)) * H, gr = g.createLinearGradient(0, sy - 80, 0, sy); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.5, 'rgba(255,255,255,.05)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, sy - 80, W, 80); if (Math.random() < .03) glitch(.5); }
      return; }
    // the dive: through the zero
    if (!dove) { dove = true; SND.whoosh(1.3, .17, true); }
    const k = clamp((t - T.dive) / (T.end - T.dive), 0, 1), z = Math.exp(k * 3.4), cx = word.cx, cy = word.cy;
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H); const sizes = {};
    for (const p of word) { const x = cx + (p.tx * cw - cx) * z, y = cy + (p.ty * ch - cy) * z; if (x < -200 || y < -200 || x > W + 200 || y > H + 200) continue; const s = Math.min(160, Math.round(fs * Math.min(z, 9))); (sizes[s] = sizes[s] || []).push([p, x, y]); }
    g.textBaseline = 'top'; for (const s in sizes) { g.font = `400 ${s}px JB, monospace`; for (const [p, x, y] of sizes[s]) { g.fillStyle = `rgba(245,245,245,${((.35 + p.v * .6) * (1 - k * .55)).toFixed(3)})`; g.fillText(p.c, x, y); } }
    if (k > .3 && k < .8 && Math.random() < .3) glitch(.8);
    if (k > .72) { g.fillStyle = `rgba(255,255,255,${((k - .72) / .28 * .9).toFixed(3)})`; g.fillRect(0, 0, W, H); }
    if (k >= 1) finish(); }
  // ---------------------------------------------------------------- out, and into the terminal
  function finish(skipped) { if (done) return; done = true; cancelAnimationFrame(raf); if (!skipped) SND.thump(.5); setTimeout(() => SND.chime(), skipped ? 0 : 120);
    SND.droneLevel(.035, 3); document.documentElement.classList.remove('pre-app'); window.ZI.active = false; if (window.ZI.onDone) window.ZI.onDone();
    el.classList.add('out'); setTimeout(() => el.remove(), 800); removeEventListener('keydown', key); }
  const key = e => { if (['Enter', 'Escape', ' '].includes(e.key)) { e.preventDefault(); SND.whoosh(.5, .1, true); finish(true); } };
  const paintSnd = () => { const b = el.querySelector('.snd'); if (b) b.textContent = SND.on ? 'sound on' : 'sound off'; };
  el.querySelector('.skip').onclick = e => { e.stopPropagation(); SND.wake(); finish(true); };
  el.querySelector('.snd').onclick = e => { e.stopPropagation(); SND.set(!SND.on); if (SND.on) SND.droneOn(.07); paintSnd(); };
  el.addEventListener('pointerdown', () => { SND.wake(); if (SND.on) SND.droneOn(.07); });
  addEventListener('keydown', key); addEventListener('resize', () => { if (!done) size(); });
  document.addEventListener('z-audio', () => { if (SND.on && !done) SND.droneOn(.07); });
  paintSnd(); size();
  // start at once: no loading screen. The fonts are preloaded; if the display font is late, the wordmark is rebuilt when it lands.
  if (SND.on) { SND.wake(); SND.droneOn(.07); }
  document.fonts && document.fonts.load('700 100px ID').then(() => { if (!done) buildWord(); });
  raf = requestAnimationFrame(frame);
})();
