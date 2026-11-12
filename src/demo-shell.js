// The demo site around HomeCore: the rail from Matt's Claude Design file (Home, Search, Weather, Devices, ⋯ and the
// account at the bottom), a menu button on phones, and the pages the rail opens.
// - HomeCore's own pages: Home, Weather, and (from ⋯) Activity, built in test-focus.js from Home's Activity card, so it
//   stays live. HomeCore settings is HomeCore's own; Settings (the cog) is Home Assistant's, with About built out.
// - The demo's pages (src/pages): Devices, Map and My account, built from HomeCore's parts; Search is a popup.
// Each page has its own address (#/devices), so a link can open it.
import { icon, HA_LOGO } from './demo-icons.js';
import { renderDevices } from './pages/devices.js';
import { renderAccount } from './pages/account.js';
import { renderActivity } from './pages/activity.js';
import { openSearch } from './pages/search.js';
import { renderConfig, renderAbout } from './pages/ha-settings.js';
import { mountLook } from './look.js';
import { closeDialog, toaster } from './motion.js';
import { IMG } from './images.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// the rail, top to bottom (Matt's file has Automation where Weather is: Matt, 9 Nov)
// Home is the logo at the top (Matt, 9 Nov); Map has Home's old place
// Home (the house) is the overview, the simple default page, and Dashboards (Home Assistant's dashboard icon) the board
// you edit, which was Home (Matt, 12 Nov)
const BOARDS = new Set(['home', 'dashboards']);
// Home's own button went (Matt, 12 Nov): the logo opens Home
const RAIL = [['dashboards', 'Dashboards', 'mdi:view-dashboard'], ['map', 'Map', 'mdi:tooltip-account'], ['weather', 'Weather', 'mdi:weather-partly-cloudy'], ['devices', 'Devices', 'mdi:devices']];
// behind ⋯: the rest of Home Assistant's sidebar today, in its order
// (Energy, History and Media went: Matt, 9 Nov, "they confuse it")
// HomeCore's own settings are HomeCore settings (Matt, 9 Nov); Home Assistant's Settings has the cog, above you
const MORE = [['activity', 'Activity', 'mdi:format-list-bulleted-type'], ['settings', 'HomeCore settings', 'mdi:tune-variant']];
const CONFIG = ['config', 'Settings', 'mdi:cog'];
// the map's code is big (MapLibre), so it loads only when Map opens
function renderMap(page, ctx) {
  const now = { ...ctx }; // Search's pick, before go() clears it
  let off = null, gone = false;
  import('./pages/map.js').then((m) => { if (!gone) off = m.renderMap(page, now); });
  return () => { gone = true; off?.(); };
}
const PAGES = { devices: renderDevices, map: renderMap, account: renderAccount, activity: renderActivity, config: renderConfig, about: renderAbout };
// Activity is the demo's own page now (Home Assistant's logbook with its filters: Matt, 9 Nov)
const HOMECORE_PAGES = new Set(['weather']);
const ROUTES = new Set(['home', 'dashboards', 'settings', ...HOMECORE_PAGES, ...Object.keys(PAGES)]);

export function mountDemoShell(root, { getHass, homecore }) {
  const $ = (id) => root.getElementById(id);
  const app = $('app'), shell = root.querySelector('.shell'), homeView = $('homeView'), settingsView = $('settingsView');
  const avatar = IMG.people.wembely; // you are Wembely (Matt, 9 Nov)
  app.classList.add('hcDemo');

  // the rail: icons only, each named in a tooltip (Matt, 9 Nov: not the chips the pages use)
  const railBtn = ([k, name, ic]) => '<button class="hcRailBtn" type="button" data-hc-go="' + k + '" data-tip="' + name + '" aria-label="' + name + '">' + icon(ic) + '</button>';
  shell.insertAdjacentHTML('afterbegin',
    '<nav class="hcRail" aria-label="Main">' +
      '<button class="hcRailBtn hcLogo" type="button" data-hc-go="home" data-tip="Home" aria-label="Home">' + HA_LOGO + '</button>' +
      '<button class="hcRailBtn" type="button" data-hc-search data-tip="Search" aria-label="Search">' + icon('mdi:magnify') + '</button>' +
      '<div class="hcRailMain">' + RAIL.map(railBtn).join('') +
        '<button class="hcRailBtn" type="button" data-hc-more data-tip="More" aria-label="More" aria-haspopup="menu" aria-expanded="false">' + icon('mdi:dots-horizontal') + '</button>' +
      '</div>' +
      railBtn(CONFIG) +
      '<button class="hcAvatar" type="button" data-hc-go="account" data-tip="My account" aria-label="My account"><img src="' + avatar + '" alt=""></button>' +
    '</nav>' +
    '<div class="hcTopRight"></div>');
  // HomeCore's edit pencil goes top right of Home, where Home Assistant's dashboard edit is (it hides itself off Home)
  const pen = $('dashEditNav');
  if (pen) shell.querySelector('.hcTopRight').appendChild(pen);
  // phones: HomeCore's bottom bar holds the menu, which opens the rail as a list
  root.querySelector('.bottomNav')?.insertAdjacentHTML('afterbegin', '<button class="navBtn" id="hcMenuNav" type="button" title="Menu" aria-label="Menu" aria-expanded="false">' + icon('mdi:menu') + '</button>');
  // the phone's menu and ⋯: plain icons beside their names, as the rail
  const row = ([k, name, ic], attr = 'data-hc-go="' + k + '"') => '<button class="hcRow hcNavRow" type="button" ' + attr + '><span class="hcNavIcon">' + icon(ic) + '</span><span class="hcRowText"><span class="hcRowName">' + name + '</span></span></button>';
  const drawerRow = (r, attr) => row(r, attr);
  app.insertAdjacentHTML('beforeend',
    '<div class="hcDrawer" hidden><div class="hcDrawerPanel" role="dialog" aria-label="Menu">' +
      '<div class="hcDrawerHead"><div class="hcLogo">' + HA_LOGO + '</div><button class="hcRailBtn" type="button" data-hc-close aria-label="Close">' + icon('mdi:close') + '</button></div>' +
      drawerRow(['search', 'Search', 'mdi:magnify'], 'data-hc-search') + drawerRow(['home', 'Home', 'mdi:home']) + RAIL.map((r) => drawerRow(r)).join('') +
      '<div class="hcDrawerLine"></div>' + MORE.map((r) => drawerRow(r)).join('') + drawerRow(CONFIG) +
      '<button class="hcRow hcNavRow hcDrawerMe" type="button" data-hc-go="account"><span class="hcNavIcon hcNavMe"><img src="' + avatar + '" alt=""></span><span class="hcRowText"><span class="hcRowName">My account</span></span></button>' +
    '</div></div>' +
    '<div class="card hcMoreMenu" role="menu" hidden>' + MORE.map((r) => row(r, 'role="menuitem" data-hc-go="' + r[0] + '"')).join('') + '</div>');
  const drawer = app.querySelector('.hcDrawer'), more = app.querySelector('.hcMoreMenu'), moreBtn = shell.querySelector('[data-hc-more]');
  // the rail's tooltips: HomeCore's tooltip look and timing (the first after 0.7 s, then straight away for a second),
  // beside the icon; by the mouse or keyboard focus, not touch
  const tip = Object.assign(document.createElement('div'), { className: 'tfTooltip hcRailTip', hidden: true });
  tip.setAttribute('aria-hidden', 'true');
  app.appendChild(tip);
  let tipTimer = 0, tipGone = -Infinity;
  const showTip = (el) => {
    clearTimeout(tipTimer);
    const go = () => {
      if (!el.isConnected) return;
      tip.textContent = el.dataset.tip;
      tip.hidden = false;
      const r = el.getBoundingClientRect(), t = tip.getBoundingClientRect();
      tip.style.left = r.right + 8 + 'px';
      tip.style.top = Math.max(8, r.top + r.height / 2 - t.height / 2) + 'px';
    };
    if (!tip.hidden || performance.now() - tipGone < 1000) go(); else tipTimer = setTimeout(go, 700);
  };
  const hideTip = () => { clearTimeout(tipTimer); if (!tip.hidden) tipGone = performance.now(); tip.hidden = true; };
  const rail = shell.querySelector('.hcRail');
  rail.addEventListener('pointerover', (ev) => { const el = ev.pointerType !== 'touch' && ev.target.closest('[data-tip]'); if (el) showTip(el); else hideTip(); });
  rail.addEventListener('pointerleave', hideTip);
  rail.addEventListener('focusin', (ev) => { const el = ev.target.closest('[data-tip]'); if (el?.matches(':focus-visible')) showTip(el); });
  rail.addEventListener('focusout', hideTip);
  rail.addEventListener('click', hideTip);

  // a page of the demo's own sits in Home's view, so HomeCore's card and tile styles apply to it; HomeCore's board hides
  homeView.insertAdjacentHTML('beforeend', '<div class="hcPage" hidden></div>');
  const page = homeView.querySelector('.hcPage');
  let pageOn = null, cleanup = null;
  /* where you came from (Matt, 9 Nov): a page opened from the side menu starts afresh and has no back arrow; one opened
     from inside another page (a card, a search result, a row) has ‹ back to it. The trail is a list of places:
     'home', a page, 'settings', or 'area:<key>' for HomeCore's own pages (Weather, Logbook, a room) */
  let trail = [], going = false, cur = 'home';
  const board = () => (homecore.overview === false ? 'dashboards' : 'home');
  const where = () => (settingsView.classList.contains('active') ? 'settings' : homecore.page ? 'area:' + homecore.page : pageOn || board());
  const BACK_SVG = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18L9 12L15 6"/></svg>';
  const ctx = { getHass, homecore, root, esc, icon, opts: null,
    // from inside a page: remember it, then go
    go: (route, after, opts) => {
      const was = where();
      going = true;
      if (was !== route) trail.push(was);
      ctx.opts = opts || null; go(route, true); after?.(); ctx.opts = null;
      going = false; cur = where(); sync();
    },
    // a page's title, with ‹ back when it was opened from another page (HomeCore's page header)
    head: (title, extra = '') => '<div class="settingsHeader tfAreaHead hcTitle">' + (trail.length ? '<button class="back" type="button" data-hc-back aria-label="Back">' + BACK_SVG + '</button>' : '') +
      '<h1 class="settingsTitle">' + esc(title) + '</h1>' + extra + '</div>',
    backBtn: () => (trail.length ? '<button class="back" type="button" data-hc-back aria-label="Back">' + BACK_SVG + '</button>' : ''),
  };
  // back: to the last place on the trail
  function back() {
    const to = trail.pop();
    if (!to) return go('home');
    going = true;
    if (to.startsWith('area:')) { const k = to.slice(5); if (HOMECORE_PAGES.has(k)) go(k, true); else { go(board(), true); homecore.openArea(k); } } else go(to, true);
    going = false; cur = where(); sync();
  }
  // every icon is the dashboard's chip (Matt, 9 Nov: "make it all the same"): HomeCore fills, fits and colours them
  Object.assign(ctx, {
    chip: (inner, hex) => '<span class="tfIcon hcChip"' + (hex ? ' data-light style="' + homecore.tint(hex) + '"' : '') + '>' + inner + '</span>',
    glyph: (name, hex) => ctx.chip(icon(name), hex),
    named: (name) => '<span class="tfIcon hcChip" data-icon-for="" data-icon-name="' + esc(name) + '"></span>',
    device: (id) => '<span class="tfIcon hcChip"' + homecore.chip(id) + '></span>',
    photo: (src) => ctx.chip('<img src="' + src + '" alt="">'),
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
    const outer = !going;
    going = true;
    closeMenus();
    const inSettings = settingsView.classList.contains('active');
    if (route === 'settings') {
      showPage(null);
      if (!inSettings) $('settingsNav').click();
      requestAnimationFrame(() => homecore.refit());
    } else {
      if (inSettings) $('homeNav').click();
      if (HOMECORE_PAGES.has(route)) { showPage(null); if (homecore.page !== route) homecore.openArea(route); }
      else {
        if (homecore.page) homecore.closeArea();
        if (BOARDS.has(route)) homecore.setOverview(route === 'home');
        showPage(BOARDS.has(route) ? null : route, again);
      }
    }
    if (outer) { going = false; cur = where(); }
    sync();
  }

  // which rail button is lit, and the address, follow what's open (HomeCore's own back buttons close pages too)
  function sync() {
    // HomeCore opened a page itself (the weather card, a room): remember where from; back on Home: a fresh start
    const now = where();
    if (!going && now !== cur) { if (BOARDS.has(now)) trail = []; else trail.push(cur); cur = now; }
    app.classList.toggle('hcNoBack', !trail.length);
    const open = settingsView.classList.contains('active') ? 'settings'
      : HOMECORE_PAGES.has(homecore.page) ? homecore.page : pageOn || board();
    const lit = MORE.some(([k]) => k === open) ? 'more' : open === 'about' ? 'config' : open;
    root.querySelectorAll('.hcRail [data-hc-go],.hcRail [data-hc-more]').forEach((b) => {
      const on = (b.dataset.hcGo || 'more') === lit;
      b.classList.toggle('active', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    drawer.querySelectorAll('[data-hc-go]').forEach((b) => b.classList.toggle('active', b.dataset.hcGo === (open === 'about' ? 'config' : open)));
    more.querySelectorAll('[data-hc-go]').forEach((b) => b.classList.toggle('active', b.dataset.hcGo === open));
    const hash = open === 'home' ? '' : '#/' + open;
    if ((location.hash || '') !== hash) history.replaceState(null, '', hash || location.pathname + location.search);
  }
  new MutationObserver(sync).observe(app, { attributes: true, attributeFilter: ['class'] });
  new MutationObserver(sync).observe(settingsView, { attributes: true, attributeFilter: ['class'] });

  function closeMenus() {
    more.hidden = true; moreBtn.setAttribute('aria-expanded', 'false');
    drawer.hidden = true; $('hcMenuNav')?.setAttribute('aria-expanded', 'false');
  }
  // the side menu: a fresh start
  const navigate = (route) => {
    trail = [];
    const hash = route === 'home' ? '' : '#/' + route;
    if ((location.hash || '') === hash) go(route, true); else location.hash = hash || '#/';
  };
  // HomeCore's own back arrows (a page's, Settings') go back along the trail when it leads somewhere other than Home
  root.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-hc-back],[data-area-back],#settingsBack');
    if (!b) return;
    if (b.matches('[data-hc-back]') || (trail.length && !BOARDS.has(trail[trail.length - 1])) || b.id === 'settingsBack') { ev.stopImmediatePropagation(); ev.preventDefault(); back(); }
  }, true);

  // a card's title that opens a page of its own (Home's Activity): from another page, so with ‹ back; not while editing
  root.addEventListener('click', (ev) => {
    const t = ev.target.closest('[data-hc-open]');
    if (!t || app.classList.contains('tfEditing')) return;
    ev.stopPropagation();
    ctx.go(t.dataset.hcOpen);
  }, true);
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
  addEventListener('hashchange', () => { trail = []; go(location.hash.replace(/^#\/?/, '') || 'home'); });

  /* Settings, as Matt asked on 9 Nov: no Show density; each group's title inside its card (a card header, 18 in);
     Lights shown as cards by default, with a Cards | Table choice */
  (function tuneSettings() {
    const pane = $('housePane');
    if (!pane) return;
    $('densityToggle')?.closest('.toggleRow')?.remove();
    pane.querySelectorAll('.tfSetGroup').forEach((g) => {
      const label = g.querySelector(':scope > .sectionLabel'), list = g.querySelector(':scope > .toggleList');
      if (label && list) { label.className = 'hcCardTitle'; list.prepend(label); }
    });
    const lights = pane.querySelector('[data-house-pane="lights"] > .card');
    if (lights) {
      const KEY = 'homecore-demo-light-view';
      let view = 'cards';
      try { view = localStorage.getItem(KEY) || 'cards'; } catch (_e) { /* cards */ }
      lights.insertAdjacentHTML('afterbegin', '<div class="hcLightView"><div class="themeChoice" role="group" aria-label="Show lights as">' +
        '<button class="wxLayoutBtn" type="button" data-light-view="cards">Cards</button><button class="wxLayoutBtn" type="button" data-light-view="table">Table</button></div></div>');
      const show = (v) => {
        view = v;
        pane.classList.toggle('hcLightCards', v === 'cards');
        lights.querySelectorAll('[data-light-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lightView === v)));
        try { localStorage.setItem(KEY, v); } catch (_e) { /* this visit only */ }
      };
      lights.querySelector('.hcLightView').addEventListener('click', (ev) => { const b = ev.target.closest('[data-light-view]'); if (b) show(b.dataset.lightView); });
      show(view);
    }
  })();
  // Appearance: the cards, the background and the stroke (Matt, 9 Nov)
  mountLook(root, { toast: (msg) => toaster.show?.(msg) });
  /* anything that should go somewhere but isn't designed yet (data-oops) says so (Matt, 9 Nov; its illustration from Figma "Popup · Oops"): HomeCore's popup, Close
     or Add to the list (which says thanks in HomeCore's toast) */
  function oops() {
    app.querySelector('.hcOops')?.remove();
    app.insertAdjacentHTML('beforeend', '<div class="tfMoreBackdrop hcOops"><div class="tfMore hcOopsCard" role="dialog" aria-modal="true" aria-labelledby="hcOopsTitle">' +
      '<div class="hcOopsTitle" id="hcOopsTitle">Oops!</div><p class="hcOopsLine">We haven\'t designed this yet. Let\'s add it to the list :)</p>' +
      '<div class="hcArt hcArtOops"><img alt="" src="' + IMG.oopsTrees + '"></div>' +
      '<div class="hcOopsActions"><button class="pill" type="button" data-oops-close>Close</button><button class="primary" type="button" data-oops-add>Add to the list</button></div></div></div>');
    const pop = app.querySelector('.hcOops'), was = root.activeElement;
    const close = () => { root.removeEventListener('keydown', onKey, true); closeDialog(pop, () => pop.remove()); was?.focus?.({ preventScroll: true }); };
    const onKey = (ev) => { if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); close(); } };
    root.addEventListener('keydown', onKey, true);
    pop.addEventListener('click', (ev) => {
      if (ev.target === pop || ev.target.closest('[data-oops-close]')) close();
      else if (ev.target.closest('[data-oops-add]')) { close(); toaster.show?.('Added to the list'); }
    });
    pop.querySelector('[data-oops-add]').focus();
  }
  ctx.oops = oops;
  /* what isn't designed yet says so (data-oops). A popup's own tiles (Maintenance's Monstera, a summary's devices) now
     open the device over the popup, with Back to it, as Move Assistant v0.79 (Matt, 12 Nov: "open over it"; was one
     level down only, 10 Nov) */
  root.addEventListener('click', (ev) => { const t = ev.target.closest('[data-oops]'); if (t) { ev.preventDefault(); ev.stopPropagation(); oops(); } }, true);
  const topRight = shell.querySelector('.hcTopRight');
  /* the edit tick lives in the edit tray's head while editing (Matt, 9 Nov: the tray covered it), in place of Done */
  const trayHead = root.querySelector('.tfTrayHead');
  new MutationObserver(() => {
    const editing = app.classList.contains('tfEditing'), pen = $('dashEditNav');
    if (!pen || !trayHead) return;
    if (editing && pen.parentElement !== trayHead) trayHead.appendChild(pen);
    if (!editing && pen.parentElement === trayHead) topRight.appendChild(pen);
  }).observe(app, { attributes: true, attributeFilter: ['class'] });
  /* the summaries are chosen in the edit tray now (Matt, 9 Nov): a Summaries section whose button pops out the list,
     each with its switch; the Settings tab for them goes. The areas the Areas card shows the same way (Matt, 11 Nov):
     Choose areas, in the tray's Areas section */
  (function choosersInTray() {
    $('housePane')?.querySelector('[data-house-tab="sums"]')?.remove();
    const inner = root.querySelector('.tfTrayInner'), headEl = inner?.querySelector('.tfTrayHead');
    if (!inner || !headEl) return;
    headEl.insertAdjacentHTML('afterend', '<section class="tfTraySection hcTraySums"><div class="sectionLabel">Summaries</div><p class="tfTrayNote">Which summaries show under the title.</p>' +
      '<button class="pill tfTrayAdd" type="button" data-hc-sums aria-expanded="false">Choose summaries</button></section>');
    inner.querySelector('[data-room-add]')?.insertAdjacentHTML('beforebegin', '<button class="pill tfTrayAdd" type="button" data-hc-areas aria-expanded="false">Choose areas</button>');
    const areasNote = inner.querySelector('[data-room-add]')?.parentElement.querySelector('.tfTrayNote');
    if (areasNote) areasNote.textContent = 'Which areas the Areas card shows, and one area on its own instead.';
    const chooser = (btn, title, list, set) => {
      app.insertAdjacentHTML('beforeend', '<div class="card hcSumsPop" role="dialog" aria-label="' + esc(title) + '" hidden></div>');
      const pop = app.lastElementChild;
      const draw = () => {
        pop.innerHTML = '<div class="hcCardTitle">' + esc(title) + '</div>' + list().map((x) => '<div class="hcSumRow">' +
          '<button class="switch' + (x.on ? ' on' : '') + '" type="button" role="switch" aria-checked="' + x.on + '" aria-label="' + esc(x.name) + '" data-chosen="' + esc(x.key) + '"></button>' +
          '<span class="tfIcon hcChip" style="color:' + esc(x.colour || 'var(--hc-icon-ink)') + '" data-icon-for="" data-icon-name="' + esc(x.icon) + '"></span><span class="hcRowName">' + esc(x.name) + '</span></div>').join('');
        homecore.paint(pop);
      };
      const place = () => { const r = btn.getBoundingClientRect(); pop.style.top = Math.max(16, Math.min(r.top - 12, innerHeight - pop.offsetHeight - 16)) + 'px'; };
      const close = () => { pop.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
      btn.addEventListener('click', () => { if (!pop.hidden) { close(); return; } app.querySelectorAll('.hcSumsPop:not([hidden])').forEach((p) => p.dispatchEvent(new Event('hc-close'))); draw(); pop.hidden = false; btn.setAttribute('aria-expanded', 'true'); place(); });
      pop.addEventListener('hc-close', close);
      pop.addEventListener('click', (ev) => { const sw = ev.target.closest('[data-chosen]'); if (!sw) return; const on = !sw.classList.contains('on'); set(sw.dataset.chosen, on); sw.classList.toggle('on', on); sw.setAttribute('aria-checked', String(on)); });
      new MutationObserver(() => { if (!app.classList.contains('tfEditing')) close(); }).observe(app, { attributes: true, attributeFilter: ['class'] });
      root.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !pop.hidden) { ev.stopPropagation(); close(); btn.focus(); } }, true);
    };
    chooser(inner.querySelector('[data-hc-sums]'), 'Summaries', () => homecore.sums(), (k, on) => homecore.setSum(k, on));
    const areasBtn = inner.querySelector('[data-hc-areas]');
    if (areasBtn) chooser(areasBtn, 'Areas', () => homecore.areas().map((a) => ({ key: a.id, name: a.name, icon: a.icon, on: a.on })), (k, on) => homecore.setArea(k, on));
  })();
  document.fonts?.ready.then(() => homecore.refit());
  go(location.hash.replace(/^#\/?/, '') || 'home');
  return { go };
}
