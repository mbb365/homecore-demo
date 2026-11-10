// HomeCore's micro-interactions (Matt, 10 Nov): the eleven from the HomeCore Motion Lab, with the values he set there,
// copied as they were. The maths is the lab's own. With Reduce motion on, everything lands at its end straight away.
export const M = {
  pivot: { tilt: 2, dir: 'dips', persp: 220, lift: 103, press: 98, shine: 10, size: 80, ret: 210, ease: 'soft' },
  slider: { glow: 6, spread: 1, strength: 14, hold: 5, holdStrength: 42, grow: 101, axis: 'height', colour: 'light', ein: 140, eout: 520, ease: 'soft' },
  iconbtn: { scale: 108.4, // 107 in the lab, its growth 20% bigger (Matt, 10 Nov)
    press: 90, dur: 160, ease: 'soft', tint: 1 },
  warp: { style: 'pinch', amount: 60, win: 120, cdelay: 0, cdur: 500, wout: 340, ease: 'soft' },
  expand: { style: 'grow', dur: 660, ease: 'standard', blur: 14, delay: 140, stagger: 145, back: 105 },
  graphs: { weight: 1, curve: 'smooth', fill: 1, grid: 1, labels: 1, draw: 1000 },
  tabs: { style: 'stretch', dur: 360, ease: 'land', stretch: 56 },
  dialog: { style: 'centre', open: 380, close: 240, ease: 'spring', scrim: 45, blur: 12, from: 80 },
  confirm: { style: 'toast', size: 18, stay: 2600, enter: 'rise', dur: 360, draw: 1, undo: 1 },
  drag: { pull: 17, keep: 70, stick: 44, tilt: 5, lift: 3.5, gap: 420, slide: 420, squash: 5 },
  outline: { lightAt: 30, glowFrom: 20, colourFrom: 50, cone: 20, glow: 15, border: 49, fill: 15, size: 60, colours: 'mono', hue: 199, press: 1, fin: 180, fout: 350 },
};
export const EASE = { standard: 'cubic-bezier(.2,0,0,1)', land: 'cubic-bezier(.34,1.46,.64,1)', spring: 'cubic-bezier(.2,1.2,.4,1)', soft: 'cubic-bezier(.4,0,.2,1)', exit: 'cubic-bezier(.4,0,1,1)' };
export const reduced = () => Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

// the lab's values as CSS custom properties, for the parts done in CSS (motion.css)
export function motionVars() {
  const { pivot: pv, slider: s, iconbtn: ib, warp: w, outline: o } = M;
  return [
    ['--pv-persp', pv.persp + 'px'], ['--pv-shine', pv.shine / 100], ['--pv-size', pv.size + '%'], ['--pv-ret', pv.ret + 'ms'], ['--pv-ease', EASE[pv.ease]],
    ['--ab-blur', s.glow + 'px'], ['--ab-spread', s.spread + 'px'], ['--ab-str', s.strength + '%'],
    ['--ab-blur2', s.glow + s.hold + 'px'], ['--ab-spread2', s.spread + s.hold / 4 + 'px'], ['--ab-str2', s.holdStrength + '%'],
    ['--ab-grow', s.axis === 'height' ? 'scaleY(' + (1 + (s.grow / 100 - 1) * 3) + ')' : 'scale(' + s.grow / 100 + ')'],
    ['--ab-in', s.ein + 'ms'], ['--ab-out', s.eout + 'ms'], ['--ab-ease', EASE[s.ease]],
    ['--ih-s', ib.scale / 100], ['--ih-p', ib.press / 100], ['--ih-dur', ib.dur + 'ms'], ['--ih-ease', EASE[ib.ease]], ['--ih-tint', ib.tint ? '8%' : '0%'],
    ['--wc-dur', w.cdur + 'ms'], ['--wc-delay', w.cdelay + 'ms'], ['--wc-ease', EASE[w.ease]],
    ['--ol-esens', o.glowFrom], ['--ol-csens', o.colourFrom], ['--ol-cone', o.cone], ['--ol-glow', o.glow / 100], ['--ol-border', o.border / 100], ['--ol-fill', o.fill / 100],
    ['--ol-size', o.size / 100], ['--ol-h', o.hue + 'deg'], ['--ol-in', o.fin + 'ms'], ['--ol-out', o.fout + 'ms'],
  ].map(([k, v]) => k + ':' + v).join(';');
}

/* ---------- 1 · pivot: buttons and tappable tiles lean toward the pointer, with a shine; they lift, and press in ---------- */
const PIVOT = ':is(button.primary,button.pill,.hcBtn,.wbRangeBtn,.activityRow.tap,.hcRow,a.hcRow)';
/* ---------- 3 · icon buttons are CSS (motion.css); 11 · the outline light: the area cards only (Matt, 10 Nov) ---------- */
const OUTLINE = '#homeView .tfAreaPanel';
/* the pivot's drop-off (Matt, 10 Nov: wide tiles bent a lot): up to the lab's tile, 300 across, it moves as set; past
   that the tilt, lift and press shrink by 300 ÷ its size and its perspective grows by its size ÷ 300 (a fixed 220
   perspective bends a wide tile's far edges most), so its edges move as far as the lab's tile's do, however wide (and,
   for the tilt up and down, however tall) it is */
const PV_REF = 300;
const pvFall = (px) => Math.min(1, PV_REF / Math.max(1, px));
const pvScale = (el, pct) => 1 + (pct / 100 - 1) * pvFall(el.offsetWidth);

export function installMotion(root, app) {
  app.style.cssText += ';' + motionVars();
  // pivot
  let pv = null;
  const rest = (el) => { el.classList.remove('mvMoving', 'mvLit'); el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); el.style.setProperty('--sc', 1); el._down = false; };
  root.addEventListener('pointermove', (e) => {
    const el = e.pointerType === 'touch' || reduced() ? null : e.target.closest?.(PIVOT);
    if (pv && pv !== el) rest(pv);
    pv = el;
    if (!el || el.disabled) return;
    const p = M.pivot, r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height, s = p.dir === 'dips' ? 1 : -1;
    el.classList.add('mvPv', 'mvMoving', 'mvLit');
    el.style.setProperty('--pv-persp', p.persp / pvFall(Math.max(el.offsetWidth, el.offsetHeight)) + 'px');
    el.style.setProperty('--ry', (s * (x - 0.5) * 2 * p.tilt * pvFall(el.offsetWidth)).toFixed(3) + 'deg');
    el.style.setProperty('--rx', (s * -(y - 0.5) * 2 * p.tilt * pvFall(el.offsetHeight)).toFixed(3) + 'deg');
    el.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
    el.style.setProperty('--my', (y * 100).toFixed(1) + '%');
    if (!el._down) el.style.setProperty('--sc', pvScale(el, p.lift));
  }, { passive: true });
  root.addEventListener('pointerout', (e) => { if (pv && !pv.contains(e.relatedTarget)) { rest(pv); pv = null; } });
  root.addEventListener('pointerdown', (e) => {
    const el = reduced() ? null : e.target.closest?.(PIVOT);
    if (el) { el._down = true; el.classList.add('mvPv'); el.classList.remove('mvMoving'); el.style.setProperty('--sc', pvScale(el, M.pivot.press)); }
  });
  root.addEventListener('pointerup', (e) => {
    const el = e.target.closest?.(PIVOT);
    if (el) { el._down = false; el.style.setProperty('--sc', e.pointerType === 'touch' ? 1 : pvScale(el, M.pivot.lift)); }
  });

  // 2 · the slider glow: on hover, and bigger and a touch taller while held
  let held = null;
  root.addEventListener('pointerover', (e) => { if (e.pointerType !== 'touch') e.target.closest?.('.tfBar')?.classList.add('mvHover'); });
  root.addEventListener('pointerout', (e) => { const b = e.target.closest?.('.tfBar'); if (b && !b.contains(e.relatedTarget) && b !== held) b.classList.remove('mvHover'); });
  root.addEventListener('pointerdown', (e) => { const b = e.target.closest?.('.tfBar'); if (b) { held = b; b.classList.add('mvHold'); } });
  const letGo = (e) => {
    if (!held) return;
    held.classList.remove('mvHold');
    const r = held.getBoundingClientRect();
    if (e.pointerType === 'touch' || e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) held.classList.remove('mvHover');
    held = null;
  };
  window.addEventListener('pointerup', letGo, true);
  window.addEventListener('pointercancel', letGo, true);
  root.addEventListener('focusin', (e) => { if (e.target.matches?.('.tfBar:focus-visible')) e.target.classList.add('mvHover'); });
  root.addEventListener('focusout', (e) => { e.target.classList?.remove('mvHover', 'mvHold'); });
  root.addEventListener('keydown', (e) => {
    const b = e.target.closest?.('.tfBar');
    if (!b || !['ArrowRight', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key)) return;
    b.classList.add('mvHold'); clearTimeout(b._k); b._k = setTimeout(() => b.classList.remove('mvHold'), 350);
  });

  // 4 · on/off: the icon pinches in, the state changes, it settles back
  root.addEventListener('click', (e) => { const b = e.target.closest?.('button.tfIcon[data-act]'); if (b) warp(b); });

  // 11 · the outline light: the same maths as Move Assistant's getBorderGlowMetrics
  let lit = null;
  const glow = (c, e, force) => {
    if (!c.querySelector(':scope>.mvEdge')) c.insertAdjacentHTML('afterbegin', '<span class="mvEdgeFill" aria-hidden="true"></span><span class="mvEdge" aria-hidden="true"><i></i></span>');
    const r = c.getBoundingClientRect(), cx = r.width / 2, cy = r.height / 2, dx = e.clientX - r.left - cx, dy = e.clientY - r.top - cy;
    const kx = dx ? cx / Math.abs(dx) : Infinity, ky = dy ? cy / Math.abs(dy) : Infinity, edge = Math.min(Math.max(1 / Math.min(kx, ky), 0), 1);
    let a = (Math.atan2(dy, dx) * 180) / Math.PI + 90; if (a < 0) a += 360;
    const prox = force ? 100 : edge * 100;
    c.style.setProperty('--edge-proximity', prox.toFixed(3));
    c.style.setProperty('--cursor-angle', a.toFixed(3) + 'deg');
    c.classList.toggle('mvLitEdge', force || prox >= M.outline.lightAt);
  };
  const unlight = (c) => { c.classList.remove('mvLitEdge'); c.style.setProperty('--edge-proximity', '0'); c._down = false; };
  const cardAt = (t) => { const c = t.closest?.(OUTLINE); return c && !app.classList.contains('tfEditing') ? c : null; };
  root.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    const c = cardAt(e.target);
    if (lit && lit !== c) unlight(lit);
    lit = c;
    if (c && !c._down) glow(c, e, false);
  }, { passive: true });
  root.addEventListener('pointerout', (e) => { if (lit && !lit.contains(e.relatedTarget)) { unlight(lit); lit = null; } });
  root.addEventListener('pointerdown', (e) => { const c = cardAt(e.target); if (c && M.outline.press) { c._down = true; glow(c, e, true); } });
  root.addEventListener('pointerup', (e) => { const c = cardAt(e.target); if (!c) return; c._down = false; if (e.pointerType === 'touch') unlight(c); else glow(c, e, false); });

  // 8 · dialogs: every popup comes in from the centre, its dim and blur fading up with it
  new MutationObserver((list) => {
    for (const m of list) {
      const t = m.target;
      if (m.type === 'attributes') { if (t.classList?.contains('tfMoreBackdrop') && !t.hidden && m.oldValue !== null) openDialog(t); continue; }
      m.addedNodes.forEach((n) => { if (n.nodeType === 1 && n.classList.contains('tfMoreBackdrop') && !n.hidden) openDialog(n); });
    }
  }).observe(app, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'], attributeOldValue: true });
}

/* ---------- 4 · on/off warp ---------- */
// where an element sits under its card (or popup), so it can be found again once the tile's been drawn again
const anchorOf = (el) => el.closest('[data-k],.tfMore,.tfMorePair') || el.getRootNode();
function pathTo(el, top) { const p = []; for (let n = el; n && n !== top && n.parentNode; n = n.parentNode) p.unshift([...n.parentNode.children].indexOf(n)); return p; }
const follow = (top, p) => p.reduce((n, i) => n?.children[i], top);
function warp(b) {
  if (reduced() || b._warp) return;
  const p = M.warp, a = p.amount / 100, glyph = b.firstElementChild;
  if (!glyph) return;
  const K = { squash: { scale: (1 + 0.35 * a) + ' ' + (1 - 0.55 * a) }, pinch: { scale: String(1 - 0.5 * a) }, twist: { rotate: 140 * a + 'deg', scale: String(1 - 0.35 * a) }, flip: { rotate: 'y 90deg' } }[p.style];
  const filt = p.style === 'pinch' ? 'blur(' + 2 * a + 'px)' : 'blur(0px)';
  const home = b.getRootNode(), top = anchorOf(b), key = top.dataset?.k, path = pathTo(b, top), was = b.getAttribute('aria-pressed') + '|' + b.dataset.act;
  b._warp = 1;
  const w1 = glyph.animate([{ scale: '1', rotate: 'none', filter: 'blur(0px)' }, { ...K, filter: filt }], { duration: p.win, easing: EASE.exit, fill: 'forwards' });
  const t0 = performance.now();
  w1.finished.then(() => {
    // the state lands about 120 after the tap (and the tile is drawn again): settle on whatever's there by then
    const settle = () => {
      const top2 = key ? (top.isConnected ? top : home.querySelector?.('[data-k="' + CSS.escape(key) + '"]')) : top;
      const now = top2 && follow(top2, path);
      const same = now === b && b.getAttribute('aria-pressed') + '|' + b.dataset.act === was;
      if (same && performance.now() - t0 < 420) { requestAnimationFrame(settle); return; }
      const target = now?.matches?.('button.tfIcon') ? now : b;
      const g = target.firstElementChild || glyph;
      g.animate([{ ...K, filter: filt }, { scale: '1', rotate: 'none', filter: 'blur(0px)' }], { duration: p.wout, easing: EASE[p.ease] });
      w1.cancel(); b._warp = 0;
    };
    settle();
  });
}

/* ---------- 5 · a tile opens: it grows from the tile, its header slides up, and the graph comes in after ---------- */
export function expandOpen(det, tile, tileChip) {
  if (reduced() || !det || !tile) return;
  const p = M.expand, d = det.getBoundingClientRect();
  const ins = 'inset(' + (tile.top - d.top).toFixed(1) + 'px ' + (d.right - tile.right).toFixed(1) + 'px ' + (d.bottom - tile.bottom).toFixed(1) + 'px ' + (tile.left - d.left).toFixed(1) + 'px round 24px)';
  const head = det.firstElementChild, bk = head?.querySelector('.tfBack, [data-close], [data-wb="graph-close"]'), rest = [...det.children].slice(1);
  det.animate([{ clipPath: ins }, { clipPath: 'inset(0px 0px 0px 0px round 0px)' }], { duration: p.dur, easing: EASE[p.ease] });
  const hc = head?.querySelector('.tfIcon,.wbIcon')?.getBoundingClientRect();
  if (head && hc && tileChip) head.animate([{ transform: 'translate(' + (tileChip.left - hc.left).toFixed(1) + 'px,' + (tileChip.top - hc.top).toFixed(1) + 'px)' }, { transform: 'none' }], { duration: p.dur, easing: EASE[p.ease] });
  bk?.animate([{ opacity: 0 }, { opacity: 0, offset: 0.5 }, { opacity: 1 }], { duration: p.dur, easing: EASE[p.ease] });
  rest.forEach((c, j) => {
    c.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 260, delay: p.delay + j * p.stagger, easing: EASE.standard, fill: 'backwards' });
  });
}
// closing runs it backwards, a little longer (back), then hands over
export function expandClose(det, tile, done) {
  if (reduced() || !det || !tile) { done(); return; }
  const p = M.expand, dur = (p.dur * p.back) / 100, d = det.getBoundingClientRect();
  const ins = 'inset(' + (tile.top - d.top).toFixed(1) + 'px ' + (d.right - tile.right).toFixed(1) + 'px ' + (d.bottom - tile.bottom).toFixed(1) + 'px ' + (tile.left - d.left).toFixed(1) + 'px round 24px)';
  [...det.children].slice(1).forEach((c) => c.animate([{ opacity: 1 }, { opacity: 0 }], { duration: dur * 0.3, easing: EASE.standard, fill: 'forwards' }));
  const a = det.animate([{ clipPath: 'inset(0px 0px 0px 0px round 0px)' }, { clipPath: ins, opacity: 1, offset: 0.85 }, { clipPath: ins, opacity: 0 }], { duration: dur, easing: EASE.standard, fill: 'forwards' });
  let called = false;
  const go = () => { if (!called) { called = true; done(); } };
  a.finished.then(go, go);
  setTimeout(go, dur + 80);
}

/* ---------- 6 · graphs: a thin smooth line, its fill, three grid lines, the line drawing in ---------- */
export const smoothD = (pts) => {
  let d = 'M' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += 'C' + c1.map((v) => v.toFixed(1)).join(' ') + ' ' + c2.map((v) => v.toFixed(1)).join(' ') + ' ' + p2.map((v) => v.toFixed(1)).join(' ');
  }
  return d;
};
export const gridLines = (W, top, bottom, cls = 'mvGrid') => (M.graphs.grid ? [0, 1, 2].map((g) => { const y = (top + ((bottom - top) * g) / 2).toFixed(1); return '<line class="' + cls + '" x1="0" x2="' + W + '" y1="' + y + '" y2="' + y + '"/>'; }).join('') : '');
export function drawLine(svg, line = svg.querySelector('.mvLine'), others = svg.querySelectorAll('.mvArea,.mvDot')) {
  if (reduced() || !line?.getTotalLength) return;
  const p = M.graphs, len = line.getTotalLength();
  line.animate([{ strokeDasharray: len, strokeDashoffset: len }, { strokeDasharray: len, strokeDashoffset: 0 }], { duration: p.draw, easing: EASE.standard });
  [...others].forEach((x, i) => x.animate([{ opacity: 0 }, { opacity: 1 }], { duration: p.draw * 0.6, delay: p.draw * 0.3 + i * 12, easing: EASE.standard, fill: 'backwards' }));
}

/* ---------- 7 · tabs: the highlight stretches across to the new tab ---------- */
export function stretchTo(ind, l0, w0, l1, w1) {
  ind.getAnimations().forEach((x) => x.cancel());
  ind.style.left = l1 + 'px'; ind.style.width = w1 + 'px';
  if (reduced() || (l0 === l1 && w0 === w1)) return;
  const p = M.tabs, k = p.stretch / 100, L = (l, w) => ({ left: l + 'px', width: w + 'px' }), right = l1 > l0;
  const mid = right ? L(l0 + (l1 - l0) * (0.15 * (1 - k)), l1 + w1 - (l0 + (l1 - l0) * (0.15 * (1 - k)))) : L(l1, l0 + w0 - l1 - (l0 - l1) * (0.15 * (1 - k)));
  ind.animate([L(l0, w0), { offset: 0.5, ...mid }, L(l1, w1)], { duration: p.dur, easing: EASE.standard });
}
// a segmented choice has no highlight of its own: one is laid over it for the move, from the old choice to the new
export function installSegments(root) {
  const GROUP = ':is(.themeChoice,.wbSegments,.tfHeightTabs,.hcSeg)';
  const onOf = (g) => g.querySelector(':scope>[aria-pressed="true"],:scope>[aria-checked="true"],:scope>.active');
  root.addEventListener('click', (e) => {
    const btn = e.target.closest?.(GROUP + '>button');
    const g = btn?.parentElement;
    if (!g || reduced()) return;
    const was = onOf(g);
    if (!was || was === btn) return;
    const gr = g.getBoundingClientRect(), a = was.getBoundingClientRect(), cs = getComputedStyle(was);
    const home = g.getRootNode(), top = anchorOf(g), key = top.dataset?.k, path = pathTo(g, top);
    // after the choice is made (and the control drawn again), slide a copy of the highlight across
    requestAnimationFrame(() => {
      const top2 = key && !top.isConnected ? home.querySelector?.('[data-k="' + CSS.escape(key) + '"]') : top;
      const g2 = top2 && follow(top2, path);
      const now = g2 && onOf(g2);
      if (!now || !g2.matches(GROUP)) return;
      const r2 = g2.getBoundingClientRect(), b = now.getBoundingClientRect();
      const ind = document.createElement('span');
      ind.className = 'mvSegInd';
      ind.style.cssText = 'top:' + (b.top - r2.top - g2.clientTop) + 'px;height:' + b.height + 'px;border-radius:' + cs.borderRadius + ';background:' + getComputedStyle(now).backgroundColor + ';box-shadow:' + getComputedStyle(now).boxShadow;
      if (getComputedStyle(g2).position === 'static') g2.style.position = 'relative';
      g2.prepend(ind);
      g2.classList.add('mvSegMoving');
      stretchTo(ind, a.left - gr.left - g2.clientLeft, a.width, b.left - r2.left - g2.clientLeft, b.width);
      setTimeout(() => { ind.remove(); g2.classList.remove('mvSegMoving'); }, M.tabs.dur + 20);
    });
  }, true);
}

/* ---------- 8 · dialogs ---------- */
const sheetLike = (bd) => getComputedStyle(bd).placeItems.startsWith('end');
function openDialog(bd) {
  const card = bd.firstElementChild;
  if (reduced() || !card || card.classList.contains('still')) return;
  const p = M.dialog;
  bd.animate([{ opacity: 0, backdropFilter: 'blur(0px)' }, { opacity: 1, backdropFilter: 'blur(' + p.blur + 'px)' }], { duration: p.open, easing: EASE.standard });
  // a popup that's a sheet on a phone rises from the bottom; the rest come in from the centre
  card.style.animation = 'none';
  card.animate(sheetLike(bd) ? [{ transform: 'translateY(100%)' }, { transform: 'none' }] : [{ opacity: 0, transform: 'scale(' + p.from / 100 + ')' }, { opacity: 1, transform: 'none' }], { duration: p.open, easing: EASE[p.ease] });
  const inner = card.classList.contains('tfMorePair') ? card.querySelector('.tfMore') || card : card;
  [...inner.children].forEach((c, j) => c.animate([{ opacity: 0 }, { opacity: 1 }], { duration: p.open * 0.6, delay: p.open * 0.35 + j * 40, easing: EASE.standard, fill: 'backwards' }));
}
// closing: the dim goes and the popup shrinks back, then it's taken away
export function closeDialog(bd, done) {
  const card = bd?.firstElementChild;
  if (reduced() || !card || bd.hidden || bd._closing) { done(); return; }
  const p = M.dialog;
  bd._closing = true;
  bd.style.pointerEvents = 'none';
  bd.animate([{ opacity: 1, backdropFilter: 'blur(' + p.blur + 'px)' }, { opacity: 0, backdropFilter: 'blur(0px)' }], { duration: p.close, easing: EASE.exit, fill: 'forwards' });
  const a = card.animate(sheetLike(bd) ? [{ transform: 'none' }, { transform: 'translateY(100%)' }] : [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(' + p.from / 100 + ')' }], { duration: p.close, easing: EASE.exit, fill: 'forwards' });
  let called = false;
  const go = () => { if (called) return; called = true; bd._closing = false; bd.style.pointerEvents = ''; bd.getAnimations().forEach((x) => x.cancel()); card.getAnimations().forEach((x) => x.cancel()); done(); };
  a.finished.then(go, go);
  setTimeout(go, p.close + 80);
}

/* ---------- 9 · confirmations: the toast rises in, 18 type, a tick drawing on ---------- */
const TICK = '<span class="mvTick" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M20 6L9 17L4 12" pathLength="1"/></svg></span>';
export function toastBody(el, message) {
  el.replaceChildren();
  el.insertAdjacentHTML('afterbegin', TICK);
  el.appendChild(Object.assign(document.createElement('span'), { className: 'mvToastText', textContent: message }));
}
export function toastIn(el) {
  if (reduced()) return;
  const p = M.confirm;
  // the toast's own place (translate -50%) stays; the rise is added to it
  el.animate([{ opacity: 0, translate: '0 18px' }, { opacity: 1, translate: '0 0' }], { duration: p.dur, easing: p.enter === 'pop' ? EASE.land : EASE.spring });
  const path = el.querySelector('.mvTick path');
  if (path && p.draw) path.animate([{ strokeDasharray: '1', strokeDashoffset: '1' }, { strokeDasharray: '1', strokeDashoffset: '0' }], { duration: 420, delay: p.dur * 0.5, easing: EASE.standard, fill: 'backwards' });
}
// the shell's own messages (Add to the list) go through HomeCore's toast when it's there
export const toaster = { show: null };

/* ---------- 10 · drag: a card follows on a spring, tilts with its speed, lifts, and squashes as it lands ---------- */
export const springStep = (v, gap, k, d, h = 1) => (v + gap * k * h) * Math.pow(d, h);
export function squash(el) {
  const q = M.drag.squash / 100;
  if (!el || reduced() || !q) return;
  el.animate([{ transform: 'scale(' + (1 + q * 0.4) + ',' + (1 - q) + ')' }, { transform: 'scale(' + (1 - q * 0.1) + ',' + (1 + q * 0.24) + ')' }, { transform: 'none' }], { duration: 340, easing: 'ease-out' });
}

// the parts of an opened card under its head come in one after another (the lab's delay and stagger)
export function revealParts(el) {
  if (!el || reduced()) return;
  const p = M.expand;
  [...el.children].slice(1).forEach((c, j) => c.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 260, delay: p.delay + j * p.stagger, easing: 'cubic-bezier(.2,0,0,1)', fill: 'backwards' }));
}
