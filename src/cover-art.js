// Covers drawn the way they move (Claude Design, "Covers design" → Main.dc.html, ported from its drawing at its
// defaults): a window of sky that follows the time of day, with the cover in front. Curtains part from the middle,
// a roller blind rolls up into its headrail, venetian slats stack under theirs and tilt. You drag the cover itself:
// a faint outline shows where it's going and the cover catches up at the device's own speed. A blue grip shows where
// you hold it while you hover, drag or it moves; on touch screens it rests at 40% after a short hello.

const COVER = '#E1E1E1', FRAME = '#F7F4F0', GRIP = '#03a9f4';
// the glass: 8 in from the frame, which is 6 in from the 200 box
const G0 = 14, GS = 172;
let seq = 0;
const n2 = (v) => Math.round(v * 100) / 100;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const rect = (x, y, w, h, fill, opacity) => '<rect x="' + n2(x) + '" y="' + n2(y) + '" width="' + n2(w) + '" height="' + n2(h) + '" fill="' + fill + '"' + (opacity != null ? ' opacity="' + opacity + '"' : '') + '/>';
const path = (pts) => pts.map((p, k) => (k ? 'L' : 'M') + n2(p[0]) + ' ' + n2(p[1])).join('');

// which drawing a cover gets: curtains, a roller blind (shade), or slats (blind, or anything that tilts)
export function coverKind(st) {
  const a = st?.attributes || {};
  if (a.device_class === 'curtain') return 'curtain';
  if (a.device_class === 'blind' || a.current_tilt_position != null) return 'venetian';
  return 'blind';
}

// the sky by the hour: [top, bottom, warm glow, cool glow, glow strength], blended between these hours
const SKY = [
  [2, ['#070B16', '#0E2447', '#1B3A6B', '#0A1733', 0.9]], [6.5, ['#0B0F1C', '#2E7FD6', '#F2743B', '#F1B6C8', 0.95]],
  [9.5, ['#8FC4EC', '#4DA3E8', '#F4FAFF', '#2F7FCF', 0.7]], [13, ['#9ED3F6', '#3F97E6', '#FFFFFF', '#2B86D9', 0.65]],
  [17, ['#9FC2E4', '#4A8ED4', '#FFD9B8', '#5E8FD6', 0.75]], [19, ['#4B5E86', '#3B86E0', '#FF6A3D', '#B07CE8', 0.95]],
  [21.5, ['#1A2140', '#1F3F7A', '#B4506E', '#3E59A6', 0.8]], [26, ['#070B16', '#0E2447', '#1B3A6B', '#0A1733', 0.9]],
];
function skyAt(hour) {
  const hh = hour < 2 ? hour + 24 : hour;
  let a = SKY[0], b = SKY[SKY.length - 1];
  for (let i = 0; i < SKY.length - 1; i++) if (hh >= SKY[i][0] && hh <= SKY[i + 1][0]) { a = SKY[i]; b = SKY[i + 1]; break; }
  const t = (hh - a[0]) / (b[0] - a[0]), e = t * t * (3 - 2 * t);
  const mix = (x, y) => { const px = parseInt(x.slice(1), 16), py = parseInt(y.slice(1), 16); return '#' + [16, 8, 0].map((sh) => Math.round(((px >> sh) & 255) + (((py >> sh) & 255) - ((px >> sh) & 255)) * e).toString(16).padStart(2, '0')).join(''); };
  return { top: mix(a[1][0], b[1][0]), bot: mix(a[1][1], b[1][1]), warm: mix(a[1][2], b[1][2]), cool: mix(a[1][3], b[1][3]), op: a[1][4] + (b[1][4] - a[1][4]) * e, t: hh };
}

// the cover's seam and highlight: its own colour 14 darker and 16 lighter
function hsl(hex) {
  const n = parseInt(hex.slice(1), 16), r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (mx + mn) / 2;
  if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = (mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4) / 6; }
  return [h * 360, s * 100, l * 100];
}
function fromHsl(h, s, l) {
  s = clamp(s, 0, 100) / 100; l = clamp(l, 0, 100) / 100;
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return '#' + [f(0), f(8), f(4)].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
}
const [CH, CS, CL] = hsl(COVER);
const SEAM = fromHsl(CH, CS, Math.max(6, CL - 14)), LIFT = fromHsl(CH, CS, Math.min(96, CL + 16));

// Each drawing gives its body, the rails a grip rides on, and its headrail's height. Flat is the outline of where
// it's going: one tint, no stripes, seams or cords.

// Curtains: two panels gathered on a rail; while they move the hem trails and the folds sway
function curtain(of, barOf, vel, ph, flat) {
  const half = GS / 2, min = GS * 0.12, cw = half - (half - min) * of;
  const hang = (t) => t ** 1.3;
  const lagV = clamp(vel, -1.5, 1.5);
  const lag = (t) => -(Math.abs(lagV) * 4.6 * t ** 1.5) * Math.sign(lagV);
  const rest = of * 1.4;
  const panel = (px, left) => {
    const amp = Math.min(4.8, Math.abs(vel) * 2.6) * (left ? 1 : -1) * Math.sign(vel || 1);
    const inner = left ? px + cw : px, outer = left ? px : px + cw;
    const edge = (t) => inner + lag(t) + amp * Math.sin(t * Math.PI * 1.2 + ph) * hang(t) * 1.4 + rest * Math.sin(t * Math.PI * 2 + ph * 0.6) * hang(t) * (left ? 1 : -1);
    const pts = [[outer, G0]];
    for (let k = 0; k <= 12; k++) pts.push([edge(k / 12), G0 + (GS * k) / 12]);
    pts.push([outer, G0 + GS]);
    let out = '<path d="' + path(pts) + 'Z" fill="' + COVER + '"/>';
    if (flat) return out;
    // six folds; the stripes are every other gap between them
    const flair = 1.35 + ((left ? vel > 0 : vel < 0) ? 0.35 : 0);
    const fold = (i) => {
      const depth = i / 7, dist = left ? 1 - depth : depth, w = (1 - dist) ** 1.3, fx = px + cw * depth;
      return Array.from({ length: 13 }, (_, k) => { const t = k / 12; return [fx + lag(t) * w + amp * flair * Math.sin(t * Math.PI * 1.2 + ph - dist * 3.2) * hang(t) * 1.4 * w + rest * 1.6 * Math.sin(t * Math.PI * 2 + ph * 0.6 - dist * 2.5) * hang(t) * of * (0.4 + 0.6 * w), G0 + GS * t]; });
    };
    const lines = [1, 2, 3, 4, 5, 6].map(fold);
    for (let i = 0; i < 6; i += 2) out += '<path d="' + path(lines[i]) + path(lines[i + 1].slice().reverse()).replace('M', 'L') + 'Z" fill="#fff"/>';
    return out;
  };
  const cwB = half - (half - min) * barOf;
  return { body: panel(G0, true) + panel(G0 + GS - cw, false), rails: [{ x: G0 + cwB - 4, y: G0, w: 4, h: GS }, { x: G0 + GS - cwB, y: G0, w: 4, h: GS }], head: 6.4 };
}

// Roller blind: fabric from the headrail down, white stripes
function blind(of, barOf, flat) {
  const fh = GS * (1 - of);
  let body = '';
  if (fh > 1) {
    body += rect(G0, G0, GS, fh, COVER);
    if (!flat) for (let i = 1; i < 7; i += 2) body += rect(G0 + (GS * i) / 7, G0, GS / 7, fh, '#fff');
  }
  return { body, rails: [{ x: G0, y: G0 + GS * (1 - barOf) - 7, w: GS, h: 11 }], head: 10.4 };
}

// Venetian blinds: slats hang from the headrail; the bottom rail sweeps up through them and stacks them; tilt turns
// each slat from 9 tall (shut) to 2 (open)
function venetian(of, barOf, tilt, flat) {
  const sh = 9 - 7 * (tilt / 100), railTop = G0 + GS * (1 - of), N = Math.ceil(GS / 10) + 1;
  const topY = G0 + sh / 2, spD = (G0 + GS - sh / 2 - topY) / (N - 1), flatH = 0.8, stackP = 0.6;
  const ys = Array.from({ length: N }, (_, i) => Math.max(topY + i * stackP, Math.min(topY + i * spD, railTop - sh / 2 - (N - 1 - i) * stackP)));
  const deps = ys.slice(0, -1).map((y, i) => clamp((ys[i + 1] - y - stackP) / (spD - stackP), 0, 1));
  deps.push(deps[N - 2]);
  let body = '';
  ys.forEach((y, i) => {
    const h = flatH + (sh - flatH) * deps[i], half = Math.max(0.5, h / 2), face = Math.max(0.4, h * 0.114);
    body += rect(G0, y - half, GS, Math.max(1, h), COVER);
    if (!flat && h > 2.2) body += rect(G0, y + half - face, GS, face, SEAM) + rect(G0, y - half, GS, face * 0.55, LIFT, 0.75);
  });
  if (!flat) [0.22, 0.78].forEach((f) => { body += rect(G0 + GS * f - 0.7, G0, 1.4, Math.max(0, ys[N - 1] + 1 - G0), SEAM, 0.85); });
  return { body, rails: [{ x: G0, y: G0 + GS * (1 - barOf) - 8, w: GS, h: 8 }], head: 8.8 };
}

const part = (kind, of, barOf, tilt, vel, ph, flat) => (kind === 'curtain' ? curtain(of, barOf, vel, ph, flat) : kind === 'venetian' ? venetian(of, barOf, tilt, flat) : blind(of, barOf, flat));

// a grip on each rail: a line across the glass and a knob with arrows the way it moves
function grips(id, rails) {
  let lines = '', knobs = '';
  rails.forEach((p) => {
    const horiz = p.w > p.h;
    const cx = clamp(horiz ? G0 + GS / 2 : p.x + p.w / 2, 17, 183), cy = clamp(horiz ? p.y + p.h / 2 : G0 + GS / 2, 17, 183);
    lines += horiz ? rect(G0, clamp(p.y + p.h / 2, G0, G0 + GS) - 1, GS, 2, GRIP) : rect(clamp(p.x + p.w / 2, G0, G0 + GS) - 1, G0, 2, GS, GRIP);
    const arrows = horiz
      ? 'M' + n2(cx - 4) + ' ' + n2(cy - 3) + 'l4 -3l4 3M' + n2(cx - 4) + ' ' + n2(cy + 3) + 'l4 3l4 -3'
      : 'M' + n2(cx - 3) + ' ' + n2(cy - 4) + 'l-3 4l3 4M' + n2(cx + 3) + ' ' + n2(cy - 4) + 'l3 4l-3 4';
    knobs += '<circle cx="' + n2(cx) + '" cy="' + n2(cy) + '" r="11" fill="' + GRIP + '" filter="url(#' + id + 's)"/><path d="' + arrows + '" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>';
  });
  return { lines, knobs };
}

function drawing(id, v) {
  const now = new Date(), sk = skyAt(now.getHours() + now.getMinutes() / 60);
  // the warm glow rides high through the day; at noon it sits just above the frame
  const wx = 42 + 18 * Math.sin(sk.t * 0.5), wy = sk.t >= 5 && sk.t <= 20 ? 40 - 48 * Math.sin((Math.PI * (sk.t - 5)) / 15) : 80;
  const cover = part(v.kind, v.pos / 100, v.bar / 100, v.tilt, v.vel, v.ph, false);
  const ghost = v.ghostAlpha > 0.004 && v.ghost != null ? part(v.kind, v.ghost / 100, v.ghost / 100, v.tilt, 0, 0, true).body : '';
  const g = v.grip > 0.004 ? grips(id, cover.rails) : null;
  const glass = (fill) => rect(G0, G0, GS, GS, fill);
  return '<svg viewBox="0 0 200 200" aria-hidden="true" focusable="false"><defs>' +
    '<clipPath id="' + id + 'c"><rect x="14" y="14" width="172" height="172" rx="8"/></clipPath>' +
    '<linearGradient id="' + id + 'l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + sk.top + '"/><stop offset="1" stop-color="' + sk.bot + '"/></linearGradient>' +
    '<radialGradient id="' + id + 'w" cx="' + n2(wx) + '%" cy="' + n2(wy) + '%" r="58%"><stop offset="0" stop-color="' + sk.warm + '" stop-opacity="' + n2(sk.op * 0.8) + '"/><stop offset="1" stop-color="' + sk.warm + '" stop-opacity="0"/></radialGradient>' +
    '<radialGradient id="' + id + 'k" cx="' + n2(100 - wx * 0.8) + '%" cy="' + n2(100 - wy * 0.6) + '%" r="62%"><stop offset="0" stop-color="' + sk.cool + '" stop-opacity="' + n2(sk.op * 0.64) + '"/><stop offset="1" stop-color="' + sk.cool + '" stop-opacity="0"/></radialGradient>' +
    '<filter id="' + id + 's" x="-5%" y="-50%" width="110%" height="300%"><feDropShadow dx="0" dy="1.2" stdDeviation="1.2" flood-color="#000" flood-opacity=".18"/></filter></defs>' +
    '<rect x="6" y="6" width="188" height="188" rx="16" fill="' + FRAME + '" stroke="#E3E3E3" stroke-width=".4"/>' +
    '<g clip-path="url(#' + id + 'c)">' + glass('url(#' + id + 'l)') + glass('url(#' + id + 'w)') + glass('url(#' + id + 'k)') +
    (ghost ? '<g opacity="' + n2(v.ghostAlpha) + '">' + ghost + '</g>' : '') + cover.body +
    '<rect x="14" y="14" width="172" height="' + cover.head + '" fill="' + COVER + '" filter="url(#' + id + 's)"/></g>' +
    (g ? '<g clip-path="url(#' + id + 'c)" opacity="' + n2(v.grip) + '">' + g.lines + '</g>' : '') +
    '<rect x="13.5" y="13.5" width="173" height="173" rx="8.5" fill="none" stroke="' + FRAME + '" stroke-width="3"/>' +
    (g ? '<g opacity="' + n2(v.grip) + '">' + g.knobs + '</g>' : '') + '</svg>';
}

// One drawing, kept across redraws. update() takes what Home Assistant says (pos, tilt, moving) and where it's
// heading (target); onMove(value) while it's dragged or keyed, onSet(value) when let go.
export function createCoverArt({ onMove, onSet }) {
  const id = 'cv' + ++seq;
  const el = document.createElement('div');
  el.className = 'tfCoverArt';
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  let s = null;
  const d = { pos: 0, tilt: 0, vel: 0, ph: 0, grip: 0, ghost: 0, gpos: null, last: 0 };
  let raf = 0, hover = false, ring = false, hold = null, keyTimer = 0, hello = 0;
  const axis = () => (s?.kind === 'curtain' ? 'x' : 'y');
  const gripWant = () => (hold || hover || ring || s.moving || s.target != null ? 1 : coarse ? (performance.now() < hello ? 1 : 0.4) : 0);

  const paint = () => { el.innerHTML = drawing(id, { kind: s.kind, pos: d.pos, bar: s.target ?? d.pos, tilt: d.tilt, vel: d.vel, ph: d.ph, ghost: d.gpos, ghostAlpha: d.ghost, grip: d.grip }); };
  function step(now) {
    raf = 0;
    const dt = d.last ? Math.min(0.064, (now - d.last) / 1000) : 1 / 60, f = dt * 60;
    d.last = now;
    // the drawn cover catches up with the device: at least 10.5% a second, quicker for a big jump
    const gap = s.pos - d.pos, prev = d.pos;
    d.pos += Math.sign(gap) * Math.min(Math.abs(gap), Math.max(10.5, Math.abs(gap) * 1.4) * dt);
    if (Math.abs(s.pos - d.pos) < 0.03) d.pos = s.pos;
    d.vel = d.vel * 0.86 + ((d.pos - prev) / f) * 0.14;
    if (Math.abs(d.vel) < 0.015 && d.pos === s.pos) d.vel = 0;
    if (d.pos !== prev || d.vel) d.ph += (0.06 + Math.abs(d.vel) * 0.03) * f;
    const tg = s.tilt - d.tilt;
    d.tilt += Math.sign(tg) * Math.min(Math.abs(tg), Math.max(60, Math.abs(tg) * 4) * dt);
    // the grip comes in quickly and goes slowly; the outline fades once the cover is there
    const gw = gripWant();
    d.grip += (gw - d.grip) * Math.min(1, dt * (gw > d.grip ? 11 : 3.5));
    if (Math.abs(gw - d.grip) < 0.01) d.grip = gw;
    const gh = s.target != null && Math.abs(s.target - d.pos) > 0.5 ? 0.22 : 0;
    if (s.target != null) d.gpos = s.target;
    d.ghost += (gh - d.ghost) * Math.min(1, dt * (gh > d.ghost ? 16 : 3));
    if (Math.abs(gh - d.ghost) < 0.004) d.ghost = gh;
    paint();
    if (d.pos !== s.pos || d.vel || d.tilt !== s.tilt || d.grip !== gw || d.ghost !== gh) raf = requestAnimationFrame(step);
    else d.last = 0;
  }
  const kick = () => { if (s && !raf) raf = requestAnimationFrame(step); };
  const sky = setInterval(() => { if (s && !raf) paint(); }, 60 * 1000);

  // drag: the cover moves by how far you've moved from where you pressed, never jumping to the pointer
  const frac = (e) => { const r = el.getBoundingClientRect(); return axis() === 'x' ? (e.clientX - r.left) / r.width : (e.clientY - r.top) / r.height; };
  el.addEventListener('pointerdown', (e) => {
    if (!s?.canSet || e.button > 0) return;
    e.preventDefault();
    el.setPointerCapture?.(e.pointerId);
    const from = s.target ?? s.pos, r = el.getBoundingClientRect();
    hold = { p0: frac(e), from, x0: e.clientX, value: null, side: null };
    // a closed pair of curtains: the side you hold is the way you first move
    if (s.kind === 'curtain' && from > 0) hold.side = (e.clientX - r.left) / r.width < 0.5 ? 'L' : 'R';
    kick();
  });
  el.addEventListener('pointermove', (e) => {
    if (!hold) return;
    let v;
    if (s.kind === 'curtain') {
      if (!hold.side) { const dx = e.clientX - hold.x0; if (Math.abs(dx) < 4) return; hold.side = dx < 0 ? 'L' : 'R'; }
      const travel = (GS / 2 - GS * 0.12) / 200; // one panel's full travel, as a share of the drawing
      v = hold.from + (hold.side === 'L' ? -1 : 1) * ((frac(e) - hold.p0) / travel) * 100;
    } else v = hold.from - ((frac(e) - hold.p0) / (GS / 200)) * 100;
    hold.value = clamp(v, 0, 100);
    onMove(hold.value);
  });
  const release = () => { if (!hold) return; const v = hold.value; hold = null; if (v != null) onSet(Math.round(v)); kick(); };
  el.addEventListener('pointerup', release);
  el.addEventListener('pointercancel', release);
  el.addEventListener('lostpointercapture', release);
  el.addEventListener('pointerenter', () => { hover = true; kick(); });
  el.addEventListener('pointerleave', () => { hover = false; kick(); });
  el.addEventListener('focus', () => { ring = el.matches(':focus-visible'); kick(); });
  el.addEventListener('blur', () => { ring = false; kick(); });
  // keys, like a range input: arrows 1 (10 with Shift), Page Up and Down 25, Home closed, End open
  el.addEventListener('keydown', (e) => {
    if (!s?.canSet) return;
    const v0 = Math.round(s.target ?? s.pos), st = e.shiftKey ? 10 : 1;
    const n = { ArrowUp: v0 + st, ArrowRight: v0 + st, ArrowDown: v0 - st, ArrowLeft: v0 - st, PageUp: v0 + 25, PageDown: v0 - 25, Home: 0, End: 100 }[e.key];
    if (n == null) return;
    e.preventDefault();
    const v = clamp(n, 0, 100);
    onMove(v);
    clearTimeout(keyTimer);
    keyTimer = setTimeout(() => onSet(v), 500);
  });

  return {
    el,
    update(next) {
      const first = !s;
      s = next;
      if (first) { d.pos = s.pos; d.tilt = s.tilt; hello = performance.now() + 1500; if (coarse) setTimeout(kick, 1600); }
      el.classList.toggle('x', axis() === 'x');
      el.classList.toggle('y', axis() === 'y');
      if (s.canSet) {
        el.tabIndex = 0;
        el.setAttribute('role', 'slider');
        el.setAttribute('aria-valuemin', '0');
        el.setAttribute('aria-valuemax', '100');
        el.setAttribute('aria-valuenow', String(Math.round(s.target ?? s.pos)));
        el.setAttribute('aria-orientation', axis() === 'x' ? 'horizontal' : 'vertical');
      } else el.setAttribute('role', 'img');
      el.setAttribute('aria-label', s.name + (s.canSet ? ' position' : ''));
      el.setAttribute('aria-valuetext', s.text);
      kick();
    },
    destroy() { cancelAnimationFrame(raf); raf = 0; clearInterval(sky); clearTimeout(keyTimer); el.remove(); },
  };
}
