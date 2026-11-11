// Pixel icons (Matt, 11 Nov; Settings → Appearance → Style → Icons): every icon redrawn on a 16 square grid, made from the
// icon itself. Each one is drawn big off screen, cut into 16 × 16 squares, and a square is filled where the icon covers
// most of it. The first time an icon is seen that takes a moment; after that it's swapped straight away, so a redraw
// of the page doesn't flicker. Standard puts the originals back.
const GRID = 16, OVER = 4, FILL = 0.42;
const TARGET = '.tfIcon svg, .hcRailBtn svg.hcI, .hcNavIcon svg.hcI, .navBtn svg';
const NS = 'http://www.w3.org/2000/svg';
const STYLE = ['fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-linecap', 'stroke-linejoin', 'opacity', 'display', 'visibility'];
const made = new Map(), waiting = new Set(), original = new WeakMap();
// each root watched, and where in it: everywhere, or only inside the Style tab's preview (Dashboards only, off a dashboard)
const roots = new Map(), where = new Map();
const targets = (root) => (where.get(root) ? TARGET.split(', ').map((t) => where.get(root) + ' ' + t).join(', ') : TARGET);

const keyOf = (svg) => (svg.getAttribute('viewBox') || '') + '|' + svg.innerHTML;

// the icon as an image of its own: its look written onto each part, since the page's styles don't reach an image
function picture(svg) {
  const copy = svg.cloneNode(true);
  const live = [svg, ...svg.querySelectorAll('*')], dead = [copy, ...copy.querySelectorAll('*')];
  live.forEach((el, i) => {
    const cs = getComputedStyle(el), out = dead[i];
    out.removeAttribute('class');
    // colours come out black (a gradient too, which the copy hasn't got), see-through stays see-through
    out.setAttribute('style', STYLE.map((p) => p + ':' + cs.getPropertyValue(p).replace(/url\([^)]*\)(\s+\S+)?/g, '#000').replace(/rgba?\([^)]*\)/g, (c) => (/^rgba\([^,]+,[^,]+,[^,]+,\s*0\)$/.test(c) ? 'transparent' : '#000'))).join(';'));
  });
  copy.setAttribute('xmlns', NS);
  copy.setAttribute('width', GRID * OVER * 2);
  copy.setAttribute('height', GRID * OVER * 2);
  if (!copy.getAttribute('viewBox')) copy.setAttribute('viewBox', '0 0 24 24');
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(copy));
}

// the squares, joined along each row
function squares(img) {
  const n = GRID * OVER, c = Object.assign(document.createElement('canvas'), { width: n, height: n }), g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0, n, n);
  const px = g.getImageData(0, 0, n, n).data;
  let d = '';
  for (let y = 0; y < GRID; y++) {
    let run = -1;
    for (let x = 0; x <= GRID; x++) {
      let on = false;
      if (x < GRID) {
        let a = 0;
        for (let j = 0; j < OVER; j++) for (let i = 0; i < OVER; i++) a += px[((y * OVER + j) * n + x * OVER + i) * 4 + 3];
        on = a / (OVER * OVER * 255) >= FILL;
      }
      if (on && run < 0) run = x;
      if (!on && run >= 0) { d += 'M' + run + ' ' + y + 'h' + (x - run) + 'v1h-' + (x - run) + 'z'; run = -1; }
    }
  }
  return d;
}

function swap(svg, d) {
  if (!original.has(svg)) original.set(svg, { box: svg.getAttribute('viewBox'), html: svg.innerHTML });
  svg.setAttribute('viewBox', '0 0 ' + GRID + ' ' + GRID);
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.innerHTML = '<path fill="currentColor" stroke="none" d="' + d + '"></path>';
  svg.dataset.px = '';
}

function restore(svg) {
  const was = original.get(svg);
  if (was) { if (was.box == null) svg.removeAttribute('viewBox'); else svg.setAttribute('viewBox', was.box); svg.innerHTML = was.html; }
  svg.removeAttribute('shape-rendering');
  delete svg.dataset.px;
}

function scan(root) {
  root.querySelectorAll(targets(root)).forEach((svg) => {
    if ('px' in svg.dataset || !svg.isConnected || svg.closest('.hcLogo,.hcLogoMark')) return;
    const key = keyOf(svg);
    if (made.has(key)) { swap(svg, made.get(key)); return; }
    if (waiting.has(key)) return;
    waiting.add(key);
    const img = new Image();
    img.onload = () => { made.set(key, squares(img)); waiting.delete(key); roots.forEach((_, r) => scan(r)); };
    img.onerror = () => waiting.delete(key);
    img.src = picture(svg);
  });
}

export function pixelIcons(root, on, only = '') {
  if (on && roots.has(root) && where.get(root) !== only) {
    where.set(root, only);
    // narrowed: the icons outside it go back
    if (only) root.querySelectorAll('svg[data-px]').forEach((svg) => { if (!svg.closest(only)) restore(svg); });
    scan(root);
  }
  if (on) where.set(root, only);
  if (on && !roots.has(root)) {
    const watch = new MutationObserver(() => scan(root));
    watch.observe(root, { childList: true, subtree: true });
    roots.set(root, watch);
    scan(root);
  } else if (!on && roots.has(root)) {
    roots.get(root).disconnect();
    roots.delete(root);
    where.delete(root);
    root.querySelectorAll('svg[data-px]').forEach(restore);
  }
}
