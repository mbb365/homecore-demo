// HomeCore settings → Appearance → Cards and background (Matt, 9 Nov): the cards' colour and opacity, the background
// (the theme's, a colour, or an image of your own) and the stroke: the system's or round every card, its width, colour
// and opacity (Matt, 11 Nov: 100% fully seen, card opacity never touches it). Then Style: monochrome, pixel icons and
// square corners. Text follows by itself:
// in the cards it turns light or dark for what's under it (the card's colour, over the background when the card lets it
// through); on the background it does the same for the background's colour or the image's brightness.
// Kept in this browser (the floating phone follows straight away); Reset goes back to the theme.
import { pixelIcons } from './pixel-icons.js';

const KEY = 'homecore-demo-look', IMG_KEY = 'homecore-demo-look-image';
const BLANK = { card: null, opacity: 100, bg: 'theme', bgColour: null, stroke: null, strokeOpacity: null, imgLum: null,
  strokes: 'system', strokeWidth: 1, mono: false, icons: 'standard', iconMono: false, corners: 'round' };
// a setting saved before 11 Nov: transparency, turned round
const migrate = (v) => { if (v.strokeClear != null && v.strokeOpacity == null) v.strokeOpacity = 100 - v.strokeClear; delete v.strokeClear; return v; };
const INK = { dark: ['#26221e', '#6a625a'], light: ['#d9d9d9', '#969696'] };
// everything painted in the card colour (every rule with background: var(--card), --card2, --modal or --group-bg), so
// the text in any of them follows the card; Settings' .card is only a wrapper on the background, so it doesn't count
const SURFACES = [
  '.card:not(#settingsView .card)', '.panel', '.workoutPanel', '.tfAction', '.wbCard', '.tfMore', '.tfMoreSideInner', '.tfMoreActions>.activityRow',
  '.tfBoardMenu', '.tfTrayInner', '.tfTrayTuck', '.tfMiniPhone', '.tfPhoneBlock', '.tfFavHide', '.hcDrawerPanel', '.hcSumsPop', '.hcMoreMenu',
  '.hcMapCard', '.hcPin', '.hcMap .maplibregl-ctrl-group', '#settingsView .toggleList', '#settingsView .integrationList', '#settingsView .helpSteps',
  '.setupGroup', '.modal', '.modalStatic', '.sheet', '.confirmCard', '.nextCard', '.upcomingCard',
].join(',');
// and what's painted in the page colour though it sits in or over cards: the wide popups and the floating phone's
// screen; their text follows the page. (#hcPageInk.hcA.hcB matches nothing: it only lifts the rule
// to the same weight as the cards' one, which has an id and two classes in it, so this one, coming after, wins)
// the settings page keeps the theme's cards, so its controls always read (Matt, 11 Nov); the Style tab's preview doesn't
const SCOPE = ':where(:not(#settingsView *),.hcLookPreview *)';
const ON_PAGE = ['#hcPageInk.hcA.hcB', '.tfMore.wide', '.tfMorePair.over .tfMore.wide+.tfMoreSide .tfMoreSideInner', '.tfPhoneScreen'].join(',');

const read = (k, fallback) => { try { return localStorage.getItem(k) ?? fallback; } catch (_e) { return fallback; } };
const write = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); return true; } catch (_e) { return false; } };
const hexRgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const rgbHex = (rgb) => '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const parseColour = (s) => { const m = String(s).match(/[\d.]+/g) || []; if (s.trim().startsWith('#')) return [...hexRgb(s.trim()), 1]; return [+m[0] || 0, +m[1] || 0, +m[2] || 0, m[3] == null ? 1 : +m[3]]; };
const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const mix = (a, b, t) => a.map((v, i) => v * (1 - t) + b[i] * t);
// light text on dark, dark text on light: whichever reads better
const inkFor = (l) => ((l + 0.05) / (lum(hexRgb(INK.dark[0])) + 0.05) > (lum(hexRgb(INK.light[0])) + 0.05) / (l + 0.05) ? INK.dark : INK.light);

export function mountLook(root, { toast }) {
  const app = root.getElementById('app');
  let s = { ...BLANK }, img = null;
  try { s = migrate({ ...BLANK, ...JSON.parse(read(KEY, '{}')) }); } catch (_e) { /* the theme */ }
  img = read(IMG_KEY, null);
  if (s.bg === 'image' && !img) s.bg = 'theme';
  const style = document.createElement('style');
  root.appendChild(style);

  // the theme's own colours, as the light or dark theme has them now
  const theme = () => {
    const cs = getComputedStyle(app);
    return { card: parseColour(cs.getPropertyValue('--color-bg-card')), ground: parseColour(cs.getPropertyValue('--color-bg-ground')), line: parseColour(cs.getPropertyValue('--color-line')) };
  };
  const changed = () => s.card || s.opacity < 100 || s.bg !== 'theme' || s.stroke || s.strokeOpacity != null || s.strokes === 'all';

  function apply() {
    const t = theme(), on = changed();
    app.classList.toggle('hcLook', Boolean(on));
    style2();
    if (!on) { style.textContent = ''; draw(); return; }
    const card = s.card ? hexRgb(s.card) : t.card.slice(0, 3), a = s.opacity / 100;
    const ground = s.bg === 'colour' && s.bgColour ? hexRgb(s.bgColour) : t.ground.slice(0, 3);
    const groundLum = s.bg === 'image' && s.imgLum != null ? s.imgLum : lum(ground);
    // what the card looks like over the background, for its text
    const seen = s.bg === 'image' && s.imgLum != null ? lum(card) * a + s.imgLum * (1 - a) : lum(mix(ground, card, a));
    const [text, muted] = inkFor(seen), [pageText, pageMuted] = inkFor(groundLum);
    const tile = mix(card, hexRgb(text), 0.07);
    // tiles on the page itself (a page's search and buttons): from the background, or see-through over an image
    const pageTile = s.bg === 'image' ? (pageText === INK.dark[0] ? 'rgba(255,255,255,.55)' : 'rgba(0,0,0,.35)') : rgbHex(mix(ground, hexRgb(pageText), 0.07));
    const line = s.stroke ? hexRgb(s.stroke) : t.line.slice(0, 3), lineA = s.strokeOpacity != null ? s.strokeOpacity / 100 : t.line[3];
    const rgba = (c, al) => 'rgba(' + c.map(Math.round).join(',') + ',' + +al.toFixed(3) + ')';
    style.textContent =
      '#app.hcDemo.hcLook{--card:' + rgba(card, a) + ';--group-bg:' + rgba(card, a) + ';--line:' + rgba(line, lineA) + ';--lineb:' + rgba(line, lineA) + ';' +
        (s.bg !== 'theme' ? '--bg:' + rgbHex(ground) + ';--page:' + rgbHex(ground) + ';--text:' + pageText + ';--muted:' + pageMuted + ';--tile:' + pageTile + ';color:var(--text);' : '') + '}' +
      (s.bg === 'image' && img ? '#app.hcDemo.hcLook .shell{background-image:url("' + img + '");background-size:cover;background-position:center;background-attachment:fixed}' +
        '#app.hcDemo.hcLook .hcRail{background:transparent;-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px)}' : '') +
      '#app.hcDemo.hcLook :is(' + SURFACES + ')' + SCOPE + '{--text:' + text + ';--muted:' + muted + ';--tile:' + rgba(tile, Math.max(a, 0.6)) + ';color:var(--text)}' +
      '#app.hcDemo.hcLook :is(' + ON_PAGE + '){--text:' + pageText + ';--muted:' + pageMuted + (s.bg !== 'theme' ? ';--tile:' + pageTile : '') + ';color:var(--text)}' +
      // frosted while there's any card at all; at 0% it's clear
      (a < 1 && a > 0 ? '#app.hcDemo.hcLook :is(' + SURFACES + ')' + SCOPE + '{-webkit-backdrop-filter:blur(24px);backdrop-filter:blur(24px)}' : '') +
      // the settings page: the theme's card, line and text; the preview: the look again
      '#app.hcDemo.hcLook #settingsView{--card:var(--color-bg-card);--group-bg:var(--color-bg-card);--line:var(--color-line);--lineb:var(--color-line)}' +
      '#app.hcDemo.hcLook #settingsView :is(.toggleList,.integrationList,.helpSteps){--text:var(--color-text-primary);--muted:var(--color-text-muted);--tile:var(--color-bg-tile);color:var(--text)}' +
      '#app.hcDemo.hcLook #settingsView .hcLookPreview{--card:' + rgba(card, a) + ';--group-bg:' + rgba(card, a) + ';--line:' + rgba(line, lineA) + ';--lineb:' + rgba(line, lineA) + '}' +
      (s.bg === 'image' && img ? '#app.hcDemo.hcLook .hcLookPreview{background-image:url("' + img + '");background-size:cover;background-position:center;background-attachment:fixed}' : '') +
      // every card's own line, drawn over whatever the system gives it; edit mode's outline and a focus ring come first
      (s.strokes === 'all' ? '#app.hcDemo.hcLook:not(.tfEditing) :is(' + SURFACES + ')' + SCOPE + ':not(:focus-visible){outline:' + s.strokeWidth + 'px solid ' + rgba(line, lineA) + ';outline-offset:-' + s.strokeWidth + 'px}' : '');
    draw();
  }
  // Style: grey all over (the whole page, photos and art too), square corners and pixel icons
  const docStyle = document.createElement('style');
  docStyle.textContent = 'html.hcMono{filter:grayscale(1)}';
  document.head.appendChild(docStyle);
  // square: no rounding anywhere, whatever a rule asks for (three #app's outweigh every rule that sets a radius)
  const squareStyle = document.createElement('style');
  squareStyle.textContent = ['', ' :not(#settingsView *)', ' .hcLookPreview *'].flatMap((x) => (x ? [x, x + '::before', x + '::after'] : [x]))
    .map((x) => '#app#app#app.hcSquare' + x).join(',') + '{border-radius:0!important}';
  // the icons grey, on their own (the settings page's own keep their colour; the preview's follow)
  squareStyle.textContent += '#app.hcIconMono .tfIcon' + SCOPE + '{filter:grayscale(1)}';
  root.appendChild(squareStyle);
  let wasSquare = null;
  function style2() {
    document.documentElement.classList.toggle('hcMono', s.mono);
    app.classList.toggle('hcSquare', s.corners === 'square');
    app.classList.toggle('hcIconMono', s.iconMono);
    pixelIcons(root, s.icons === 'pixel');
    // the sun's band follows the corners
    if (wasSquare !== null && wasSquare !== (s.corners === 'square')) dispatchEvent(new Event('hc-look-corners'));
    wasSquare = s.corners === 'square';
  }
  const save = () => { write(KEY, JSON.stringify(s)); apply(); };

  // the controls, as a group in Appearance
  const look = root.querySelector('[data-house-pane="style"] > .card');
  if (look) {
    const row = (title, status, control, attr = '') => '<div class="toggleRow"' + attr + '><div><strong>' + title + '</strong>' + (status ? '<div class="status">' + status + '</div>' : '') + '</div>' + control + '</div>';
    const swatch = (k, label) => '<label class="hcSwatch"><input type="color" data-look="' + k + '" aria-label="' + label + '"></label>';
    const choice = (k, label, opts) => '<div class="themeChoice" role="group" aria-label="' + label + '">' + opts.map(([v, t]) => '<button class="wxLayoutBtn" type="button" data-look-pick-' + k.toLowerCase() + '="' + v + '">' + t + '</button>').join('') + '</div>';
    // HomeCore's slider (the light tile's bar, Matt, 11 Nov), its value on the left
    const range = (k, label) => '<span class="hcRangeWrap"><span class="hcRangeValue" data-look-value="' + k + '"></span>' +
      '<span class="tfBar pos hcLookBar" role="slider" tabindex="0" aria-label="' + label + '" aria-valuemin="0" aria-valuemax="100" data-look-bar="' + k + '"><i></i></span></span>';
    // a row's controls side by side under its name: a choice and the colour that goes with it
    const pair = (...parts) => '<span class="hcRowControls">' + parts.join('') + '</span>';
    look.insertAdjacentHTML('beforeend', '<div class="hcLookPreview" aria-label="Preview" inert></div>' +
    '<div class="tfSetGroup"><div class="toggleList hcLookList"><div class="hcCardTitle">Cards and background</div>' +
      row('Cards', 'Their colour, and how much of the background shows through. Text turns light or dark to suit.', pair(swatch('card', 'Card colour'), range('opacity', 'Card opacity'))) +
      row('Background', 'A colour, or a photo or picture of your own, kept in this browser.', pair('<div class="themeChoice" role="group" aria-label="Background">' + [['theme', 'Theme'], ['colour', 'Colour'], ['image', 'Image']].map(([v, t]) => '<button class="wxLayoutBtn" type="button" data-look-bg="' + v + '">' + t + '</button>').join('') + '</div>',
        '<span data-look-show="colour">' + swatch('bgColour', 'Background colour') + '</span>',
        '<span class="hcLookImg" data-look-show="image"><button class="hcBtn" type="button" data-look-pick>Choose image</button><input type="file" accept="image/*" hidden data-look-file></span>')) +
      row('Strokes', 'System is the fine line the design gives some cards. All cards puts a line round every one.', pair(choice('strokes', 'Strokes', [['system', 'System'], ['all', 'All cards']]), swatch('stroke', 'Stroke colour'))) +
      row('Stroke width', '', choice('strokeWidth', 'Stroke width', [['1', '1 px'], ['2', '2 px'], ['3', '3 px']]), ' data-look-row="width"') +
      row('Stroke opacity', 'At 100% the line is fully seen.', range('strokeOpacity', 'Stroke opacity')) +
    '</div></div>' +
    '<div class="tfSetGroup"><div class="toggleList hcLookList"><div class="hcCardTitle">Style</div>' +
      row('Colour', 'Monochrome turns everything grey, photos and art too.', choice('mono', 'Colour', [['false', 'Full'], ['true', 'Monochrome']])) +
      row('Icons', 'Pixel redraws every icon on a 16 square grid.', choice('icons', 'Icons', [['standard', 'Standard'], ['pixel', 'Pixel']])) +
      row('Icon colour', 'Monochrome turns the icons grey and leaves the rest.', choice('iconMono', 'Icon colour', [['false', 'Full'], ['true', 'Monochrome']])) +
      row('Corners', '', choice('corners', 'Corners', [['round', 'Round'], ['square', 'Square']])) +
      row('Back to the theme', 'Cards, background, strokes and style.', '<button class="pill" type="button" data-look-reset>Reset</button>') +
    '</div></div>');
  }
  const list = look;
  const CHOICES = ['strokes', 'strokeWidth', 'mono', 'icons', 'iconMono', 'corners'];
  function draw() {
    if (!list?.querySelector('.hcLookList')) return;
    const t = theme();
    const val = { card: s.card || rgbHex(t.card), opacity: s.opacity, bgColour: s.bgColour || rgbHex(t.ground), stroke: s.stroke || rgbHex(t.line), strokeOpacity: s.strokeOpacity ?? Math.round(t.line[3] * 100) };
    list.querySelectorAll('[data-look]').forEach((el) => { if (root.activeElement !== el) el.value = val[el.dataset.look]; });
    list.querySelectorAll('[data-look-bar]').forEach((el) => { const v = val[el.dataset.lookBar]; el.querySelector('i').style.width = v + '%'; el.setAttribute('aria-valuenow', v); el.setAttribute('aria-valuetext', v + '%'); });
    list.querySelectorAll('[data-look-value]').forEach((el) => { el.textContent = val[el.dataset.lookValue] + '%'; });
    list.querySelectorAll('[data-look-bg]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lookBg === s.bg)));
    CHOICES.forEach((k) => list.querySelectorAll('[data-look-pick-' + k.toLowerCase() + ']').forEach((b) => b.setAttribute('aria-pressed', String(b.getAttribute('data-look-pick-' + k.toLowerCase()) === String(s[k])))));
    list.querySelector('[data-look-row="width"]').hidden = s.strokes !== 'all';
    list.querySelectorAll('[data-look-show]').forEach((el) => { el.hidden = el.dataset.lookShow !== s.bg; });
    list.querySelector('[data-look-pick]').textContent = img ? 'Change image' : 'Choose image';
  }
  if (list) {
    list.addEventListener('input', (ev) => {
      const k = ev.target.dataset.look;
      if (!k) return;
      s[k] = ev.target.value;
      if (k === 'bgColour') s.bg = 'colour';
      save();
    });
    // the sliders: dragged anywhere along them, or the arrow keys (Shift for tens), Home and End
    const setBar = (bar, v) => { s[bar.dataset.lookBar] = Math.max(0, Math.min(100, Math.round(v))); save(); };
    list.addEventListener('pointerdown', (ev) => {
      const bar = ev.target.closest('[data-look-bar]');
      if (!bar || ev.button > 0) return;
      ev.preventDefault();
      bar.focus({ preventScroll: true });
      bar.setPointerCapture(ev.pointerId);
      const at = (e) => { const r = bar.getBoundingClientRect(); setBar(bar, ((e.clientX - r.left) / r.width) * 100); };
      at(ev);
      const end = () => { bar.removeEventListener('pointermove', at); bar.removeEventListener('pointerup', end); bar.removeEventListener('pointercancel', end); };
      bar.addEventListener('pointermove', at);
      bar.addEventListener('pointerup', end);
      bar.addEventListener('pointercancel', end);
    });
    list.addEventListener('keydown', (ev) => {
      const bar = ev.target.closest?.('[data-look-bar]');
      if (!bar) return;
      const now = s[bar.dataset.lookBar] ?? Number(bar.getAttribute('aria-valuenow')), step = ev.shiftKey ? 10 : 1;
      const next = { ArrowRight: now + step, ArrowUp: now + step, ArrowLeft: now - step, ArrowDown: now - step, Home: 0, End: 100 }[ev.key];
      if (next == null) return;
      ev.preventDefault();
      setBar(bar, next);
    });
    const file = list.querySelector('[data-look-file]');
    list.addEventListener('click', (ev) => {
      const bg = ev.target.closest('[data-look-bg]');
      if (bg) {
        s.bg = bg.dataset.lookBg;
        if (s.bg === 'image' && !img) { file.click(); s.bg = 'theme'; }
        save();
        return;
      }
      if (ev.target.closest('[data-look-pick]')) { file.click(); return; }
      for (const k of CHOICES) {
        const attr = 'data-look-pick-' + k.toLowerCase(), b = ev.target.closest('[' + attr + ']');
        if (!b) continue;
        const v = b.getAttribute(attr);
        s[k] = k === 'strokeWidth' ? Number(v) : k === 'mono' || k === 'iconMono' ? v === 'true' : v;
        save();
        return;
      }
      if (ev.target.closest('[data-look-reset]')) { s = { ...BLANK }; img = null; write(IMG_KEY, null); save(); }
    });
    // an image: made no bigger than 2400 across, its brightness measured for the text on it
    file.addEventListener('change', () => {
      const f = file.files?.[0];
      file.value = '';
      if (!f) return;
      const pic = new Image(), url = URL.createObjectURL(f);
      pic.onload = () => {
        const k = Math.min(1, 2400 / Math.max(pic.naturalWidth, pic.naturalHeight));
        const c = Object.assign(document.createElement('canvas'), { width: Math.round(pic.naturalWidth * k), height: Math.round(pic.naturalHeight * k) });
        c.getContext('2d').drawImage(pic, 0, 0, c.width, c.height);
        const tiny = Object.assign(document.createElement('canvas'), { width: 24, height: 24 }), tc = tiny.getContext('2d');
        tc.drawImage(pic, 0, 0, 24, 24);
        const px = tc.getImageData(0, 0, 24, 24).data;
        let sum = 0;
        for (let i = 0; i < px.length; i += 4) sum += lum([px[i], px[i + 1], px[i + 2]]);
        URL.revokeObjectURL(url);
        img = c.toDataURL('image/jpeg', 0.85);
        s.imgLum = sum / (px.length / 4);
        s.bg = 'image';
        if (!write(IMG_KEY, img)) toast('The image is too big to keep, so it lasts until you leave');
        save();
      };
      pic.onerror = () => { URL.revokeObjectURL(url); toast('That file isn’t an image this browser can show'); };
      pic.src = url;
    });
  }
  /* the Style tab's preview (Matt, 11 Nov): copies of three of the house page's own cards (the Office light, the
     Thermostat and Air quality, or others like them if those are gone), taken each time the tab opens, sized as at M;
     they can't be used. It stays at the top as the controls scroll under it */
  const preview = look?.querySelector('.hcLookPreview'), stylePane = root.querySelector('[data-house-pane="style"]'), settings = root.getElementById('settingsView');
  const PICKS = [['[data-k="light.office_2"]', '.tfAction[data-k^="light."]'], ['[data-k="climate.made_up_living_room"]', '.tfAction[data-k^="climate."]'], ['.tfDash-aq', '.tfDash-pollen', '.tfDash-wx']];
  function fillPreview() {
    const home = root.getElementById('homeView');
    if (!preview || !home || !stylePane?.classList.contains('active') || !settings?.classList.contains('active')) return;
    const cards = PICKS.map((qs) => qs.map((q) => home.querySelector(q)).find(Boolean)).filter(Boolean);
    // the house page not drawn just now: the copies already there stay
    if (!cards.length) return;
    preview.replaceChildren(...cards.map((el) => {
      const c = el.cloneNode(true), rows = Number(el.dataset.rows) || Math.round((parseFloat(el.style.height) + 16) / 76) || 2;
      c.removeAttribute('id');
      c.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
      c.classList.remove('tfDragging', 'mvDrag');
      Object.assign(c.style, { position: 'relative', left: '', top: '', transform: '', width: '216px', height: rows * 76 - 16 + 'px' });
      return c;
    }));
  }
  if (preview) new MutationObserver(fillPreview).observe(settings, { attributes: true, attributeFilter: ['class'] });
  if (stylePane) new MutationObserver(fillPreview).observe(stylePane, { attributes: true, attributeFilter: ['class'] });
  // the light or dark theme changing: the theme's colours change under the settings
  let wasLight = app.classList.contains('light');
  new MutationObserver(() => { const l = app.classList.contains('light'); if (l !== wasLight) { wasLight = l; apply(); } }).observe(app, { attributes: true, attributeFilter: ['class'] });
  // another window of the demo (the floating phone) changing them
  addEventListener('storage', (ev) => {
    if (ev.key !== KEY && ev.key !== IMG_KEY) return;
    try { s = migrate({ ...BLANK, ...JSON.parse(read(KEY, '{}')) }); } catch (_e) { s = { ...BLANK }; }
    img = read(IMG_KEY, null);
    apply();
  });
  apply();
}
