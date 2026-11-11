// z3r0 fx: ASCII helpers, text that decrypts into place, a quiet field of characters behind the terminal, and sound written in code
(() => {
  'use strict';
  const FX = window.ZFX = {};
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const GLY = '!<>-_\\/[]{}=+*^?#%@$0123456789abcdefABCDEF░▒▓', B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  FX.GLY = GLY; FX.B58 = B58;
  const rnd = s => s[Math.floor(Math.random() * s.length)];
  // ---------------------------------------------------------------- ASCII blocks
  const BL = '▁▂▃▄▅▆▇█';
  FX.blocks = (c, w = 24) => { if (!c || c.length < 2) return '·'.repeat(w); const out = [], lo = Math.min(...c), hi = Math.max(...c), r = hi - lo || 1;
    for (let i = 0; i < w; i++) { const v = c[Math.min(c.length - 1, Math.round(i / (w - 1) * (c.length - 1)))]; out.push(BL[Math.min(7, Math.floor((v - lo) / r * 7.999))]); } return out.join(''); };
  FX.bar = (p, w = 20) => { p = Math.max(0, Math.min(100, p || 0)); const n = Math.round(p / 100 * w); return '█'.repeat(n) + '<s>' + '░'.repeat(w - n) + '</s>'; };
  // ---------------------------------------------------------------- the slashed zero in 3D, drawn with characters (a tall torus with a bar through it)
  // returns a grid of characters and their light, for a rotation (ay around the vertical, ax a tilt) and a size in grid cells
  const LUM = '.,-~:;=!*#$@';
  FX.zero3d = (cols, rows, ay, ax, o = {}) => { const N = cols * rows, out = new Array(N).fill(' '), lum = new Float32Array(N), zb = new Float32Array(N), R = 1.6, r = o.r || .42, sy = 1.35, K2 = 6, sc = o.scale || 1, cx = o.cx ?? cols / 2, cy = o.cy ?? rows / 2, ar = o.aspect || 2;
    const Ky = rows * .72 * sc * (o.fit || 1), Kx = Ky * ar, ca = Math.cos(ay), sa = Math.sin(ay), cb = Math.cos(ax), sb = Math.sin(ax), lx = 0, ly = .7071, lz = -.7071;
    const plot = (x, y, z, nx, ny, nz) => { // rotate around Y, then tilt around X
      let X = x * ca + z * sa, Z = -x * sa + z * ca, Y = y; const Y2 = Y * cb - Z * sb, Z2 = Y * sb + Z * cb; Y = Y2; Z = Z2;
      let NX = nx * ca + nz * sa, NZ = -nx * sa + nz * ca, NY = ny; const NY2 = NY * cb - NZ * sb, NZ2 = NY * sb + NZ * cb; NY = NY2; NZ = NZ2;
      const ooz = 1 / (Z + K2), px = Math.round(cx + Kx * X * ooz), py = Math.round(cy - Ky * Y * ooz); if (px < 0 || py < 0 || px >= cols || py >= rows) return;
      const j = py * cols + px; if (ooz <= zb[j]) return; zb[j] = ooz; const L = NX * lx + NY * ly + NZ * lz; lum[j] = Math.max(.08, L); out[j] = LUM[Math.max(0, Math.min(11, Math.floor(L * 11.5)))] || '.'; };
    const ts = o.fine ? .045 : .07, ps = o.fine ? .018 : .028;
    for (let t = 0; t < 6.2832; t += ts) { const ct = Math.cos(t), st = Math.sin(t); for (let p = 0; p < 6.2832; p += ps) { const cp = Math.cos(p), sp = Math.sin(p), cxr = R + r * ct;
      const x = cxr * cp, y = cxr * sp * sy, z = r * st; let nx = ct * cp, ny = ct * sp / sy, nz = st; const nl = Math.hypot(nx, ny, nz); plot(x, y, z, nx / nl, ny / nl, nz / nl); } }
    // the slash: a bar from lower left to upper right, through the middle
    const dx = 1 / Math.hypot(1, sy), dy = sy / Math.hypot(1, sy), ex = -dy, ey = dx, h = (R + r) * 1.18, w = r * .78;
    for (let u = -h; u <= h; u += .03) for (let v = -w; v <= w; v += .05) {
      plot(u * dx + w * ex, u * dy + w * ey, v, ex, ey, 0); plot(u * dx - w * ex, u * dy - w * ey, v, -ex, -ey, 0);
      plot(u * dx + v * ex, u * dy + v * ey, -w, 0, 0, -1); plot(u * dx + v * ex, u * dy + v * ey, w, 0, 0, 1); }
    return { out, lum }; };
  // ---------------------------------------------------------------- text that decrypts into place
  FX.scramble = (el, dur = 620) => { if (!el || RM) return; const txt = el.dataset.t || el.textContent; el.dataset.t = txt; const t0 = performance.now(), n = txt.length;
    cancelAnimationFrame(el._sc); const step = now => { const k = Math.min(1, (now - t0) / dur); let s = ''; for (let i = 0; i < n; i++) { const c = txt[i]; s += c === ' ' || i / n < k * 1.15 - .15 ? c : rnd(GLY); } el.textContent = s; if (k < 1) el._sc = requestAnimationFrame(step); else el.textContent = txt; }; el._sc = requestAnimationFrame(step); };
  FX.scrambleAll = (root, sel = '[data-scr]') => root && root.querySelectorAll(sel).forEach((e, i) => setTimeout(() => FX.scramble(e), i * 40));
  // types a line out, one character at a time
  FX.type = (el, txt, cps = 70) => { if (!el) return; if (RM) { el.textContent = txt; return; } el.textContent = ''; el.classList.add('typed'); let i = 0; clearInterval(el._ty); el._ty = setInterval(() => { i += 2; el.textContent = txt.slice(0, i); if (i >= txt.length) { clearInterval(el._ty); setTimeout(() => el.classList.remove('typed'), 1200); } }, 1000 / cps * 2); };
  // a number that counts up to its value
  FX.count = (el, to, fmt = v => Math.round(v).toLocaleString('en-US'), dur = 900) => { if (!el) return; if (RM || !isFinite(to)) { el.textContent = fmt(to); return; } const t0 = performance.now(); const f = now => { const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(to * e); if (k < 1) requestAnimationFrame(f); }; requestAnimationFrame(f); };
  // braille spinners for anything that is still loading
  const SP = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'; let spi = 0; setInterval(() => { spi = (spi + 1) % SP.length; document.querySelectorAll('.spin').forEach(e => e.textContent = SP[spi]); }, 90);
  FX.spin = () => `<span class="spin">${SP[0]}</span>`;
  // ---------------------------------------------------------------- the field behind the terminal: dim characters that slowly change
  FX.field = cv => { if (!cv) return; const g = cv.getContext('2d'); let W, H, cols, rows, cells, fs = 14, last = 0, on = true;
    const size = () => { const d = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; cv.width = W * d; cv.height = H * d; g.setTransform(d, 0, 0, d, 0, 0); cols = Math.ceil(W / (fs * .62)); rows = Math.ceil(H / (fs * 1.25)); cells = Array.from({ length: cols * rows }, () => Math.random() < .07 ? { c: rnd(B58), a: Math.random() * .1 } : null); g.clearRect(0, 0, W, H); full(); };
    const draw1 = i => { const x = (i % cols) * fs * .62, y = Math.floor(i / cols) * fs * 1.25; g.fillStyle = '#000'; g.fillRect(x, y, fs * .62, fs * 1.25); const c = cells[i]; if (!c) return; g.fillStyle = `rgba(220,220,220,${c.a.toFixed(3)})`; g.fillText(c.c, x, y + fs); };
    const full = () => { g.font = `400 ${fs}px JB, monospace`; g.textBaseline = 'alphabetic'; for (let i = 0; i < cells.length; i++) draw1(i); };
    const loop = now => { requestAnimationFrame(loop); if (!on || document.hidden || now - last < 70) return; last = now; g.font = `400 ${fs}px JB, monospace`;
      for (let k = 0; k < 26; k++) { const i = Math.floor(Math.random() * cells.length); cells[i] = Math.random() < .93 ? null : { c: rnd(Math.random() < .2 ? GLY : B58), a: .03 + Math.random() * .08 }; draw1(i); } };
    addEventListener('resize', size); size(); if (!RM) requestAnimationFrame(loop); FX.fieldOn = v => { on = v; }; };
  // ---------------------------------------------------------------- sound, written in code (no files). Quiet by design.
  const SND = FX.snd = { on: true, ctx: null, master: null, drone: null };
  try { SND.on = localStorage.getItem('z3r0-sound') !== '0'; } catch (e) { }
  const ac = () => { if (SND.ctx) return SND.ctx; const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; const c = SND.ctx = new C(), m = SND.master = c.createGain(); m.gain.value = SND.on ? .55 : 0; const comp = c.createDynamicsCompressor(); m.connect(comp); comp.connect(c.destination);
    // a small room for everything
    const len = c.sampleRate * 1.6, ir = c.createBuffer(2, len, c.sampleRate); for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); } const rv = SND.rv = c.createConvolver(); rv.buffer = ir; const rg = c.createGain(); rg.gain.value = .32; rv.connect(rg); rg.connect(m); return c; };
  const out = () => SND.master;
  SND.wake = () => { const c = ac(); if (c && c.state === 'suspended') c.resume(); return c; };
  SND.set = v => { SND.on = v; try { localStorage.setItem('z3r0-sound', v ? '1' : '0'); } catch (e) { } const c = SND.wake(); if (c) SND.master.gain.setTargetAtTime(v ? .55 : 0, c.currentTime, .08); document.dispatchEvent(new Event('z-sound')); };
  const noiseBuf = c => { if (SND.nb) return SND.nb; const b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return SND.nb = b; };
  const env = (c, g, t, a, peak, r) => { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + r); };
  SND.tick = (v = .05, f = 5200) => { const c = SND.ctx; if (!c || !SND.on || c.state !== 'running') return; const t = c.currentTime, s = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain(); s.buffer = noiseBuf(c); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 3; env(c, g, t, .002, v, .03); s.connect(bp); bp.connect(g); g.connect(out()); s.start(t, Math.random()); s.stop(t + .06); };
  SND.blip = (f = 880, v = .05, d = .09) => { const c = SND.ctx; if (!c || !SND.on || c.state !== 'running') return; const t = c.currentTime, o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 1.5, t + d); env(c, g, t, .004, v, d); o.connect(g); g.connect(out()); g.connect(SND.rv); o.start(t); o.stop(t + d + .05); };
  SND.whoosh = (d = .9, v = .12, up = true) => { const c = SND.ctx; if (!c || !SND.on || c.state !== 'running') return; const t = c.currentTime, s = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain(); s.buffer = noiseBuf(c); bp.type = 'bandpass'; bp.Q.value = 1.2; bp.frequency.setValueAtTime(up ? 300 : 3000, t); bp.frequency.exponentialRampToValueAtTime(up ? 4200 : 250, t + d); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + d * .7); g.gain.exponentialRampToValueAtTime(.0001, t + d); s.connect(bp); bp.connect(g); g.connect(out()); g.connect(SND.rv); s.start(t); s.stop(t + d + .1); };
  SND.thump = (v = .5) => { const c = SND.ctx; if (!c || !SND.on || c.state !== 'running') return; const t = c.currentTime, o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(38, t + .5); env(c, g, t, .004, v, .7); o.connect(g); g.connect(out()); g.connect(SND.rv); o.start(t); o.stop(t + .8); };
  SND.chime = () => { [0, .09, .18].forEach((d, i) => setTimeout(() => SND.blip([660, 990, 1320][i], .045, .25), d * 1000)); };
  // the room tone: two detuned low voices under a slow filter, barely there
  SND.droneOn = (level = .07) => { const c = SND.wake(); if (!c || SND.drone) return; const t = c.currentTime, g = c.createGain(), lp = c.createBiquadFilter(), lfo = c.createOscillator(), lg = c.createGain(); lp.type = 'lowpass'; lp.frequency.value = 220; lp.Q.value = .7; lfo.frequency.value = .05; lg.gain.value = 120; lfo.connect(lg); lg.connect(lp.frequency);
    const os = [55, 55.4, 82.4, 110.2].map((f, i) => { const o = c.createOscillator(); o.type = i < 2 ? 'sawtooth' : 'triangle'; o.frequency.value = f; const og = c.createGain(); og.gain.value = i < 2 ? .5 : .25; o.connect(og); og.connect(lp); o.start(); return o; });
    lp.connect(g); g.connect(out()); g.connect(SND.rv); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(level, t + 3); lfo.start(); SND.drone = { g, os, lfo }; };
  SND.droneLevel = (v, s = 1.5) => { const c = SND.ctx; if (c && SND.drone) SND.drone.g.gain.setTargetAtTime(v, c.currentTime, s / 3); };
  // the browser only lets sound start after a click or a key
  const first = () => { SND.wake(); document.dispatchEvent(new Event('z-audio')); removeEventListener('pointerdown', first, true); removeEventListener('keydown', first, true); };
  addEventListener('pointerdown', first, true); addEventListener('keydown', first, true);
})();
