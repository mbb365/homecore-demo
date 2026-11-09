// HomeCore settings → Appearance → Cards and background (Matt, 9 Nov): the cards' colour and opacity, the background
// (the theme's, a colour, or an image of your own) and the stroke's colour and transparency. Text follows by itself:
// in the cards it turns light or dark for what's under it (the card's colour, over the background when the card lets it
// through); on the background it does the same for the background's colour or the image's brightness.
// Kept in this browser (the floating phone follows straight away); Reset goes back to the theme.
const KEY = 'homecore-demo-look', IMG_KEY = 'homecore-demo-look-image';
const BLANK = { card: null, opacity: 100, bg: 'theme', bgColour: null, stroke: null, strokeClear: null, imgLum: null };
const INK = { dark: ['#26221e', '#6a625a'], light: ['#d9d9d9', '#969696'] };
// what HomeCore paints in the card colour
const SURFACES = '#homeView .card,.hcPage .card,.tfAction,.wbCard,.tfMore,.tfMoreSideInner,.tfMoreActions>.activityRow,.tfBoardMenu,.tfTrayInner,.hcDrawerPanel,.hcSumsPop,.hcMoreMenu,#settingsView .toggleList';

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
  try { s = { ...BLANK, ...JSON.parse(read(KEY, '{}')) }; } catch (_e) { /* the theme */ }
  img = read(IMG_KEY, null);
  if (s.bg === 'image' && !img) s.bg = 'theme';
  const style = document.createElement('style');
  root.appendChild(style);

  // the theme's own colours, as the light or dark theme has them now
  const theme = () => {
    const cs = getComputedStyle(app);
    return { card: parseColour(cs.getPropertyValue('--color-bg-card')), ground: parseColour(cs.getPropertyValue('--color-bg-ground')), line: parseColour(cs.getPropertyValue('--color-line')) };
  };
  const changed = () => s.card || s.opacity < 100 || s.bg !== 'theme' || s.stroke || s.strokeClear != null;

  function apply() {
    const t = theme(), on = changed();
    app.classList.toggle('hcLook', Boolean(on));
    if (!on) { style.textContent = ''; draw(); return; }
    const card = s.card ? hexRgb(s.card) : t.card.slice(0, 3), a = s.opacity / 100;
    const ground = s.bg === 'colour' && s.bgColour ? hexRgb(s.bgColour) : t.ground.slice(0, 3);
    const groundLum = s.bg === 'image' && s.imgLum != null ? s.imgLum : lum(ground);
    // what the card looks like over the background, for its text
    const seen = s.bg === 'image' && s.imgLum != null ? lum(card) * a + s.imgLum * (1 - a) : lum(mix(ground, card, a));
    const [text, muted] = inkFor(seen), [pageText, pageMuted] = inkFor(groundLum);
    const tile = mix(card, hexRgb(text), 0.07);
    const line = s.stroke ? hexRgb(s.stroke) : t.line.slice(0, 3), lineA = s.strokeClear != null ? 1 - s.strokeClear / 100 : t.line[3];
    const rgba = (c, al) => 'rgba(' + c.map(Math.round).join(',') + ',' + +al.toFixed(3) + ')';
    style.textContent =
      '#app.hcDemo.hcLook{--card:' + rgba(card, a) + ';--group-bg:' + rgba(card, a) + ';--line:' + rgba(line, lineA) + ';--lineb:' + rgba(line, lineA) + ';' +
        (s.bg !== 'theme' ? '--bg:' + rgbHex(ground) + ';--page:' + rgbHex(ground) + ';--text:' + pageText + ';--muted:' + pageMuted + ';color:var(--text);' : '') + '}' +
      (s.bg === 'image' && img ? '#app.hcDemo.hcLook .shell{background-image:url("' + img + '");background-size:cover;background-position:center;background-attachment:fixed}' +
        '#app.hcDemo.hcLook .hcRail{background:transparent;-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px)}' : '') +
      '#app.hcDemo.hcLook :is(' + SURFACES + '){--text:' + text + ';--muted:' + muted + ';--tile:' + rgba(tile, Math.max(a, 0.6)) + ';color:var(--text)}' +
      (a < 1 ? '#app.hcDemo.hcLook :is(' + SURFACES + '){-webkit-backdrop-filter:blur(24px);backdrop-filter:blur(24px)}' : '');
    draw();
  }
  const save = () => { write(KEY, JSON.stringify(s)); apply(); };

  // the controls, as a group in Appearance
  const look = root.querySelector('[data-house-pane="look"] > .card');
  if (look) {
    const row = (title, status, control, attr = '') => '<div class="toggleRow"' + attr + '><div><strong>' + title + '</strong>' + (status ? '<div class="status">' + status + '</div>' : '') + '</div>' + control + '</div>';
    const swatch = (k, label) => '<label class="hcSwatch"><input type="color" data-look="' + k + '" aria-label="' + label + '"></label>';
    const range = (k, label, min) => '<span class="hcRangeWrap"><input class="hcRange" type="range" min="' + min + '" max="100" step="1" data-look="' + k + '" aria-label="' + label + '"><span class="hcRangeValue" data-look-value="' + k + '"></span></span>';
    look.insertAdjacentHTML('beforeend', '<div class="tfSetGroup"><div class="toggleList hcLookList"><div class="hcCardTitle">Cards and background</div>' +
      row('Card colour', 'Text in the cards turns light or dark to suit.', swatch('card', 'Card colour')) +
      row('Card opacity', 'Lower lets the background show through.', range('opacity', 'Card opacity', 20)) +
      row('Background', '', '<div class="themeChoice" role="group" aria-label="Background">' + [['theme', 'Theme'], ['colour', 'Colour'], ['image', 'Image']].map(([v, t]) => '<button class="wxLayoutBtn" type="button" data-look-bg="' + v + '">' + t + '</button>').join('') + '</div>') +
      row('Background colour', '', swatch('bgColour', 'Background colour'), ' data-look-row="colour"') +
      row('Background image', 'A photo or picture of your own, kept in this browser.', '<span class="hcLookImg"><button class="hcBtn" type="button" data-look-pick>Choose image</button><input type="file" accept="image/*" hidden data-look-file></span>', ' data-look-row="image"') +
      row('Stroke colour', 'The fine line round cards and tiles.', swatch('stroke', 'Stroke colour')) +
      row('Stroke transparency', '', range('strokeClear', 'Stroke transparency', 0)) +
      row('Back to the theme', '', '<button class="pill" type="button" data-look-reset>Reset</button>') +
    '</div></div>');
  }
  const list = root.querySelector('.hcLookList');
  function draw() {
    if (!list) return;
    const t = theme();
    const val = { card: s.card || rgbHex(t.card), opacity: s.opacity, bgColour: s.bgColour || rgbHex(t.ground), stroke: s.stroke || rgbHex(t.line), strokeClear: s.strokeClear ?? Math.round((1 - t.line[3]) * 100) };
    list.querySelectorAll('[data-look]').forEach((el) => { if (root.activeElement !== el) el.value = val[el.dataset.look]; });
    list.querySelectorAll('[data-look-value]').forEach((el) => { el.textContent = val[el.dataset.lookValue] + '%'; });
    list.querySelectorAll('[data-look-bg]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lookBg === s.bg)));
    list.querySelector('[data-look-row="colour"]').hidden = s.bg !== 'colour';
    list.querySelector('[data-look-row="image"]').hidden = s.bg !== 'image';
    list.querySelector('[data-look-pick]').textContent = img ? 'Change image' : 'Choose image';
  }
  if (list) {
    list.addEventListener('input', (ev) => {
      const k = ev.target.dataset.look;
      if (!k) return;
      s[k] = ev.target.type === 'range' ? Number(ev.target.value) : ev.target.value;
      if (k === 'bgColour') s.bg = 'colour';
      save();
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
  // the light or dark theme changing: the theme's colours change under the settings
  let wasLight = app.classList.contains('light');
  new MutationObserver(() => { const l = app.classList.contains('light'); if (l !== wasLight) { wasLight = l; apply(); } }).observe(app, { attributes: true, attributeFilter: ['class'] });
  // another window of the demo (the floating phone) changing them
  addEventListener('storage', (ev) => {
    if (ev.key !== KEY && ev.key !== IMG_KEY) return;
    try { s = { ...BLANK, ...JSON.parse(read(KEY, '{}')) }; } catch (_e) { s = { ...BLANK }; }
    img = read(IMG_KEY, null);
    apply();
  });
  apply();
}
