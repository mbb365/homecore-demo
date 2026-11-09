// The demo site around HomeCore: the rail from Matt's Claude Design file (Home, Search, Weather, Devices, ⋯ and the
// account at the bottom), a menu button on phones, and the pages the rail opens.
// - HomeCore's own pages: Home, Weather, and (from ⋯) Energy, Logbook, History and Media, built in test-focus.js from the
//   cards Home already has, so they stay live. Settings is HomeCore's Settings.
// - The demo's pages (src/pages): Devices, Map and My account, built from HomeCore's parts; Search is a popup.
// Each page has its own address (#/devices), so a link can open it.
import { icon } from './demo-icons.js';
import { renderDevices } from './pages/devices.js';
import { renderAccount } from './pages/account.js';
import { openSearch } from './pages/search.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// the rail, top to bottom (Matt's file has Automation where Weather is: Matt, 9 Nov)
const RAIL = [['home', 'Home', 'mdi:home'], ['weather', 'Weather', 'mdi:weather-partly-cloudy'], ['devices', 'Devices', 'mdi:devices']];
// behind ⋯: the rest of Home Assistant's sidebar today, in its order
const MORE = [['energy', 'Energy', 'mdi:lightning-bolt'], ['map', 'Map', 'mdi:tooltip-account'], ['logbook', 'Logbook', 'mdi:format-list-bulleted-type'],
  ['history', 'History', 'mdi:chart-box-outline'], ['media', 'Media', 'mdi:play-box-multiple'], ['settings', 'Settings', 'mdi:cog']];
// the map's code is big (MapLibre), so it loads only when Map opens
function renderMap(page, ctx) {
  const now = { ...ctx }; // Search's pick, before go() clears it
  let off = null, gone = false;
  import('./pages/map.js').then((m) => { if (!gone) off = m.renderMap(page, now); });
  return () => { gone = true; off?.(); };
}
const PAGES = { devices: renderDevices, map: renderMap, account: renderAccount };
const HOMECORE_PAGES = new Set(['weather', 'energy', 'logbook', 'history', 'media']);
const ROUTES = new Set(['home', 'settings', ...HOMECORE_PAGES, ...Object.keys(PAGES)]);

export function mountDemoShell(root, { getHass, homecore }) {
  const $ = (id) => root.getElementById(id);
  const app = $('app'), shell = root.querySelector('.shell'), homeView = $('homeView'), settingsView = $('settingsView');
  const avatar = new URL('people/wembely.png', document.baseURI).href; // you are Wembely (Matt, 9 Nov)
  app.classList.add('hcDemo');

  const railBtn = ([k, name, ic]) => '<button class="navBtn tfIcon" type="button" data-hc-go="' + k + '" title="' + name + '" aria-label="' + name + '">' + icon(ic) + '</button>';
  shell.insertAdjacentHTML('afterbegin',
    '<nav class="hcRail" aria-label="Main">' +
      '<div class="hcLogo" role="img" aria-label="Home Assistant">' + icon('mdi:home-assistant') + '</div>' +
      '<button class="navBtn tfIcon" type="button" data-hc-search title="Search" aria-label="Search">' + icon('mdi:magnify') + '</button>' +
      '<div class="hcRailMain">' + RAIL.map(railBtn).join('') +
        '<button class="navBtn tfIcon" type="button" data-hc-more title="More" aria-label="More" aria-haspopup="menu" aria-expanded="false">' + icon('mdi:dots-horizontal') + '</button>' +
      '</div>' +
      '<button class="hcAvatar" type="button" data-hc-go="account" title="My account" aria-label="My account"><img src="' + avatar + '" alt=""></button>' +
    '</nav>' +
    '<div class="hcTopRight"></div>');
  // HomeCore's edit pencil goes top right of Home, where Home Assistant's dashboard edit is (it hides itself off Home)
  const pen = $('dashEditNav');
  if (pen) shell.querySelector('.hcTopRight').appendChild(pen);
  // phones: HomeCore's bottom bar holds the menu, which opens the rail as a list
  root.querySelector('.bottomNav')?.insertAdjacentHTML('afterbegin', '<button class="navBtn tfIcon" id="hcMenuNav" type="button" title="Menu" aria-label="Menu" aria-expanded="false">' + icon('mdi:menu') + '</button>');
  const row = ([k, name, ic], attr = 'data-hc-go="' + k + '"') => '<button class="hcRow" type="button" ' + attr + '><span class="tfIcon hcChip">' + icon(ic) + '</span><span class="hcRowText"><span class="hcRowName">' + name + '</span></span></button>';
  const drawerRow = (r, attr) => row(r, attr);
  app.insertAdjacentHTML('beforeend',
    '<div class="hcDrawer" hidden><div class="hcDrawerPanel" role="dialog" aria-label="Menu">' +
      '<div class="hcDrawerHead"><div class="hcLogo">' + icon('mdi:home-assistant') + '</div><button class="navBtn tfIcon" type="button" data-hc-close title="Close" aria-label="Close">' + icon('mdi:close') + '</button></div>' +
      drawerRow(['search', 'Search', 'mdi:magnify'], 'data-hc-search') + RAIL.map((r) => drawerRow(r)).join('') +
      '<div class="hcDrawerLine"></div>' + MORE.map((r) => drawerRow(r)).join('') +
      '<button class="hcRow hcDrawerMe" type="button" data-hc-go="account"><span class="tfIcon hcChip"><img src="' + avatar + '" alt=""></span><span class="hcRowText"><span class="hcRowName">My account</span></span></button>' +
    '</div></div>' +
    '<div class="card hcMoreMenu" role="menu" hidden>' + MORE.map((r) => row(r, 'role="menuitem" data-hc-go="' + r[0] + '"')).join('') + '</div>');
  const drawer = app.querySelector('.hcDrawer'), more = app.querySelector('.hcMoreMenu'), moreBtn = shell.querySelector('[data-hc-more]');
  [shell.querySelector('.hcRail'), drawer, more, root.querySelector('.bottomNav')].forEach((x) => x && homecore.paint(x));

  // a page of the demo's own sits in Home's view, so HomeCore's card and tile styles apply to it; HomeCore's board hides
  homeView.insertAdjacentHTML('beforeend', '<div class="hcPage" hidden></div>');
  const page = homeView.querySelector('.hcPage');
  let pageOn = null, cleanup = null;
  const ctx = { getHass, homecore, root, esc, icon, opts: null, go: (route, after, opts) => { ctx.opts = opts || null; go(route, true); after?.(); ctx.opts = null; } };
  // every icon is the dashboard's chip (Matt, 9 Nov: "make it all the same"): HomeCore fills, fits and colours them
  Object.assign(ctx, {
    chip: (inner, hex) => '<span class="tfIcon hcChip"' + (hex ? ' data-light style="' + homecore.tint(hex) + '"' : '') + '>' + inner + '</span>',
    glyph: (name, hex) => ctx.chip(icon(name), hex),
    named: (name) => '<span class="tfIcon hcChip" data-icon-for="" data-icon-name="' + esc(name) + '"></span>',
    device: (id) => '<span class="tfIcon hcChip"' + homecore.chip(id) + '></span>',
    photo: (src) => ctx.chip('<img src="' + new URL(src, document.baseURI).href + '" alt="">'),
    paint: (scope) => homecore.paint(scope),
  });

  function showPage(key, again = false) {
    if (key === pageOn && !again) return;
    cleanup?.(); cleanup = null;
    pageOn = key;
    app.classList.toggle('hcOnPage', Boolean(key));
    page.hidden = !key;
    page.innerHTML = '';
    page.dataset.page = key || '';
    if (key) { cleanup = PAGES[key](page, ctx) || null; window.scrollTo(0, 0); }
  }

  function go(route, again = false) {
    if (!ROUTES.has(route)) route = 'home';
    closeMenus();
    const inSettings = settingsView.classList.contains('active');
    if (route === 'settings') {
      showPage(null);
      if (!inSettings) $('settingsNav').click();
    } else {
      if (inSettings) $('homeNav').click();
      if (HOMECORE_PAGES.has(route)) { showPage(null); if (homecore.page !== route) homecore.openArea(route); }
      else { if (homecore.page) homecore.closeArea(); showPage(route === 'home' ? null : route, again); }
    }
    sync();
  }

  // which rail button is lit, and the address, follow what's open (HomeCore's own back buttons close pages too)
  function sync() {
    const open = settingsView.classList.contains('active') ? 'settings'
      : HOMECORE_PAGES.has(homecore.page) ? homecore.page : pageOn || 'home';
    const lit = MORE.some(([k]) => k === open) ? 'more' : open;
    root.querySelectorAll('.hcRail [data-hc-go],.hcRail [data-hc-more]').forEach((b) => {
      const on = (b.dataset.hcGo || 'more') === lit;
      b.classList.toggle('active', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    drawer.querySelectorAll('[data-hc-go]').forEach((b) => b.classList.toggle('active', b.dataset.hcGo === open));
    more.querySelectorAll('[data-hc-go]').forEach((b) => b.classList.toggle('active', b.dataset.hcGo === open));
    // ⋯'s pages are top level here, so HomeCore's back arrow on them goes
    app.classList.toggle('hcTopPage', HOMECORE_PAGES.has(open) && open !== 'weather');
    const hash = open === 'home' ? '' : '#/' + open;
    if ((location.hash || '') !== hash) history.replaceState(null, '', hash || location.pathname + location.search);
  }
  new MutationObserver(sync).observe(app, { attributes: true, attributeFilter: ['class'] });
  new MutationObserver(sync).observe(settingsView, { attributes: true, attributeFilter: ['class'] });

  function closeMenus() {
    more.hidden = true; moreBtn.setAttribute('aria-expanded', 'false');
    drawer.hidden = true; $('hcMenuNav')?.setAttribute('aria-expanded', 'false');
  }
  const navigate = (route) => {
    const hash = route === 'home' ? '' : '#/' + route;
    if ((location.hash || '') === hash) go(route); else location.hash = hash || '#/';
  };

  root.addEventListener('click', (ev) => {
    const t = ev.target.closest('[data-hc-go],[data-hc-more],[data-hc-close],[data-hc-search],#hcMenuNav,.hcDrawer');
    if (!t) { if (!more.hidden && !ev.target.closest('.hcMoreMenu')) closeMenus(); return; }
    if (t.matches('[data-hc-go]')) { navigate(t.dataset.hcGo); return; }
    if (t.matches('[data-hc-search]')) { closeMenus(); openSearch(ctx); return; }
    if (t.matches('[data-hc-more]')) {
      const open = more.hidden;
      closeMenus();
      if (open) {
        const r = t.getBoundingClientRect();
        more.hidden = false; t.setAttribute('aria-expanded', 'true');
        more.style.left = r.right + 12 + 'px';
        more.style.top = Math.max(20, Math.min(r.top, innerHeight - 20 - more.offsetHeight)) + 'px';
        more.querySelector('button')?.focus();
      }
      return;
    }
    if (t.id === 'hcMenuNav') { drawer.hidden = false; t.setAttribute('aria-expanded', 'true'); drawer.querySelector('[data-hc-close]').focus(); return; }
    if (t.matches('[data-hc-close]') || (t === drawer && ev.target === drawer)) closeMenus();
  });
  root.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && (!more.hidden || !drawer.hidden)) { ev.preventDefault(); closeMenus(); } });
  // ⌘K / Ctrl+K or "/" opens Search, as in Home Assistant
  addEventListener('keydown', (ev) => {
    const typing = ev.composedPath().some((el) => el instanceof HTMLElement && (el.matches('input,textarea,select') || el.isContentEditable));
    if (((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === 'k') || (ev.key === '/' && !typing)) { ev.preventDefault(); openSearch(ctx); }
  });
  addEventListener('hashchange', () => go(location.hash.replace(/^#\/?/, '') || 'home'));

  go(location.hash.replace(/^#\/?/, '') || 'home');
  return { go };
}
