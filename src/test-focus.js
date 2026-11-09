// Test focus and the density overlay.
// - Test focus (`layout: test-focus` in the YAML): a whole house on Home, built from the HomeCore display pieces so the
//   spacing rules can be pushed with real data. Rooms come from Home Assistant areas; house.js adds made-up devices
//   for what the house doesn't have. Area cards sit where the move panels were (an accordion, like them); the move
//   panels are hidden. Tapping a device's name opens this page's more-info, for real and made-up devices alike: a
//   popup or a sheet (Settings → Appearance → More info), with its details rolling out beside it. Covers follow
//   Claude Design's "Covers design": four blocks, a tilt bar and Open/Stop/Close on the tile, and the cover drawn in
//   its window in more-info. The normal Home never shows any of this.
// - Show density: every display card's height, and how many readings fit on the screen.
import { createHouse, isMadeUp, solarHistory } from './house.js';
import { mountWeatherBento } from './weather-bento.js';
import { createCoverArt, coverKind } from './cover-art.js';

const DENSITY_KEY = 'move-assistant-density';

const local = {
  get(k) { try { return localStorage.getItem(k); } catch (_e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (_e) { /* private window: just not remembered */ } },
};
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const ARROW = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5"/><path d="M12 19L5 12L12 5"/></svg>';
// Move Assistant's back chevron (its pages' header)
const BACK = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18L9 12L15 6"/></svg>';
const CLOSE = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6L18 18"/><path d="M18 6L6 18"/></svg>';
const MEDIA = {
  prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6h2v12H6zM9.5 12L18 18V6z"/></svg>',
  next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 6h2v12h-2zM6 18l8.5-6L6 6z"/></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>',
};
// a stepper's − and +, drawn at 22 like the telly's buttons
const STEP = {
  down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 11h14v2H5z"/></svg>',
  up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/></svg>',
};
// media_player supported_features bits
const PAUSE = 1, VOLUME_SET = 4, PREVIOUS = 16, NEXT = 32, TURN_ON = 128, TURN_OFF = 256, PLAY = 16384;
// cover supported_features bits
const OPEN = 1, CLOSE_COVER = 2, SET_POSITION = 4, STOP = 8;
// a cover's open, stop and close, and its icon and name for each kind (Claude Design "Covers design")
const COVER_BUTTONS = {
  open: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 7l-5 5 5 5"/><path d="M16 7l5 5-5 5"/></svg>',
  stop: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2.5" fill="currentColor"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7l5 5-5 5"/><path d="M21 7l-5 5 5 5"/></svg>',
};
const COVER_ICON = { curtain: ['mdi:curtains', 'mdi:curtains-closed'], blind: ['mdi:roller-shade', 'mdi:roller-shade-closed'], venetian: ['mdi:blinds-horizontal', 'mdi:blinds-horizontal-closed'] };
const COVER_NOUN = { curtain: 'curtains', blind: 'blind', venetian: 'blinds' };
// the home view's summaries (Home Assistant's home-summaries.ts, with its English names), in its default order. Energy
// shows what the house uses now: this page can't read the energy dashboard's day
const SUMMARIES = {
  light: { name: 'Lights', icon: 'mdi:lightbulb', colour: '#ffc107' },
  climate: { name: 'Climate', icon: 'mdi:home-thermometer', colour: '#ff5722' },
  security: { name: 'Security', icon: 'mdi:security', colour: '#607d8b' },
  media_players: { name: 'Media players', icon: 'mdi:multimedia', colour: '#2196f3' },
  maintenance: { name: 'Maintenance', icon: 'mdi:wrench', colour: '#9e9e9e' },
  energy: { name: 'Energy', icon: 'mdi:lightning-bolt', colour: '#ffc107' },
};
const HOUSE_KEY = 'move_assistant_house'; // the house page's own saved data (its favourites), apart from the moves
const USED_KEY = 'move-assistant-house-used'; // how often each device is used here, for suggested favourites
const TOGGLES = ['switch', 'fan', 'input_boolean', 'automation'];
// How more-info opens on the house page (Matt picked these two, 27 Oct): a popup in the middle, or a sheet from the
// bottom, 640 wide. Set in Settings → Appearance → More info and remembered in this browser; both rise from the
// bottom on phones.
const LOOK_KEY = 'move-assistant-house-look';
// Settings → Appearance in groups, each named above its card (Matt, 8 Nov)
const LOOK_GROUPS = [['look', 'Look'], ['house', 'House page'], ['weather', 'Weather']];
const MORE_STYLES = [['popup', 'Popup'], ['sheet', 'Sheet']];
// Settings → Appearance → Long names (Matt, 31 Oct): how a name or state too long for its space shows
const NAME_STYLES = [['auto', 'Automatic'], ['cut', 'Cut short'], ['wrap', 'Two lines'], ['scroll', 'Scroll']];
const HOUR_WINDOWS = [['day', 'Daytime 06–22'], ['waking', 'Waking 07–23'], ['all', 'All day']];
const WX_STYLES = [['bitmap', 'Pixel'], ['onebit', '1-bit'], ['smooth', 'Smooth'], ['line', 'Line']];
// the dashboard's edit mode: the pencil and Done in the bottom bar, and each card's grip and options
const GRIP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7,19V17H9V19H7M11,19V17H13V19H11M15,19V17H17V19H15M7,15V13H9V15H7M11,15V13H13V15H11M15,15V13H17V15H15M7,11V9H9V11H7M11,11V9H13V11H11M15,11V9H17V11H15M7,7V5H9V7H7M11,7V5H13V7H11M15,7V5H17V7H15Z"/></svg>';
const DOTS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16,12A2,2 0 0,1 18,10A2,2 0 0,1 20,12A2,2 0 0,1 18,14A2,2 0 0,1 16,12M10,12A2,2 0 0,1 12,10A2,2 0 0,1 14,12A2,2 0 0,1 12,14A2,2 0 0,1 10,12M4,12A2,2 0 0,1 6,10A2,2 0 0,1 8,12A2,2 0 0,1 6,14A2,2 0 0,1 4,12Z"/></svg>';
// the edit tray's: show, hide and remove
const EYE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17M12,4.5C7,4.5 2.73,7.61 1,12C2.73,16.39 7,19.5 12,19.5C17,19.5 21.27,16.39 23,12C21.27,7.61 17,4.5 12,4.5Z"/></svg>';
const EYE_OFF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11.83,9L15,12.16C15,12.11 15,12.05 15,12A3,3 0 0,0 12,9C11.94,9 11.89,9 11.83,9M7.53,9.8L9.08,11.35C9.03,11.56 9,11.77 9,12A3,3 0 0,0 12,15C12.22,15 12.44,14.97 12.65,14.92L14.2,16.47C13.53,16.8 12.79,17 12,17A5,5 0 0,1 7,12C7,11.21 7.2,10.47 7.53,9.8M2,4.27L4.28,6.55L4.73,7C3.08,8.3 1.78,10 1,12C2.73,16.39 7,19.5 12,19.5C13.55,19.5 15.03,19.2 16.38,18.66L16.81,19.08L19.73,22L21,20.73L3.27,3M12,7A5,5 0 0,1 17,12C17,12.64 16.87,13.26 16.64,13.82L19.57,16.75C21.07,15.5 22.27,13.86 23,12C21.27,7.61 17,4.5 12,4.5C10.6,4.5 9.26,4.75 8,5.2L10.17,7.35C10.74,7.13 11.35,7 12,7Z"/></svg>';
const CROSS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/></svg>';
const CHEVRON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
// a stroke icon on the 24 grid
const svgIcon = (paths) => '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">' + paths.map((d) => '<path d="' + d + '"/>').join('') + '</svg>';
const PENCIL = svgIcon(['M12 20H21', 'M16.5 3.5C17.33 2.67 18.67 2.67 19.5 3.5C20.33 4.33 20.33 5.67 19.5 6.5L7 19L3 20L4 16L16.5 3.5Z']);
const TICK = svgIcon(['M20 6L9 17L4 12']);
// Area cards: the room's main thing big, then its controls as tiles (Matt, 27 Oct: Big's headline with Tiles)
// an area card's icons: the same solid Material Design Icons as everywhere else (Matt, 31 Oct: no line icons), a
// device's own where the key is one device, else its kind's
const areaGlyph = (id, name = '') => '<span class="tfAreaGlyph"' + ' data-icon-for="' + esc(id || '') + '"' + (name ? ' data-icon-name="' + esc(name) + '"' : '') + '></span>';
const STAR = (on) => '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.8 6 6.6.6-5 4.4 1.5 6.5L12 17l-5.9 3.3 1.5-6.5-5-4.4 6.6-.6z" fill="' + (on ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
// lock: can open the door; alarm: arm home, away, night
const LOCK_OPEN = 1;
const ALARM_MODES = [['disarmed', 'Off', 'alarm_disarm', 0], ['armed_home', 'Home', 'alarm_arm_home', 1], ['armed_away', 'Away', 'alarm_arm_away', 2], ['armed_night', 'Night', 'alarm_arm_night', 4]];
const ALARM_STATE = { disarmed: 'Disarmed', armed_home: 'Armed home', armed_away: 'Armed away', armed_night: 'Armed night', armed_vacation: 'Armed vacation', arming: 'Arming', pending: 'Pending', triggered: 'Triggered', disarming: 'Disarming' };
const COLOUR_MODES = ['hs', 'xy', 'rgb', 'rgbw', 'rgbww'];
const OPEN_CLASSES = ['door', 'window', 'garage_door', 'opening'];
// alarms Activity keeps for the day, in red (Matt, 29 Oct): what it detected, and what it says once it's cleared
const ALARM_CLASSES = { moisture: ['detected water', 'dry'], smoke: ['detected smoke', 'clear'], gas: ['detected gas', 'clear'], carbon_monoxide: ['detected carbon monoxide', 'clear'], safety: ['became unsafe', 'safe'] };
const ACTION_DOMAINS = ['light', 'climate', 'cover', 'humidifier', 'media_player', 'vacuum', 'lock', 'alarm_control_panel', 'valve'];
// The dashboard (Matt, 27 Oct): what its activity card follows, how many changes and favourites it shows, and its
// energy's icons
const ACTIVITY_DOMAINS = ['light', 'switch', 'fan', 'lock', 'cover', 'climate', 'humidifier', 'media_player', 'alarm_control_panel', 'vacuum', 'valve', 'binary_sensor'];
// Favourites: five rows, so beside Activity their tiles line up. Activity: the latest changes, five before the rest
// scroll (Matt, 27 Oct)
const DASH_FAVOURITES = 10, ACTIVITY_MOST = 20;
const ENERGY_ICON = { electricity: 'mdi:lightning-bolt', solar: 'mdi:solar-power-variant', gas: 'mdi:fire', water: 'mdi:water' };
// the bottom row's tiles: a light tile's size, 10 apart (light tiles' rule)
const DASH_TILE_W = 252, DASH_TILE_GAP = 10;
// the rooms whose lights the dashboard shows, in Favourites, Activity and the tiles (Matt, 27 Oct)
const DASH_LIGHT_ROOMS = ['living room', 'bedroom', 'office'];

export function mountTestFocus(root, { config, getHass }) {
  const $ = (id) => root.getElementById(id);
  const app = $('app');
  const cfg = config || {};
  const testFocus = String(cfg.layout || '').toLowerCase().replace('_', '-') === 'test-focus';
  let densityOn = local.get(DENSITY_KEY) === '1';
  let states = {};
  const callWS = (msg) => getHass()?.callWS(msg);
  const callService = (domain, service, data) => callWS({ type: 'call_service', domain, service, service_data: data });

  /* ---------- Settings → Appearance → Show density ---------- */
  const list = root.querySelector('#appearancePane .toggleList');
  if (list && !$('densityToggle')) {
    list.insertAdjacentHTML('afterbegin',
      '<div class="toggleRow"><div><strong>Show density</strong><div class="status">Each card’s height, and how many readings fit on the screen.</div></div>' +
      '<button class="switch" id="densityToggle" type="button" aria-label="Show density"></button></div>');
    $('densityToggle').addEventListener('click', () => { densityOn = !densityOn; local.set(DENSITY_KEY, densityOn ? '1' : '0'); applyDensity(); });
  }

  /* Settings on the house (Matt, 27 Oct): it's "HomeCore" (28 Oct; was "HomeCore test"), with only what the house uses.
     Appearance: theme, Show density, More info and the lights (this page's tiles or the Dual Axis Controller); Sources: which entities feed the
     weather, energy and alarm; Summaries: which show. A table of the lights (Matt, 27 Oct: an example of a table) sets
     each one's favourite, tile and pad. Move Assistant's own settings stay on its page */
  const SOURCES = [
    ['weather', 'Weather', 'The forecast under Home.', (id) => id.startsWith('weather.')],
    ['grid', 'Energy', 'Power from the grid, for Energy.', (id) => id.startsWith('sensor.') && attr(id).device_class === 'power' && /^(W|kW)$/.test(attr(id).unit_of_measurement || '')],
    ['alarm', 'Alarm', 'The alarm in the Security popup.', (id) => id.startsWith('alarm_control_panel.')],
  ];
  const seg = (id, label, attrName, opts) => '<div class="themeChoice" id="' + id + '" role="group" aria-label="' + label + '">' +
    opts.map(([v, t]) => '<button class="wxLayoutBtn" type="button" aria-pressed="false" ' + attrName + '="' + v + '">' + t + '</button>').join('') + '</div>';
  const settingRow = (title, status, control, id) => '<div class="toggleRow"' + (id ? ' id="' + id + '"' : '') + '><div><strong>' + title + '</strong>' + (status ? '<div class="status">' + status + '</div>' : '') + '</div>' + control + '</div>';
  function houseSettings() {
    if (!testFocus || $('housePane')) return;
    const view = $('settingsView');
    view.querySelector('.settingsTitle').textContent = 'HomeCore';
    // one tab each (Matt, 27 Oct); the tab names the section, so the sections have no heading of their own
    const tabs = [['look', 'Appearance'], ['lights', 'Lights'], ['sources', 'Sources'], ['sums', 'Summaries']];
    const tabPane = (k, html) => '<div class="houseTab' + (k === 'look' ? ' active' : '') + '" data-house-pane="' + k + '"><section class="card">' + html + '</section></div>';
    view.querySelector('.rubberTabs').insertAdjacentHTML('afterend', '<div class="settingsPane active" id="housePane">' +
      '<div class="tabs rubberTabs houseTabs"><div class="rubberIndicator" aria-hidden="true"></div>' +
        tabs.map(([k, t]) => '<button class="tab segBtn' + (k === 'look' ? ' active' : '') + '" type="button" data-house-tab="' + k + '">' + t + '</button>').join('') + '</div>' +
      // Appearance in groups, each named above its card (Matt, 8 Nov)
      tabPane('look', LOOK_GROUPS.map(([k, t]) => '<div class="tfSetGroup"><div class="sectionLabel">' + t + '</div><div class="toggleList" data-look-group="' + k + '"></div></div>').join('')) +
      tabPane('lights', '<p class="note tfTableNote">This is an example of a table. It is not how to control features in lights.</p>' +
        '<div class="metaTableWrap"><table class="metaTable tfLightTable"><thead><tr><th>Light</th><th>Room</th><th>Now</th><th class="metaSwitchCol">Favourite</th><th>Tile</th><th>Pad</th></tr></thead>' +
        '<tbody id="lightRows"></tbody></table></div><div class="tfLightCards" id="lightCards"></div>') +
      tabPane('sources', '<div class="toggleList">' +
        SOURCES.map(([k, t, s]) => settingRow(t, s, '<select class="settingsSelect" data-source="' + k + '" aria-label="' + t + '"></select>')).join('') + '</div>') +
      tabPane('sums', '<div class="toggleList">' +
        Object.entries(SUMMARIES).map(([k, s]) => settingRow(s.name, '', '<button class="switch" type="button" role="switch" data-sum-toggle="' + k + '" aria-label="' + s.name + ' summary"></button>')).join('') + '</div>') + '</div>');
    const group = (k) => view.querySelector('[data-look-group="' + k + '"]'), rowOf = (el) => el?.closest('.toggleRow');
    [rowOf(view.querySelector('.themeBtn')), rowOf($('densityToggle'))].forEach((row) => row && group('look').appendChild(row));
    [rowOf($('moreInfoChoice')), rowOf($('namesChoice'))].forEach((row) => row && group('house').appendChild(row));
    group('house').insertAdjacentHTML('beforeend', settingRow('Lights', 'How lights show on the house page.', seg('lightsChoice', 'Lights', 'data-lights', [['tile', 'HomeCore tile'], ['dac', 'Dual Axis Controller']]), 'lightsRow') +
      settingRow('Pad', 'What the Dual Axis Controller’s pad sets on its tile.', seg('dacPadChoice', 'Pad', 'data-dac-pad', [['temperature', 'Temperature'], ['colour', 'Colour']]), 'dacPadRow'));
    [rowOf($('hoursChoice')), rowOf($('wxStyleChoice'))].forEach((row) => row && group('weather').appendChild(row));
    const pane = $('housePane'), bar = pane.querySelector('.houseTabs'), mark = bar.querySelector('.rubberIndicator');
    new ResizeObserver(() => fitChoices()).observe(pane);
    // the sliding mark under the open tab, as on Move Assistant's settings; placed again whenever the bar shows or resizes
    const placeMark = (animate) => {
      const on = bar.querySelector('.tab.active');
      mark.style.transition = animate ? '' : 'none';
      mark.style.left = on.offsetLeft + 'px';
      mark.style.width = on.offsetWidth + 'px';
      if (animate) { mark.style.transform = 'scaleX(1.08)'; setTimeout(() => (mark.style.transform = ''), 180); }
    };
    new ResizeObserver(() => placeMark(false)).observe(bar);
    pane.addEventListener('click', (ev) => {
      const tab = ev.target.closest('[data-house-tab]');
      if (tab) {
        bar.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === tab));
        pane.querySelectorAll('.houseTab').forEach((p) => p.classList.toggle('active', p.dataset.housePane === tab.dataset.houseTab));
        tab.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
        placeMark(true);
        fitChoices();
        return;
      }
      const fav = ev.target.closest('[data-light-fav]');
      if (fav) { toggleStar(fav.dataset.lightFav); return; }
      // a light's card on a phone: its tile and pad as choices (the table's lists, as segments)
      const pick = ev.target.closest('[data-light-pick]');
      if (pick) {
        const [field, id] = pick.dataset.lightPick.split('|'), next = { ...look[field] };
        if (pick.dataset.v) next[id] = pick.dataset.v; else delete next[id];
        look[field] = next;
        saveLook();
        [...dacs.keys()].filter((k) => k.endsWith(':' + id)).forEach((k) => dacs.delete(k));
        render();
        return;
      }
      const b = ev.target.closest('[data-lights],[data-dac-pad],[data-sum-toggle]');
      if (!b || b.disabled) return;
      if (b.dataset.lights) look.lights = b.dataset.lights;
      if (b.dataset.dacPad) look.dacPad = b.dataset.dacPad;
      if (b.dataset.lights || b.dataset.dacPad) { saveLook(); dacs.clear(); }
      if (b.dataset.sumToggle) {
        const k = b.dataset.sumToggle, hidden = new Set(prefs.hiddenSums || []);
        if (hidden.has(k)) hidden.delete(k); else hidden.add(k);
        prefs = { ...prefs, hiddenSums: [...hidden] };
        savePrefs();
      }
      render();
    });
    pane.addEventListener('change', (ev) => {
      const t = ev.target;
      if (t.dataset.source) {
        prefs = { ...prefs, sources: { ...(prefs.sources || {}), [t.dataset.source]: t.value || undefined } };
        savePrefs();
      }
      // a light's own tile or pad (Default follows Appearance); its controllers are made again
      const id = t.dataset.lightStyle || t.dataset.lightPad;
      if (id) {
        const field = t.dataset.lightStyle ? 'lightStyles' : 'lightPads', next = { ...look[field] };
        if (t.value) next[id] = t.value; else delete next[id];
        look[field] = next;
        saveLook();
        [...dacs.keys()].filter((k) => k.endsWith(':' + id)).forEach((k) => dacs.delete(k));
      }
      render();
    });
  }
  // the settings as they are now: each choice pressed, the sources' lists, the summaries' switches
  function syncSettings() {
    if (usesDac()) bringDac();
    const pane = $('housePane');
    if (!pane) return;
    const have = Boolean(customElements.get(DAC_TAG));
    pane.querySelectorAll('[data-lights]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lights === look.lights)));
    $('lightsRow').querySelector('.status').textContent = have || !usesDac() ? 'How lights show on the house page.'
      : dacFetch === 'failed' ? "The Dual Axis Controller didn't load. Check the connection, or install it from HACS." : 'Getting the Dual Axis Controller…';
    pane.querySelectorAll('[data-dac-pad]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.dacPad === look.dacPad)));
    $('dacPadRow').hidden = !usesDac();
    for (const sel of pane.querySelectorAll('[data-source]')) {
      if (sel === root.activeElement) continue;
      const [kind] = SOURCES.find(([k]) => k === sel.dataset.source), ids = Object.keys(states).filter(SOURCES.find(([k]) => k === kind)[3]).sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
      if (sel.dataset.sig !== ids.join(',')) { sel.innerHTML = '<option value="">Automatic</option>' + ids.map((x) => '<option value="' + esc(x) + '">' + esc(nameOf(x)) + '</option>').join(''); sel.dataset.sig = ids.join(','); }
      sel.value = ids.includes(prefs.sources?.[kind]) ? prefs.sources[kind] : '';
    }
    pane.querySelectorAll('[data-sum-toggle]').forEach((b) => { const on = !(prefs.hiddenSums || []).includes(b.dataset.sumToggle); b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); });
    // the lights table, by room, redrawn when something in it changed, but not while one of its lists is open. A switch
    // just pressed keeps its focus through the redraw (it used to stop the redraw, so a favourite never showed as set)
    const body = $('lightRows'), cards = $('lightCards'), active = root.activeElement;
    const inside = body?.contains(active) || cards?.contains(active) ? active : null;
    if (!body || inside?.matches('select')) { fitChoices(); return; }
    const stars = new Set(starred()), opt = (v, t, cur, off) => '<option value="' + v + '"' + (v === cur ? ' selected' : '') + (off ? ' disabled' : '') + '>' + t + '</option>';
    const html = Object.keys(states).filter((id) => id.startsWith('light.'))
      .sort((a, b) => !whereIs.get(a) - !whereIs.get(b) || (whereIs.get(a) || '').localeCompare(whereIs.get(b) || '') || nameOf(a).localeCompare(nameOf(b))).map((id) => {
        const style = look.lightStyles[id] || '', pad = look.lightPads[id] || '', fav = stars.has(id), name = esc(nameOf(id));
        return '<tr><td><strong>' + name + '</strong></td><td>' + esc(whereIs.get(id) || '—') + '</td><td>' + esc(valueOf(id)) + '</td>' +
          '<td class="metaSwitchCol"><button class="switch' + (fav ? ' on' : '') + '" type="button" role="switch" aria-checked="' + fav + '" data-light-fav="' + esc(id) + '" aria-label="' + name + ' is a favourite"></button></td>' +
          '<td><select class="settingsSelect" data-light-style="' + esc(id) + '" aria-label="' + name + ' tile">' + opt('', 'Default', style) + opt('tile', 'HomeCore tile', style) + opt('dac', 'Dual Axis Controller', style) + '</select></td>' +
          '<td><select class="settingsSelect" data-light-pad="' + esc(id) + '" aria-label="' + name + ' pad"' + (wantsDac(id) ? '' : ' disabled') + '>' + opt('', 'Default', pad) + opt('temperature', 'Temperature', pad) + opt('colour', 'Colour', pad) + '</select></td></tr>';
      }).join('');
    // on a phone each light is a card (Matt, 8 Nov): its name and where it is, then Favourite with its switch, then its
    // tile, and its pad when it's the Dual Axis Controller, as choices
    const pickSeg = (field, id, label, opts, cur) => '<div class="themeChoice" role="group" aria-label="' + label + '">' + opts.map(([v, t]) =>
      '<button class="wxLayoutBtn" type="button" aria-pressed="' + (v === cur) + '" data-light-pick="' + field + '|' + esc(id) + '" data-v="' + v + '">' + t + '</button>').join('') + '</div>';
    const cardsHtml = Object.keys(states).filter((id) => id.startsWith('light.'))
      .sort((a, b) => !whereIs.get(a) - !whereIs.get(b) || (whereIs.get(a) || '').localeCompare(whereIs.get(b) || '') || nameOf(a).localeCompare(nameOf(b))).map((id) => {
        const fav = stars.has(id), name = esc(nameOf(id)), where = [whereIs.get(id), valueOf(id)].filter(Boolean).map(esc).join(' · ');
        return '<div class="toggleList"><div class="toggleRow"><div><strong>' + name + '</strong><div class="status">' + where + '</div></div></div>' +
          settingRow('Favourite', '', '<button class="switch' + (fav ? ' on' : '') + '" type="button" role="switch" aria-checked="' + fav + '" data-light-fav="' + esc(id) + '" aria-label="' + name + ' is a favourite"></button>') +
          settingRow('Tile', '', pickSeg('lightStyles', id, name + ' tile', [['', 'Default'], ['tile', 'HomeCore tile'], ['dac', 'Dual Axis Controller']], look.lightStyles[id] || '')) +
          (wantsDac(id) ? settingRow('Pad', '', pickSeg('lightPads', id, name + ' pad', [['', 'Default'], ['temperature', 'Temperature'], ['colour', 'Colour']], look.lightPads[id] || '')) : '') + '</div>';
      }).join('');
    if (body.dataset.html !== html) { body.innerHTML = html; body.dataset.html = html; }
    if (cards.dataset.html !== cardsHtml) { cards.innerHTML = cardsHtml; cards.dataset.html = cardsHtml; }
    if (inside?.dataset.lightFav) (cards.contains(inside) ? cards : body).querySelector('[data-light-fav="' + CSS.escape(inside.dataset.lightFav) + '"]')?.focus({ preventScroll: true });
    fitChoices();
  }
  /* a choice of more than three, or one whose choices don't fit on its line, is a list below instead (Matt, 8 Nov).
     The list stands in for the segments: picking in it presses the segment, and it follows whichever is pressed */
  function fitChoices() {
    const pane = $('housePane');
    if (!pane) return;
    for (const c of pane.querySelectorAll('.themeChoice')) {
      const btns = [...c.querySelectorAll('button')];
      let list = c.nextElementSibling?.classList.contains('tfChoiceList') ? c.nextElementSibling : null;
      if (!list) {
        list = document.createElement('select');
        list.className = 'settingsSelect tfChoiceList';
        list.setAttribute('aria-label', c.getAttribute('aria-label') || c.closest('.toggleRow')?.querySelector('strong')?.textContent || '');
        list.addEventListener('change', () => btns[Number(list.value)]?.click());
        c.after(list);
        const follow = () => {
          list.innerHTML = btns.map((b, i) => '<option value="' + i + '"' + (b.disabled ? ' disabled' : '') + '>' + esc(b.textContent) + '</option>').join('');
          const on = btns.findIndex((b) => b.getAttribute('aria-pressed') === 'true' || b.classList.contains('active'));
          if (on >= 0) list.value = String(on);
        };
        new MutationObserver(follow).observe(c, { subtree: true, attributes: true, attributeFilter: ['aria-pressed', 'class', 'disabled'] });
        follow();
      }
      const show = (seg) => { if (c.hidden !== !seg) c.hidden = !seg; if (list.hidden !== seg) list.hidden = seg; };
      if (btns.length > 3) { show(false); continue; }
      // measured only while it shows; a closed tab keeps what it had
      if (!c.getClientRects().length && !list.getClientRects().length) { if (!list.dataset.fit) show(true); continue; }
      const was = c.hidden;
      c.hidden = false;
      const fits = btns.every((b) => b.scrollWidth <= b.clientWidth + 1);
      c.hidden = was;
      show(fits);
      list.dataset.fit = '1';
    }
  }

  /* ---------- density overlay ---------- */
  const badge = document.createElement('div');
  badge.className = 'densityBadge';
  badge.setAttribute('aria-live', 'polite');
  badge.hidden = true;
  app.appendChild(badge);
  let densityTimer = 0;
  function measureDensity() {
    if (!densityOn) return;
    const home = $('homeView');
    const shown = (el) => el.offsetParent !== null && !el.closest('[hidden]');
    home.querySelectorAll(':scope .card, :scope .tfAction').forEach((el) => { if (shown(el)) el.dataset.h = Math.round(el.getBoundingClientRect().height) + ' px'; });
    const readings = [...home.querySelectorAll('.activityRow, .tfAction, .wxNow')].filter(shown);
    const vh = window.innerHeight;
    const vis = readings.filter((el) => { const r = el.getBoundingClientRect(); return r.height > 0 && r.top >= 0 && r.bottom <= vh + 0.5; }).length;
    badge.hidden = !home.classList.contains('active');
    badge.innerHTML = '<b>' + vis + '</b><small>of ' + readings.length + ' readings on screen</small>';
  }
  const onScroll = () => { if (densityOn) requestAnimationFrame(measureDensity); };
  function applyDensity() {
    app.classList.toggle('showDensity', densityOn);
    $('densityToggle')?.classList.toggle('on', densityOn);
    badge.hidden = !densityOn;
    clearInterval(densityTimer);
    if (densityOn) { densityTimer = setInterval(measureDensity, 1000); measureDensity(); }
  }
  window.addEventListener('scroll', onScroll, { capture: true, passive: true });
  window.addEventListener('resize', onScroll, { passive: true });

  /* ---------- the house ---------- */
  const grid = root.querySelector('#homeView .grid');
  let open = null; // { key of its card, entity id, card height before it opened }
  let activeArea = null; // the area card that's open in the accordion
  let areaPage = null; // the section whose own page is open (a room's, from its card's Go, or the weather's), or null for the house
  let more = null; // { id, opener } while the stand-in more-info is open
  const history = new Map(); // entity id → { at, points }
  const energyText = new Map(); // the dashboard's energy: statistic id → { name, text, icon } its tile shows
  const dragging = new Map(); // "kind|entity id" → value while a bar is held
  const BAR_SLOP = 6; // how far a finger goes before it's sliding a bar or scrolling the page
  let heldBar = null; // the bar a finger is moving, if any
  const goals = new Map(); // cover id → { pos, tilt, at }: where it was sent, until it gets there
  const arts = new Map(); // cover id → its drawing in more-info, kept across redraws
  const keyTimers = new Map(); // cover id → the pause before keyed steps are sent
  // favourites: Matt's stars are saved in his Home Assistant user data (HOUSE_KEY). Until he stars something here,
  // they start from Home Assistant's own home view favourites, which this page reads and never writes
  let prefs = { favourites: null };
  let haHome = {}, haSecurity = {}; // Home Assistant's home view and security settings
  let predicted = []; // Home Assistant's suggested devices (usage prediction), if it has them
  let suggested = null; // the suggestions, worked out once a visit so tiles don't move while you use them
  const used = (() => { try { return JSON.parse(local.get(USED_KEY)) || {}; } catch (_e) { return {}; } })();
  let whereIs = new Map(); // entity id → its room's name
  // saved to Home Assistant (prefs, HOUSE_KEY): the favourites, Settings → Sources (sources: { weather, grid, alarm })
  // and the summaries switched off there (hiddenSums). Home Assistant's areas are never changed
  let saveTimer = 0;
  function savePrefs() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => Promise.resolve(callWS({ type: 'frontend/set_user_data', key: HOUSE_KEY, value: prefs })).catch(() => {}), 400);
  }
  // this browser's look for the house: More info as a popup or a sheet, and the lights as this page's tiles or as the
  // Dual Axis Controller (with its pad on temperature or colour), each light able to differ (the lights table)
  const look = (() => {
    let v = {};
    try { v = JSON.parse(local.get(LOOK_KEY)) || {}; } catch (_e) { /* the defaults */ }
    const only = (o, ok) => Object.fromEntries(Object.entries(o || {}).filter(([, x]) => ok.includes(x)));
    return { more: v.more === 'sheet' ? 'sheet' : 'popup', names: v.namesPicked && ['auto', 'cut', 'wrap', 'scroll'].includes(v.names) ? v.names : 'scroll', namesPicked: Boolean(v.namesPicked),
      hoursWindow: ['day', 'waking', 'all'].includes(v.hoursWindow) ? v.hoursWindow : 'day',
      wxStyle: ['bitmap', 'onebit', 'smooth', 'line'].includes(v.wxStyle) ? v.wxStyle : 'bitmap', lights: v.lights === 'dac' ? 'dac' : 'tile', dacPad: v.dacPad === 'colour' ? 'colour' : 'temperature',
      lightStyles: only(v.lightStyles, ['tile', 'dac']), lightPads: only(v.lightPads, ['temperature', 'colour']) };
  })();
  const saveLook = () => local.set(LOOK_KEY, JSON.stringify(look));
  const applyLook = () => { app.dataset.more = look.more; app.dataset.names = look.names; fitDetails(); };
  /* Settings → Appearance → More info (the house page): a popup or a sheet */
  if (testFocus && list && !$('moreInfoChoice')) {
    $('densityToggle').closest('.toggleRow').insertAdjacentHTML('afterend',
      '<div class="toggleRow"><div><strong>More info</strong><div class="status">How a device opens on the house page.</div></div>' +
      '<div class="themeChoice" id="moreInfoChoice" role="group" aria-label="More info">' +
      MORE_STYLES.map(([value, text]) => '<button class="wxLayoutBtn" type="button" aria-pressed="' + (look.more === value) + '" data-more-style="' + value + '">' + text + '</button>').join('') + '</div></div>');
    $('moreInfoChoice').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-more-style]');
      if (!b) return;
      look.more = b.dataset.moreStyle;
      saveLook();
      applyLook();
      $('moreInfoChoice').querySelectorAll('[data-more-style]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    });
    // Long names: Scroll unless one's picked here (Matt, 31 Oct); Automatic cuts with "…" on the board and wraps on
    // phones; the others do one thing everywhere
    $('moreInfoChoice').closest('.toggleRow').insertAdjacentHTML('afterend',
      '<div class="toggleRow"><div><strong>Long names</strong><div class="status">How a name or state too long for its space shows.</div></div>' +
      '<div class="themeChoice" id="namesChoice" role="group" aria-label="Long names">' +
      NAME_STYLES.map(([value, text]) => '<button class="wxLayoutBtn" type="button" aria-pressed="' + (look.names === value) + '" data-names-style="' + value + '">' + text + '</button>').join('') + '</div></div>');
    $('namesChoice').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-names-style]');
      if (!b) return;
      look.names = b.dataset.namesStyle;
      look.namesPicked = true;
      saveLook();
      applyLook();
      $('namesChoice').querySelectorAll('[data-names-style]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    });
    // Next hours (Matt, 1 Nov): the hours each day's page shows, a swipe snapping from one day's to the next
    $('namesChoice').closest('.toggleRow').insertAdjacentHTML('afterend',
      '<div class="toggleRow"><div><strong>Next hours</strong><div class="status">The hours each day shows on the Weather page.</div></div>' +
      '<div class="themeChoice" id="hoursChoice" role="group" aria-label="Next hours">' +
      HOUR_WINDOWS.map(([value, text]) => '<button class="wxLayoutBtn" type="button" aria-pressed="' + (look.hoursWindow === value) + '" data-hours-window="' + value + '">' + text + '</button>').join('') + '</div></div>');
    $('hoursChoice').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-hours-window]');
      if (!b) return;
      look.hoursWindow = b.dataset.hoursWindow;
      saveLook();
      bento?.refresh();
      $('hoursChoice').querySelectorAll('[data-hours-window]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    });
    // Weather art (Matt, 1 Nov: back in Settings): how the weather's pictures and the sky are drawn
    $('hoursChoice').closest('.toggleRow').insertAdjacentHTML('afterend',
      '<div class="toggleRow"><div><strong>Weather art</strong><div class="status">How the weather and the sky are drawn.</div></div>' +
      '<div class="themeChoice" id="wxStyleChoice" role="group" aria-label="Weather art">' +
      WX_STYLES.map(([value, text]) => '<button class="wxLayoutBtn" type="button" aria-pressed="' + (look.wxStyle === value) + '" data-wx-style="' + value + '">' + text + '</button>').join('') + '</div></div>');
    $('wxStyleChoice').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-wx-style]');
      if (!b) return;
      look.wxStyle = b.dataset.wxStyle;
      saveLook();
      bento?.setStyle(look.wxStyle);
      dashBentos?.forEach((x) => x.setStyle(look.wxStyle));
      $('wxStyleChoice').querySelectorAll('[data-wx-style]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    });
  }
  houseSettings();
  let model = { rooms: [], vacuums: [], homeVacuums: [], grid: null, security: { alarms: [], locks: [], openings: [] } };
  const units = new Map(); // card or tile key → the html last drawn
  let signature = '';
  const house = testFocus ? createHouse({ onChange: () => refresh() }) : null;
  if (testFocus) app.classList.add('house');
  // Home's weather is the bento (Figma "Weather bento"), at its drawn sizes; it stays mounted across redraws
  const bentoBox = Object.assign(document.createElement('div'), { className: 'tfBento' });
  let bento = null, bentoId = null, suspended = false;
  function placeBento(order) {
    const id = weatherId();
    app.classList.toggle('houseBento', Boolean(id));
    // a different forecast was picked in Settings → Sources; the dashboard shows it only on its Weather page
    if (bento && (bentoId !== id || order == null)) { bento.destroy(); bento = null; }
    if (!id || order == null) { bentoBox.remove(); return; }
    if (!bentoBox.isConnected) grid.append(bentoBox);
    bentoBox.style.order = order;
    if (!bento && !suspended) { bento = mountWeatherBento(bentoBox, { getHass, entityId: id, style: look.wxStyle, hoursWindow: () => look.hoursWindow }); bentoId = id; }
  }
  // the dashboard's own weather cards (Matt, 27 Oct): the weather card, whose Now opens the Weather page, and Compared
  // to average in the place of the concept's to-do list; each kept mounted across redraws
  // and the new cards in the data tiles' shape (Matt, 1 Nov): Air quality, Pollen and Rain radar, off the board until
  // they're added from the edit tray
  const DASH_WEATHER = [['wx', ['current']], ['avg', ['compared_to_average']], ['aq', ['aq_tile']], ['pollen', ['pollen_tile']], ['radar', ['radar_tile']]];
  const NEW_CARDS = ['aq', 'pollen', 'radar'];
  const dashBoxes = Object.fromEntries(DASH_WEATHER.map(([k]) => [k, Object.assign(document.createElement('div'), { className: 'tfDashBento tfDash-' + k })]));
  let dashBentos = null, dashBentoId = null;
  function placeDash(on) {
    const id = on ? weatherId() : null;
    if (dashBentos && dashBentoId !== id) { dashBentos.forEach((b) => b.destroy()); dashBentos = null; }
    Object.values(dashBoxes).forEach((box) => (id ? !box.isConnected && grid.append(box) : box.remove()));
    if (id && !dashBentos && !suspended) {
      dashBentos = DASH_WEATHER.map(([k, cards]) => mountWeatherBento(dashBoxes[k], { getHass, entityId: id, style: look.wxStyle, cards, onOpen: k === 'wx' ? () => openArea('weather') : undefined }));
      dashBentoId = id;
    }
  }

  const attr = (id) => states[id]?.attributes || {};
  const nameOf = (id) => attr(id).friendly_name || id;
  const has = (id, bit) => isMadeUp(id) || (Number(attr(id).supported_features) & bit) === bit;
  const cap = (s) => { const t = String(s ?? '').replace(/_/g, ' '); return t.charAt(0).toUpperCase() + t.slice(1); };
  const num = (v, d = 1) => Number(v).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
  const brightnessOf = (st) => (st?.state === 'on' ? (st.attributes.brightness != null ? Math.max(1, Math.round(st.attributes.brightness / 2.55)) : 100) : 0);
  const modesOf = (id) => attr(id).supported_color_modes || [];
  // a light's colour while it's on, as Home Assistant's tiles show it: its rgb, else its hue, else its warm to cool,
  // else amber
  const kelvinRgb = (k) => {
    const t = k / 100;
    return [t <= 66 ? 255 : 329.7 * Math.pow(t - 60, -0.1332), t <= 66 ? 99.47 * Math.log(t) - 161.12 : 288.12 * Math.pow(t - 60, -0.0755), t >= 66 ? 255 : t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04];
  };
  const hueRgb = (h, sat) => [5, 3, 1].map((n) => { const k = (n + h / 60) % 6; return 255 * (1 - (sat / 100) * Math.max(0, Math.min(k, 4 - k, 1))); });
  // a lit light's glyph is its own colour, deepened (or, where white would contrast more, paled) only as far as 3.5:1
  // on it (Matt, 1 Nov: black on orange was harsh; 29 Oct: white on amber was 2:1)
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const lum = (rgb) => 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  /* a device that's on has its kind's colour (Matt, 8 Nov): a solid chip in a soft tint of it (mixed with white, so it
     stays clean) and the icon a brighter, richer version of the same hue, never darkened toward grey: full saturation, as
     light as it can be while it still reads on the chip (3:1). A light is its own colour; the rest are Home Assistant's
     state colours */
  const SOFTEN = 0.55;
  const lightRgb = (id) => {
    const a = attr(id);
    return (a.rgb_color || (a.hs_color && a.color_mode !== 'color_temp' ? hueRgb(...a.hs_color) : a.color_temp_kelvin ? kelvinRgb(a.color_temp_kelvin) : [255, 170, 0])).map((v) => Math.round(Math.max(0, Math.min(255, v))));
  };
  const CLIMATE_RGB = { heat: [255, 111, 34], cool: [33, 150, 243], heat_cool: [255, 193, 7], auto: [76, 175, 80], dry: [255, 152, 0], fan_only: [0, 188, 212] };
  // the colour a device has while it's on, or null while it's off (a triggered alarm stays solid red)
  function kindRgb(id) {
    const d = id.split('.')[0], st = states[id]?.state;
    if (!st || st === 'unavailable' || st === 'unknown') return null;
    if (d === 'light') return st === 'on' ? lightRgb(id) : null;
    if (d === 'climate') return CLIMATE_RGB[st] || null;
    if (d === 'cover') return st !== 'closed' ? [146, 107, 199] : null;
    if (d === 'lock') return st !== 'locked' ? [244, 67, 54] : null;
    if (d === 'media_player') return ['playing', 'paused', 'on', 'buffering'].includes(st) ? [3, 169, 244] : null;
    if (d === 'humidifier' || d === 'valve') return ['on', 'open', 'opening', 'closing'].includes(st) ? [33, 150, 243] : null;
    if (d === 'vacuum') return ['cleaning', 'returning'].includes(st) ? [0, 150, 136] : null;
    if (d === 'alarm_control_panel') return st !== 'disarmed' && st !== 'triggered' ? [76, 175, 80] : null;
    if (d === 'fan') return st === 'on' ? [0, 188, 212] : null;
    if (d === 'switch' || d === 'input_boolean') return st === 'on' ? [255, 193, 7] : null;
    return null;
  }
  // the richest version of a colour that reads (3:1) on the chip under it: its hue at full saturation, from mid
  // lightness darker for a light chip, or lighter for a dark one
  function richInk(rgb, on, up = false) {
    const [r, g, b] = rgb.map((v) => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    const h = !d ? 0 : (mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60;
    const l0 = (mx + mn) / 2, s0 = !d ? 0 : d / (1 - Math.abs(2 * l0 - 1)), s = d < 0.1 ? Math.min(s0, 0.25) : 1; // a white light stays soft, not pink
    const hsl = (l) => { const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l); return [0, 8, 4].map((n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))))); };
    for (let l = 0.5; up ? l < 0.96 : l > 0.04; l += up ? 0.01 : -0.01) { const c = hsl(l); if (ratio(c, on) >= 3) return 'rgb(' + c.join(',') + ')'; }
    return up ? '#ffffff' : '#26221e';
  }
  // a summary's icon in its colour on the plain chip (Matt, 8 Nov), one for the dark chip and one for the light; a grey
  // summary colour (Maintenance) has no hue, so it keeps the text colour
  const sumInk = (hex) => {
    const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    if (Math.max(...rgb) - Math.min(...rgb) < 26) return '';
    return ';--sum-d:' + richInk(rgb, [58, 58, 58], true) + ';--sum-l:' + richInk(rgb, [230, 230, 230]);
  };
  // Climate's icon is a soft pastel gradient from warm to cool (Matt, 8 Nov): peach at the top, blue at the foot, through
  // lilac so the middle never goes grey; a touch deeper on the light chip so it still shows there
  const CLIMATE_STOPS = { d: ['#ffb894', '#d2b4ff', '#9dcbff'], l: ['#f0946a', '#b48ae6', '#6fa8e8'] };
  const climateVars = () => [0, 1, 2].map((i) => '--g' + i + '-d:' + CLIMATE_STOPS.d[i] + ';--g' + i + '-l:' + CLIMATE_STOPS.l[i]).join(';');
  const CLIMATE_DEFS = '<svg class="tfGradDefs" aria-hidden="true" focusable="false"><defs><linearGradient id="hcClimateGrad" x1="0" y1="0" x2="0" y2="1">' +
    [0.15, 0.5, 0.85].map((o, i) => '<stop offset="' + o + '" style="stop-color:var(--g' + i + ')"/>').join('') + '</linearGradient></defs></svg>';
  const colourVars = (rgb) => { const soft = rgb.map((v) => Math.round(v + (255 - v) * SOFTEN)); return '--light-soft:rgb(' + soft.join(',') + ');--light-ink:' + richInk(rgb, soft); };
  const lightVars = (id) => colourVars(lightRgb(id));
  // the marker and colours on a device's tile while it's on (data-light: lights first, now every kind)
  const lightAttrs = (id) => { const c = kindRgb(id); return c ? ' data-light style="' + colourVars(c) + '"' : ''; };
  const dimmable = (id) => { const m = modesOf(id); return m.length ? m.some((x) => x !== 'onoff') : attr(id).brightness != null; };
  const kelvinRange = (id) => [attr(id).min_color_temp_kelvin || 2000, attr(id).max_color_temp_kelvin || 6500];
  const clock = (t) => new Date(t).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  function ago(t) {
    const s = Math.max(1, Math.round((Date.now() - t) / 1000));
    if (s < 10) return 'Just now';
    if (s < 60) return s + ' seconds ago';
    const m = Math.round(s / 60);
    if (m < 60) return m + (m === 1 ? ' minute ago' : ' minutes ago');
    const h = Math.round(m / 60);
    if (h < 24) return h + (h === 1 ? ' hour ago' : ' hours ago');
    const days = Math.round(h / 24);
    return days + (days === 1 ? ' day ago' : ' days ago');
  }
  // covers: where one is (Home Assistant), and where it's heading (held, or sent and not there yet)
  const posOf = (id) => attr(id).current_position ?? (states[id]?.state === 'closed' ? 0 : 100);
  const coverValue = (id) => held('pos', id, goals.get(id)?.pos ?? posOf(id));
  const tiltOf = (id) => held('tilt', id, goals.get(id)?.tilt ?? attr(id).current_tilt_position);

  function valueOf(id) {
    const st = states[id];
    if (!st) return 'Not found';
    if (st.state === 'unavailable') return 'Unavailable';
    const a = st.attributes, d = id.split('.')[0];
    if (d === 'light') {
      if (st.state !== 'on') return 'Off';
      const k = a.color_temp_kelvin;
      return (dimmable(id) ? brightnessOf(st) + '%' : 'On') + (a.color_mode === 'color_temp' && k ? ' · ' + Number(k).toLocaleString() + 'k' : COLOUR_MODES.includes(a.color_mode) ? ' · Colour' : '');
    }
    if (d === 'climate') return (st.state === 'off' ? 'Off' : cap(a.hvac_action || st.state)) + ' · ' + num(a.current_temperature) + ' °C now';
    if (d === 'cover') {
      const p = posOf(id), t = a.current_tilt_position;
      if (st.state === 'opening' || st.state === 'closing') return cap(st.state) + ' - ' + p + '%';
      return (p <= 0 ? 'Closed' : p >= 100 ? 'Open' : 'Partially open') + (t > 0 && t < 100 ? ' · tilted' : '');
    }
    if (d === 'humidifier') return st.state !== 'on' ? 'Off' : cap(a.action || 'on') + ' · ' + a.current_humidity + '% now';
    if (d === 'vacuum') return cap(st.state) + (st.state === 'cleaning' && a.rooms?.length ? ' · ' + a.rooms.join(', ') : '') + (a.battery_level != null ? ' · ' + a.battery_level + '%' : '');
    if (d === 'media_player') return st.state === 'playing' || st.state === 'paused' ? (st.state === 'paused' ? 'Paused · ' : '') + (a.media_title || 'Playing') : cap(st.state);
    if (d === 'alarm_control_panel') return ALARM_STATE[st.state] || cap(st.state);
    if (d === 'lock' || d === 'valve') return cap(st.state);
    if (d === 'switch') return st.state === 'on' ? 'On' : 'Off';
    if (d === 'plant') return st.state === 'ok' ? 'Healthy' : cap(a.problem);
    if (d === 'binary_sensor') {
      if (a.device_class === 'battery') return st.state === 'on' ? 'Low' : 'Normal';
      if (a.device_class === 'problem') return st.state === 'on' ? 'Problem' : 'OK';
      if (a.device_class === 'moisture') return st.state === 'on' ? 'Wet' : 'Dry';
      if (OPEN_CLASSES.includes(a.device_class)) return st.state === 'on' ? 'Open' : 'Closed';
      return st.state === 'on' ? 'Detected' : 'Clear';
    }
    if (a.rang) return 'Rang at ' + clock(a.rang);
    const hass = getHass();
    if (hass?.formatEntityState && !isMadeUp(id)) { try { return hass.formatEntityState(st); } catch (_e) { /* fall through */ } }
    const n = Number(st.state);
    if (st.state !== '' && Number.isFinite(n)) {
      const digits = Math.abs(n) >= 100 ? 0 : Math.abs(n) >= 10 ? 1 : 2;
      const unit = a.unit_of_measurement ? (a.unit_of_measurement === '%' ? '%' : ' ' + a.unit_of_measurement) : '';
      return n.toLocaleString(undefined, { maximumFractionDigits: digits }) + unit + (a.plant_low ? ' · Low' : a.plant_high ? ' · High' : '');
    }
    return cap(st.state);
  }
  const watts = (w) => (w >= 1000 ? num(w / 1000, 2) + ' kW' : Math.round(w).toLocaleString() + ' W');

  // Entity icons come from Home Assistant (ha-state-icon), so they match the rest of the dashboard
  function fillIcons(scope) {
    const hass = getHass();
    scope.querySelectorAll('[data-icon-for]').forEach((slot) => {
      const st = states[slot.dataset.iconFor];
      const want = slot.dataset.iconName || '';
      if (customElements.get('ha-state-icon') && st && !want) {
        let el = slot.firstElementChild;
        if (!el || el.localName !== 'ha-state-icon') { slot.textContent = ''; el = document.createElement('ha-state-icon'); slot.appendChild(el); }
        el.hass = hass; el.stateObj = st;
      } else if (customElements.get('ha-icon')) {
        let el = slot.firstElementChild;
        if (!el || el.localName !== 'ha-icon') { slot.textContent = ''; el = document.createElement('ha-icon'); slot.appendChild(el); }
        el.icon = want || st?.attributes?.icon || 'mdi:circle-medium';
      } else if (!slot.textContent) {
        slot.textContent = (slot.dataset.letter || nameOf(slot.dataset.iconFor) || '?').trim().charAt(0).toUpperCase();
      }
    });
    scope.querySelectorAll?.('.tfIcon').forEach(fadeChip);
    if (scope.classList?.contains('tfIcon')) fadeChip(scope);
    fitSoon();
  }
  /* on and off fade over 0.18 s, as the Dual Axis Controller's icon does (Matt, 1 Nov: every light icon behaves the
     same); a redraw makes a chip anew, so it fades from the colours it last had */
  const chipWas = new Map(); // a chip's place and device → the colours it last had
  function fadeChip(chip) {
    const key = (chip.closest('[data-k]')?.dataset.k || '') + '|' + (chip.dataset.iconFor || chip.querySelector('[data-icon-for]')?.dataset.iconFor || chip.getAttribute('aria-label') || '');
    const cs = getComputedStyle(chip), now = { backgroundColor: cs.backgroundColor, color: cs.color }, was = chipWas.get(key);
    chipWas.set(key, now);
    if (!was || (was.backgroundColor === now.backgroundColor && was.color === now.color) || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    chip.animate([was, now], { duration: 180, easing: 'ease' });
  }
  /* icon fit (Matt, 31 Oct: one size for every icon): Material Design Icons draw at different sizes in their 24 grid
     (curtains 22 across, a water drop 12), so in one box they look different sizes. Once drawn, each glyph is sized so
     its longest side leaves 7 clear in its room, 26 in a 40 (tiles, rows, summaries, popups and area cards alike; 18
     in the mini phone's 32), and centred on what's drawn */
  const ICON_SEL = '[data-icon-for]>:is(ha-state-icon,ha-icon),.tfIcon>svg';
  const firstSvg = (el) => { const q = [el]; while (q.length) { const n = q.shift(); if (n.localName === 'svg') return n; if (n.shadowRoot) q.push(...n.shadowRoot.children); q.push(...n.children); } return null; };
  // true once the icon is fitted (or there's nothing to fit); false while it's still loading or out of sight
  function fitIcon(el) {
    const svg = el.localName === 'svg' ? el : firstSvg(el);
    const shapes = svg ? [...svg.querySelectorAll('path,rect,circle,ellipse,polygon,polyline,line')] : [];
    if (!shapes.length) return !svg;
    const room = el.closest('.tfIcon')?.offsetWidth;
    if (room === undefined) return true;
    if (!room) return false;
    const key = room + '|' + shapes.map((x) => x.getAttribute('d') || x.localName).join('|');
    if (el.dataset.fitted === key) return true;
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    for (const x of shapes) {
      const b = x.getBBox(), cs = getComputedStyle(x), pad = cs.stroke !== 'none' ? (parseFloat(cs.strokeWidth) || 0) / 2 : 0;
      if (!b.width && !b.height) continue;
      x1 = Math.min(x1, b.x - pad); y1 = Math.min(y1, b.y - pad); x2 = Math.max(x2, b.x + b.width + pad); y2 = Math.max(y2, b.y + b.height + pad);
    }
    if (!(x2 > x1)) return false;
    const vb = svg.viewBox?.baseVal?.width ? svg.viewBox.baseVal : { x: 0, y: 0, width: 24, height: 24 };
    const target = room - 14, size = (target * vb.width) / Math.max(x2 - x1, y2 - y1), at = size / vb.width;
    if (el.localName === 'svg') { el.style.width = size + 'px'; el.style.height = size + 'px'; } else el.style.setProperty('--mdc-icon-size', size + 'px');
    svg.style.translate = ((vb.x + vb.width / 2 - (x1 + x2) / 2) * at).toFixed(2) + 'px ' + ((vb.y + vb.height / 2 - (y1 + y2) / 2) * at).toFixed(2) + 'px';
    el.dataset.fitted = key;
    return true;
  }
  let fitTimer = 0;
  // icons load after they're placed, so a few tries
  function fitIcons(tries = 0) {
    clearTimeout(fitTimer);
    const waiting = [...root.querySelectorAll(ICON_SEL)].filter((el) => !fitIcon(el)).length;
    if (waiting && tries < 5) fitTimer = setTimeout(() => fitIcons(tries + 1), 300);
  }
  function fitSoon() { clearTimeout(fitTimer); fitTimer = setTimeout(() => fitIcons(), 60); }
  // every light the same solid bulb, on or off, its state in the chip's colour (Matt, 30 Oct); a light given its own
  // icon in Home Assistant keeps it
  const lightIcon = (id) => (id.startsWith('light.') && states[id] && !attr(id).icon && !getHass()?.entities?.[id]?.icon ? 'mdi:lightbulb' : '');
  const iconSlot = (id, icon, letter) => { icon = icon || lightIcon(id); return ' data-icon-for="' + esc(id) + '"' + (icon ? ' data-icon-name="' + esc(icon) + '"' : '') + (letter ? ' data-letter="' + esc(letter) + '"' : ''); };
  const iconFor = (id) => (id.endsWith('_solar_power') ? 'mdi:solar-power-variant' : attr(id).rang ? 'mdi:doorbell' : '');
  // a service call on a button: domain|service|entity|data
  const act = (domain, service, id, data) => esc([domain, service, id, data ? JSON.stringify(data) : ''].join('|'));
  // several at once (an area's lights): a JSON list of [domain, service, entity, data]
  const acts = (list) => esc(JSON.stringify(list));

  /* readings: tiles in a card; numbers open to their last 24 hours */
  function readingRow(cardKey, id) {
    const label = esc(nameOf(id) + ', ' + valueOf(id));
    const graph = Number.isFinite(Number(states[id]?.state)) && states[id]?.state !== '';
    return '<div class="activityRow' + (graph ? ' tap" role="button" tabindex="0" data-open="' + esc(cardKey + '|' + id) + '" aria-label="' + label + '. Show the last 24 hours"' : '" aria-label="' + label + '"') + '>' +
      '<div class="tfIcon" aria-hidden="true"' + iconSlot(id, iconFor(id)) + '></div>' +
      '<div><div class="activityRowName">' + esc(nameOf(id)) + '</div><div class="activityRowMeta">' + esc(valueOf(id)) + '</div></div></div>';
  }
  const sumRow = (name, value, icon) => '<div class="activityRow" aria-label="' + esc(name + ', ' + value) + '"><div class="tfIcon" aria-hidden="true"' + iconSlot('', icon, name) + '></div>' +
    '<div><div class="activityRowName">' + esc(name) + '</div><div class="activityRowMeta">' + esc(value) + '</div></div></div>';
  // a plug: its icon is the button; its name and value open its popup (Matt, 1 Nov: a name or subtitle always does)
  function plugRow(id) {
    const on = states[id]?.state === 'on';
    return '<div class="activityRow tfPlug' + (on ? ' on' : '') + '"><button class="tfIcon" type="button" data-act="' + act('switch', 'toggle', id) + '" aria-label="Turn ' + esc(nameOf(id)) + (on ? ' off' : ' on') + '"' + iconSlot(id) + '></button>' +
      '<button class="tfName" type="button" data-more="' + esc(id) + '" aria-label="' + esc(nameOf(id) + ', ' + valueOf(id) + '. More info') + '"><span class="activityRowName">' + esc(nameOf(id)) + '</span><span class="activityRowMeta">' + esc(valueOf(id)) + '</span></button></div>';
  }
  // an opened tile shows its reading, or what its card says instead (the dashboard's energy: today's use, by source)
  const openName = (id) => energyText.get(id)?.name ?? nameOf(id);
  const openValue = (id) => energyText.get(id)?.text ?? valueOf(id);
  function openTile(id) {
    const icon = energyText.get(id)?.icon;
    return '<div class="tfOpen"><div class="tfOpenHead"><div class="tfIcon" aria-hidden="true"' + (icon ? iconSlot('', icon, openName(id)) : iconSlot(id, iconFor(id))) + '></div>' +
      '<div><div class="activityRowName">' + esc(openName(id)) + '</div><div class="activityRowMeta">' + esc(openValue(id)) + '</div></div>' +
      '<button class="tfBack" type="button" data-close aria-label="Close ' + esc(openName(id)) + '’s last 24 hours">' + ARROW + '</button></div>' +
      '<svg class="tfGraph" data-graph="' + esc(id) + '" role="img" aria-label="' + esc(openName(id)) + ', last 24 hours"></svg></div>';
  }
  // a card of readings; its title can open more-info (a plant) or its popup (Energy today, Favourites)
  function card(key, order, title, rows, extra = '', moreId = null, cls = '') {
    const isOpen = open && open.key === key;
    return '<section class="card tfCard' + (cls ? ' ' + cls : '') + (isOpen ? ' open' : '') + '" data-tf data-k="' + esc(key) + '" style="order:' + order + (isOpen && open.h ? ';min-height:' + open.h + 'px' : '') + '" aria-label="' + esc(title) + '">' +
      '<div class="activityHeader">' + (moreId ? '<button class="activityTitle tfTitleBtn" type="button" data-more="' + esc(moreId) + '" aria-label="' + esc(title + (states[moreId] ? ', ' + valueOf(moreId) : '') + '. More info') + '">' + esc(title) + '</button>' : '<div class="activityTitle">' + esc(title) + '</div>') + '</div>' +
      (isOpen ? openTile(open.id) : '<div class="activityRows">' + rows.join('') + '</div>' + extra) + '</section>';
  }
  function roomCard(r, order) {
    const key = 'readings:' + r.id;
    const rows = r.readings.map((id) => readingRow(key, id));
    if (r.power != null) rows.push(sumRow('Power now', watts(r.power), 'mdi:flash'));
    return card(key, order, 'Readings', rows.concat(r.plugs.map(plugRow)));
  }
  function energyCard(r, order) {
    const key = 'energy:' + r.id;
    const [now, today] = [r.solar.find((id) => id.endsWith('_power')), r.solar.find((id) => id.endsWith('_today'))];
    const rows = [now, today].filter(Boolean).map((id) => readingRow(key, id));
    const solarW = Number(states[now]?.state || 0) * 1000;
    if (model.grid) {
      rows.push(readingRow(key, model.grid));
      rows.push(sumRow('House use', watts(solarW + Number(states[model.grid].state)), 'mdi:home-lightning-bolt'));
    }
    return card(key, order, 'Energy', rows, '<div class="tfCardGraph"><svg class="tfGraph" data-solar role="img" aria-label="Solar, last 24 hours"></svg></div>');
  }
  const plantCard = (p, order) => card('plant:' + p.id, order, nameOf(p.id), p.readings.map((id) => readingRow('plant:' + p.id, id)), '', p.id);

  /* action tiles: a name row, then sections stacked under it */
  // was: where a light's brightness was before it went off, a faint line on its bar
  function bar(kind, id, frac, label, valueText, marker, was = null) {
    const f = frac == null ? null : Math.max(0, Math.min(1, frac)), pct = f == null ? 0 : Math.round(f * 100);
    return '<div class="tfBar ' + kind + '" role="slider" tabindex="0" aria-label="' + esc(label) + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '"' + (valueText ? ' aria-valuetext="' + esc(valueText) + '"' : '') + ' data-drag="' + esc(kind + '|' + id) + '">' +
      (was != null ? '<span class="was" aria-hidden="true" style="left:' + was + '%"></span>' : '') +
      (marker ? (f == null ? '' : '<b style="left:' + pct + '%"></b>') : '<i style="width:' + pct + '%"></i>') + '</div>';
  }
  // each light's brightness while it was last on, remembered in this browser, for its off line
  const LAST_BRIGHT_KEY = 'move-assistant-house-last-bright';
  const lastBright = (() => { try { return JSON.parse(local.get(LAST_BRIGHT_KEY)) || {}; } catch (_e) { return {}; } })();
  let lastBrightTimer = 0;
  const noteBright = (id, v) => {
    if (!v || lastBright[id] === v) return;
    lastBright[id] = v;
    clearTimeout(lastBrightTimer);
    lastBrightTimer = setTimeout(() => local.set(LAST_BRIGHT_KEY, JSON.stringify(lastBright)), 500);
  };
  const stepper = (label, valueText, down, up) => '<div class="tfStep" role="group" aria-label="' + esc(label) + '">' +
    '<button type="button" data-act="' + down + '" aria-label="Lower ' + esc(label.toLowerCase()) + '">' + STEP.down + '</button><output>' + esc(valueText) + '</output>' +
    '<button type="button" data-act="' + up + '" aria-label="Raise ' + esc(label.toLowerCase()) + '">' + STEP.up + '</button></div>';
  const buttons = (cls, label, items) => '<div class="' + cls + '" role="group" aria-label="' + esc(label) + '">' + items.filter(Boolean).map((it) =>
    '<button type="button" data-act="' + it.act + '"' + (it.pressed != null ? ' aria-pressed="' + it.pressed + '"' : '') + (it.disabled ? ' disabled' : '') + (it.aria ? ' aria-label="' + esc(it.aria) + '"' : '') + '>' + (it.html || esc(it.label)) + '</button>').join('') + '</div>';
  // a cover: four blocks for 25, 50, 75 and 100% (tap one for its stop; hold or drag for 1% steps), the slats' tilt
  // from Shut to Open, then open, stop and close; each the track every control is (Matt, 31 Oct): 46 tall, corner 16,
  // 4 in from its edge
  const blockFill = (v, i) => 'width:' + Math.round(Math.max(0, Math.min(1, (v - i * 25) / 25)) * 1000) / 10 + '%;opacity:' + (0.6 + (0.4 * i) / 3).toFixed(2);
  const tipAt = (v) => 'left:calc(4px + ' + v / 100 + ' * (100% - 8px))';
  const blocks = (id, v) => '<div class="tfBlocks" role="slider" tabindex="0" aria-label="' + esc(nameOf(id)) + ' position" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(v) + '" aria-valuetext="' + Math.round(v) + '% open" data-blocks="' + esc(id) + '">' +
    [0, 1, 2, 3].map((i) => '<span><i style="' + blockFill(v, i) + '"></i><b' + (v >= (i + 1) * 25 - 12 ? ' class="lit"' : '') + '>' + (i + 1) * 25 + '<small>%</small></b></span>').join('') +
    '<output class="tfTip" aria-hidden="true" style="' + tipAt(v) + '">' + Math.round(v) + '%</output></div>';
  function paintBlocks(el, v) {
    el.querySelectorAll(':scope>span').forEach((c, i) => { c.firstElementChild.setAttribute('style', blockFill(v, i)); c.lastElementChild.classList.toggle('lit', v >= (i + 1) * 25 - 12); });
    const tip = el.querySelector('.tfTip');
    tip.setAttribute('style', tipAt(v));
    tip.textContent = Math.round(v) + '%';
    el.setAttribute('aria-valuenow', String(Math.round(v)));
    el.setAttribute('aria-valuetext', Math.round(v) + '% open');
  }
  const tiltBar = (id, v) => '<div class="tfTilt" role="slider" tabindex="0" aria-label="' + esc(nameOf(id)) + ' tilt" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(v) + '" aria-valuetext="' + Math.round(v) + '% open" data-drag="tilt|' + esc(id) + '">' +
    '<i style="width:calc((100% - 8px) * ' + v / 100 + ')"></i><span' + (v > 8 ? ' class="lit"' : '') + '>Shut</span><span' + (v > 92 ? ' class="lit"' : '') + '>Open</span></div>';
  const coverButtons = (id, v, moving) => '<div class="tfSeg tfCoverBtns" role="group" aria-label="' + esc(nameOf(id)) + '">' + [
    has(id, OPEN) && ['open', 'Open', 'open_cover', v >= 100 && !moving],
    has(id, STOP) && ['stop', 'Stop', 'stop_cover', false],
    has(id, CLOSE_COVER) && ['close', 'Close', 'close_cover', v <= 0 && !moving],
  ].filter(Boolean).map(([icon, label, service, off]) => '<button type="button" data-act="' + act('cover', service, id) + '" aria-label="' + label + '"' + (off ? ' disabled' : '') + '>' + COVER_BUTTONS[icon] + '</button>').join('') + '</div>';
  const iconButton = (id, s) => '<button class="tfIcon' + (s.art ? ' art' : '') + '" type="button" data-act="' + s.button.act + '" aria-label="' + esc(s.button.label) + '"' +
    (s.art ? ' style="background-image:url(&quot;' + esc(s.art) + '&quot;)"' : iconSlot(id, s.icon)) + '></button>';
  // the name and value open more-info
  const nameButton = (id) => '<button class="tfName" type="button" data-more="' + esc(id) + '" aria-label="' + esc(nameOf(id) + ', ' + valueOf(id) + '. More info') + '"><span class="activityRowName">' + esc(nameOf(id)) + '</span><span class="activityRowMeta">' + esc(valueOf(id)) + '</span></button>';
  // a tile shows the sections Matt kept (all but a cover's drawing to start with), at its size; small is the icon and
  // name only. In edit mode its controls rest under a bar of tools
  // in a summary's popup a tile keeps all its controls, except a light, which keeps only its brightness (Matt, 27 Oct:
  // not a barrage of colour; warmth and colour are on the light's own popup)
  // on the dashboard's bottom row (only) a tile keeps just its first control: a light its brightness, a thermostat its target
  function actionTile(id, inDialog = false, only = null) {
    // a light as the Dual Axis Controller is a tile like every other, the controller's pad its control (Matt, 1 Nov:
    // it's just another action)
    // a Dual Axis Controller on the dashboard is its pad from M; at S its brightness only, as a light of bars, and at
    // XS its head (Matt, 2 Nov)
    const s = specFor(id), dac = id.startsWith('light.') && dacFor(id) && !(only && sizeOf(id) < 3), keep = only || (inDialog && id.startsWith('light.') ? ['bright'] : null);
    const sections = dac ? ['<div class="tfDacPad" data-dac="' + (inDialog ? 'more:' : only ? 'dash:' : 'tile:') + esc(id) + '"></div>']
      : s.sections.map((sec, i) => (sec && (!keep || keep.includes((s.parts || [])[i])) ? sec : '')).filter(Boolean);
    return '<div class="tfAction' + (dac ? ' tfDac' : '') + (s.on ? ' on' : '') + '" data-k="' + esc(id) + '"' + (s.tone ? ' data-tone="' + s.tone + '"' : '') + lightAttrs(id) + '>' +
      '<div class="tfActionHead">' + iconButton(id, s) + nameButton(id) + '</div>' + sections.join('') + '</div>';
  }
  /* the Dual Axis Controller (Matt's HACS card, custom:dual-controller-v3): when Settings picks it, every light is its
     tile, with its own pad and controller. It comes with HomeCore (Matt, 28 Oct: people install one thing): the first
     time a light uses it, it's fetched from its GitHub release, unless Home Assistant loads one installed from HACS
     (one of its dashboard resources), which is then used instead */
  const DAC_TAG = 'dual-controller-v3';
  const DAC_URL = 'https://cdn.jsdelivr.net/gh/mbb365/Dual-Axis-Controller-v4@v9.0.5/dist/dual-axis-controller-v4.js';
  let dacFetch = null; // null, 'loading' or 'failed'
  async function bringDac() {
    if (dacFetch || customElements.get(DAC_TAG)) return;
    dacFetch = 'loading';
    const resources = await Promise.resolve().then(() => callWS({ type: 'lovelace/resources' })).catch(() => null);
    const installed = Array.isArray(resources) && resources.some((r) => /dual-axis-controller/i.test(r.url || ''));
    // an installed one may still be on its way: it gets a moment first
    await Promise.race([customElements.whenDefined(DAC_TAG), new Promise((done) => setTimeout(done, installed ? 8000 : 0))]);
    if (customElements.get(DAC_TAG)) return;
    const script = Object.assign(document.createElement('script'), { src: DAC_URL });
    script.onerror = () => { dacFetch = 'failed'; syncSettings(); };
    document.head.appendChild(script);
  }
  const dacs = new Map(); // place:light id → its card, kept across redraws
  // a light's tile and pad: its own choice in the lights table, else Appearance's
  const wantsDac = (id) => (look.lightStyles[id] || look.lights) === 'dac';
  const usesDac = () => look.lights === 'dac' || Object.values(look.lightStyles).includes('dac');
  function dacFor(id) { return wantsDac(id) && Boolean(customElements.get(DAC_TAG)); }
  const padOf = (id) => look.lightPads[id] || look.dacPad;
  // the card follows this page's theme rather than Home Assistant's
  const dacHass = () => {
    const h = getHass();
    return h && { ...h, themes: { ...(h.themes || {}), darkMode: !app.classList.contains('light') },
      callService: (domain, service, data, ...rest) => h.callService(domain, ...asLastOn(domain, service, data), ...rest) };
  };
  // the controller gives only its pad (Matt, 1 Nov: it's just another action): the tile around it, head and all, is this
  // page's, so the card's own frame and head are hidden (through its open shadow root), and the pad takes the room the
  // tile leaves (--tf-dac-pad: on the board its cells less the tile's 90; elsewhere 198, a 4-row tile's); in dark mode
  // its text is this page's grey (Matt, 28 Oct: #d9d9d9; the card's own is #f1f1f1)
  const DAC_PAD = 'ha-card,.hc.hcTile{padding:0!important;border:0!important;border-radius:0!important;background:none!important;box-shadow:none!important}' +
    '.hcTileHead{display:none!important}.hc--dark{--hc-text:var(--color-text-primary,#f1f1f1)}' +
    '.halo.is-size-tile .halo__pad-shell{height:var(--tf-dac-pad,198px)!important;transition:height .25s cubic-bezier(.2,.7,.3,1)}';
  const dressDac = (el) => {
    if (!el.shadowRoot || el.shadowRoot.querySelector('style[data-tf]')) return;
    el.shadowRoot.appendChild(Object.assign(document.createElement('style'), { textContent: DAC_PAD })).dataset.tf = '';
  };
  // a controller taken off the page (another page opened) is drawn again from nothing when it's back, a moment later;
  // until it is, its place keeps its last height, so nothing under it moves (Matt, 28 Oct: back from the weather, the
  // page jumped)
  const dacHeights = new Map(); // place:light id → its height when last drawn
  const dacSizes = new ResizeObserver((entries) => entries.forEach(({ target }) => {
    const slot = target.parentElement;
    if (!slot || !target.offsetHeight) return;
    slot.style.removeProperty('min-height');
    dacHeights.set(slot.dataset.dac, slot.offsetHeight);
  }));
  function mountDacs(scope) {
    // its place is the pad's, inside its tile
    scope.querySelectorAll('[data-dac]').forEach((slot) => {
      const key = slot.dataset.dac;
      let el = dacs.get(key);
      if (!el) { const id = key.slice(key.indexOf(':') + 1); el = document.createElement(DAC_TAG); el.setConfig({ type: 'custom:' + DAC_TAG, entity: id, pad: padOf(id), tap_action: { action: 'none' } }); dacs.set(key, el); }
      el.hass = dacHass();
      if (el.parentNode !== slot) slot.replaceChildren(el);
      if (!el.offsetHeight && dacHeights.has(key)) slot.style.minHeight = dacHeights.get(key) + 'px';
      dacSizes.observe(el);
      dressDac(el);
    });
  }
  function syncDacs() { const h = dacHass(); dacs.forEach((el, key) => { if (el.isConnected) el.hass = h; else dacs.delete(key); }); }
  // the card can load after this one: draw again once it's there
  customElements.whenDefined(DAC_TAG).then(() => { if (testFocus && grid?.querySelector('[data-tf]')) keepPlace(render); });
  const held = (kind, id, fallback) => (dragging.has(kind + '|' + id) ? dragging.get(kind + '|' + id) : fallback);

  // each kind of device: whether it's on, its button, and its sections in order
  function specFor(id) {
    const st = states[id], a = st.attributes, d = id.split('.')[0];
    const toggle = (domain, label) => ({ act: act(domain, 'toggle', id), label });
    if (d === 'light') {
      // brightness, then warm to cool, then colour, each only if the light can do it
      const on = st.state === 'on', modes = modesOf(id), [kMin, kMax] = kelvinRange(id), b = held('bright', id, brightnessOf(st));
      if (on) noteBright(id, brightnessOf(st));
      const k = held('ct', id, on && a.color_mode === 'color_temp' ? a.color_temp_kelvin : null);
      const hue = held('hue', id, on && COLOUR_MODES.includes(a.color_mode) && a.hs_color ? a.hs_color[0] : null);
      return { on, button: toggle('light', 'Turn ' + nameOf(id) + (on ? ' off' : ' on')), parts: ['bright', 'ct', 'hue'], sections: [
        dimmable(id) && bar('bright', id, b / 100, nameOf(id) + ' brightness', b + '%', false, on ? null : lastBright[id] ?? null),
        modes.includes('color_temp') && bar('ct', id, k == null ? null : (k - kMin) / (kMax - kMin), nameOf(id) + ' warm to cool', k == null ? '' : Math.round(k) + ' kelvin', true),
        modes.some((m) => COLOUR_MODES.includes(m)) && bar('hue', id, hue == null ? null : hue / 360, nameOf(id) + ' colour', '', true),
      ] };
    }
    if (d === 'climate') {
      // the target, then its modes
      const step = a.target_temp_step || 0.5, t = Number(a.temperature);
      return { on: st.state !== 'off', tone: st.state === 'cool' || a.hvac_action === 'cooling' ? 'cool' : 'heat', button: toggle('climate', 'Turn ' + nameOf(id) + (st.state === 'off' ? ' on' : ' off')), parts: ['step', 'modes'], sections: [
        Number.isFinite(t) && stepper('Target temperature', num(t) + ' °C', act('climate', 'set_temperature', id, { temperature: t - step }), act('climate', 'set_temperature', id, { temperature: t + step })),
        buttons('tfSeg', 'Mode', (a.hvac_modes || []).map((m) => ({ label: cap(m), act: act('climate', 'set_hvac_mode', id, { hvac_mode: m }), pressed: st.state === m }))),
      ] };
    }
    if (d === 'cover') {
      // the blocks, the slats' tilt if it has slats, then open, stop and close
      const moving = st.state === 'opening' || st.state === 'closing', closed = st.state === 'closed', v = coverValue(id), tilt = tiltOf(id);
      return { on: !closed, tone: 'blue', icon: COVER_ICON[coverKind(st)][closed ? 1 : 0], button: toggle('cover', (closed ? 'Open ' : 'Close ') + nameOf(id)), parts: ['blocks', 'tilt', 'buttons'], sections: [
        has(id, SET_POSITION) && blocks(id, v),
        tilt != null && tiltBar(id, tilt),
        coverButtons(id, v, moving),
      ] };
    }
    if (d === 'humidifier') {
      // the target, then its modes
      const h = Number(a.humidity);
      return { on: st.state === 'on', tone: 'blue', icon: 'mdi:air-humidifier', button: toggle('humidifier', 'Turn ' + nameOf(id) + (st.state === 'on' ? ' off' : ' on')), parts: ['step', 'modes'], sections: [
        Number.isFinite(h) && stepper('Target humidity', h + '%', act('humidifier', 'set_humidity', id, { humidity: h - 1 }), act('humidifier', 'set_humidity', id, { humidity: h + 1 })),
        a.available_modes?.length && buttons('tfSeg', 'Mode', a.available_modes.map((m) => ({ label: cap(m), act: act('humidifier', 'set_mode', id, { mode: m }), pressed: a.mode === m }))),
      ] };
    }
    if (d === 'media_player') {
      // artwork in the icon room, then playback, then volume; off shows only the button
      const playing = st.state === 'playing', off = st.state === 'off' || st.state === 'standby', vol = held('vol', id, a.volume_level);
      const button = off ? { act: act('media_player', has(id, TURN_ON) ? 'turn_on' : 'toggle', id), label: 'Turn ' + nameOf(id) + ' on' }
        : st.state === 'playing' || st.state === 'paused' ? { act: act('media_player', 'media_play_pause', id), label: (playing ? 'Pause ' : 'Play ') + nameOf(id) }
          : { act: act('media_player', has(id, TURN_OFF) ? 'turn_off' : 'toggle', id), label: 'Turn ' + nameOf(id) + ' off' };
      return { on: !off, tone: 'blue', art: !off && a.entity_picture ? a.entity_picture : null, button, parts: ['playback', 'volume'], sections: off ? [] : [
        (has(id, PREVIOUS) || has(id, NEXT) || has(id, PAUSE) || has(id, PLAY)) && buttons('tfSeg', 'Playback', [
          { html: MEDIA.prev, aria: 'Previous', act: act('media_player', 'media_previous_track', id), disabled: !has(id, PREVIOUS) },
          { html: playing ? MEDIA.pause : MEDIA.play, aria: playing ? 'Pause' : 'Play', act: act('media_player', 'media_play_pause', id), disabled: !(has(id, PAUSE) || has(id, PLAY)) },
          { html: MEDIA.next, aria: 'Next', act: act('media_player', 'media_next_track', id), disabled: !has(id, NEXT) },
        ]),
        has(id, VOLUME_SET) && vol != null && bar('vol', id, vol, nameOf(id) + ' volume', Math.round(vol * 100) + '%'),
      ] };
    }
    if (d === 'vacuum') {
      // start, dock and locate, then which rooms to clean
      const busy = st.state === 'cleaning', picked = a.rooms || [];
      const toggleRoom = (name) => (picked.includes(name) ? picked.filter((x) => x !== name) : picked.concat(name));
      const go = act('vacuum', busy ? 'pause' : 'start', id, isMadeUp(id) ? { rooms: picked } : null);
      return { on: busy || st.state === 'returning', tone: 'blue', button: { act: go, label: (busy ? 'Pause ' : 'Start ') + nameOf(id) }, parts: ['controls', 'rooms'], sections: [
        buttons('tfSeg', nameOf(id), [
          { label: busy ? 'Pause' : 'Start', act: go },
          { label: 'Dock', act: act('vacuum', 'return_to_base', id), disabled: st.state === 'docked' },
          { label: 'Locate', act: act('vacuum', 'locate', id) },
        ]),
        isMadeUp(id) && buttons('tfChips', 'Rooms to clean', model.rooms.filter((r) => r.id !== 'balcony').map((r) => ({ label: r.name, act: act('vacuum', 'set_rooms', id, { rooms: toggleRoom(r.name) }), pressed: picked.includes(r.name) }))),
      ] };
    }
    if (d === 'lock') {
      // lock, unlock and, if the door can, open it
      const locked = st.state === 'locked';
      return { on: !locked, tone: 'heat', button: { act: act('lock', locked ? 'unlock' : 'lock', id), label: (locked ? 'Unlock ' : 'Lock ') + nameOf(id) }, parts: ['controls'], sections: [
        buttons('tfSeg', nameOf(id), [
          { label: 'Lock', act: act('lock', 'lock', id), pressed: locked },
          { label: 'Unlock', act: act('lock', 'unlock', id), pressed: st.state === 'unlocked' },
          has(id, LOCK_OPEN) && { label: 'Open', act: act('lock', 'open', id), pressed: st.state === 'open' },
        ]),
      ] };
    }
    if (d === 'alarm_control_panel') {
      // off, then each way it can arm
      const off = st.state === 'disarmed';
      return { on: !off, tone: st.state === 'triggered' ? 'alarm' : 'blue', button: { act: act('alarm_control_panel', off ? 'alarm_arm_away' : 'alarm_disarm', id), label: off ? 'Arm ' + nameOf(id) + ', away' : 'Disarm ' + nameOf(id) }, parts: ['controls'], sections: [
        buttons('tfSeg', nameOf(id), ALARM_MODES.filter(([, , , bit]) => !bit || has(id, bit)).map(([state, label, service]) => ({ label, act: act('alarm_control_panel', service, id), pressed: st.state === state }))),
      ] };
    }
    if (d === 'valve') {
      const isOpen = st.state === 'open';
      return { on: isOpen, tone: 'blue', icon: 'mdi:sprinkler-variant', button: toggle('valve', (isOpen ? 'Close ' : 'Open ') + nameOf(id)), parts: ['controls'], sections: [
        buttons('tfSeg', nameOf(id), [
          { label: 'Open', act: act('valve', 'open_valve', id), pressed: isOpen },
          { label: 'Close', act: act('valve', 'close_valve', id), pressed: !isOpen },
        ]),
      ] };
    }
    return { on: false, button: { act: '', label: nameOf(id) }, sections: [] };
  }

  /* area cards: one open, the others folded, like the move panels; Go opens the area's own page. Open, a card shows the
     room's main thing big (its temperature, unless Matt picks another in edit mode), then its controls as tiles */
  const deg = (v) => (Number.isInteger(Number(v)) ? String(Number(v)) : num(v)) + '°';
  // a room's key information, each a reading, a control (with what tapping it does) or an alert
  function roomKeys(r) {
    const find = (cls) => r.readings.find((id) => attr(id).device_class === cls);
    const temp = find('temperature'), hum = find('humidity'), num1 = (id) => Number(states[id]?.state);
    const of = (re) => r.actions.filter((id) => re.test(id));
    const lit = r.lights.filter((id) => states[id]?.state === 'on');
    const covers = of(/^cover\./), open = covers.filter((id) => states[id]?.state !== 'closed');
    const kinds = [...new Set(covers.map((id) => coverKind(states[id])))];
    const climate = of(/^climate\./)[0], humidifier = of(/^humidifier\./)[0];
    const players = of(/^media_player\./), playing = players.find((id) => states[id]?.state === 'playing') || players.find((id) => states[id]?.state === 'paused');
    const plugsOn = r.plugs.filter((id) => states[id]?.state === 'on');
    const keys = [];
    if (temp && Number.isFinite(num1(temp))) keys.push({ key: 'temp', id: temp, kind: 'reading', icon: areaGlyph(temp), label: 'Temperature', value: num(num1(temp)) + '°' });
    if (hum && Number.isFinite(num1(hum))) keys.push({ key: 'hum', id: hum, kind: 'reading', icon: areaGlyph(hum), label: 'Humidity', value: Math.round(num1(hum)) + '%' });
    if (r.lights.length) keys.push({ key: 'lights', kind: 'control', tone: 'light', icon: areaGlyph('', 'mdi:lightbulb'), label: 'Lights', value: lit.length ? lit.length + ' of ' + r.lights.length + ' on' : 'All off', short: lit.length ? lit.length + ' on' : 'Off', on: lit.length > 0, light: lit.length ? lightVars(lit[0]) : '',
      acts: r.lights.map((id) => ['light', lit.length ? 'turn_off' : 'turn_on', id]), aria: (lit.length ? 'Turn off' : 'Turn on') + ' the lights in ' + r.name });
    if (covers.length) {
      const noun = kinds.length === 1 ? COVER_NOUN[kinds[0]] : 'covers', avg = Math.round(covers.reduce((t, id) => t + posOf(id), 0) / covers.length);
      keys.push({ key: 'covers', kind: 'control', tone: 'blue', light: open.length ? colourVars([146, 107, 199]) : '', icon: areaGlyph('', COVER_ICON[kinds[0]]?.[open.length ? 0 : 1] || 'mdi:window-shutter'), label: cap(noun), value: avg <= 0 ? 'Closed' : avg >= 100 ? 'Open' : avg + '% open', short: avg <= 0 ? 'Closed' : avg + '%', on: open.length > 0,
        acts: covers.map((id) => ['cover', open.length ? 'close_cover' : 'open_cover', id]), aria: (open.length ? 'Close the ' : 'Open the ') + noun + ' in ' + r.name });
    }
    if (climate) {
      const a = attr(climate), off = states[climate].state === 'off';
      keys.push({ key: 'climate', kind: 'control', tone: a.hvac_action === 'cooling' ? 'cool' : 'heat', light: kindRgb(climate) ? colourVars(kindRgb(climate)) : '', icon: areaGlyph(climate), label: nameOf(climate), value: off ? 'Off' : cap(a.hvac_action || states[climate].state) + ' · ' + deg(a.temperature), short: off ? 'Off' : deg(a.temperature), on: !off,
        acts: [['climate', 'toggle', climate]], aria: 'Turn ' + nameOf(climate) + (off ? ' on' : ' off') });
    }
    if (humidifier) {
      const on = states[humidifier].state === 'on';
      keys.push({ key: 'humidifier', kind: 'control', tone: 'blue', light: on ? colourVars([33, 150, 243]) : '', icon: areaGlyph('', 'mdi:air-humidifier'), label: nameOf(humidifier), value: on ? 'On · ' + attr(humidifier).humidity + '%' : 'Off', short: on ? attr(humidifier).humidity + '%' : 'Off', on,
        acts: [['humidifier', 'toggle', humidifier]], aria: 'Turn ' + nameOf(humidifier) + (on ? ' off' : ' on') });
    }
    if (players.length) {
      const id = playing || players[0], st = states[id], isOn = st.state === 'playing';
      keys.push({ key: 'media', kind: 'control', tone: 'blue', light: kindRgb(id) ? colourVars(kindRgb(id)) : '', icon: areaGlyph(id), label: nameOf(id), value: valueOf(id), short: isOn ? 'Playing' : st.state === 'paused' ? 'Paused' : cap(st.state), on: isOn,
        acts: [['media_player', st.state === 'playing' || st.state === 'paused' ? 'media_play_pause' : 'toggle', id]], aria: (isOn ? 'Pause ' : 'Play ') + nameOf(id) });
    }
    if (r.plugs.length) keys.push({ key: 'plugs', kind: 'control', tone: 'blue', light: plugsOn.length ? colourVars([255, 193, 7]) : '', icon: areaGlyph('', 'mdi:power-plug'), label: 'Plugs', value: plugsOn.length ? plugsOn.length + ' of ' + r.plugs.length + ' on' : 'All off', short: plugsOn.length ? plugsOn.length + ' on' : 'Off', on: plugsOn.length > 0,
      acts: r.plugs.map((id) => ['switch', plugsOn.length ? 'turn_off' : 'turn_on', id]), aria: (plugsOn.length ? 'Turn off' : 'Turn on') + ' the plugs in ' + r.name });
    // a leak is an alert, in red; an open door or window is only worth a note, never red (Matt, 27 Oct: the balcony door)
    r.alerts.forEach((id) => keys.push(attr(id).device_class === 'moisture' ? { key: 'alert:' + id, kind: 'alert', icon: areaGlyph(id), label: 'Water leak' }
      : { key: 'note:' + id, kind: 'note', icon: areaGlyph(id), label: nameOf(id) + ' ' + valueOf(id).toLowerCase() }));
    return keys;
  }
  // the devices a room's key stands for
  const groupIds = (r, key) => {
    const of = (re) => r.actions.filter((id) => re.test(id));
    return ({ lights: r.lights, covers: of(/^cover\./), climate: of(/^climate\./).slice(0, 1), humidifier: of(/^humidifier\./).slice(0, 1), plugs: r.plugs,
      media: (() => { const players = of(/^media_player\./); return [players.find((id) => states[id]?.state === 'playing') || players.find((id) => states[id]?.state === 'paused') || players[0]].filter(Boolean); })() })[key] || [];
  };
  const keyButton = (k, cls, inner) => '<button class="' + cls + (k.on ? ' on' : '') + '" type="button" data-tone="' + k.tone + '" data-acts="' + acts(k.acts) + '" aria-label="' + esc(k.aria) + '" aria-pressed="' + k.on + '">' + inner + '</button>';
  // the room's name opens its page (Matt, 28 Oct: the title is the link; there's no Go any more)
  const areaTitle = (r) => '<button class="tfAName" type="button" data-go="' + esc(r.id) + '" aria-label="Open ' + esc(r.name) + '">' + esc(r.name) + '</button>';
  // the room's own icon (its area's in Home Assistant, else Home Assistant's own area icon), the button for its lights
  // (Matt, 28 Oct, Figma "Area card accordions v04" 521:9673), always grey for now. A room without lights, and a folded
  // card, only show it
  function areaIcon(r, keys, folded = false) {
    // no colour on a room's icon for now (Matt, 1 Nov: generic this round): the grey chip and muted glyph, lights on or
    // off; the button still turns the room's lights on and off
    const k = keys.find((x) => x.key === 'lights'), on = Boolean(k?.on), lit = '';
    const glyph = '<span class="tfAreaGlyph"' + iconSlot('area:' + r.id, r.icon || 'mdi:texture-box', r.name) + '></span>';
    if (folded || !k) return '<span class="tfIcon tfAreaIcon' + (on ? ' on' : '') + '"' + lit + ' aria-hidden="true">' + glyph + '</span>';
    return '<button class="tfIcon tfAreaIcon' + (on ? ' on' : '') + '" type="button"' + lit + ' data-acts="' + acts(k.acts) + '" aria-label="' + esc(k.aria) + '" aria-pressed="' + on + '">' + glyph + '</button>';
  }
  const alertTags = (keys) => keys.filter((k) => k.kind === 'alert' || k.kind === 'note').map((k) => '<span class="sourceTag">' + esc(k.label) + '</span>').join(' ');
  // a room's main: its temperature, else its first reading, else its first device
  const mainOf = (r) => r.readings.find((id) => attr(id).device_class === 'temperature') || [...r.readings, ...r.solar, ...r.openings, ...r.actions, ...r.plugs].find((id) => states[id]) || null;
  // a name without its room's ("Living room humidity" in the living room is "Humidity")
  const inRoom = (r, id) => { const n = nameOf(id); return n.toLowerCase().startsWith(r.name.toLowerCase() + ' ') ? cap(n.slice(r.name.length + 1)) : n; };
  // the main as a headline: a number and its unit, or a word
  function headline(id) {
    const st = states[id], a = attr(id), d = id.split('.')[0], n = Number(st.state);
    if (st.state === 'unavailable') return { text: 'Unavailable' };
    if (d === 'sensor' && Number.isFinite(n)) {
      if (a.device_class === 'temperature') return { text: deg(n) };
      const unit = a.unit_of_measurement || '';
      return unit === '%' ? { text: Math.round(n) + '%' } : { text: num(n, Number.isInteger(n) ? 0 : 1), unit };
    }
    if (d === 'climate' && (a.current_temperature ?? a.temperature) != null) return { text: deg(a.current_temperature ?? a.temperature) };
    if (d === 'light') return { text: st.state !== 'on' ? 'Off' : dimmable(id) ? brightnessOf(st) + '%' : 'On' };
    if (d === 'cover') { const p = posOf(id); return { text: p <= 0 ? 'Closed' : p >= 100 ? 'Open' : p + '%' }; }
    if (d === 'humidifier') return { text: st.state === 'on' ? a.humidity + '%' : 'Off' };
    if (d === 'media_player') return { text: st.state === 'playing' ? 'Playing' : st.state === 'paused' ? 'Paused' : cap(st.state) };
    return { text: valueOf(id) };
  }
  // under the headline: what it is (the temperature needs no name) and the room's other readings; a thermostat's says
  // what it's doing in place of the room's temperature, so there aren't two temperatures
  const mainSub = (r, id, keys) => {
    const t = keys.find((k) => k.key === 'temp'), h = keys.find((k) => k.key === 'hum'), a = attr(id), off = states[id].state === 'off';
    if (id.startsWith('climate.')) return [inRoom(r, id), off ? 'Off' : cap(a.hvac_action || states[id].state) + (a.temperature != null ? ' · ' + deg(a.temperature) : ''), h && h.value + ' humidity'].filter(Boolean).join(' · ');
    return [!(t && t.id === id) && inRoom(r, id), t && t.id !== id && t.value, h && h.id !== id && h.value + ' humidity'].filter(Boolean).join(' · ');
  };
  // the open card: the room's icon (its lights) and name (its page), with any alerts; the main, which opens its
  // more-info; up to four controls as tiles, the icon the button
  function areaBody(r, keys, main) {
    const h = main && headline(main), sub = main ? mainSub(r, main, keys) : '';
    // the icon is the button; the name and value open what the tile stands for: a room's lights, covers or plugs as a
    // group, one device as its own more-info (Matt, 27 Oct)
    const opens = (k) => { const ids = groupIds(r, k.key); return ids.length === 1 ? ids[0] : 'group:' + r.id + ':' + k.key; };
    const tiles = keys.filter((k) => k.kind === 'control').slice(0, 4).map((k) => '<div class="tfATile' + (k.on ? ' on' : '') + '" data-tone="' + k.tone + '"' + (k.light ? ' data-light style="' + k.light + '"' : '') + '>' + keyButton(k, 'tfIcon', k.icon) +
      '<button class="tfName" type="button" data-more="' + esc(opens(k)) + '" aria-label="' + esc(r.name + ' ' + k.label.toLowerCase() + ', ' + k.value + '. Open') + '"><span class="activityRowName">' + esc(k.label) + '</span><span class="activityRowMeta">' + esc(k.value) + '</span></button></div>');
    // its notes (an open door, a leak) sit in the card's top right corner, so they never push the reading down (Matt, 8 Nov)
    const tags = alertTags(keys);
    return '<div class="workoutPanelTop">' + areaIcon(r, keys) + '<div class="tfATitle">' + areaTitle(r) + '</div>' + (tags ? '<div class="tfATags">' + tags + '</div>' : '') + '</div>' +
      (main ? '<button class="tfABig" type="button" data-more="' + esc(main) + '" aria-label="' + esc(nameOf(main) + ', ' + valueOf(main) + '. More info') + '">' +
        '<span class="tfABigMain' + (h.text.length > 7 ? ' long' : '') + '">' + esc(h.text) + (h.unit ? '<span class="tfABigUnit">' + esc(h.unit) + '</span>' : '') + '</span>' +
        (sub ? '<span class="tfABigSub">' + esc(sub) + '</span>' : '') + '</button>' : '') +
      (tiles.length ? '<div class="tfATiles">' + tiles.join('') + '</div>' : '');
  }
  function areaPanel(r) {
    const isActive = r.id === activeArea, keys = roomKeys(r), main = mainOf(r), h = main && headline(main);
    // a folded card's content can't be reached until it's open. Folded (Matt's Figma "Area card accordions v04" 521:9673,
    // 28 Oct): the room's icon with its name under it, cut with "…" when it doesn't fit; the main; then the room's control
    // icons two by two (an alert after them, in red; an open door or window plain); tapping anywhere opens it
    const chips = [...keys.filter((k) => k.kind === 'control'), ...keys.filter((k) => k.kind !== 'control' && k.kind !== 'reading')].slice(0, 4);
    return '<article class="workoutPanel tfAreaPanel' + (isActive ? ' active' : '') + '" data-area="' + esc(r.id) + '" tabindex="0" aria-expanded="' + isActive + '" aria-label="' + esc(r.name) + '">' +
      '<div class="panelExpanded"' + (isActive ? '' : ' inert') + '>' + areaBody(r, keys, main) + '</div>' +
      '<div class="panelCollapsed tfACollapsed"><div class="tfACTop">' + areaIcon(r, keys, true) + '<span class="tfACName">' + esc(r.name) + '</span></div>' +
      '<span class="tfACMain">' + (h ? esc(h.text + (h.unit ? ' ' + h.unit : '')) : '') + '</span>' +
      '<span class="tfACTiles" aria-hidden="true">' + chips.map((k) => '<span class="tfACTile"><span class="tfIcon' + (k.kind === 'alert' ? ' alert' : '') + '"' + (k.on && k.light ? ' data-light style="' + k.light + '"' : '') + '>' + k.icon + '</span></span>').join('') + '</span></div></article>';
  }
  let areaRooms = []; // the rooms with area cards, in Matt's order
  const areasHtml = (order) => '<div class="tfAreas" data-tf data-k="areas" style="order:' + order + '">' +
    '<section class="workoutGallery tfAreaGallery" aria-label="Areas">' + areaRooms.map(areaPanel).join('') + '</section></div>';
  /* one room on its own (Tile · Room, Matt, 6 Nov; Figma 954:6176): a tile added from the edit tray instead of the Areas
     card, keyed room:<area>. The head is the room's icon and name; XS its reading in the head, S the reading big, M its
     devices too (up to four), L and XL the reading bigger with its second under it. It never opens out: the tile opens
     the room's page, and each device button that device's control (one device its own, a room's lights or covers as a
     group) */
  const isRoomKey = (key) => key.startsWith('room:');
  const roomOf = (key) => areaRooms.find((r) => 'room:' + r.id === key);
  function roomTile(r, key) {
    const keys = roomKeys(r), main = mainOf(r), h = main && headline(main), sub = main ? mainSub(r, main, keys) : '';
    const big = h ? h.text + (h.unit ? ' ' + h.unit : '') : '';
    const opens = (k) => { const ids = groupIds(r, k.key); return ids.length === 1 ? ids[0] : 'group:' + r.id + ':' + k.key; };
    const controls = keys.filter((k) => k.kind === 'control').slice(0, 4), lit = (k) => (k.on && k.light ? ' data-light style="' + k.light + '"' : '');
    const devices = controls.map((k) => '<button class="tfIcon' + (k.on ? ' on' : '') + '" type="button" data-tone="' + k.tone + '"' + lit(k) +
      ' data-more="' + esc(opens(k)) + '" aria-label="' + esc(k.label + ', ' + k.value + '. Open its controls') + '">' + k.icon + '</button>');
    // wide, the same devices as heads (icon, name, state), as the open room shows them (Matt, 6 Nov; Figma 954:6297)
    const heads = controls.map((k) => '<button class="tfRoomDev" type="button" data-more="' + esc(opens(k)) + '" aria-label="' + esc(k.label + ', ' + k.value + '. Open its controls') + '">' +
      '<span class="tfIcon' + (k.on ? ' on' : '') + '" data-tone="' + k.tone + '"' + lit(k) + '>' + k.icon + '</span><span class="tfRoomDevName"><span class="activityRowName">' + esc(k.label) + '</span><span class="activityRowMeta">' + esc(k.value) + '</span></span></button>');
    return '<div class="tfAction tfRoomTile" data-k="' + esc(key) + '" data-go="' + esc(r.id) + '">' +
      '<div class="tfActionHead"><span class="tfIcon tfRoomIcon" aria-hidden="true"><span class="tfAreaGlyph"' + iconSlot('area:' + r.id, r.icon || 'mdi:texture-box', r.name) + '></span></span>' +
      '<button class="tfName" type="button" data-go="' + esc(r.id) + '" aria-label="Open ' + esc(r.name) + '"><span class="activityRowName">' + esc(r.name) + '</span>' +
      (big || sub ? '<span class="activityRowMeta">' + (big ? '<span class="tfRoomInline">' + esc(big) + (sub ? ' · ' : '') + '</span>' : '') + esc(sub) + '</span>' : '') + '</button></div>' +
      (big ? '<div class="tfRoomReading" aria-hidden="true"><span class="tfRoomBig">' + esc(big) + '</span>' + (sub ? '<span class="tfRoomSub">' + esc(sub) + '</span>' : '') + '</div>' : '') +
      (devices.length ? '<div class="tfRoomDevices">' + devices.join('') + '</div><div class="tfRoomHeads">' + heads.join('') + '</div>' : '') + '</div>';
  }

  /* sections: Home and each room, with their devices as Home Assistant has them (Security is a summary's popup, Matt
     29 Oct) */
  const sectionsOf = () => [
    { key: 'home', name: 'Home', ids: model.homeVacuums },
    ...model.rooms.map((r) => ({ key: 'room:' + r.id, name: r.name, room: r, ids: r.actions })),
  ];

  /* favourites and summaries, as on Home Assistant's home view */
  const count = (n, one, many) => n + ' ' + (n === 1 ? one : many);
  const starred = () => (prefs.favourites ?? haHome.favorite_entities ?? []).filter((id) => states[id]);
  // suggestions: Home Assistant's, then what's used most here, then what's on, then the rest of the rooms' devices
  function suggestionIds() {
    if (!suggested) {
      const most = Object.entries(used).sort((a, b) => b[1] - a[1]).map(([id]) => id);
      const actions = model.rooms.flatMap((r) => r.actions);
      suggested = [...new Set([...predicted, ...most, ...actions.filter((id) => specFor(id).on), ...actions])];
    }
    const stars = starred();
    return suggested.filter((id) => states[id] && states[id].state !== 'unavailable' && !stars.includes(id));
  }
  // the favourites start, once, with Home Assistant's home ones, then the made-up thermostat, curtains and watering, and
  // a lock (Matt, 28 Oct); after that the list is his, edited in the dashboard's edit tray like Home Assistant's
  let prefsReady = false;
  function seedFavourites() {
    if (!prefsReady || prefs.favSeeded || !model.rooms.length) return;
    const first = (test) => Object.keys(states).find((id) => isMadeUp(id) && test(id));
    const made = [first((id) => id.startsWith('climate.')), first((id) => id.startsWith('cover.') && /curtain/.test(id)), first((id) => id.startsWith('valve.')), model.security.locks[0]];
    prefs = { ...prefs, favourites: [...new Set([...(prefs.favourites ?? haHome.favorite_entities ?? []), ...made.filter(Boolean)])], favSeeded: true };
    savePrefs();
  }
  // the dashboard's Favourites: the favourites in their order, less those hidden to the edit tray; then, with Show
  // suggestions on, suggestions from the dashboard's rooms to fill the card
  const suggestOn = () => prefs.suggest ?? !haHome.hide_suggested_entities;
  function dashFavourites() {
    const hidden = new Set(prefs.favHidden || []), stars = starred().filter((id) => !hidden.has(id));
    const fill = suggestOn() ? suggestionIds().filter((id) => !hidden.has(id) && dashLight(id)) : [];
    return [...stars, ...fill].slice(0, DASH_FAVOURITES);
  }
  // starred first, then suggestions up to 8
  function favouriteIds(most = 8) {
    const stars = starred();
    if (haHome.hide_suggested_entities) return stars;
    return [...stars, ...suggestionIds()].slice(0, Math.max(most, stars.length));
  }
  const starButton = (id) => {
    const on = starred().includes(id);
    return '<button class="tfStar" type="button" data-star="' + esc(id) + '" aria-pressed="' + on + '" aria-label="Favourite: ' + esc(nameOf(id)) + '">' + STAR(on) + '</button>';
  };
  // a device as a tile in a card: its icon is the button where it has one, and its name opens more-info. Favourites
  // add the room; the favourites list gives a star instead of the button. Plain: no button, and what it says can be
  // given (Maintenance's vacuum is just its battery), and it goes by its device's name, as Home Assistant's
  // Maintenance page names a battery ("Back door sensor", not "Back door sensor Battery"); alert: what it says is in
  // the danger colour
  function deviceRow(id, { area = false, star = false, plain = false, say = null, alert = false } = {}) {
    const dev = plain && getHass()?.devices?.[getHass()?.entities?.[id]?.device_id];
    const name = (dev && (dev.name_by_user || dev.name)) || nameOf(id);
    const d = id.split('.')[0], spec = !plain && ACTION_DOMAINS.includes(d) ? specFor(id) : null;
    const on = spec ? spec.on : ['on', 'open', 'playing'].includes(states[id]?.state);
    const button = plain ? null : spec ? spec.button
      : TOGGLES.includes(d) ? { act: act(d, 'toggle', id), label: 'Turn ' + nameOf(id) + (on ? ' off' : ' on') }
        : d === 'scene' || d === 'script' ? { act: act(d, 'turn_on', id), label: 'Run ' + nameOf(id) } : null;
    const meta = (say ?? valueOf(id)) + (area && whereIs.get(id) ? ' · ' + whereIs.get(id) : '');
    const icon = spec?.icon || iconFor(id);
    return '<div class="activityRow' + (button ? ' tfPlug' : '') + (on ? ' on' : '') + (star ? ' tfPick' : '') + (alert ? ' alert' : '') + '" data-k="' + esc((area ? 'fav:' : 'row:') + id) + '" data-tone="' + (d === 'light' ? 'light' : spec?.tone || 'blue') + '"' + lightAttrs(id) + '>' +
      (button && !star ? '<button class="tfIcon" type="button" data-act="' + button.act + '" aria-label="' + esc(button.label) + '"' + iconSlot(id, icon) + '></button>' : '<div class="tfIcon" aria-hidden="true"' + iconSlot(id, icon) + '></div>') +
      '<button class="tfName" type="button" data-more="' + esc(id) + '" aria-label="' + esc(name + ', ' + meta + '. More info') + '"><span class="activityRowName">' + esc(name) + '</span><span class="activityRowMeta">' + esc(meta) + '</span></button>' +
      (star ? starButton(id) : '') + '</div>';
  }
  const weatherId = () => (states[prefs.sources?.weather] ? prefs.sources.weather : states['weather.forecast_home'] ? 'weather.forecast_home' : Object.keys(states).find((x) => x.startsWith('weather.')));
  // the security summary's alerts: Home Assistant's alert sensors, or this page's (leaks and smoke alert; doors and
  // windows warn)
  function alertList() {
    const bin = (classes) => Object.keys(states).filter((id) => id.startsWith('binary_sensor.') && classes.includes(attr(id).device_class));
    const set = haSecurity.alert_entities?.length ? haSecurity.alert_entities
      : [...bin(['moisture', 'smoke', 'gas']).map((entity) => ({ entity, severity: 'alert' })), ...bin(OPEN_CLASSES).map((entity) => ({ entity, severity: 'warning' }))];
    return set.filter((x) => states[x.entity]).map((x) => ({ ...x, on: ['on', 'open', 'unlocked', 'triggered', 'problem'].includes(states[x.entity].state) }));
  }
  // Home Assistant's order for the summaries, and any shortcuts Matt added there (its resolveShortcutItems)
  function shortcutItems() {
    const keys = Object.keys(SUMMARIES), seen = new Set(), out = [];
    (haHome.shortcuts || []).forEach((it) => {
      if (it.type === 'summary') { if (!keys.includes(it.key) || seen.has(it.key)) return; seen.add(it.key); }
      out.push(it);
    });
    keys.forEach((key) => { if (!seen.has(key)) out.push({ type: 'summary', key }); });
    return out;
  }
  // Maintenance (Matt, 29 Oct): counted as Home Assistant counts it (batteries at 20% or under that aren't charging,
  // battery and problem sensors that are on, any of them unavailable), plus plants that need care and a vacuum that's
  // low and away from its dock. What needs attention comes first, then everything else by room, the room order the
  // dashboard's; a vacuum is just its battery there
  function maintenanceData() {
    const ents = getHass()?.entities || {}, dc = (id) => attr(id).device_class;
    const sensors = Object.keys(states).filter((id) => (id.startsWith('sensor.') && dc(id) === 'battery') || (id.startsWith('binary_sensor.') && ['battery', 'problem'].includes(dc(id))));
    const plants = model.rooms.flatMap((r) => r.plants.map((p) => p.id));
    if (!sensors.length && !plants.length) return null;
    const charging = (id) => {
      const dev = ents[id]?.device_id;
      return Boolean(dev) && Object.keys(states).some((x) => x.startsWith('binary_sensor.') && ents[x]?.device_id === dev && dc(x) === 'battery_charging' && states[x].state === 'on');
    };
    const isLow = (id) => (id.startsWith('vacuum.') ? attr(id).battery_level <= 20 && states[id].state !== 'docked'
      : id.startsWith('binary_sensor.') ? dc(id) === 'battery' && states[id].state === 'on'
        : parseFloat(states[id].state) <= 20 && !charging(id));
    const low = [...sensors, ...model.vacuums].filter((id) => states[id] && isLow(id));
    const problems = [...sensors.filter((id) => dc(id) === 'problem' && states[id].state === 'on'), ...plants.filter((id) => states[id]?.state === 'problem')];
    const gone = sensors.filter((id) => states[id].state === 'unavailable');
    const attention = [...new Set([...low, ...problems, ...gone])];
    // the rest: plants, the vacuum, batteries lowest first, then problem sensors
    const level = (id) => { const n = parseFloat(states[id].state); return dc(id) === 'battery' && Number.isFinite(n) ? n : 101; };
    const rest = [...plants, ...model.vacuums, ...[...sensors].sort((a, b) => level(a) - level(b))].filter((id) => states[id] && !attention.includes(id));
    const byRoom = new Map();
    rest.forEach((id) => { const a = model.areaOf?.(id) || ''; byRoom.set(a, [...(byRoom.get(a) || []), id]); });
    const rank = (a) => { const i = model.rooms.findIndex((r) => r.id === a); return a === '' ? Infinity : i < 0 ? model.rooms.length : i; };
    const rooms = [...byRoom.keys()].sort((a, b) => rank(a) - rank(b));
    const roomName = (a) => model.rooms.find((r) => r.id === a)?.name || getHass()?.areas?.[a]?.name || a;
    return {
      value: [low.length && count(low.length, 'low battery', 'low batteries'), problems.length && count(problems.length, 'problem', 'problems'), gone.length && count(gone.length, 'unavailable device', 'unavailable devices')].filter(Boolean).join(', ') || 'All good',
      plain: true,
      groups: [{ name: 'Needs attention', ids: attention, alert: true }, ...rooms.map((a) => ({ name: a ? roomName(a) : rooms.length > 1 ? 'Other devices' : 'Devices', ids: byRoom.get(a) }))].filter((g) => g.ids.length),
    };
  }
  // each summary's line, worked out as Home Assistant's summary card does, and the devices it opens to
  function summaryData() {
    const rooms = model.rooms, sec = model.security, of = (r, re) => r.actions.filter((id) => re.test(id));
    const groups = (pick) => rooms.map((r) => ({ name: r.name, ids: pick(r) })).filter((g) => g.ids.length);
    const lights = rooms.flatMap((r) => r.lights), lit = lights.filter((id) => states[id]?.state === 'on').length;
    const temps = rooms.map((r) => r.readings.find((id) => attr(id).device_class === 'temperature')).filter(Boolean).map((id) => Number(states[id].state)).filter(Number.isFinite);
    const [lo, hi] = [num(Math.min(...temps)), num(Math.max(...temps))];
    const players = rooms.flatMap((r) => of(r, /^media_player\./)), playing = players.filter((id) => states[id]?.state === 'playing').length;
    const alerts = alertList(), warnings = alerts.filter((x) => x.severity === 'warning' && x.on).length;
    const unlocked = sec.locks.filter((id) => ['unlocked', 'jammed', 'open'].includes(states[id]?.state)).length;
    const disarmed = sec.alarms.filter((id) => states[id]?.state === 'disarmed').length;
    const warnText = warnings ? count(warnings, 'warning', 'warnings') : null;
    const secText = unlocked ? unlocked + ' unlocked' : disarmed ? disarmed + ' disarmed' : warnText ? null : 'All secure';
    const maint = maintenanceData();
    const solar = rooms.flatMap((r) => r.solar), solarNow = solar.find((id) => id.endsWith('_power'));
    const all = {
      light: lights.length && { value: lit ? lit + ' on' : 'All off', groups: groups((r) => r.lights) },
      climate: temps.length && { value: lo === hi ? lo + '°' : lo + ' - ' + hi + '°', groups: groups((r) => [...r.readings.filter((id) => ['temperature', 'humidity'].includes(attr(id).device_class)), ...of(r, /^(climate|humidifier)\./)]) },
      security: (sec.alarms.length || sec.locks.length) && { value: [warnText, secText].filter(Boolean).join(', '), groups: [{ name: 'Alarm and locks', ids: [...sec.alarms, ...sec.locks] }, { name: 'Doors and windows', ids: sec.openings }].filter((g) => g.ids.length) },
      media_players: players.length && { value: playing ? playing + ' playing' : 'No media playing', groups: groups((r) => of(r, /^media_player\./)) },
      maintenance: maint,
      energy: model.grid && { value: watts(Number(states[solarNow]?.state || 0) * 1000 + Number(states[model.grid].state)) + ' now', groups: [{ name: 'Energy', ids: [...solar, model.grid] }] },
    };
    const out = [];
    const active = alerts.filter((x) => x.severity !== 'warning' && x.on);
    if (active.length) out.push({ key: 'alerts', name: 'Alerts', icon: 'mdi:alarm-plus', colour: '#f44336', value: count(active.length, 'active alert', 'active alerts'), groups: [{ name: 'Active', ids: active.map((x) => x.entity) }] });
    shortcutItems().forEach((it) => {
      if (it.type !== 'summary') out.push({ key: 'path:' + it.path, name: it.label || it.path, icon: it.icon || 'mdi:link-variant', colour: '', value: '' });
      else if (!it.hidden && all[it.key] && !(prefs.hiddenSums || []).includes(it.key)) out.push({ key: it.key, ...SUMMARIES[it.key], ...all[it.key] });
    });
    return out;
  }
  const summaryRow = (s) => '<div class="activityRow tap tfSum" role="button" tabindex="0" data-summary="' + esc(s.key) + '" data-k="sum:' + esc(s.key) + '" aria-label="' + esc(s.name + (s.value ? ', ' + s.value : '')) + '"' + (s.key === 'alerts' ? ' style="--sum:' + s.colour + ';--sum-ink:#ffffff"' : s.key === 'climate' ? ' style="' + climateVars() + '"' : s.colour && sumInk(s.colour) ? ' style="' + sumInk(s.colour).slice(1) + '"' : '') + '>' +
    (s.key === 'climate' ? CLIMATE_DEFS : '') + '<div class="tfIcon" aria-hidden="true"' + iconSlot(s.id || '', s.icon, s.name) + '></div>' +
    '<div><div class="activityRowName">' + esc(s.name) + '</div>' + (s.value ? '<div class="activityRowMeta">' + esc(s.value) + '</div>' : '') + '</div></div>';
  function toggleStar(id) {
    const list = starred();
    prefs = { ...prefs, favourites: list.includes(id) ? list.filter((x) => x !== id) : [...list, id], favHidden: (prefs.favHidden || []).filter((x) => x !== id) };
    savePrefs();
    refresh();
  }
  // a shortcut Matt added on Home Assistant's home view goes where it points
  function go(path) {
    if (!document.querySelector('home-assistant')) return;
    history.pushState(null, '', path);
    window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: false } }));
  }
  function openSummary(key, opener) {
    if (key.startsWith('path:')) { go(key.slice(5)); return; }
    openMore('summary:' + key, opener);
  }
  // saved favourites, Home Assistant's home view and security settings, and its suggested devices
  async function loadPrefs() {
    const get = (msg) => Promise.resolve().then(() => callWS(msg)).catch(() => null);
    const [mine, home, security, usage] = await Promise.all([
      get({ type: 'frontend/get_user_data', key: HOUSE_KEY }),
      get({ type: 'frontend/get_system_data', key: 'home' }),
      get({ type: 'frontend/get_system_data', key: 'security' }),
      get({ type: 'usage_prediction/common_control' }),
    ]);
    // edit mode's old choices (sections, order, sizes…) are left behind: the page is laid out as Home Assistant has it
    const v = mine?.value || {};
    prefs = { favourites: v.favourites ?? null, sources: v.sources, hiddenSums: v.hiddenSums, dash: v.dash, named: v.named, favHidden: v.favHidden, suggest: v.suggest, favSeeded: v.favSeeded };
    haHome = home?.value || {};
    haSecurity = security?.value || {};
    predicted = Array.isArray(usage?.entities) ? usage.entities : [];
    suggested = null;
    if (Object.keys(states).length) refresh();
    nameDashboard();
    prefsReady = true;
    seedFavourites();
  }
  // the sidebar calls this page HomeCore (Matt, 28 Oct). A sidebar entry's name is its dashboard's title, kept in Home
  // Assistant rather than in the card, so the card names its own dashboard: once (a dashboard renamed afterwards is left
  // alone), only a dashboard of just this page, and only for an admin, as Home Assistant allows no one else
  const SIDEBAR_NAME = 'HomeCore';
  async function nameDashboard() {
    const path = location.pathname.split('/')[1], named = prefs.named || [];
    if (!getHass()?.user?.is_admin || !path || named.includes(path)) return;
    const remember = () => { prefs = { ...prefs, named: [...named, path] }; savePrefs(); };
    try {
      const board = (await callWS({ type: 'lovelace/dashboards/list' }))?.find((d) => d.url_path === path);
      if (!board || board.mode === 'yaml') return;
      if (board.title === SIDEBAR_NAME) { remember(); return; }
      const config = await callWS({ type: 'lovelace/config', url_path: path });
      const cards = (config?.views || []).flatMap((v) => [...(v.cards || []), ...(v.sections || []).flatMap((s) => s.cards || [])]);
      if (!cards.length || !cards.every((c) => c?.type === 'custom:move-assistant-card' && c.layout === 'test-focus')) return;
      await callWS({ type: 'lovelace/dashboards/update', dashboard_id: board.id, title: SIDEBAR_NAME });
      remember();
    } catch { /* not allowed, or no such dashboard: its name stays as it is */ }
  }

  /* ---------- the dashboard (Matt, 27 Oct) ----------
     After the HomeCore concept (Figma "Visual Design Language" 1851:906), with this page's parts at their drawn sizes
     (Figma "Spacing rules"), never the concept's spacing: the home's name, the summaries, the weather card and the areas,
     then Favourites, Activity, Energy today and Compared to average, then lights and thermostats. No labels above
     anything; a card has its title inside where the concept has one. Settings → Appearance → Home picks it or the
     house page */
  // Activity: the latest change to each of the house's devices, from Home Assistant's logbook (who did it and when);
  // what changed since then comes from the devices themselves, and without a logbook (the dev preview) everything does
  let logbook = null, logbookAt = 0, logbookBusy = false;
  const followed = (id) => { const d = id.split('.')[0], dc = attr(id).device_class; return ACTIVITY_DOMAINS.includes(d) && (d !== 'binary_sensor' || OPEN_CLASSES.includes(dc) || Boolean(ALARM_CLASSES[dc])); };
  const alarmOf = (id) => (id.startsWith('binary_sensor.') ? ALARM_CLASSES[attr(id).device_class] : null);
  async function loadActivity() {
    if (logbookBusy || Date.now() - logbookAt < 30 * 1000) return;
    logbookBusy = true;
    logbookAt = Date.now();
    try {
      const ids = Object.keys(getHass()?.states || {}).filter(followed);
      const res = ids.length ? await callWS({ type: 'logbook/get_events', start_time: new Date(Date.now() - 24 * 3600 * 1000).toISOString(), end_time: new Date().toISOString(), entity_ids: ids }) : null;
      logbook = Array.isArray(res) ? res.filter((e) => e.entity_id && e.state != null && e.when) : null;
    } catch (_e) { logbook = null; }
    logbookBusy = false;
    refresh();
  }
  // an alarm is its own row for the day, from when it last went off, with when it cleared after that; everything else is
  // each device's latest change
  function activityItems() {
    const latest = new Map(), alarms = new Map();
    const note = (e) => {
      if (!states[e.entity_id] || !followed(e.entity_id) || !dashLight(e.entity_id) || ['unavailable', 'unknown'].includes(e.state)) return;
      if (alarmOf(e.entity_id)) {
        const a = alarms.get(e.entity_id);
        if (e.state === 'on') { if (!a || e.when > a.when + 1) alarms.set(e.entity_id, { ...e, alarm: true, cleared: null }); }
        else if (a && !a.cleared && e.when > a.when) a.cleared = e.when;
        return;
      }
      const was = latest.get(e.entity_id);
      if (!was || e.when > was.when + 1) latest.set(e.entity_id, e);
    };
    [...(logbook || [])].sort((a, b) => a.when - b.when).forEach(note);
    const since = logbook ? logbookAt / 1000 - 5 : 0;
    Object.keys(states).forEach((id) => {
      const st = states[id], when = st.last_changed ? Date.parse(st.last_changed) / 1000 : 0;
      if (when > since) note({ entity_id: id, state: st.state, when, context_user_id: st.context?.user_id });
    });
    return [...latest.values(), ...alarms.values()].sort((a, b) => b.when - a.when).slice(0, ACTIVITY_MOST);
  }
  // who: the person with that user, else the automation or script that did it
  function whoDid(e) {
    const person = e.context_user_id && Object.keys(states).find((id) => id.startsWith('person.') && attr(id).user_id === e.context_user_id);
    if (person) return nameOf(person);
    const user = getHass()?.user;
    if (user && e.context_user_id === user.id) return user.name;
    if (['automation', 'script'].includes(e.context_domain) || e.context_event_type === 'automation_triggered') return e.context_name || 'Home Assistant';
    return '';
  }
  function didWhat(e) {
    const d = e.entity_id.split('.')[0], s = String(e.state);
    if (d === 'lock') return { locked: 'locked', unlocked: 'unlocked', open: 'opened', jammed: 'jammed', locking: 'locking', unlocking: 'unlocking' }[s] || cap(s).toLowerCase();
    if (d === 'cover' || d === 'valve') return { open: 'opened', closed: 'closed', opening: 'opening', closing: 'closing' }[s] || cap(s).toLowerCase();
    if (d === 'binary_sensor') return s === 'on' ? 'opened' : 'closed';
    if (d === 'climate') return s === 'off' ? 'turned off' : 'set to ' + cap(s).toLowerCase();
    if (d === 'media_player') return { playing: 'started playing', paused: 'paused', idle: 'stopped', off: 'turned off', standby: 'turned off', on: 'turned on' }[s] || cap(s).toLowerCase();
    if (d === 'alarm_control_panel') return (ALARM_STATE[s] || cap(s)).toLowerCase();
    if (d === 'vacuum') return { cleaning: 'started cleaning', docked: 'docked', returning: 'went home', paused: 'paused', idle: 'stopped' }[s] || cap(s).toLowerCase();
    return s === 'on' ? 'turned on' : s === 'off' ? 'turned off' : cap(s).toLowerCase();
  }
  // a row opens its device with its day, this moment marked (data-at)
  function activityRow(e) {
    const id = e.entity_id, alarm = e.alarm && alarmOf(id);
    const what = nameOf(id) + ' ' + (alarm ? alarm[0] : didWhat(e));
    const meta = alarm ? clock(e.when * 1000) + (e.cleared ? ' · ' + alarm[1] + ' since ' + clock(e.cleared * 1000) : '') : [whoDid(e), clock(e.when * 1000)].filter(Boolean).join(' · ');
    return '<div class="activityRow' + (alarm ? ' alert' : '') + '"><div class="tfIcon' + (alarm ? ' alert' : '') + '" aria-hidden="true"' + iconSlot(id, iconFor(id)) + '></div>' +
      '<button class="tfName" type="button" data-more="' + esc(id) + '" data-at="' + Math.round(e.when * 1000) + '" aria-label="' + esc(what + ', ' + meta + '. More info') + '"><span class="activityRowName">' + esc(what) + '</span><span class="activityRowMeta">' + esc(meta) + '</span></button></div>';
  }
  // Energy today: Home Assistant's energy dashboard where it's set up (each source's use since midnight); otherwise
  // made up, as the house makes up what it doesn't have. A tile opens to its graph, like a reading
  let energy = null, energyAt = 0;
  // Solar too (Matt, 9 Nov), in Home Assistant's order: the house's own solar today when it has one
  const MADE_UP_ENERGY = [['electricity', 'Electricity', 4.3, 'kWh'], ['solar', 'Solar', 2.3, 'kWh'], ['gas', 'Gas', 0.21, 'm³'], ['water', 'Water', 0.2, 'm³']];
  async function loadEnergy() {
    if (Date.now() - energyAt < 5 * 60 * 1000) return;
    energyAt = Date.now();
    const list = [];
    try {
      const src = (await callWS({ type: 'energy/get_prefs' }))?.energy_sources || [];
      const statsOf = (type) => src.filter((s) => s.type === type).flatMap((s) => (type === 'grid' ? (s.flow_from || []).map((f) => f.stat_energy_from) : [s.stat_energy_from])).filter(Boolean);
      for (const [key, name, ids] of [['electricity', 'Electricity', statsOf('grid')], ['solar', 'Solar', statsOf('solar')], ['gas', 'Gas', statsOf('gas')], ['water', 'Water', statsOf('water')]]) {
        if (!ids.length) continue;
        const today = await Promise.all(ids.map((id) => Promise.resolve(callWS({ type: 'recorder/statistic_during_period', statistic_id: id, calendar: { period: 'day' }, types: ['change'] })).then((r) => Number(r?.change) || 0, () => 0)));
        list.push({ key, name, id: ids[0], ids, value: today.reduce((t, v) => t + v, 0), unit: attr(ids[0]).unit_of_measurement || (key === 'gas' || key === 'water' ? 'm³' : 'kWh') });
      }
    } catch (_e) { /* no energy dashboard: made up */ }
    energy = list;
    refresh();
  }
  // Energy today's sources are a glance, and tapping one shows its day in the graph, in place: the card never moves
  // (Matt, 27 Oct; since 31 Oct its use by the hour, the bars rising as in the HomeCore motion lab)
  let energyPick = null, energyTiles = [];
  function energyGlance() {
    const tiles = energyTiles = energy?.length ? energy : MADE_UP_ENERGY.map(([key, name, value, unit]) => {
      if (key === 'solar') { const sun = Object.keys(states).find((x) => x.endsWith('_solar_today') && !x.includes('made_up_energy')); if (sun && Number.isFinite(Number(states[sun].state))) value = Number(states[sun].state); }
      const id = 'sensor.made_up_energy_' + key;
      states[id] = { entity_id: id, state: String(value), last_changed: new Date().toISOString(), attributes: { friendly_name: name + ' today', unit_of_measurement: unit, state_class: 'total_increasing' } };
      return { key, name, id, value, unit };
    });
    energyText.clear();
    if (!tiles.some((t) => t.id === energyPick)) energyPick = tiles[0].id;
    const rows = tiles.map((t) => {
      const text = Number(t.value).toLocaleString(undefined, { maximumFractionDigits: t.value < 10 ? 2 : 1 }) + ' ' + t.unit, icon = ENERGY_ICON[t.key], on = t.id === energyPick;
      energyText.set(t.id, { name: t.name, text, icon });
      return '<div class="activityRow tap' + (on ? ' picked' : '') + '" role="button" tabindex="0" data-energy-pick="' + esc(t.id) + '" aria-pressed="' + on + '" aria-label="' + esc(t.name + ', ' + text) + '. Show its day in the graph">' +
        '<div class="tfIcon" aria-hidden="true"' + iconSlot('', icon, t.name) + '></div><div><div class="activityRowName">' + esc(t.name) + '</div><div class="activityRowMeta">' + esc(text) + '</div></div></div>';
    });
    // the picked source's day as a graph, above the glance or below it (its ⋯ in edit mode)
    const pick = tiles.find((t) => t.id === energyPick), below = (dashPrefs().opts.energy?.graph || 'above') === 'below';
    const graph = '<div class="tfCardGraph tfDashGraph"><svg class="tfGraph" data-graph="' + esc(pick.id) + '" role="img" aria-label="' + esc(pick.name) + ', last 24 hours"></svg></div>';
    return card('dash:energy', 0, 'Energy today', rows, graph, summaryData().some((x) => x.key === 'energy') ? 'summary:energy' : null, 'tfDashCard tfDash-energy' + (below ? '' : ' graphAbove'));
  }
  // a source picked: its tile marked and its day drawn into the graph; nothing else on the page changes
  function pickEnergy(id) {
    const cardEl = grid.querySelector('.tfDash-energy'), svg = cardEl?.querySelector('.tfDashGraph svg');
    if (!svg || id === energyPick) return;
    energyPick = id;
    cardEl.querySelectorAll('[data-energy-pick]').forEach((t) => { const on = t.dataset.energyPick === id; t.classList.toggle('picked', on); t.setAttribute('aria-pressed', String(on)); });
    svg.dataset.graph = id;
    svg.dataset.drawn = '';
    units.set('dash:energy', energyGlance());
    drawDashGraph(true);
  }
  /* Energy today's graph (Matt, 31 Oct: use over the day, not the meter climbing): each hour's use since midnight, from
     Home Assistant's hourly statistics (what each hour added to the meter) and, for the hour it is, its use so far. A
     made-up source follows a day's usual shape, adding up to its total */
  const USUAL_DAY = {
    electricity: [15, 12, 10, 10, 10, 12, 25, 45, 40, 30, 25, 30, 35, 30, 25, 25, 35, 60, 80, 70, 55, 45, 30, 20],
    gas: [2, 2, 2, 2, 3, 8, 18, 20, 12, 6, 4, 4, 4, 4, 4, 5, 8, 14, 16, 14, 10, 6, 3, 2],
    water: [0, 0, 0, 0, 0, 2, 12, 18, 8, 4, 3, 4, 6, 3, 2, 3, 4, 6, 10, 8, 5, 5, 3, 1],
  };
  const hourly = new Map(); // a source's id → { at, day, hours }
  async function hoursOf(src) {
    const now = new Date(), day = new Date(now).setHours(0, 0, 0, 0), hour = now.getHours(), part = now.getMinutes() / 60;
    const hours = Array.from({ length: 24 }, (_, h) => (h <= hour ? 0 : null));
    if (!src.ids) {
      const shape = USUAL_DAY[src.key] || USUAL_DAY.electricity, sofar = shape.map((w, h) => (h < hour ? w : h === hour ? w * part : 0));
      const sum = sofar.reduce((t, w) => t + w, 0) || 1;
      return hours.map((v, h) => (v == null ? null : (src.value * sofar[h]) / sum));
    }
    const was = hourly.get(src.id);
    if (was && was.day === day && Date.now() - was.at < 5 * 60 * 1000) return was.hours;
    try {
      const res = await callWS({ type: 'recorder/statistics_during_period', start_time: new Date(day).toISOString(), end_time: now.toISOString(), statistic_ids: src.ids, period: 'hour', types: ['change'] });
      src.ids.forEach((id) => (res?.[id] || []).forEach((row) => {
        const t = typeof row.start === 'number' ? row.start : Date.parse(row.start), h = new Date(t).getHours();
        if (t >= day && h < hour) hours[h] += Number(row.change) || 0;
      }));
      // the hour it is isn't in the hourly statistics until it ends
      const start = new Date(now).setMinutes(0, 0, 0);
      const parts = await Promise.all(src.ids.map((id) => Promise.resolve(callWS({ type: 'recorder/statistic_during_period', statistic_id: id, fixed_period: { start_time: new Date(start).toISOString(), end_time: now.toISOString() }, types: ['change'] })).then((r) => Number(r?.change) || 0, () => 0)));
      hours[hour] = parts.reduce((t, v) => t + v, 0);
    } catch (_e) { /* no statistics: an empty day */ }
    hourly.set(src.id, { at: Date.now(), day, hours });
    return hours;
  }
  // the motion lab's "Bars by the hour" (Figma 602:3168): a bar for each hour, 72% of its slot, corner 2, in the text
  // colour at 50% (the lab's 22% is under 3:1), the hour it is in the accent; three guide lines; 00, 06, 12 and 18
  // under it; the busiest hour named top left
  async function drawEnergyDay(svg, src) {
    const hours = await hoursOf(src);
    if (!svg.isConnected) return;
    const W = Math.max(120, svg.clientWidth || 260), H = Math.max(60, svg.clientHeight || 130), top = 18, base = H - 18;
    const slot = W / 24, bw = slot * 0.72, now = new Date().getHours(), vals = hours.map((v) => v ?? 0), max = Math.max(0, ...vals);
    const y = (v) => base - (max > 0 ? (v / max) * (base - top) : 0);
    const f = (v) => v.toLocaleString(undefined, { maximumFractionDigits: v < 10 ? 2 : 1 }) + ' ' + src.unit;
    const hh = (h) => String(h).padStart(2, '0') + ':00', most = max > 0 ? vals.indexOf(max) : -1;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('aria-label', src.name + ' today by the hour: ' + f(src.value) + (most >= 0 ? ', most ' + f(max) + ' at ' + hh(most) : ''));
    svg.innerHTML = [top, (top + base) / 2, base].map((ly) => '<line x1="0" x2="' + W + '" y1="' + ly + '" y2="' + ly + '" stroke="var(--line)" stroke-width="1"/>').join('') +
      hours.map((v, h) => (v > 0 ? '<rect x="' + (h * slot + (slot - bw) / 2).toFixed(1) + '" y="' + y(v).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + (base - y(v)).toFixed(1) + '" rx="2" fill="' + (h === now ? 'var(--primary)' : 'var(--text)') + '"' + (h === now ? '' : ' fill-opacity=".5"') + '/>' : '')).join('') +
      [0, 6, 12, 18].map((h) => '<text x="' + (h * slot).toFixed(1) + '" y="' + (H - 3) + '">' + String(h).padStart(2, '0') + '</text>').join('') +
      (most >= 0 ? '<text x="0" y="11">Most: ' + esc(f(max)) + ' at ' + hh(most) + '</text>' : '');
  }
  // the bars rise from the base, a little after one another; not with Reduce motion
  function rise(svg) {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    svg.querySelectorAll('rect').forEach((r, i) => r.animate([{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], { duration: 500, delay: i * 18, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'backwards' }));
  }
  // the line draws in over 700 and the area under it follows (the motion lab's graphs); not with Reduce motion
  function drawIn(svg) {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const [area, line] = svg.querySelectorAll('path');
    if (!line?.getTotalLength) return;
    const len = line.getTotalLength();
    line.animate([{ strokeDasharray: len, strokeDashoffset: len }, { strokeDasharray: len, strokeDashoffset: 0 }], { duration: 700, easing: 'cubic-bezier(.2,.7,.3,1)' });
    area?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: 200, easing: 'ease-out', fill: 'backwards' });
  }
  // the dashboard's tiles: yours once you've added or removed one in edit mode (Matt, 29 Oct), any device with controls
  // from any room. Until then, the bottom row: the lights of the living room, bedroom and office (on first, then the
  // most used) and up to two thermostats, each a light tile (252), as many as fit in one row (two rows of two on
  // phones); worked out once a visit, so tiles don't move while you use them
  let dashPicks = null, dashColsSeen = 0;
  // the dashboard shows only these rooms' lights (anything else passes)
  const dashLight = (id) => !id.startsWith('light.') || DASH_LIGHT_ROOMS.includes((whereIs.get(id) || '').toLowerCase());
  const dashCols = () => Math.max(2, pegsFor(grid?.clientWidth || 0).n);
  // a tile on the dashboard shows one control more for each row past its head: at XS none, at S its first (a light's
  // brightness, a thermostat's target, a cover's position…), at M its first two, and so on
  const controlsOf = (id) => { const s = specFor(id); return s.sections.map((sec, i) => sec && (s.parts || [])[i]).filter(Boolean); };
  const dashControl = (id) => controlsOf(id).slice(0, sizeOf(id) - 1);
  function dashTileIds(n) {
    const own = dashPrefs().tiles;
    if (own) return own.filter((id) => states[id] || roomOf(id));
    if (!dashPicks) {
      const rank = (id) => (states[id]?.state === 'on' ? 1e6 : 0) + (used[id] || 0);
      dashPicks = {
        lights: model.rooms.flatMap((r) => r.lights).filter((id) => dashLight(id) && states[id]?.state !== 'unavailable').sort((a, b) => rank(b) - rank(a) || nameOf(a).localeCompare(nameOf(b))),
        climates: model.rooms.flatMap((r) => r.actions.filter((id) => id.startsWith('climate.'))),
      };
    }
    const climates = dashPicks.climates.filter((id) => states[id]).slice(0, n > 3 ? 2 : 1);
    return [...dashPicks.lights.filter((id) => states[id]).slice(0, Math.max(0, n - climates.length)), ...climates];
  }
  const dashWrap = (cls, key, label, titled) => (inner) => '<section class="card tfCard tfDashCard ' + cls + '" data-tf data-k="' + key + '" aria-label="' + label + '">' +
    (titled ? '<div class="activityHeader">' + (key === 'favs' ? '<button class="activityTitle tfTitleBtn" type="button" data-more="favourites" aria-label="Favourites. More info">' + label + '</button>' : '<div class="activityTitle">' + label + '</div>') + '</div>' : '') + '<div class="activityRows">' + inner + '</div></section>';
  function dashboard(out, sums) {
    out.dash = true;
    out.push({ key: 'dash:title', html: '<h1 class="settingsTitle tfDashTitle" data-tf data-k="dash:title">' + esc(getHass()?.config?.location_name || 'Home') + '</h1>' });
    // the summaries: a row of their own, the bar only as wide as its tiles
    if (sums.length) out.push({ key: 'sums', wrap: (inner) => '<div class="tfDashBarRow" data-tf data-k="sums">' + dashWrap('tfDash-bar', 'sums-bar', 'Summaries', false)(inner).replace(' data-tf', '') + '</div>', tiles: sums.map((s) => ({ key: 'sum:' + s.key, html: summaryRow(s) })) });
    if (areaRooms.length) out.push({ key: 'areas', html: areasHtml(0) });
    // what you've starred always shows, from any room; only the suggestions that fill the card keep to the dashboard's rooms
    const favs = dashFavourites();
    if (favs.length) out.push({ key: 'favs', wrap: dashWrap('tfDash-favs', 'favs', 'Favourites', true), tiles: favs.map((id) => ({ key: 'fav:' + id, html: deviceRow(id, { area: true }) })) });
    const items = activityItems();
    out.push({ key: 'dash:act', html: card('dash:act', 0, 'Activity', items.length ? items.map(activityRow) : ['<p class="tfDashNone">Nothing has changed in the last day.</p>'], '', null, 'tfDashCard tfDash-act') });
    out.push({ key: 'dash:energy', html: energyGlance() });
    const cols = dashCols();
    dashColsSeen = cols;
    // each tile in a wrapper of its own (display:contents), so the page can be put in reading order round the cards
    dashTileIds(cols >= 3 ? cols : cols * 2).forEach((id) => out.push({ key: 'dash:tile:' + id, wrap: (inner) => '<div class="tfDashTiles" data-tf data-k="dash:tile:' + esc(id) + '">' + inner + '</div>',
      tiles: [{ key: id, html: isRoomKey(id) ? roomTile(roomOf(id), id) : actionTile(id, false, dashControl(id)) }] }));
    loadActivity();
    loadEnergy();
    return out;
  }
  /* ---------- the peg board (Matt, 27 Oct) ----------
     The dashboard is a solid grid of cells from the top left: columns that fill its width (Matt, 29 Oct: as the window
     narrows, the cards narrow with it) and rows 60 tall, 16 apart both ways. As many columns as fit at 200; they share
     the width, so they narrow together as it narrows and, at 200, one goes and they widen again (never more than 25%
     past their drawn 252). Rows stay 60 whatever the width. Every card fills whole cells, so
     everything lines up. Every element is as many whole rows as what it holds needs (Matt, 1 Nov: any height, but
     always a whole row bigger or smaller, never part of one); a tile is one column wide, a card two, the areas the
     whole width. A card
     can sit in any free cell; one dropped where others are pushes them down. Edit mode (the pencil in the bottom bar)
     draws the cells: drag a card by its grip (or anywhere on it), or use its ⋯ to size, move or hide it, and Energy
     today's graph above or below. Where everything is goes with the page's settings in Home Assistant (prefs.dash:
     cells, sizes, what's hidden, options). Phones keep one column */
  const PEG = 252, PEG_GAP = 16, PEG_MIN = 200, PEG_MAX = Math.round(PEG * 1.25), ROW = 60, ROW_PITCH = ROW + PEG_GAP, EXTRA_ROWS = 3;
  const BOARD_NAMES = { title: 'The name', sums: 'Summaries', wx: 'Weather', areas: 'Areas', favs: 'Favourites', act: 'Activity', energy: 'Energy today', avg: 'Compared to average', aq: 'Air quality', pollen: 'Pollen', radar: 'Rain radar' };
  // the new cards are two columns, as Compared to average (Matt, 1 Nov: one was too narrow), a tile in their ⋯
  const RESIZABLE = ['wx', 'favs', 'act', 'energy', 'avg'];
  // five heights, picked in an element's ⋯ (Matt, 2 Nov), each a whole number of rows: XS 1 (60, one tile), S 2 (136),
  // M 3 (212), L 4 (288), XL 5 (364). Each element starts at its kind's own (the weather, the areas, Favourites and
  // Activity XL; Energy today, Compared to average and the weather tiles L; every tile S, a Dual Axis Controller too:
  // it's an action tile like the others, whatever its control (Matt, 6 Nov); XL if it was made taller before), and one
  // with nothing to fill a height doesn't offer it: a tile goes up a row for each control it has (a light of bars to L,
  // a thermostat to M)
  const SIZE_NAMES = ['XS', 'S', 'M', 'L', 'XL'], ROWS_MOST = SIZE_NAMES.length;
  const WIDTH_NAMES = ['Narrow', 'Wide', 'Really wide'];
  const SIZES = { wx: 5, areas: 5, favs: 5, act: 5, energy: 4, avg: 4, aq: 4, pollen: 4, radar: 4 };
  // a tile whose entity isn't in the states yet keeps its saved height (it can't be measured, and must never stop the board)
  const mostRows = (key) => (!key.includes('.') || !states[key] || (key.startsWith('light.') && wantsDac(key)) ? ROWS_MOST : Math.min(ROWS_MOST, controlsOf(key).length + 1));
  const sizeOf = (key) => {
    const o = dashPrefs().opts[key] || {}, most = mostRows(key), h = Number(o.h) || (o.tall ? 5 : SIZES[key] || TILE_ROWS);
    return Math.max(1, Math.min(most, h));
  };
  const TILE_ROWS = 2, DAC_CHROME = 90; // a tile's padding (18 and 18), head (40) and gap (14) around the controller's pad
  // a card of tiles fills its height (Matt, 2 Nov): as many rows as fit at 56 or taller, every row the same height
  const FILL_MIN = 56;
  const boardName = (key) => BOARD_NAMES[key] || (key.startsWith('room:') ? areaRooms.find((r) => 'room:' + r.id === key)?.name || 'Area' : nameOf(key));
  const AREA_OPEN = 409, AREA_FOLDED = 128;
  let editing = false, drag = null, boardOpen = null, fitQueued = false, lastPlaced = new Map(), boardRows = 0, boardTop = 0;
  // the page's header, above the grid at its own size (the cards' rules: padding 10, tiles 60, so a bar of summaries is
  // 80 or 140 and never fits the grid's rows; Matt, 27 Oct: "we have rules to follow")
  const HEAD = ['title', 'sums'];
  const pegsFor = (W) => {
    const n = Math.max(1, Math.floor((W + PEG_GAP) / (PEG_MIN + PEG_GAP)));
    return { n, w: Math.max(1, Math.min(PEG_MAX, Math.floor((W - (n - 1) * PEG_GAP) / n))) };
  };
  // a card the page hasn't offered before starts off the board, waiting in the edit tray (known: the ones it has)
  const dashPrefs = () => {
    const d = { cells: {}, spans: {}, hidden: [], opts: {}, ...(prefs.dash || {}) }, fresh = NEW_CARDS.filter((k) => !(d.known || []).includes(k) && !d.hidden.includes(k));
    return fresh.length ? { ...d, hidden: [...d.hidden, ...fresh] } : d;
  };
  function saveDash(next) { prefs = { ...prefs, dash: { ...next, known: NEW_CARDS } }; savePrefs(); }
  // what's on the board: each card's key, its element, its width in pegs ('full' the whole width) and whether it's a tile
  function boardItems() {
    const q = (sel) => grid.querySelector(sel);
    return [['title', q('.tfDashTitle'), 'full'], ['sums', q('.tfDashBarRow'), 'full'], ['wx', dashBoxes.wx, 2], ['areas', q('.tfAreas'), 'areas'],
      ['favs', q('.tfDash-favs'), 2], ['act', q('.tfDash-act'), 2], ['energy', q('.tfDash-energy'), 2], ['avg', dashBoxes.avg, 2],
      ...NEW_CARDS.map((k) => [k, dashBoxes[k], 1]),
      ...[...grid.querySelectorAll('.tfDashTiles > [data-k]')].map((el) => [el.dataset.k, el, 1, true])]
      .filter(([, el]) => el?.isConnected).map(([key, el, span, tile = false]) => ({ key, el, span, tile }));
  }
  // a card's width in pegs on a board n pegs wide, each w: 'full' the whole width, the areas as wide as they're drawn
  const colsOf = (it, n, w) => {
    if (it.span === 'full') return n;
    // the areas: as wide as you picked in its ⋯ (Matt, 6 Nov: a lot of rooms), else as wide as its rooms; the rest scroll
    const picked = it.span === 'areas' && dashPrefs().spans.areas;
    if (picked) return picked === 'full' ? n : Math.min(n, Math.max(2, picked));
    if (it.span === 'areas') return Math.min(n, Math.ceil((AREA_OPEN + Math.max(0, areaRooms.length - 1) * (AREA_FOLDED + PEG_GAP) + PEG_GAP) / (w + PEG_GAP)));
    return Math.min(n, dashPrefs().spans[it.key] ?? it.span);
  };
  // a card's rows: its height's
  const rowsOf = (it) => sizeOf(it.key);
  // each card's cell on a board n pegs wide (the cards know their cols and rows): a dragged card where it would land;
  // then the cards with a saved cell, top to bottom (one in the way goes down to the next free cell); then the rest in
  // the page's order, each in the first cell from the top left it fits.
  // Cells saved on a wider board that don't fit this one would crowd its right edge, so then the cards keep the saved
  // order instead (the top row first, each row left to right), each in the first cell from the top left it fits.
  function placeCards(cards, n, dragged = null) {
    const cells = dashPrefs().cells, fits = cards.every((it) => !cells[it.key] || cells[it.key].col + it.cols <= n);
    const at = (it) => cells[it.key] || { row: 1e9, col: 0 };
    const place = () => {
      const taken = new Set(), placed = new Map();
      const free = (c, r, cs, rs) => { for (let y = r; y < r + rs; y++) for (let x = c; x < c + cs; x++) if (taken.has(x + ',' + y)) return false; return true; };
      const put = (it, c, r) => {
        for (let y = r; y < r + it.rows; y++) for (let x = c; x < c + it.cols; x++) taken.add(x + ',' + y);
        placed.set(it.key, { col: c, row: r, cols: it.cols, rows: it.rows });
      };
      const near = (it, c, r) => { c = Math.max(0, Math.min(n - it.cols, c)); r = Math.max(0, r); while (!free(c, r, it.cols, it.rows)) r++; put(it, c, r); };
      const first = (it) => { for (let r = 0; ; r++) for (let c = 0; c <= n - it.cols; c++) if (free(c, r, it.cols, it.rows)) { put(it, c, r); return; } };
      if (dragged) near(dragged, drag.col, drag.row);
      const rest = cards.filter((it) => it !== dragged), inOrder = (a, b) => at(a).row - at(b).row || at(a).col - at(b).col;
      if (!fits) { [...rest].sort(inOrder).forEach(first); return placed; }
      rest.filter((it) => cells[it.key]).sort(inOrder).forEach((it) => near(it, cells[it.key].col, cells[it.key].row));
      rest.filter((it) => !cells[it.key]).forEach(first);
      return placed;
    };
    // nothing stretches (Matt, 1 Nov: the information density stays the same): a tile keeps its own rows
    return place();
  }
  // the same board on a phone: each card in the phone's order, in the first cells it fits from the top left
  function placeInOrder(cards, n) {
    const taken = new Set(), placed = new Map();
    const free = (c, r, it) => { for (let y = r; y < r + it.rows; y++) for (let x = c; x < c + it.cols; x++) if (taken.has(x + ',' + y)) return false; return true; };
    cards.forEach((it) => {
      for (let r = 0; ; r++) {
        let c = 0;
        while (c <= n - it.cols && !free(c, r, it)) c++;
        if (c > n - it.cols) continue;
        for (let y = r; y < r + it.rows; y++) for (let x = c; x < c + it.cols; x++) taken.add(x + ',' + y);
        placed.set(it.key, { col: c, row: r, cols: it.cols, rows: it.rows });
        return;
      }
    });
    return placed;
  }
  // a phone's order: its cards run down in the board's reading order, the top row first and each row
  // left to right (Matt, 27 Oct), unless the mini phone in the edit tray gave phones an order of their own (Matt, 28
  // Oct; dash.phone): those cards first in that order, then any it doesn't know yet in the board's. The board is the
  // one last on screen, else the one the cells were saved on (four pegs wide if they never were); hidden cards last
  function phoneCards() {
    const dash = dashPrefs(), hidden = new Set(dash.hidden), cards = boardItems().filter((it) => !HEAD.includes(it.key));
    let placed = lastPlaced;
    if (!placed.size) {
      const n = dash.pegs || 4, shown = cards.filter((it) => !hidden.has(it.key));
      shown.forEach((it) => { it.cols = colsOf(it, n, PEG); it.rows = rowsOf(it) ?? TILE_ROWS; });
      placed = placeCards(shown, n);
    }
    const at = (it) => (!hidden.has(it.key) && placed.get(it.key)) || { row: 1e9, col: 0 };
    cards.sort((a, b) => at(a).row - at(b).row || at(a).col - at(b).col);
    const own = (dash.phone || []).map((k) => cards.find((it) => it.key === k && !hidden.has(k))).filter(Boolean);
    return [...own, ...cards.filter((it) => !own.includes(it))];
  }
  const phoneOrder = () => {
    const cards = phoneCards();
    cards.forEach((it, i) => it.el.style.setProperty('--o', String(3 + i)));
    readingOrder([...boardItems().filter((it) => HEAD.includes(it.key)), ...cards].map((it) => it.el));
  };
  // the page in the order it reads (Matt, 29 Oct: accessibility; Tab and screen readers follow the page, not where the
  // board draws things): on the board the top row first, each row left to right; on phones the order they show in.
  // Only what's out of place moves, with moveBefore where there is one, so a Dual Axis Controller and focus stay as
  // they were
  function readingOrder(els) {
    if (drag) return;
    const was = root.activeElement;
    let prev = null;
    for (const node of new Set(els.map((el) => { while (el && el.parentElement !== grid) el = el.parentElement; return el; }).filter(Boolean))) {
      const ref = prev ? prev.nextSibling : grid.querySelector(':scope > [data-tf]');
      if (node !== ref) {
        try { grid.moveBefore ? grid.moveBefore(node, ref) : grid.insertBefore(node, ref); } catch (_e) { grid.insertBefore(node, ref); }
      }
      prev = node;
    }
    if (was && was !== root.activeElement && was.isConnected) was.focus({ preventScroll: true });
  }
  // saves where every card is, with the board's width in pegs so a phone can read them in the same order
  const saveCells = (dash, cells) => saveDash({ ...dash, cells, pegs: pegsFor(grid.clientWidth).n });
  // lays the board out on its cells: the name and the summaries first, then the cards (placeCards)
  function layoutBoard() {
    if (!testFocus || !grid) return;
    // a phone is the same board two columns wide (Matt, 1 Nov: one rule everywhere, so Smalls stack beside a Medium
    // there too), its cards in the phone's order and not edited there
    const W = grid.clientWidth, phone = W < 2 * PEG + PEG_GAP, board = app.classList.contains('tfDash');
    const { n, w } = phone ? { n: 2, w: Math.floor((W - PEG_GAP) / 2) } : pegsFor(W);
    // the Weather page is laid on the same board, its columns the dashboard's (Matt, 1 Nov: one rule set)
    bentoBox.classList.add('tfPegs');
    bentoBox.style.setProperty('--peg-n', n);
    bentoBox.style.setProperty('--peg-w', w + 'px');
    const off = new Set(dashPrefs().hidden);
    NEW_CARDS.forEach((k) => dashBoxes[k]?.classList.toggle('tfNotAdded', off.has(k) && !(drag?.fromTray && drag.key === k)));
    app.classList.toggle('tfBoard', board);
    app.classList.toggle('tfEditing', board && editing && !phone);
    const pen = $('dashEditNav');
    if (pen) { pen.hidden = !board || phone; pen.classList.toggle('active', editing); pen.setAttribute('aria-pressed', String(editing)); pen.setAttribute('aria-label', editing ? 'Done editing' : 'Edit the dashboard'); pen.title = editing ? 'Done' : 'Edit'; pen.innerHTML = editing ? TICK : PENCIL; }
    const items = board ? boardItems() : [];
    if (!board) {
      grid.style.height = '';
      grid.querySelectorAll('.tfBoardItem').forEach((el) => { el.classList.remove('tfBoardItem', 'tfBoardHidden'); el.style.left = el.style.top = el.style.width = el.style.height = ''; });
      grid.querySelector('.tfDash-act > .activityRows')?.style.removeProperty('max-height');
      editTools(false);
      if (app.classList.contains('tfDash')) phoneOrder();
      renderTray();
      return;
    }
    grid.style.setProperty('--peg-w', w + 'px');
    // a card being dragged out of the edit tray shows where it would land
    const hidden = new Set(dashPrefs().hidden), pitch = w + PEG_GAP;
    if (drag?.fromTray) hidden.delete(drag.key);
    items.forEach((it) => it.el.classList.toggle('tfBoardHidden', hidden.has(it.key)));
    const shown = items.filter((it) => !hidden.has(it.key) && getComputedStyle(it.el).display !== 'none');
    // the header: the name and the summaries, the full width, each at its own height, 16 apart
    let top = 0;
    shown.filter((it) => HEAD.includes(it.key)).forEach((it) => {
      it.el.classList.add('tfBoardItem');
      Object.assign(it.el.style, { width: W + 'px', height: '', left: '0px', top: top + 'px' });
      // the summaries in even rows: all in one if they fit, else halves, thirds…, each column as wide as its words
      const bar = it.key === 'sums' && it.el.querySelector('.tfDash-bar'), count = bar ? bar.querySelectorAll('.activityRow').length : 0;
      if (bar) bar.style.maxWidth = 'none';
      for (let rows = 1; bar && rows <= count; rows++) { bar.style.setProperty('--bar-cols', String(Math.ceil(count / rows))); if (bar.offsetWidth <= W) break; }
      if (bar) bar.style.maxWidth = '';
      top += it.el.offsetHeight + PEG_GAP;
    });
    boardTop = top;
    const cards = shown.filter((it) => !HEAD.includes(it.key));
    // each card's cells: its width in pegs, and its rows
    cards.forEach((it) => {
      it.cols = colsOf(it, n, w);
      it.el.classList.add('tfBoardItem');
      it.el.style.width = (it.cols === n ? W : it.cols * w + (it.cols - 1) * PEG_GAP) + 'px';
      it.el.style.height = '';
      it.rows = rowsOf(it) ?? Math.max(1, Math.ceil((it.el.offsetHeight + PEG_GAP - 6) / ROW_PITCH));
    });
    const dragged = drag && cards.find((it) => it.key === drag.key);
    const order = phone && phoneCards().map((it) => it.key), seq = (it) => (order.includes(it.key) ? order.indexOf(it.key) : -1);
    const placed = phone ? placeInOrder([...cards].sort((a, b) => seq(a) - seq(b)), n) : placeCards(cards, n, dragged);
    placed.forEach((p) => Object.assign(p, { x: p.cols === n ? 0 : p.col * pitch, y: boardTop + p.row * ROW_PITCH, w: p.cols === n ? W : p.cols * w + (p.cols - 1) * PEG_GAP, h: p.rows * ROW_PITCH - PEG_GAP }));
    cards.forEach((it) => {
      const p = placed.get(it.key);
      it.el.style.height = p.h + 'px';
      it.el.dataset.rows = sizeOf(it.key);
      // one column wide on a board of more (not a phone's single column): the card's narrow version (Matt, 6 Nov)
      it.el.toggleAttribute('data-narrow', !phone && p.cols === 1 && n > 1);
      it.el.dataset.cols = p.cols; // how many columns it spans (a room's tile lays out by it)
      // a DAC's pad takes what its cells leave under its name
      if (it.el.classList.contains('tfDac')) it.el.style.setProperty('--tf-dac-pad', (p.h - DAC_CHROME) + 'px');
      if (it === dragged && !drag.fromTray) return; // the dragged card follows the pointer; where it lands shows instead
      it.el.style.left = p.x + 'px';
      it.el.style.top = p.y + 'px';
    });
    if (!phone) lastPlaced = placed; // the board's own places, which a phone's order follows
    readingOrder([...shown.filter((it) => HEAD.includes(it.key)), ...cards.slice().sort((a, b) => placed.get(a.key).row - placed.get(b.key).row || placed.get(a.key).col - placed.get(b.key).col)].map((it) => it.el));
    // Favourites and Activity fill their height with whole rows of tiles (FILL_MIN); the rest scroll
    [['favs', '.tfDash-favs'], ['act', '.tfDash-act']].forEach(([key, sel]) => {
      const p = placed.get(key), card = p && grid.querySelector(sel), list = card?.querySelector(':scope > .activityRows'), head = card?.querySelector(':scope > .activityHeader');
      if (!list || !head) return;
      // at XS a card has no title: its one row of tiles is the card
      // measured to the list's real top, rounded down: whole pixels (offsetTop) overshot by a fraction and made it scroll
      const below = list.getBoundingClientRect().top - card.getBoundingClientRect().top;
      const space = p.rows === 1 ? p.h : Math.floor(p.h - below - parseFloat(getComputedStyle(card).paddingBottom)), n = Math.max(1, Math.floor(space / FILL_MIN));
      list.style.setProperty('--fill-row', (space / n).toFixed(2) + 'px');
      list.style.maxHeight = space + 'px';
    });
    boardRows = Math.max(0, ...[...placed.values()].map((p) => p.row + p.rows));
    let height = boardTop + boardRows * ROW_PITCH - PEG_GAP;
    height = editTools(editing && !phone, cards, placed, height, n, w);
    grid.style.height = height + 'px';
    // cards slide to new places from the second layout on (not as the page first draws)
    requestAnimationFrame(() => app.classList.add('tfBoardReady'));
    items.forEach((it) => itemSizes.observe(it.el));
    drawDashGraph();
    renderTray();
  }
  const queueFit = () => { if (fitQueued) return; fitQueued = true; requestAnimationFrame(() => { fitQueued = false; layoutBoard(); }); };
  // a card whose content changes height (a forecast arriving, a reading opening) may need more rows
  const itemSizes = new ResizeObserver(() => { if (!drag) queueFit(); });
  // edit mode's tools: the grid of cells, each card's grip (top middle) and ⋯ (its own controls rest), where a dragged
  // card will land, and on the Favourites card a hide button for each favourite (hidden cards and favourites wait in the
  // edit tray); returns the board's height with them
  function editTools(on, shown = [], placed = new Map(), height = 0, n = 1, w = PEG) {
    grid.querySelectorAll('.tfEditChips').forEach((c) => { if (!on || !c.closest('.tfBoardItem')) c.remove(); });
    grid.querySelectorAll('.tfFavHides').forEach((c) => c.remove());
    grid.querySelectorAll('.tfBoardItem').forEach((el) => [...el.children].forEach((c) => { if (!c.classList.contains('tfEditChips')) c.toggleAttribute('inert', on); }));
    let cells = grid.querySelector('.tfBoardCells'), land = grid.querySelector('.tfBoardLand');
    if (!on) { cells?.remove(); land?.remove(); closeBoardMenu(); return height; }
    // the cells, with a few spare rows under the cards to drop into
    const rows = boardRows + EXTRA_ROWS;
    if (!cells) { cells = Object.assign(document.createElement('div'), { className: 'tfBoardCells' }); cells.setAttribute('aria-hidden', 'true'); grid.prepend(cells); }
    cells.style.top = boardTop + 'px';
    if (cells.dataset.size !== n + 'x' + rows + 'x' + w) {
      cells.dataset.size = n + 'x' + rows + 'x' + w;
      cells.style.gridTemplateColumns = 'repeat(' + n + ',' + w + 'px)';
      cells.innerHTML = '<i></i>'.repeat(n * rows);
    }
    height = Math.max(height, boardTop + rows * ROW_PITCH - PEG_GAP);
    shown.forEach((it) => {
      const host = it.el;
      if (!host || host.querySelector(':scope > .tfEditChips')) return;
      host.insertAdjacentHTML('beforeend', '<div class="tfEditChips"><span class="tfEditGrip" aria-hidden="true">' + GRIP + '</span>' +
        '<button class="tfEditChip" type="button" data-board-more="' + esc(it.key) + '" aria-label="' + esc(boardName(it.key)) + ' options" aria-haspopup="menu">' + DOTS + '</button></div>');
    });
    if (drag && placed.has(drag.key)) {
      if (!land) { land = Object.assign(document.createElement('div'), { className: 'tfBoardLand' }); grid.appendChild(land); }
      const p = placed.get(drag.key);
      Object.assign(land.style, { left: p.x + 'px', top: p.y + 'px', width: p.w + 'px', height: p.h + 'px' });
    } else land?.remove();
    // each favourite on the Favourites card can be hidden to the tray: a button over its row, outside the card's inert
    // content
    const favCard = grid.querySelector('.tfDash-favs.tfBoardItem:not(.tfBoardHidden)');
    if (favCard) {
      const box = favCard.getBoundingClientRect();
      favCard.insertAdjacentHTML('beforeend', '<div class="tfFavHides">' + [...favCard.querySelectorAll('[data-k^="fav:"]')].map((row) => {
        const r = row.getBoundingClientRect(), id = row.dataset.k.slice(4);
        return '<button class="tfFavHide" type="button" data-fav-hide="' + esc(id) + '" aria-label="Hide ' + esc(nameOf(id)) + ' from the dashboard" style="left:' +
          Math.round(r.right - box.left - 42) + 'px;top:' + Math.round(r.top - box.top + (r.height - 32) / 2) + 'px">' + EYE_OFF + '</button>';
      }).join('') + '</div>');
    }
    return height;
  }
  let editStart = ''; // the page's settings when edit mode began
  function setEditing(on) {
    editing = on;
    if (!on) { drag = null; trayPicking = tilePicking = false; closeBoardMenu(); }
    layoutBoard();
    if (on) editStart = JSON.stringify(prefs);
    else if (editStart && JSON.stringify(prefs) !== editStart) toast('Changes saved');
  }
  // a card's ⋯: its height (XS to XL), its width (a tile or a card), a cell left, right, up or down, Energy today's
  // graph, and hide; a tile is removed instead (Matt, 29 Oct), and added again from the edit tray
  function openBoardMenu(key, opener) {
    closeBoardMenu();
    const p = lastPlaced.get(key), { n } = pegsFor(grid.clientWidth), dash = dashPrefs(), span = dash.spans[key] ?? (isRoomKey(key) ? 1 : 2);
    if (!p) return;
    const full = p.cols >= n, item = (act, label, off) => '<button type="button" role="menuitem" data-board-act="' + act + '"' + (off ? ' disabled' : '') + '>' + label + '</button>';
    const menu = Object.assign(document.createElement('div'), { className: 'tfBoardMenu' });
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', boardName(key) + ' options');
    const tile = grid.querySelector('.tfDashTiles > [data-k="' + CSS.escape(key) + '"]'), most = mostRows(key), now = sizeOf(key);
    // its height first: XS to XL side by side, one not offered greyed out (Matt, 2 Nov)
    const height = '<div class="tfHeight" role="group" aria-label="Height"><span class="tfHeightLabel" aria-hidden="true">Height</span><div class="tfHeightTabs">' +
      SIZE_NAMES.map((name, i) => '<button type="button" role="menuitemradio" aria-checked="' + (i + 1 === now) + '" aria-label="' + name + ', ' + (i + 1) + (i ? ' rows' : ' row') + '" data-board-act="h:' + (i + 1) + '"' + (i < most ? '' : ' disabled') + '>' + name + '</button>').join('') + '</div></div>';
    // then its width, for the cards that have one: narrow (a column), wide (two) or really wide (three), one the board
    // hasn't the columns for greyed out (Matt, 6 Nov: not "Card size" / "Tile size")
    // the areas: wide (two), really wide (three) or the full width, never narrow (an open room is 409); until one's
    // picked it's as wide as its rooms, which may be none of these
    const AREA_WIDTHS = [['Wide', 2, n >= 2], ['Really wide', 3, n >= 3], ['Full width', 'full', n >= 4]];
    const width = key === 'areas' ? '<div class="tfHeight tfWidth" role="group" aria-label="Width"><span class="tfHeightLabel" aria-hidden="true">Width</span><div class="tfHeightTabs">' +
      AREA_WIDTHS.map(([name, v, ok]) => '<button type="button" role="menuitemradio" aria-checked="' + (ok && (v === 'full' ? p.cols === n : p.cols === v && !(v === n && dash.spans.areas === 'full'))) + '" aria-label="' + name + (v === 'full' ? '' : ', ' + v + ' columns') + '" data-board-act="w:' + v + '"' + (ok ? '' : ' disabled') + '>' + name + '</button>').join('') + '</div></div>'
      // a room's tile too (Matt, 6 Nov): narrow, wide or really wide, like the cards
      : RESIZABLE.includes(key) || isRoomKey(key) ? '<div class="tfHeight tfWidth" role="group" aria-label="Width"><span class="tfHeightLabel" aria-hidden="true">Width</span><div class="tfHeightTabs">' +
      WIDTH_NAMES.map((name, i) => '<button type="button" role="menuitemradio" aria-checked="' + (i + 1 === Math.min(span, n)) + '" aria-label="' + name + ', ' + (i + 1) + (i ? ' columns' : ' column') + '" data-board-act="w:' + (i + 1) + '"' + (i < n ? '' : ' disabled') + '>' + name + '</button>').join('') + '</div></div>' : '';
    menu.innerHTML = height + width +
      (key === 'energy' ? item('graph', (dash.opts.energy?.graph || 'above') === 'above' ? 'Graph below' : 'Graph above') : '') +
      item('left', 'Move left', full || p.col === 0) + item('right', 'Move right', full || p.col + p.cols >= n) +
      item('up', 'Move up', p.row <= 0) + item('down', 'Move down') + (tile ? item('remove', 'Remove') : item('hide', 'Hide'));
    grid.appendChild(menu);
    const left = Math.min(p.x + p.w - menu.offsetWidth, grid.clientWidth - menu.offsetWidth);
    Object.assign(menu.style, { left: Math.max(0, left) + 'px', top: (p.y + 28) + 'px' });
    boardOpen = { key, menu, opener };
    menu.querySelector('button:not([disabled])')?.focus();
  }
  function closeBoardMenu(refocus) {
    if (!boardOpen) return;
    const { menu, opener } = boardOpen;
    boardOpen = null;
    menu.remove();
    if (refocus) opener?.focus();
  }
  // every card's cell as it is now, so moving one leaves the rest where they are
  const cellsNow = () => Object.fromEntries([...lastPlaced].map(([k, p]) => [k, { col: p.col, row: p.row }]));
  function boardAct(key, act) {
    if (act === 'remove') { closeBoardMenu(); removeTile(key); return; }
    const before = prefs, dash = dashPrefs(), cells = cellsNow(), here = cells[key] || { col: 0, row: 0 };
    if (act.startsWith('w:')) dash.spans = { ...dash.spans, [key]: act === 'w:full' ? 'full' : Number(act.slice(2)) };
    if (act.startsWith('h:')) dash.opts = { ...dash.opts, [key]: { ...(dash.opts[key] || {}), h: Number(act.slice(2)), tall: undefined } };
    if (act === 'graph') dash.opts = { ...dash.opts, energy: { ...(dash.opts.energy || {}), graph: (dash.opts.energy?.graph || 'above') === 'above' ? 'below' : 'above' } };
    if (act === 'left') cells[key] = { ...here, col: here.col - 1 };
    if (act === 'right') cells[key] = { ...here, col: here.col + 1 };
    if (act === 'up') cells[key] = { ...here, row: here.row - 1 };
    if (act === 'down') cells[key] = { ...here, row: here.row + 1 };
    if (act === 'hide') dash.hidden = [...new Set([...dash.hidden, key])];
    // a card moved onto others goes first; they make room under it
    if (['left', 'right', 'up', 'down'].includes(act)) drag = { key, col: cells[key].col, row: cells[key].row };
    saveCells(dash, cells);
    if (drag) { layoutBoard(); drag = null; saveCells(dashPrefs(), cellsNow()); }
    closeBoardMenu();
    if (act === 'graph') { units.delete('dash:energy'); refresh(); }
    if (act.startsWith('h:') && key.includes('.')) refresh(); // a room's tile shows what fits by its height alone // a tile's controls change with its height
    layoutBoard();
    if (act !== 'hide') grid.querySelector('[data-board-more="' + CSS.escape(key) + '"]')?.focus();
    else toast(boardName(key) + ' hidden', undoTo(before));
  }
  // a card back from the edit tray: put back, or added if it's never been on the board
  const backWord = (key) => (NEW_CARDS.includes(key) && !(prefs.dash?.cells || {})[key] ? ' added' : ' put back');
  function showCard(key) {
    const dash = dashPrefs(), said = boardName(key) + backWord(key);
    saveDash({ ...dash, hidden: dash.hidden.filter((k) => k !== key) });
    layoutBoard();
    toast(said);
  }
  // the dashboard's tiles as they are: yours, else today's picks as shown. A tile added goes in the first free cell
  // (left of the edit tray), everything else staying where it is; one removed leaves its cell free. Tiles aren't hidden any more, so any hidden
  // before go with the first change
  const tilesNow = () => dashPrefs().tiles || [...grid.querySelectorAll('.tfDashTiles > [data-k]')].map((el) => el.dataset.k).filter((k) => !dashPrefs().hidden.includes(k));
  function setTiles(tiles, cells) {
    const dash = dashPrefs();
    saveCells({ ...dash, tiles, hidden: dash.hidden.filter((k) => !k.includes('.')) }, cells);
    refresh();
    renderTray();
  }
  const addTile = (id) => { setTiles([...tilesNow().filter((x) => x !== id), id], cellsNow()); toast(boardName(id) + ' added'); reveal(id); };
  const removeTile = (id) => { const before = prefs, cells = cellsNow(); delete cells[id]; setTiles(tilesNow().filter((x) => x !== id), cells); toast(boardName(id) + ' removed', undoTo(before)); };
  /* ---------- toasts (Matt, 29 Oct) ----------
     The card's toast, at the bottom middle of the board (left of the edit tray when it's out) and 12 above the bottom
     bar: what an edit did, with Undo for 5 s after a remove or a hide. Done says Changes saved when the edits changed
     anything; they save as they're made */
  let toastTimer = 0;
  function toast(message, undo = null) {
    const el = $('toast');
    if (!el) return;
    el.replaceChildren(Object.assign(document.createElement('span'), { textContent: message }));
    if (undo) {
      const b = Object.assign(document.createElement('button'), { type: 'button', className: 'toastAction', textContent: 'Undo' });
      b.addEventListener('click', () => { clearTimeout(toastTimer); el.classList.remove('show', 'withAction'); undo(); });
      el.appendChild(b);
    }
    const box = app.getBoundingClientRect(), bar = root.querySelector('.bottomNav')?.getBoundingClientRect();
    const right = tray.classList.contains('open') && !trayTucked ? Math.min(box.right, tray.getBoundingClientRect().left) : box.right;
    el.style.left = (box.left + right) / 2 + 'px';
    el.style.bottom = (bar?.height ? window.innerHeight - bar.top + 12 : 26) + 'px';
    el.classList.add('tfToast', 'show');
    el.classList.toggle('withAction', Boolean(undo));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show', 'withAction'), undo ? 5000 : 2200);
  }
  /* ---------- tooltips (Matt, 29 Oct: a HomeCore rule) ----------
     Text cut short with "…" shows all of it in a tooltip, by the mouse or keyboard focus (not touch): the first after
     0.7 s, then, while one has shown in the last second, the next straight away. It stays while the pointer is on it,
     Escape closes it, and it goes when the page scrolls */
  const TIP_DELAY = 700, TIP_WARM = 1000;
  const tip = Object.assign(document.createElement('div'), { className: 'tfTooltip', hidden: true });
  tip.setAttribute('role', 'tooltip');
  tip.setAttribute('aria-hidden', 'true'); // what it says is already each control's name
  app.appendChild(tip);
  let tipFor = null, tipTimer = 0, tipHideTimer = 0, tipGoneAt = -Infinity;
  const cutShort = (el) => {
    if (el.nodeType !== 1) return false;
    const cs = getComputedStyle(el);
    return (cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1) || (cs.webkitLineClamp !== 'none' && el.scrollHeight > el.clientHeight + 1);
  };
  const cutUnder = (el) => { for (let e = el; e && e !== app; e = e.parentElement) if (cutShort(e)) return e; return null; };
  function showTip(el, text) {
    clearTimeout(tipTimer);
    clearTimeout(tipHideTimer);
    const go = () => {
      if (!el.isConnected) return;
      tipFor = el;
      tip.textContent = text;
      tip.hidden = false;
      // above the text, 8 from it, else under it; never off the screen
      const r = el.getBoundingClientRect(), t = tip.getBoundingClientRect();
      const y = r.top - t.height - 8 >= 8 ? r.top - t.height - 8 : r.bottom + 8;
      tip.style.left = Math.max(8, Math.min(window.innerWidth - t.width - 8, r.left + r.width / 2 - t.width / 2)) + 'px';
      tip.style.top = y + 'px';
    };
    if (!tip.hidden || performance.now() - tipGoneAt < TIP_WARM) go(); else tipTimer = setTimeout(go, TIP_DELAY);
  }
  function hideTip() {
    clearTimeout(tipTimer);
    clearTimeout(tipHideTimer);
    if (!tip.hidden) tipGoneAt = performance.now();
    tip.hidden = true;
    tipFor = null;
  }
  root.addEventListener('pointerover', (ev) => {
    if (ev.pointerType === 'touch') return;
    if (tip.contains(ev.target)) { clearTimeout(tipHideTimer); return; }
    const el = cutUnder(ev.target);
    if (el && look.names === 'scroll' && el.matches(NAME_SEL)) { glide(el); return; }
    if (el) { if (el !== tipFor) showTip(el, el.textContent.trim()); else clearTimeout(tipHideTimer); return; }
    // a moment to reach the tooltip itself before it goes
    clearTimeout(tipTimer);
    clearTimeout(tipHideTimer);
    tipHideTimer = setTimeout(hideTip, 120);
  });
  root.addEventListener('focusin', (ev) => {
    const el = ev.target;
    if (!el.matches?.(':focus-visible')) return;
    let cut = [el, ...el.querySelectorAll('*')].filter(cutShort);
    if (look.names === 'scroll') { cut.filter((x) => x.matches(NAME_SEL)).forEach(glide); cut = cut.filter((x) => !x.matches(NAME_SEL)); }
    if (cut.length) showTip(el, cut.map((x) => x.textContent.trim()).join(' · '));
  });
  root.addEventListener('focusout', (ev) => { if (ev.target === tipFor) hideTip(); });
  root.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !tip.hidden) { ev.stopPropagation(); hideTip(); } }, true);
  window.addEventListener('scroll', () => { if (!tip.hidden || tipTimer) hideTip(); }, { capture: true, passive: true });
  /* Long names → Scroll (Matt, 31 Oct): a name or state cut short glides across to its end and back once, when it comes
     into view and when it's hovered or reached with the keyboard, then rests cut with "…" again: 30 a second, a 0.6 s
     pause before and 1 s at the end. Nothing keeps moving (WCAG 2.2.2), and none of it with Reduce motion */
  const NAME_SEL = '.activityRowName,.activityRowMeta';
  const gliding = new WeakSet();
  function glide(el) {
    if (look.names !== 'scroll' || gliding.has(el) || el.closest('[inert]') || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    gliding.add(el);
    // measured after the pause, once what it sits in has stopped moving: an area opening grows for 0.32 s, and measured
    // as it began, its names, cut while it was folded, scrolled though they fit once it was open (Matt, 6 Nov: a bug)
    // (and after the area it's in, if it's opening, has finished: a slow phone may take longer than the pause)
    const settled = () => Promise.all([el.closest('.workoutPanel'), el.closest('.panelExpanded')].filter(Boolean)
      .flatMap((x) => x.getAnimations()).map((a) => a.finished.catch(() => {})));
    setTimeout(async () => {
      await settled();
      const d = el.isConnected && !el.closest('[inert]') ? el.scrollWidth - el.clientWidth : 0;
      if (d < 2) { gliding.delete(el); return; }
      const go = (d / 30) * 1000, total = go + 1000 + go;
      el.style.textOverflow = 'clip';
      const a = el.animate([
        { textIndent: '0px', offset: 0, easing: 'ease-in-out' },
        { textIndent: -d + 'px', offset: go / total },
        { textIndent: -d + 'px', offset: (1000 + go) / total, easing: 'ease-in-out' },
        { textIndent: '0px', offset: 1 },
      ], { duration: total });
      a.onfinish = a.oncancel = () => { el.style.textOverflow = ''; gliding.delete(el); };
    }, 600);
  }
  // each cut name glides the first time it's wholly in view (not while it's on a folded area's hidden layer)
  const inView = new IntersectionObserver((seen) => seen.forEach((e) => { if (e.isIntersecting && !e.target.closest('[inert]')) { inView.unobserve(e.target); glide(e.target); } }), { threshold: 1 });
  let namesQueued = false;
  new MutationObserver(() => {
    if (namesQueued || look.names !== 'scroll') return;
    namesQueued = true;
    setTimeout(() => {
      namesQueued = false;
      root.querySelectorAll(NAME_SEL).forEach((el) => { if (!el.dataset.glided && cutShort(el)) { el.dataset.glided = '1'; inView.observe(el); } });
    }, 300);
  }).observe(root, { childList: true, subtree: true });
  // Undo: the page's settings put back as they were before the edit
  const undoTo = (before) => () => { prefs = before; savePrefs(); refresh(); layoutBoard(); renderTray(); };
  // a tile just added: the page scrolls gently until it's in view, and a ring round it fades over 1.5 s (Home
  // Assistant's highlight on a pasted card; edit mode already outlines every card, so a ring outside it). With Reduce
  // motion the scroll jumps and the ring holds still
  function reveal(key) {
    const find = () => grid.querySelector('.tfDashTiles > [data-k="' + CSS.escape(key) + '"]');
    // once it has slid out from under the tray (and been drawn again)
    setTimeout(() => {
      const el = find();
      if (!el) return;
      const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches, r = el.getBoundingClientRect();
      if (r.top < 0 || r.bottom > window.innerHeight) el.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'center' });
      const ring = (a) => '0 0 0 4px color-mix(in srgb,var(--primary) ' + a + '%,transparent),0 0 24px color-mix(in srgb,var(--primary) ' + a + '%,transparent)';
      el.animate([{ boxShadow: ring(55) }, { boxShadow: ring(0) }], { duration: 1500, easing: still ? 'steps(1, end)' : 'ease-out' });
    }, clearOfTray(key) ? 260 : 0);
  }
  // a tile added under the edit tray moves to the first free cell left of it, so it can be seen; true if it moved
  function clearOfTray(key) {
    const p = lastPlaced.get(key);
    if (!p || !tray.classList.contains('open') || trayTucked) return false;
    const { n, w } = pegsFor(grid.clientWidth), edge = tray.getBoundingClientRect().left - grid.getBoundingClientRect().left;
    const clear = (c) => c * (w + PEG_GAP) + p.cols * w + (p.cols - 1) * PEG_GAP <= edge;
    if (clear(p.col)) return false;
    const taken = new Set();
    lastPlaced.forEach((q, k) => { if (k !== key) for (let y = q.row; y < q.row + q.rows; y++) for (let x = q.col; x < q.col + q.cols; x++) taken.add(x + ',' + y); });
    const free = (c, r) => { for (let y = r; y < r + p.rows; y++) for (let x = c; x < c + p.cols; x++) if (taken.has(x + ',' + y)) return false; return true; };
    for (let r = 0; r <= boardRows; r++) for (let c = 0; c + p.cols <= n && clear(c); c++) {
      if (!free(c, r)) continue;
      saveCells(dashPrefs(), { ...cellsNow(), [key]: { col: c, row: r } });
      layoutBoard();
      return true;
    }
    return false;
  }
  /* ---------- the edit tray (Matt, 28 Oct) ----------
     Edit mode's side panel, sliding in from the right with the pencil (tablets and up). It holds the cards hidden from
     the board (drag one onto the board where it should go, or tap it to put it back) and the favourites, edited as on
     Home Assistant's home view: Add favourite (any device, made-up ones too), drag to reorder, the eye to show or hide
     one on the dashboard, remove, and Show suggestions. A favourite hidden from the Favourites card waits here; drag it
     back into the card where it should go. Add tile (Matt, 29 Oct) puts any device with controls on the board as its
     tile. The tray lies over the board rather than squeezing it, so the board edited is the board shown, and the tab
     on its edge tucks it away */
  const PICK_DOMAINS = /^(light|switch|cover|climate|fan|lock|valve|media_player|humidifier|vacuum|scene|script|alarm_control_panel|water_heater|input_boolean)\./;
  const tray = Object.assign(document.createElement('aside'), { className: 'tfEditTray' });
  tray.setAttribute('aria-label', 'Edit the dashboard');
  tray.innerHTML = '<button class="tfTrayTuck" type="button" data-tray-tuck></button>' +
    '<div class="tfTrayInner"><div class="tfTrayHead"><div class="activityTitle">Edit dashboard</div><button class="pill" type="button" data-tray-done>Done</button></div>' +
    '<section class="tfTraySection" data-tray="cards"></section>' +
    '<section class="tfTraySection"><div class="sectionLabel">Tiles</div><p class="tfTrayNote">Remove a tile from its ⋯.</p>' +
    '<button class="pill tfTrayAdd" type="button" data-tile-add aria-expanded="false">Add tile</button>' +
    '<div class="tfTrayPick" data-pick="tiles" hidden><input class="addInput" type="search" placeholder="Search devices" aria-label="Search devices" autocomplete="off" data-tile-search>' +
    '<ul class="tfTrayList" data-tray="tilepick"></ul></div></section>' +
    '<section class="tfTraySection"><div class="sectionLabel">Areas</div><p class="tfTrayNote">One area on its own, instead of all of them in the Areas card.</p>' +
    '<button class="pill tfTrayAdd" type="button" data-room-add aria-expanded="false">Add area</button>' +
    '<ul class="tfTrayList" data-tray="roompick" hidden></ul></section>' +
    '<section class="tfTraySection" data-tray="phone"></section>' +
    '<section class="tfTraySection"><div class="sectionLabel">Favourites</div><ul class="tfTrayList" data-tray="favs"></ul>' +
    '<button class="pill tfTrayAdd" type="button" data-fav-add aria-expanded="false">Add favourite</button>' +
    '<div class="tfTrayPick" data-pick="favs" hidden><input class="addInput" type="search" placeholder="Search devices" aria-label="Search devices" autocomplete="off" data-fav-search>' +
    '<ul class="tfTrayList" data-tray="pick"></ul></div><div class="toggleRow tfTraySuggest" data-tray="suggest"></div></section></div>';
  app.appendChild(tray);
  let trayTucked = false, trayPicking = false, tilePicking = false, roomPicking = false, favAim = null, phoneShown = false;
  const trayHtml = {};
  const trayPut = (key, html) => {
    if (trayHtml[key] === html) return;
    trayHtml[key] = html;
    const el = tray.querySelector('[data-tray="' + key + '"]');
    el.innerHTML = html;
    fillIcons(el);
  };
  const trayName = (id, meta) => '<span class="tfTrayName"><span class="activityRowName">' + esc(nameOf(id)) + '</span><span class="activityRowMeta">' + esc(meta) + '</span></span>';
  const favRow = (id, off, star) => '<li class="tfTrayFav' + (off ? ' off' : '') + '" data-tray-fav="' + esc(id) + '">' +
    '<span class="tfTrayGrip" aria-hidden="true">' + GRIP + '</span><span class="tfIcon"' + iconSlot(id, iconFor(id)) + '></span>' +
    trayName(id, off ? 'Hidden' + (whereIs.get(id) ? ' · ' + whereIs.get(id) : '') : whereIs.get(id) || valueOf(id)) +
    '<button class="tfTrayBtn" type="button" data-fav-eye="' + esc(id) + '" aria-pressed="' + !off + '" aria-label="' + (off ? 'Show ' : 'Hide ') + esc(nameOf(id)) + ' on the dashboard">' + (off ? EYE_OFF : EYE) + '</button>' +
    (star ? '<button class="tfTrayBtn" type="button" data-fav-remove="' + esc(id) + '" aria-label="Remove ' + esc(nameOf(id)) + ' from favourites">' + CROSS + '</button>' : '<span></span>') + '</li>';
  // the devices to pick from, by room: those it can take that aren't there already
  function pickHtml(q, takes, there, attr) {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const ids = Object.keys(states).filter((id) => takes(id) && !there.has(id) && states[id].state !== 'unavailable')
      .filter((id) => { const hay = (nameOf(id) + ' ' + (whereIs.get(id) || '') + ' ' + id).toLowerCase(); return words.every((w) => hay.includes(w)); })
      .sort((a, b) => (whereIs.get(a) || '~').localeCompare(whereIs.get(b) || '~') || nameOf(a).localeCompare(nameOf(b))).slice(0, 40);
    return ids.map((id) => '<li><button class="tfTrayPickItem" type="button" ' + attr + '="' + esc(id) + '"><span class="tfIcon"' + iconSlot(id, iconFor(id)) + '></span>' +
      trayName(id, whereIs.get(id) || '—') + '</button></li>').join('') || '<li class="tfTrayNote">Nothing matches.</li>';
  }
  function renderTray() {
    const show = editing && app.classList.contains('tfBoard');
    tray.classList.toggle('open', show);
    tray.classList.toggle('tucked', show && trayTucked);
    tray.toggleAttribute('inert', !show);
    if (!show) phoneShown = false;
    renderPhone();
    if (!show) return;
    const tuck = tray.querySelector('[data-tray-tuck]');
    tuck.innerHTML = trayTucked ? BACK : CHEVRON;
    tuck.setAttribute('aria-expanded', String(!trayTucked));
    tuck.setAttribute('aria-label', trayTucked ? 'Show the edit tray' : 'Tuck the edit tray away');
    const hiddenCards = dashPrefs().hidden.filter((k) => boardItems().some((it) => it.key === k));
    trayPut('cards', '<div class="sectionLabel">Hidden and new cards</div>' + (hiddenCards.length ? '<div class="tfTrayCards">' + hiddenCards.map((k) =>
      '<button class="tfTrayCard" type="button" data-tray-card="' + esc(k) + '" aria-label="' + esc(boardName(k)) + ': drag it onto the board, or press to put it back">' +
      '<span class="tfTrayGrip" aria-hidden="true">' + GRIP + '</span>' + esc(boardName(k)) + '</button>').join('') + '</div>' : '<p class="tfTrayNote">Cards you hide, and new ones, wait here.</p>'));
    trayPut('phone', '<div class="sectionLabel">Phone</div><p class="tfTrayNote">' + (dashPrefs().phone ? 'Phones have an order of their own.' : 'Phones follow the board\'s order.') + '</p>' +
      '<button class="pill tfTrayAdd" type="button" data-phone-toggle aria-pressed="' + phoneShown + '">' + (phoneShown ? 'Hide the phone' : 'Show the phone') + '</button>');
    const hidden = new Set(prefs.favHidden || []), stars = starred();
    const ids = [...stars, ...[...hidden].filter((id) => !stars.includes(id) && states[id])];
    trayPut('favs', ids.map((id) => favRow(id, hidden.has(id), stars.includes(id))).join('') || '<li class="tfTrayNote">No favourites yet.</li>');
    tray.querySelector('[data-pick="tiles"]').hidden = !tilePicking;
    tray.querySelector('[data-tile-add]').setAttribute('aria-expanded', String(tilePicking));
    if (tilePicking) trayPut('tilepick', pickHtml(tray.querySelector('[data-tile-search]').value, (id) => ACTION_DOMAINS.includes(id.split('.')[0]), new Set(tilesNow()), 'data-tile-pick'));
    // the rooms not on the board yet, in the Areas card's order
    tray.querySelector('[data-tray="roompick"]').hidden = !roomPicking;
    tray.querySelector('[data-room-add]').setAttribute('aria-expanded', String(roomPicking));
    if (roomPicking) { const there = new Set(tilesNow()); trayPut('roompick', areaRooms.filter((r) => !there.has('room:' + r.id)).map((r) => '<li><button class="tfTrayPickItem" type="button" data-room-pick="' + esc(r.id) + '">' +
      '<span class="tfIcon"><span class="tfAreaGlyph"' + iconSlot('area:' + r.id, r.icon || 'mdi:texture-box', r.name) + '></span></span><span class="tfTrayName"><span class="activityRowName">' + esc(r.name) + '</span></span></button></li>').join('') || '<li class="tfTrayNote">Every area is on the board.</li>'); }
    tray.querySelector('[data-pick="favs"]').hidden = !trayPicking;
    tray.querySelector('[data-fav-add]').setAttribute('aria-expanded', String(trayPicking));
    if (trayPicking) trayPut('pick', pickHtml(tray.querySelector('[data-fav-search]').value, (id) => PICK_DOMAINS.test(id), new Set(starred()), 'data-fav-pick'));
    trayPut('suggest', '<div><strong>Show suggestions</strong><div class="status">Fills the card after your favourites.</div></div>' +
      '<button class="switch' + (suggestOn() ? ' on' : '') + '" type="button" role="switch" aria-checked="' + suggestOn() + '" data-fav-suggest aria-label="Show suggestions"></button>');
  }
  const saveFavs = (next) => { prefs = { ...prefs, ...next }; savePrefs(); refresh(); renderTray(); };
  function setFavShown(id, show) {
    const before = prefs, hidden = new Set(prefs.favHidden || []);
    if (show) hidden.delete(id); else hidden.add(id);
    saveFavs({ favHidden: [...hidden] });
    if (show) toast(nameOf(id) + ' put back'); else toast(nameOf(id) + ' hidden', undoTo(before));
  }
  const removeFav = (id) => {
    const before = prefs;
    saveFavs({ favourites: starred().filter((x) => x !== id), favHidden: (prefs.favHidden || []).filter((x) => x !== id) });
    toast(nameOf(id) + ' removed from favourites', undoTo(before));
  };
  const addFav = (id) => { saveFavs({ favourites: [...starred().filter((x) => x !== id), id], favHidden: (prefs.favHidden || []).filter((x) => x !== id) }); toast(nameOf(id) + ' added to favourites'); };
  tray.addEventListener('click', (ev) => {
    const t = ev.target.closest('button');
    if (!t) return;
    if (t.hasAttribute('data-tray-done')) setEditing(false);
    else if (t.hasAttribute('data-tray-tuck')) { trayTucked = !trayTucked; renderTray(); }
    else if (t.hasAttribute('data-phone-toggle')) { phoneShown = !phoneShown; renderTray(); if (phoneShown) phone.querySelector('[data-phone-key]')?.focus({ preventScroll: true }); }
    else if (t.dataset.trayCard) { if (ev.detail === 0) { showCard(t.dataset.trayCard); renderTray(); } } // a press from the keyboard; a pointer's is its drag
    else if (t.dataset.favEye) setFavShown(t.dataset.favEye, t.getAttribute('aria-pressed') !== 'true');
    else if (t.dataset.favRemove) removeFav(t.dataset.favRemove);
    else if (t.hasAttribute('data-fav-add')) { trayPicking = !trayPicking; renderTray(); if (trayPicking) tray.querySelector('[data-fav-search]').focus({ preventScroll: true }); }
    else if (t.dataset.favPick) addFav(t.dataset.favPick);
    else if (t.hasAttribute('data-tile-add')) { tilePicking = !tilePicking; renderTray(); if (tilePicking) tray.querySelector('[data-tile-search]').focus({ preventScroll: true }); }
    else if (t.dataset.tilePick) addTile(t.dataset.tilePick);
    else if (t.hasAttribute('data-room-add')) { roomPicking = !roomPicking; renderTray(); }
    else if (t.dataset.roomPick) addTile('room:' + t.dataset.roomPick);
    else if (t.hasAttribute('data-fav-suggest')) saveFavs({ suggest: !suggestOn() });
  });
  tray.addEventListener('input', (ev) => { if (ev.target.matches('[data-fav-search],[data-tile-search]')) renderTray(); });
  // Escape closes the search it's in
  tray.addEventListener('keydown', (ev) => {
    const tiles = Boolean(ev.target.closest?.('[data-pick="tiles"],[data-tile-add]'));
    if (ev.key !== 'Escape' || !(tiles ? tilePicking : trayPicking)) return;
    ev.stopPropagation();
    if (tiles) tilePicking = false; else trayPicking = false;
    renderTray();
    tray.querySelector(tiles ? '[data-tile-add]' : '[data-fav-add]').focus({ preventScroll: true });
  });
  // out of the tray: a hidden card onto the board, at the cell under the pointer (a press without a drag puts it back
  // where there's room); a hidden favourite into the Favourites card, at the place under the pointer
  function dragOut(ev, el, kind, key) {
    ev.preventDefault();
    const x0 = ev.clientX, y0 = ev.clientY;
    let ghost = null, raf = 0;
    const mark = Object.assign(document.createElement('div'), { className: 'tfFavDrop' });
    const move = (e) => {
      if (!ghost) {
        if (Math.hypot(e.clientX - x0, e.clientY - y0) < 4) return;
        ghost = el.cloneNode(true);
        ghost.classList.add('tfTrayGhost');
        ghost.style.width = el.offsetWidth + 'px';
        app.appendChild(ghost);
      }
      ghost.style.transform = 'translate(' + (e.clientX - 24) + 'px,' + (e.clientY - 24) + 'px)';
      const overTray = !trayTucked && e.clientX >= tray.getBoundingClientRect().left;
      if (kind === 'card') {
        const r = grid.getBoundingClientRect(), { w } = pegsFor(grid.clientWidth);
        drag = !overTray && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top + boardTop
          ? { key, col: Math.max(0, Math.floor((e.clientX - r.left) / (w + PEG_GAP))), row: Math.max(0, Math.floor((e.clientY - r.top - boardTop) / ROW_PITCH)), fromTray: true } : null;
        if (!raf) raf = requestAnimationFrame(() => { raf = 0; layoutBoard(); });
        return;
      }
      const card = grid.querySelector('.tfDash-favs'), box = card?.getBoundingClientRect();
      favAim = null;
      if (box && !overTray && e.clientX >= box.left && e.clientX <= box.right && e.clientY >= box.top && e.clientY <= box.bottom) {
        let best = Infinity;
        card.querySelectorAll('[data-k^="fav:"]').forEach((row, i) => {
          const r = row.getBoundingClientRect(), d = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
          if (d < best) { best = d; favAim = { i, r, after: e.clientX > r.left + r.width / 2 }; }
        });
        favAim ||= { i: 0, r: null, after: false };
      }
      if (favAim?.r) {
        if (!mark.isConnected) app.appendChild(mark);
        Object.assign(mark.style, { left: (favAim.after ? favAim.r.right : favAim.r.left) - 2 + 'px', top: favAim.r.top + 8 + 'px', height: favAim.r.height - 16 + 'px' });
      } else mark.remove();
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      cancelAnimationFrame(raf);
      ghost?.remove();
      mark.remove();
      if (kind === 'card') {
        if (!ghost) showCard(key);
        else if (drag?.fromTray) {
          layoutBoard();
          const said = boardName(key) + backWord(key), dash = dashPrefs(), cells = cellsNow();
          drag = null;
          saveCells({ ...dash, hidden: dash.hidden.filter((k) => k !== key) }, cells);
          toast(said);
        }
        drag = null;
        layoutBoard();
        refresh();
        renderTray();
        return;
      }
      if (!favAim) return;
      // where it went among the shown favourites becomes its place in the list (a hidden suggestion becomes a favourite)
      const hidden = new Set(prefs.favHidden || []);
      hidden.delete(key);
      const list = starred().filter((x) => x !== key), shown = list.filter((x) => !hidden.has(x));
      const before = shown[Math.min(favAim.i + (favAim.after ? 1 : 0), shown.length)];
      list.splice(before ? list.indexOf(before) : list.length, 0, key);
      favAim = null;
      saveFavs({ favourites: list, favHidden: [...hidden] });
      toast(nameOf(key) + ' put back');
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }
  /* the mini phone (Matt, 28 Oct): opened from the edit tray's Phone section, beside the tray, only when asked. It shows
     the phone's cards as simple blocks at 80% of their phone size (about: heights measured on a 375 phone), in the
     order phones show them; drag a block, or move it with the arrow keys, to give phones their own order. Follow the
     board drops it again */
  const PHONE_H = { sums: 201, wx: 364, favs: 364, areas: 364, act: 364, energy: 288, avg: 288, aq: 288, pollen: 288, radar: 288 }, PHONE_TILE = 136, PHONE_DAC = 288, PHONE_SCALE = 0.8;
  const CARD_ICON = { wx: 'mdi:weather-partly-cloudy', areas: 'mdi:home', favs: 'mdi:star', act: 'mdi:history', energy: 'mdi:lightning-bolt', avg: 'mdi:chart-line', aq: 'mdi:air-filter', pollen: 'mdi:flower-pollen', radar: 'mdi:radar' };
  const phone = Object.assign(document.createElement('aside'), { className: 'tfMiniPhone' });
  phone.setAttribute('aria-label', 'Phone order');
  phone.innerHTML = '<div class="tfPhoneHead"><div class="activityTitle">Phone</div><button class="tfTrayBtn" type="button" data-phone-close aria-label="Close the phone">' + CROSS + '</button></div>' +
    '<p class="tfTrayNote" data-phone="note"></p><div class="tfPhoneScreen"><div class="tfPhoneList" data-phone="list"></div></div>';
  app.appendChild(phone);
  let phoneHtml = '';
  function renderPhone() {
    const show = phoneShown && editing && app.classList.contains('tfBoard') && !trayTucked;
    phone.classList.toggle('open', show);
    phone.toggleAttribute('inert', !show);
    if (!show) return;
    const cards = phoneCards().filter((it) => !dashPrefs().hidden.includes(it.key)), last = cards.length;
    const px = (h) => Math.round(h * PHONE_SCALE * 10) / 10 + 'px';
    const block = (it, i) => {
      const dac = it.el.classList.contains('tfDac'), h = it.tile ? (dac ? PHONE_DAC : PHONE_TILE) : PHONE_H[it.key] || PHONE_TILE;
      return '<button class="tfPhoneBlock' + (it.tile ? ' tile' : '') + '" type="button" data-phone-key="' + esc(it.key) + '" style="min-height:' + px(h) + '" aria-label="' +
        esc(boardName(it.key) + ', ' + (i + 1) + ' of ' + last + '. Drag, or use the arrow keys, to move it') + '">' +
        '<span class="tfIcon"' + (it.tile ? iconSlot(it.key, iconFor(it.key)) : iconSlot(it.key, CARD_ICON[it.key])) + '></span><span class="tfPhoneName">' + esc(boardName(it.key)) + '</span></button>';
    };
    const html = '<div class="tfPhoneTitle">' + esc(grid.querySelector('.tfDashTitle')?.textContent || '') + '</div>' +
      '<div class="tfPhoneBlock fixed" style="min-height:' + px(PHONE_H.sums) + '"><span class="tfPhoneName">' + esc(boardName('sums')) + '</span></div>' + cards.map(block).join('');
    phone.querySelector('[data-phone="note"]').innerHTML = dashPrefs().phone
      ? 'Phones use this order. <button class="tfLinkBtn" type="button" data-phone-reset>Follow the board</button>'
      : 'Phones follow the board. Drag a card to give them an order of their own.';
    if (html === phoneHtml) return;
    phoneHtml = html;
    const list = phone.querySelector('[data-phone="list"]');
    list.innerHTML = html;
    fillIcons(list);
  }
  function savePhone(keys, focusKey) {
    saveDash({ ...dashPrefs(), phone: keys });
    renderTray();
    if (focusKey) phone.querySelector('[data-phone-key="' + CSS.escape(focusKey) + '"]')?.focus({ preventScroll: true });
  }
  const phoneKeysNow = () => [...phone.querySelectorAll('[data-phone-key]')].map((b) => b.dataset.phoneKey);
  // a block dragged among the others: before or after the one under the pointer (tiles sit two to a row, so by x)
  function phoneDrag(ev, el) {
    ev.preventDefault();
    const list = el.parentElement, screen = phone.querySelector('.tfPhoneScreen'), was = phoneKeysNow().join();
    el.classList.add('moving');
    const move = (e) => {
      const s = screen.getBoundingClientRect();
      if (e.clientY > s.bottom - 40) screen.scrollTop += 12; else if (e.clientY < s.top + 40) screen.scrollTop -= 12;
      const over = [...list.querySelectorAll('[data-phone-key]')].find((x) => { const r = x.getBoundingClientRect(); return x !== el && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; });
      if (!over) return;
      const r = over.getBoundingClientRect(), before = over.classList.contains('tile') ? e.clientX < r.left + r.width / 2 : e.clientY < r.top + r.height / 2;
      list.insertBefore(el, before ? over : over.nextSibling);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      el.classList.remove('moving');
      const keys = phoneKeysNow();
      phoneHtml = '';
      if (keys.join() !== was) savePhone(keys); else renderPhone();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }
  phone.addEventListener('pointerdown', (ev) => {
    const b = ev.target.closest('[data-phone-key]');
    if (b && ev.button <= 0) phoneDrag(ev, b);
  });
  phone.addEventListener('click', (ev) => {
    const t = ev.target.closest('button');
    if (t?.hasAttribute('data-phone-close')) { phoneShown = false; renderTray(); tray.querySelector('[data-phone-toggle]')?.focus({ preventScroll: true }); }
    else if (t?.hasAttribute('data-phone-reset')) { const { phone: _, ...rest } = dashPrefs(); saveDash(rest); renderTray(); }
  });
  phone.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') { ev.stopPropagation(); phoneShown = false; renderTray(); tray.querySelector('[data-phone-toggle]')?.focus({ preventScroll: true }); return; }
    const key = ev.target.closest?.('[data-phone-key]')?.dataset.phoneKey, step = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 }[ev.key];
    if (!key || !step) return;
    ev.preventDefault();
    const keys = phoneKeysNow(), i = keys.indexOf(key), j = i + step;
    if (j < 0 || j >= keys.length) return;
    [keys[i], keys[j]] = [keys[j], keys[i]];
    savePhone(keys, key);
  });
  // the favourites' order, by their grips
  function reorderFav(ev, li) {
    ev.preventDefault();
    const list = li.parentElement;
    li.classList.add('moving');
    const move = (e) => {
      const over = [...list.children].find((x) => { const r = x.getBoundingClientRect(); return x !== li && e.clientY >= r.top && e.clientY <= r.bottom; });
      if (over) { const r = over.getBoundingClientRect(); list.insertBefore(li, e.clientY < r.top + r.height / 2 ? over : over.nextSibling); }
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      li.classList.remove('moving');
      const stars = new Set(starred());
      trayHtml.favs = null;
      saveFavs({ favourites: [...list.children].map((x) => x.dataset.trayFav).filter((id) => stars.has(id)) });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }
  tray.addEventListener('pointerdown', (ev) => {
    if (ev.button > 0) return;
    const card = ev.target.closest('[data-tray-card]'), fav = ev.target.closest('.tfTrayFav');
    if (card) dragOut(ev, card, 'card', card.dataset.trayCard);
    else if (fav && ev.target.closest('.tfTrayGrip')) reorderFav(ev, fav);
    else if (fav?.classList.contains('off') && !ev.target.closest('button')) dragOut(ev, fav, 'fav', fav.dataset.trayFav);
  });
  // dragging: the card follows the pointer and lands on the nearest cell; cards in the way move down to make room
  function boardDown(ev) {
    if (!editing || ev.button !== 0 || ev.target.closest('[data-board-more],.tfBoardMenu,.tfFavHides')) return;
    const el = ev.target.closest('.tfBoardItem');
    const it = el && boardItems().find((x) => x.el === el);
    if (!it || HEAD.includes(it.key)) return;
    const p = lastPlaced.get(it.key), { w } = pegsFor(grid.clientWidth);
    if (!p) return;
    ev.preventDefault();
    closeBoardMenu();
    const x0 = ev.clientX, y0 = ev.clientY;
    let started = false, raf = 0;
    const move = (e) => {
      const dx = e.clientX - x0, dy = e.clientY - y0;
      if (!started) { if (Math.hypot(dx, dy) < 4) return; started = true; drag = { key: it.key, col: p.col, row: p.row }; el.classList.add('tfDragging'); }
      el.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      drag.col = Math.round((p.x + dx) / (w + PEG_GAP));
      drag.row = Math.round((p.y + dy - boardTop) / ROW_PITCH);
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; layoutBoard(); });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      if (!started) return;
      cancelAnimationFrame(raf);
      layoutBoard();
      el.classList.remove('tfDragging');
      el.style.transform = '';
      drag = null;
      saveCells(dashPrefs(), cellsNow());
      layoutBoard();
      refresh();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }
  // Energy today's graph: the picked source's last 24 hours (made-up energy rises from midnight), drawn again only when
  // the source or the graph's size changes; a new pick draws in
  function drawDashGraph(animate = false) {
    const svg = grid?.querySelector('.tfDashGraph svg[data-graph]');
    if (!svg?.clientWidth) return;
    // drawn again when it's resized, picked or five minutes old
    const drawn = svg.dataset.graph + '@' + svg.clientWidth + 'x' + svg.clientHeight + '@' + Math.floor(Date.now() / 300000);
    if (svg.dataset.drawn === drawn) return;
    const first = !svg.dataset.drawn;
    svg.dataset.drawn = drawn;
    const src = energyTiles.find((t) => t.id === svg.dataset.graph);
    if (src) drawEnergyDay(svg, src).then(() => { if (animate || first) rise(svg); });
    else drawHistory(svg.dataset.graph, svg).then(() => { if (animate) drawIn(svg); });
  }

  /* the page: areas, Home (weather, vacuum), then each room: its label, readings, plants and action tiles */
  function layout() {
    model = house.model(getHass());
    seedFavourites();
    states = model.states;
    // Settings → Sources: the grid's power and the alarm, when picked
    if (states[prefs.sources?.grid]) model.grid = prefs.sources.grid;
    if (states[prefs.sources?.alarm]) model.security.alarms = [prefs.sources.alarm];
    // a cover's goal goes once it's there and still (or after two minutes, if it never says)
    goals.forEach((g, id) => {
      const st = states[id], a = st?.attributes || {};
      if (!st || Date.now() - g.at > 2 * 60 * 1000) { goals.delete(id); return; }
      if (g.pos != null && st.state !== 'opening' && st.state !== 'closing' && Math.abs(posOf(id) - g.pos) < 1) delete g.pos;
      if (g.tilt != null && Math.abs((a.current_tilt_position ?? -1) - g.tilt) < 1) delete g.tilt;
      if (g.pos == null && g.tilt == null) goals.delete(id);
    });
    const out = [];
    let order = 0;
    const secs = sectionsOf();
    areaRooms = secs.filter((x) => x.room).map((x) => x.room);
    if (!areaRooms.some((r) => r.id === activeArea)) activeArea = areaRooms[0]?.id || null;
    // Home is the dashboard (Matt, 27 Oct: no house page any more). A section has its own page: a room's from its area
    // card's Go; its header, then only that section. The weather card opens the Weather
    // page: its header and the whole bento
    const page = areaPage === 'weather' ? { key: 'weather', name: 'Weather' } : DEMO_PAGES[areaPage] ? { key: areaPage, name: DEMO_PAGES[areaPage], demo: true } : areaPage && secs.find((x) => x.key === areaPage);
    if (!page) areaPage = null;
    app.classList.toggle('tfAreaOpen', Boolean(page));
    app.classList.toggle('tfWeatherOpen', page?.key === 'weather');
    app.classList.toggle('tfDash', !page);
    whereIs = new Map();
    model.rooms.forEach((r) => [...r.actions, ...r.plugs, ...r.readings, ...r.openings, ...r.solar, ...r.plants.flatMap((p) => [p.id, ...p.readings])].forEach((id) => whereIs.set(id, r.name)));
    if (!page) return dashboard(out, summaryData());
    out.push({ key: 'areahead', html: areaHead(page, ++order) });
    if (page.key === 'weather') { out.weather = ++order; return out; }
    if (page.demo) return demoPage(out, page.key, order);
    // the section: a room's energy, readings and plants, then its tiles
    const ids = page.ids, name = page.room ? page.room.id : page.key, r = page.room;
    if (r?.solar.length) out.push({ key: 'energy:' + r.id, html: energyCard(r, ++order) });
    if (r && (r.readings.length || r.plugs.length || r.power != null)) out.push({ key: 'readings:' + r.id, html: roomCard(r, ++order) });
    r?.plants.forEach((p) => out.push({ key: 'plant:' + p.id, html: plantCard(p, ++order) }));
    if (ids.length) out.push({ key: 'block:' + name, order: ++order, tiles: ids.map((id) => ({ key: id, html: actionTile(id) })) });
    return out;
  }
  /* HomeCore demo (9 Nov): the Activity page the site's ⋯ opens (Matt: "I want it to be the Activity page basically";
     was Logbook), Home's Activity card on a page of its own, so it stays live. (Energy, History and Media pages went
     the same day: Matt, "they confuse it") */
  const DEMO_PAGES = { activity: 'Activity' };
  function demoPage(out, key, order) {
    if (key === 'activity') {
      const items = activityItems();
      out.push({ key: 'dash:act', html: card('dash:act', ++order, 'Activity', items.length ? items.map(activityRow) : ['<p class="tfDashNone">Nothing has changed in the last day.</p>'], '', null, 'tfDashCard tfDash-act') });
      loadActivity();
    }
    return out;
  }
  // a section's page header, as Move Assistant's pages have: a big back arrow and the section's name
  const areaHead = (x, order) => '<div class="settingsHeader tfAreaHead" data-tf data-k="areahead" style="order:' + order + '">' +
    '<button class="back" type="button" data-area-back aria-label="Back to the house">' + BACK + '</button><div class="settingsTitle">' + esc(x.name) + '</div></div>';
  // a room's Go opens its section's page at its top; back returns to the house exactly where
  // you were (Matt, 28 Oct). Scrolling it into view instead would tuck its title under Home Assistant's top bar
  let leftAt = 0, leftTop = null; // how far the house was scrolled when a page opened, and where its opener was on screen
  // the card a page opened from: the weather card or the areas
  const openerOf = (key) => (key === 'weather' ? dashBoxes.wx : (key.startsWith('room:') && grid.querySelector('.tfRoomTile[data-k="' + CSS.escape(key) + '"]')) || grid.querySelector('.tfAreas'));
  function openArea(key) {
    if (!areaPage) { leftAt = scroller().scrollTop; leftTop = openerOf(key)?.getBoundingClientRect().top ?? null; }
    areaPage = key;
    if (key.startsWith('room:')) activeArea = key.slice(5);
    render();
    scroller().scrollTop = 0;
    grid.querySelector('[data-area-back]')?.focus({ preventScroll: true });
  }
  // back on the house, the card you left from stays where it was on screen while the rest finishes drawing (1.5 s, or
  // until you touch or scroll), so nothing that's drawn late moves the page under you
  let holdStop = null;
  function holdPlace(find, top) {
    holdStop?.();
    if (top == null) return;
    const sc = scroller(), until = performance.now() + 1500, quit = ['wheel', 'touchstart', 'pointerdown', 'keydown'];
    let raf = 0;
    const stop = () => { cancelAnimationFrame(raf); quit.forEach((t) => window.removeEventListener(t, stop, true)); holdStop = null; };
    const fix = () => {
      const el = find();
      if (el?.isConnected) { const off = el.getBoundingClientRect().top - top; if (Math.abs(off) > 0.5) sc.scrollTop += off; }
      if (performance.now() < until) raf = requestAnimationFrame(fix); else stop();
    };
    quit.forEach((t) => window.addEventListener(t, stop, { capture: true, passive: true }));
    holdStop = stop;
    fix();
  }
  function closeArea() {
    const key = areaPage;
    areaPage = null;
    render();
    scroller().scrollTop = leftAt;
    holdPlace(() => openerOf(key), leftTop);
    const panel = key.startsWith('room:') ? grid.querySelector('.tfRoomTile[data-k="' + CSS.escape(key) + '"]') || grid.querySelector('.tfAreaPanel[data-area="' + CSS.escape(key.slice(5)) + '"]')
      : key === 'weather' ? dashBoxes.wx.querySelector('.wbOpenPage') : grid.querySelector('[data-k="sum:' + CSS.escape(key) + '"]');
    (panel?.querySelector('[data-go]') || panel)?.focus({ preventScroll: true });
  }
  const blockHtml = (n) => (n.wrap ? n.wrap(n.tiles.map((t) => t.html).join(''), n)
    : '<div class="tfBlock" data-tf data-k="' + esc(n.key) + '" style="order:' + n.order + '"><div class="tfActions">' + n.tiles.map((t) => t.html).join('') + '</div></div>');
  const signOf = (out) => out.map((n) => n.key + (n.tiles ? '(' + n.tiles.map((t) => t.key).join(',') + ')' : '')).join(';');

  // what scrolls the page: a scrolling box round the card if there is one, else the window (Home Assistant's
  // dashboards scroll the window, under its fixed top bar)
  function scroller() {
    for (let el = app.parentElement || app.getRootNode().host; el; el = el.parentElement || el.getRootNode().host) {
      const y = getComputedStyle(el).overflowY;
      if ((y === 'auto' || y === 'scroll') && el.scrollHeight > el.clientHeight) return el;
    }
    return document.scrollingElement;
  }
  // a redraw never moves the page (Matt, 28 Oct: "the page jumps to a seemingly random spot"): whatever card is on
  // the screen stays exactly where it was, even when something above it changes height (Safari doesn't do this itself)
  function keepPlace(change) {
    const sc = scroller(), onScreen = (el) => { const r = el.getBoundingClientRect(); return r.height && r.bottom > 0 && r.top < window.innerHeight; };
    const mark = [...grid.children, ...grid.querySelectorAll('.tfDashTiles > *')].find((el) => !el.matches('.tfDashTiles') && onScreen(el));
    const key = mark?.dataset.k, was = mark?.getBoundingClientRect().top;
    change();
    const now = mark?.isConnected ? mark : key && grid.querySelector('[data-k="' + CSS.escape(key) + '"]');
    if (now?.isConnected && was != null) sc.scrollTop += now.getBoundingClientRect().top - was;
  }
  function render() {
    if (!testFocus || !grid) return;
    // the new page is ready before the old one goes, so the page never stands empty (it would lose its scroll)
    const out = layout();
    // the icons already drawn go into the new page's same slots, so a full redraw (the favourites settling a moment
    // after the page opens, an area opening) doesn't blank every icon while they load again (Matt, 8 Nov: flicker)
    const slotKey = (slot) => (slot.closest('[data-k]')?.dataset.k || '') + '|' + slot.dataset.iconFor + '|' + (slot.dataset.iconName || '');
    const drawn = new Map();
    grid.querySelectorAll('[data-tf] [data-icon-for]').forEach((slot) => { if (slot.firstElementChild) (drawn.get(slotKey(slot)) || drawn.set(slotKey(slot), []).get(slotKey(slot))).push(slot.firstElementChild); });
    grid.querySelectorAll('[data-tf]').forEach((el) => el.remove());
    units.clear();
    const wrap = document.createElement('div');
    wrap.innerHTML = out.map((n) => (n.tiles ? blockHtml(n) : n.html)).join('');
    out.forEach((n) => (n.tiles ? n.tiles.forEach((t) => units.set(t.key, t.html)) : units.set(n.key, n.html)));
    signature = signOf(out);
    wrap.querySelectorAll('[data-icon-for]').forEach((slot) => { const el = !slot.firstElementChild && drawn.get(slotKey(slot))?.shift(); if (el) slot.appendChild(el); });
    grid.append(...wrap.children);
    placeBento(out.weather);
    placeDash(true);
    itemSizes.disconnect();
    layoutBoard();
    fillIcons(grid);
    mountArt(grid);
    mountDacs(grid);
    syncSettings();
    if (open) drawHistory(open.id);
    drawSolar();
    renderMore();
    tidyArts();
    requestAnimationFrame(measureDensity);
  }

  // Redraw only what changed, so a held bar or a focused button isn't replaced under the pointer
  // after a redraw, focus what was: the same label, or else the same action (a toggle's label flips when it's pressed)
  const focusOf = (scope) => { const f = root.activeElement && scope.contains(root.activeElement) ? root.activeElement : null; return f && { label: f.getAttribute('aria-label'), act: f.dataset?.act }; };
  const refocus = (scope, was) => { if (!was) return; ((was.label && scope.querySelector('[aria-label="' + CSS.escape(was.label) + '"]')) || (was.act && scope.querySelector('[data-act="' + CSS.escape(was.act) + '"]')))?.focus({ preventScroll: true }); };
  // swaps an element for its redrawn self. A Dual Axis Controller's pad stays where it is (moved, the controller draws
  // again from nothing, under a finger too): its tile takes its new head and colours in place, and what holds it, its
  // new attributes
  function swapIn(old, next) {
    if (!old.querySelector('.tfDacPad')) { old.replaceWith(next); return next; }
    const pad = old.matches('.tfDac') && old.querySelector(':scope > .tfDacPad'), fresh = next.querySelector(':scope > .tfDacPad');
    if (pad) {
      if (fresh?.dataset.dac !== pad.dataset.dac) { old.replaceWith(next); return next; }
      old.querySelector(':scope > .tfActionHead').replaceWith(next.querySelector(':scope > .tfActionHead'));
      old.classList.toggle('on', next.classList.contains('on'));
      ['data-light', 'data-tone'].forEach((a) => (next.hasAttribute(a) ? old.setAttribute(a, next.getAttribute(a)) : old.removeAttribute(a)));
      // the light's colours; the board's own (--tf-…, its place and size) stay
      [...old.style].filter((v) => v.startsWith('--') && !v.startsWith('--tf-')).forEach((v) => old.style.removeProperty(v));
      [...next.style].forEach((v) => old.style.setProperty(v, next.style.getPropertyValue(v)));
      return old;
    }
    // an icon that's already drawn stays (Matt, 8 Nov: icons flickered): the redrawn slot comes empty, and swapped in
    // it stood blank until its icon loaded again. Same icon, so only its attributes change; fillIcons updates it in place
    const slot = (el) => el.dataset?.iconFor !== undefined;
    if (slot(old) && slot(next) && !next.children.length && old.dataset.iconFor === next.dataset.iconFor && old.dataset.iconName === next.dataset.iconName && old.firstElementChild) {
      [...old.attributes].forEach((a) => { if (!next.hasAttribute(a.name)) old.removeAttribute(a.name); });
      [...next.attributes].forEach((a) => { if (old.getAttribute(a.name) !== a.value) old.setAttribute(a.name, a.value); });
      return old;
    }
    if (old.tagName !== next.tagName || old.children.length !== next.children.length) { old.replaceWith(next); return next; }
    [...old.attributes].forEach((a) => { if (!next.hasAttribute(a.name)) old.removeAttribute(a.name); });
    [...next.attributes].forEach((a) => old.setAttribute(a.name, a.value));
    const kids = [...next.children];
    [...old.children].forEach((c, i) => swapIn(c, kids[i]));
    return old;
  }
  function replace(el, html) {
    const t = document.createElement('div');
    t.innerHTML = html;
    const was = focusOf(el), now = swapIn(el, t.firstElementChild);
    fillIcons(now);
    mountArt(now);
    mountDacs(now);
    refocus(now, was);
  }
  function refresh() {
    if (!testFocus || !grid || drag) return;
    keepPlace(redraw);
  }
  function redraw() {
    if (!grid.querySelector('[data-tf]')) { render(); return; }
    const out = layout();
    if (signOf(out) !== signature) { render(); return; }
    // a tile is held while one of its device's bars or drawing is (a favourite holds its device too)
    const isHeld = (key) => [...dragging.keys()].some((k) => {
      const id = k.slice(k.indexOf('|') + 1);
      return key === id || key.endsWith(':' + id);
    });
    out.forEach((n) => (n.tiles || [n]).forEach((u) => {
      if (units.get(u.key) === u.html || isHeld(u.key)) return;
      const el = grid.querySelector('[data-k="' + CSS.escape(u.key) + '"]');
      if (!el) return;
      units.set(u.key, u.html);
      // an open reading keeps its graph; only its value changes
      if (open && open.key === u.key && el.querySelector('.tfOpen')) { el.querySelector('.tfOpen .activityRowMeta').textContent = openValue(open.id); return; }
      replace(el, u.html);
      if (open && open.key === u.key) drawHistory(open.id);
      if (u.key.startsWith('energy:')) drawSolar();
    }));
    renderMore();
    tidyArts();
    syncDacs();
    syncSettings();
    bento?.update();
    dashBentos?.forEach((b) => b.update());
    if (app.classList.contains('tfDash')) queueFit();
    requestAnimationFrame(measureDensity);
  }

  /* more-info: this page's own, for every device, so its layout can be tried with real ones too (Matt, 27 Oct) */
  const DETAILS = {
    light: (a) => [['Brightness', a.brightness != null ? Math.round(a.brightness / 2.55) + '%' : null], ['Colour temperature', a.color_temp_kelvin ? Number(a.color_temp_kelvin).toLocaleString() + ' K' : null], ['Colour mode', a.color_mode && cap(a.color_mode)]],
    climate: (a) => [['Current temperature', num(a.current_temperature) + ' °C'], ['Target', num(a.temperature) + ' °C'], ['Action', cap(a.hvac_action)]],
    cover: (a) => [['Position', a.current_position != null ? a.current_position + '% open' : null], ['Tilt', a.current_tilt_position != null ? a.current_tilt_position + '% open' : null]],
    humidifier: (a) => [['Current humidity', a.current_humidity + '%'], ['Target', a.humidity + '%'], ['Mode', cap(a.mode)]],
    media_player: (a) => [['Title', a.media_title], ['Artist', a.media_artist], ['Volume', a.volume_level != null ? Math.round(a.volume_level * 100) + '%' : null], ['Source', a.source]],
    vacuum: (a) => [['Battery', a.battery_level + '%'], ['Fan speed', cap(a.fan_speed)], ['Rooms', (a.rooms || []).join(', ') || null]],
    lock: (a) => [['Changed by', a.changed_by]],
    alarm_control_panel: (a) => [['Changed by', a.changed_by]],
    valve: () => [],
    plant: (a) => [['Moisture', a.moisture + '%'], ['Light', Number(a.brightness).toLocaleString() + ' lx'], ['Temperature', num(a.temperature) + ' °C'], ['Fertility', a.conductivity + ' µS/cm'], ['Problems', a.problem === 'none' ? 'None' : cap(a.problem)]],
    weather: (a) => [['Temperature', a.temperature != null ? a.temperature + ' ' + (a.temperature_unit || '°C') : null], ['Humidity', a.humidity != null ? a.humidity + '%' : null], ['Wind', a.wind_speed != null ? a.wind_speed + ' ' + (a.wind_speed_unit || 'km/h') : null], ['Pressure', a.pressure != null ? a.pressure + ' ' + (a.pressure_unit || 'hPa') : null]],
  };
  const detailsHtml = (id) => {
    const rows = (DETAILS[id.split('.')[0]]?.(attr(id)) || []).filter(([, v]) => v != null && v !== '');
    return rows.length ? '<div class="tfMoreRows">' + rows.map(([k, v]) => '<div class="tfMoreRow"><span>' + esc(k) + '</span><span>' + esc(v) + '</span></div>').join('') + '</div>' : '';
  };
  const madeUpNote = (id) => (isMadeUp(id) ? '<div class="tfMoreNote">Made up for this page</div>' : '');
  // devices by group, as tiles
  function listHtml(groups, opts = {}, single = false) {
    return '<div class="tfMoreList">' + groups.map((g) => '<div class="tfMoreGroup"><div class="tfMoreGroupName">' + esc(g.name) + '</div>' +
      '<div class="tfMoreTiles' + (single ? ' single' : '') + '">' + g.ids.map((x) => deviceRow(x, opts)).join('') + '</div></div>').join('') + '</div>';
  }
  const sheet = document.createElement('div');
  sheet.className = 'tfMoreBackdrop';
  sheet.hidden = true;
  app.appendChild(sheet);
  // while a popup is open the page behind it stays still (Matt, 28 Oct): a swipe or wheel only scrolls what's inside
  // the popup, and nothing once that's at its end; on the dark round it, nothing at all. Sideways swipes and the
  // popup's own controls are left alone
  const scrollsInside = (from, dy) => {
    for (let el = from; el && el !== sheet; el = el.parentElement) {
      const y = getComputedStyle(el).overflowY;
      if ((y === 'auto' || y === 'scroll') && el.scrollHeight > el.clientHeight + 1 && (dy < 0 ? el.scrollTop > 0 : el.scrollTop + el.clientHeight < el.scrollHeight - 1)) return true;
    }
    return false;
  };
  let touchAt = null;
  sheet.addEventListener('touchstart', (ev) => { touchAt = { x: ev.touches[0].clientX, y: ev.touches[0].clientY }; }, { passive: true });
  sheet.addEventListener('touchmove', (ev) => {
    if (!touchAt || ev.touches.length > 1 || ev.target.closest?.('input,textarea,select')) return;
    const t = ev.touches[0], dx = touchAt.x - t.clientX, dy = touchAt.y - t.clientY;
    touchAt = { x: t.clientX, y: t.clientY };
    if (Math.abs(dy) >= Math.abs(dx) && !scrollsInside(ev.target, dy)) ev.preventDefault();
  }, { passive: false });
  sheet.addEventListener('wheel', (ev) => { if (!scrollsInside(ev.target, ev.deltaY)) ev.preventDefault(); }, { passive: false });
  // a device's details sit behind a Details button and roll out beside the dialog, which stays where it is (Matt,
  // 27 Oct); where there's no room beside it (always on phones) they open over the top of it
  function fitDetails() {
    const pair = sheet.querySelector('.tfMorePair'), box = sheet.querySelector('.tfMore');
    pair?.classList.toggle('over', window.innerWidth <= 620 || (window.innerWidth - box.offsetWidth) / 2 < 312 + 16);
  }
  window.addEventListener('resize', fitDetails, { passive: true });
  if (testFocus) applyLook();
  // the dialog's parts, one element each. A device: name, state and when it changed, a cover's drawing, the tile's
  // sections, and a Details button (its details and the made-up note open beside it). A summary: its line, then its
  // devices by room. The favourites list (the only place to star, Matt 27 Oct): every device with a star, starred first
  let moreParts = [];
  const special = (id) => id === 'favourites' || id.startsWith('summary:') || id.startsWith('group:');
  function partsOf(id) {
    const head = (title, extra = '') => '<div class="tfMoreHead">' + (more?.back ? '<button class="tfBack" type="button" data-more-back aria-label="Back">' + ARROW + '</button>' : '') +
      '<div class="activityTitle" id="tfMoreTitle">' + esc(title) + '</div>' + extra + '<button class="tfBack" type="button" data-more-close aria-label="Close">' + CLOSE + '</button></div>';
    const now = (text, sub) => '<div class="tfMoreNow"><div class="tfMoreState">' + esc(text) + '</div>' + (sub ? '<div class="tfMoreSub">' + esc(sub) + '</div>' : '') + '</div>';
    const list = listHtml;
    if (id === 'favourites') {
      const stars = starred(), inStars = new Set(stars);
      const groups = [{ name: 'Starred', ids: stars }, { name: 'Home', ids: model.homeVacuums }, { name: 'Security', ids: [...model.security.alarms, ...model.security.locks] }, ...model.rooms.map((r) => ({ name: r.name, ids: [...r.actions, ...r.plugs] }))]
        .map((g, i) => (i ? { ...g, ids: g.ids.filter((x) => !inStars.has(x)) } : g)).filter((g) => g.ids.length);
      return [head('Favourites'), now(stars.length ? stars.length + ' starred' : 'None starred'), list(groups, { star: true }, true)];
    }
    // a group of devices in one grid (Matt, 29 Oct: one grid, one width): devices first, each its tile with all its
    // controls, then readings as tiles of the same width. Plain (Maintenance): every device is a reading, and a vacuum
    // says only its battery
    const groupGrid = (ids, { name = '', alert = false, plain = false } = {}) => {
      const tiles = plain ? [] : ids.filter((x) => ACTION_DOMAINS.includes(x.split('.')[0])), rows = ids.filter((x) => !tiles.includes(x));
      const battery = (x) => (x.startsWith('vacuum.') && attr(x).battery_level != null ? attr(x).battery_level + '%' : null);
      return '<div class="tfMoreGroup">' + (name ? '<div class="tfMoreGroupName">' + esc(name) + '</div>' : '') + '<div class="tfMoreActions">' +
        tiles.map((x) => actionTile(x, true)).join('') + rows.map((x) => deviceRow(x, { plain, alert, say: plain ? battery(x) : null })).join('') + '</div></div>';
    };
    // a summary (Matt, 27 Oct: room to breathe, and more control than opening tiles): its line, with all on or off for
    // the lights, then its devices by room. A group named as the popup is (Energy's) goes without its name
    if (id.startsWith('summary:')) {
      const s = summaryData().find((x) => x.key === id.slice(8));
      if (!s) return null;
      const lights = s.key === 'light' ? (s.groups || []).flatMap((g) => g.ids) : [], anyOn = lights.some((x) => states[x]?.state === 'on');
      const all = lights.length ? '<button class="primary" type="button" data-acts="' + acts(lights.map((x) => ['light', anyOn ? 'turn_off' : 'turn_on', x])) + '">' + (anyOn ? 'Turn all off' : 'Turn all on') + '</button>' : '';
      return [head(s.name), '<div class="tfMoreNowRow">' + now(s.value) + all + '</div>', ...(s.groups || []).map((g) => groupGrid(g.ids, { name: g.name === s.name ? '' : g.name, alert: g.alert, plain: s.plain }))];
    }
    // a room's lights, covers or plugs, opened from its area card's tile (Matt, 27 Oct): laid out as a summary, all on or
    // off beside its line
    if (id.startsWith('group:')) {
      const [, roomId, key] = id.split(':'), r = model.rooms.find((x) => x.id === roomId), k = r && roomKeys(r).find((x) => x.key === key);
      if (!k) return null;
      const all = k.acts ? '<button class="primary" type="button" data-acts="' + acts(k.acts) + '">' + (k.on ? 'Turn all off' : 'Turn all on') + '</button>' : '';
      return [head(r.name + ' ' + k.label.toLowerCase()), '<div class="tfMoreNowRow">' + now(k.value) + all + '</div>', groupGrid(groupIds(r, key))];
    }
    const d = id.split('.')[0], st = states[id];
    const s = ACTION_DOMAINS.includes(d) ? specFor(id) : { sections: [] };
    return [
      head(nameOf(id)),
      now(valueOf(id), st.last_changed && ago(Date.parse(st.last_changed))),
      more?.at && '<svg class="tfGraph tfDay" data-day="' + esc(id) + '" role="img" aria-label="' + esc(nameOf(id)) + ', last 24 hours"></svg>',
      d === 'cover' && '<div data-cover-art="' + esc(id) + '"></div>',
      ...s.sections.filter(Boolean),
      detailsOf(id) && '<button class="tfDetailsBtn" type="button" data-details aria-expanded="' + Boolean(more?.details) + '" aria-controls="tfMoreSide"><span>Details</span>' + CHEVRON + '</button>',
    ].filter(Boolean);
  }
  const detailsOf = (id) => (special(id) ? '' : detailsHtml(id) + madeUpNote(id));
  let moreSide = '';
  function toggleDetails(open) {
    if (!more) return;
    more.details = open;
    renderMore();
    sheet.querySelector(open ? '[data-details-close]' : '[data-details]')?.focus({ preventScroll: true });
  }
  // a cover's drawing in its window: kept across redraws so it can keep moving
  const coverView = (id) => {
    const st = states[id], pos = posOf(id), target = coverValue(id);
    return { kind: coverKind(st), name: nameOf(id), text: valueOf(id), pos, target: Math.abs(target - pos) > 0.5 ? target : null, moving: st.state === 'opening' || st.state === 'closing', tilt: tiltOf(id) ?? 100, canSet: has(id, SET_POSITION) };
  };
  // a cover's drawing in each place it's drawn (its tile, the dialog), kept across redraws so it can keep moving
  function mountArt(scope) {
    scope.querySelectorAll('[data-cover-art]').forEach((slot) => {
      const id = slot.dataset.coverArt, key = slot.dataset.artKey || 'more:' + id;
      let art = arts.get(key);
      if (!art) { art = createCoverArt({ onMove: (v) => holdCover(id, v), onSet: (v) => { holdCover(id, v); commit('pos', id); } }); art.coverId = id; arts.set(key, art); }
      slot.replaceWith(art.el);
      art.update(coverView(id));
    });
  }
  const artsOf = (id) => [...arts.values()].filter((art) => art.coverId === id);
  const syncArts = () => arts.forEach((art) => { if (states[art.coverId]) art.update(coverView(art.coverId)); });
  // a drawing no longer on the page (its dialog closed, or its tile stopped showing it) stops
  const tidyArts = () => { arts.forEach((art, key) => { if (!art.el.isConnected) { art.destroy(); arts.delete(key); } }); syncArts(); };
  function renderMore() {
    if (!more || !(special(more.id) || states[more.id])) { sheet.hidden = true; return; }
    if ([...dragging.keys()].some((k) => k.endsWith('|' + more.id))) { syncArts(); return; }
    const parts = partsOf(more.id), box = sheet.querySelector('.tfMore');
    if (!parts) { closeMore(); return; }
    const was = focusOf(sheet), side = detailsOf(more.id);
    const wide = more.frame ? more.frame.wide : more.id.startsWith('summary:') || more.id.startsWith('group:');
    if (sheet.hidden || !box || parts.length !== moreParts.length || box.classList.contains('wide') !== wide) {
      // drawn again while open (a light turning off loses its colour): it stays scrolled where it was. A new page in it
      // starts at its top, and Back returns to where that page was left
      const keep = turning ? more.scroll || 0 : !sheet.hidden && box ? box.scrollTop : 0;
      // the dialog and, beside it, its details: one dialog for screen readers. Already open, it doesn't rise in again
      sheet.innerHTML = '<div class="tfMorePair' + (sheet.hidden ? '' : ' still') + '" role="dialog" aria-modal="true" aria-labelledby="tfMoreTitle"><section class="tfMore' + (wide ? ' wide' : '') + '"' + (more.frame ? ' style="height:' + more.frame.h + 'px"' : '') + '>' + parts.join('') + '</section>' +
        (side ? '<aside class="tfMoreSide" id="tfMoreSide" aria-label="Details"><div class="tfMoreSideInner"><div class="tfMoreHead"><button class="tfBack" type="button" data-details-close aria-label="Back">' + ARROW + '</button>' +
          '<div class="activityTitle">Details</div></div><div class="tfMoreSideBody">' + side + '</div></div></aside>' : '') + '</div>';
      moreSide = side;
      sheet.classList.toggle('wide', wide);
      sheet.hidden = false;
      fitDetails();
      mountArt(sheet);
      mountDacs(sheet);
      fillIcons(sheet);
      sheet.querySelectorAll('[data-day]').forEach((svg) => drawDay(svg.dataset.day, svg, more.at));
      if (keep) sheet.querySelector('.tfMore').scrollTop = keep;
      refocus(sheet, was);
      if (!sheet.contains(root.activeElement)) sheet.querySelector('[data-more-close]')?.focus({ preventScroll: true });
    } else {
      // only the parts that changed, so the drawing and a focused button stay
      parts.forEach((p, i) => {
        if (p === moreParts[i] || p.includes('data-cover-art') || box.children[i].contains(root.activeElement?.matches?.('input,select') ? root.activeElement : null)) return;
        if ([...dragging.keys()].some((k) => box.children[i].querySelector('[data-drag="' + CSS.escape(k) + '"]'))) return;
        const t = document.createElement('div');
        t.innerHTML = p;
        const next = swapIn(box.children[i], t.firstElementChild);
        fillIcons(next);
        mountDacs(next);
      });
      if (side !== moreSide) { const body = sheet.querySelector('.tfMoreSideBody'); if (body) body.innerHTML = side; moreSide = side; }
      if (!sheet.contains(root.activeElement)) refocus(sheet, was);
    }
    sheet.querySelector('.tfMorePair')?.classList.toggle('details', Boolean(more.details && side));
    moreParts = parts;
    syncArts();
  }
  // "5 minutes ago" moves on while it's open
  setInterval(() => { if (more) renderMore(); }, 15 * 1000);
  function openMore(id, opener) {
    // opened from inside the dialog (a summary's device): it opens in the same popup, which keeps the size and place it
    // first opened at, with Back and the device's name where the summary's was (Matt, 29 Oct: you don't lose where you
    // were). Back returns there
    const inside = Boolean(more && opener && sheet.contains(opener)), box = inside && sheet.querySelector('.tfMore');
    if (inside) more.scroll = box.scrollTop;
    more = { id, opener: inside ? more.opener : opener, back: inside ? more : null, frame: inside ? more.frame || { wide: box.classList.contains('wide'), h: box.offsetHeight } : null, at: Number(opener?.dataset?.at) || null };
    showMore();
  }
  let turning = false; // a new page in the open popup (a device, or Back)
  function showMore() {
    moreParts = [];
    turning = !sheet.hidden;
    arts.forEach((art, k) => { if (k !== more.id && sheet.contains(art.el)) { art.destroy(); arts.delete(k); } });
    renderMore();
    turning = false;
  }
  function closeMore() {
    const opener = more?.opener;
    more = null;
    arts.forEach((art, k) => { if (sheet.contains(art.el)) { art.destroy(); arts.delete(k); } });
    dacs.forEach((el, k) => { if (k.startsWith('more:')) dacs.delete(k); });
    sheet.hidden = true;
    sheet.innerHTML = '';
    // focus goes back to what opened it, without moving the page
    const quiet = { preventScroll: true };
    if (opener?.isConnected) opener.focus(quiet);
    else if (opener?.dataset?.more) grid.querySelector('[data-more="' + CSS.escape(opener.dataset.more) + '"]')?.focus(quiet);
    else if (opener?.dataset?.summary) grid.querySelector('[data-summary="' + CSS.escape(opener.dataset.summary) + '"]')?.focus(quiet);
    else if (opener?.hasAttribute?.('data-favs-edit')) grid.querySelector('[data-favs-edit]')?.focus(quiet);
  }

  /* graphs: the last 24 hours of an open reading, and the balcony's solar */
  function plot(svg, pts, label, opts = {}) {
    const vals = pts.map((p) => p[1]), min = opts.zero ? 0 : Math.min(...vals), max = Math.max(...vals);
    const W = Math.max(120, svg.clientWidth || 260), H = Math.max(60, svg.clientHeight || 130), top = 8, bottom = H - 20;
    const t0 = Date.now() - 24 * 3600 * 1000, span = 24 * 3600 * 1000;
    const x = (t) => Math.max(0, Math.min(W, ((t - t0) / span) * W));
    const y = (v) => (max === min ? (top + bottom) / 2 : bottom - ((v - min) / (max - min)) * (bottom - top));
    let d = 'M' + x(pts[0][0]).toFixed(1) + ' ' + y(pts[0][1]).toFixed(1);
    for (let i = 1; i < pts.length; i++) d += opts.smooth ? 'L' + x(pts[i][0]).toFixed(1) + ' ' + y(pts[i][1]).toFixed(1) : 'H' + x(pts[i][0]).toFixed(1) + 'V' + y(pts[i][1]).toFixed(1);
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('aria-label', label);
    svg.innerHTML = '<path d="' + d + 'V' + bottom + 'H' + x(pts[0][0]).toFixed(1) + 'Z" fill="' + (opts.colour || 'var(--primary)') + '" fill-opacity=".14"/>' +
      '<path d="' + d + '" fill="none" stroke="' + (opts.colour || 'var(--primary)') + '" stroke-width="2" stroke-linejoin="round"/>' +
      '<text x="0" y="' + (H - 4) + '">24 h ago</text><text x="' + W + '" y="' + (H - 4) + '" text-anchor="end">Now</text>';
  }
  /* a device's day, opened from Activity (Matt, 29 Oct; the motion lab's "On and off through the day"): one track 26
     tall across the last 24 hours, corner 8, in the text colour at 10%; each time it was on (open, wet, unlocked…) a span
     in its colour (a light amber, an alarm red, the rest the accent), when above it; the hours under it; the Activity
     row's moment marked. A number draws as a line instead */
  const ON_STATES = { lock: ['unlocked', 'open', 'opening'], cover: ['open', 'opening', 'closing'], valve: ['open', 'opening', 'closing'], vacuum: ['cleaning', 'returning'] };
  const isOn = (id, s) => {
    const d = id.split('.')[0];
    if (ON_STATES[d]) return ON_STATES[d].includes(s);
    if (d === 'alarm_control_panel' || d === 'climate' || d === 'media_player') return !['off', 'standby', 'disarmed', 'unavailable', 'unknown'].includes(s);
    return s === 'on';
  };
  const onWord = (id) => {
    const d = id.split('.')[0], dc = attr(id).device_class;
    if (d === 'binary_sensor') return { moisture: 'Wet', smoke: 'Smoke', gas: 'Gas', carbon_monoxide: 'Carbon monoxide', safety: 'Unsafe' }[dc] || (OPEN_CLASSES.includes(dc) ? 'Open' : 'On');
    return { lock: 'Unlocked', cover: 'Open', valve: 'Open', vacuum: 'Cleaning', alarm_control_panel: 'Armed' }[d] || 'On';
  };
  const days = new Map(); // entity id → { at, pts }: its changes over the last 24 hours
  let dayClips = 0;
  async function dayOf(id) {
    let h = days.get(id);
    if (!h || Date.now() - h.at > 60 * 1000) {
      let pts = [];
      try {
        const res = await callWS({ type: 'history/history_during_period', start_time: new Date(Date.now() - 864e5).toISOString(), entity_ids: [id], minimal_response: true, no_attributes: true, significant_changes_only: false });
        pts = (res?.[id] || []).map((r) => [r.lu != null ? r.lu * 1000 : Date.parse(r.last_updated || r.last_changed), String(r.s ?? r.state)]).filter(([t]) => Number.isFinite(t));
      } catch (_e) { /* no history: the logbook's changes, then the device's own */ }
      if (!pts.length) pts = (logbook || []).filter((e) => e.entity_id === id).map((e) => [e.when * 1000, String(e.state)]);
      h = { at: Date.now(), pts };
      days.set(id, h);
    }
    const st = states[id], pts = h.pts.slice().sort((a, b) => a[0] - b[0]);
    if (st && (!pts.length || pts[pts.length - 1][1] !== st.state)) pts.push([Date.parse(st.last_changed) || Date.now(), st.state]);
    return pts;
  }
  async function drawDay(id, svg, at) {
    const pts = await dayOf(id);
    if (!svg.isConnected) return;
    const nums = pts.map(([t, s]) => [t, Number(s)]);
    if (pts.length > 1 && nums.every(([, v]) => Number.isFinite(v))) { plot(svg, nums, nameOf(id) + ', last 24 hours'); return; }
    const t1 = Date.now(), t0 = t1 - 864e5, W = Math.max(200, svg.clientWidth || 360), H = 62, x = (t) => Math.max(0, Math.min(W, ((t - t0) / 864e5) * W));
    const spans = [];
    let from = null;
    pts.forEach(([t, s]) => {
      const on = isOn(id, s);
      if (on && from == null) from = Math.max(t, t0);
      else if (!on && from != null) { spans.push([from, Math.max(t, t0)]); from = null; }
    });
    if (from != null) spans.push([from, t1]);
    const colour = alarmOf(id) ? 'var(--danger)' : id.startsWith('light.') ? '#ffaa00' : 'var(--primary)', word = onWord(id), clip = 'tfDayClip' + ++dayClips;
    const said = spans.map(([a, b]) => word + (b >= t1 - 1000 && a <= t0 + 1000 ? ' all day' : b >= t1 - 1000 ? ' since ' + clock(a) : a <= t0 + 1000 ? ' until ' + clock(b) : ' ' + clock(a) + '–' + clock(b)));
    // when, above each span, where there's room
    let labels = '', end = -Infinity;
    spans.forEach(([a], i) => {
      const w = said[i].length * 5.4, lx = Math.min(x(a), W - w);
      if (lx < end + 8) return;
      labels += '<text x="' + lx.toFixed(1) + '" y="10">' + esc(said[i]) + '</text>';
      end = lx + w;
    });
    // the hours under it: midnight, 06, 12 and 18 where they fall, and Now at the end
    let hours = '<text x="' + W + '" y="' + (H - 2) + '" text-anchor="end">Now</text>';
    [0, 6, 12, 18].forEach((hr) => {
      let t = new Date(t1).setHours(hr, 0, 0, 0);
      if (t > t1) t -= 864e5;
      if (x(t) > 8 && x(t) < W - 34) hours += '<text x="' + x(t).toFixed(1) + '" y="' + (H - 2) + '" text-anchor="middle">' + String(hr).padStart(2, '0') + '</text>';
    });
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('aria-label', nameOf(id) + ', last 24 hours: ' + (said.length ? said.join(', ') : 'no changes'));
    svg.innerHTML = '<clipPath id="' + clip + '"><rect x="0" y="18" width="' + W + '" height="26" rx="8"/></clipPath>' + labels +
      '<rect x="0" y="18" width="' + W + '" height="26" rx="8" fill="var(--text)" fill-opacity=".1"/>' +
      '<g clip-path="url(#' + clip + ')">' + spans.map(([a, b]) => '<rect x="' + x(a).toFixed(1) + '" y="18" width="' + Math.max(2, x(b) - x(a)).toFixed(1) + '" height="26" fill="' + colour + '"/>').join('') + '</g>' +
      (at && at >= t0 ? '<line x1="' + x(at).toFixed(1) + '" x2="' + x(at).toFixed(1) + '" y1="13" y2="49" stroke="var(--text)" stroke-width="2" stroke-linecap="round"/>' : '') + hours;
  }
  function madeUpHistory(id) {
    const v = Number(states[id]?.state), now = Date.now();
    // a meter that counts up through the day (the made-up energy): from nothing at midnight to now's value
    if (attr(id).state_class === 'total_increasing') {
      const midnight = new Date().setHours(0, 0, 0, 0), span = Math.max(1, now - midnight);
      return [...Array(49)].map((_, i) => midnight + (span * i) / 48).map((t) => [t, Math.round(v * Math.pow((t - midnight) / span, 1.3) * 100) / 100]);
    }
    return [...Array(48)].map((_, i) => [now - (48 - i) * 30 * 60 * 1000, Math.round(v * (0.96 + 0.04 * Math.sin(i / 6)) * 10) / 10]);
  }
  async function drawHistory(id, into) {
    let h = history.get(id);
    if (id.endsWith('_solar_power')) h = { at: Date.now(), points: solarHistory() };
    else if (isMadeUp(id)) h = { at: Date.now(), points: madeUpHistory(id) };
    else if (!h || Date.now() - h.at > 5 * 60 * 1000) {
      try {
        const start = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
        const res = await callWS({ type: 'history/history_during_period', start_time: start, entity_ids: [id], minimal_response: true, no_attributes: true, significant_changes_only: false });
        const points = (res?.[id] || []).map((r) => [r.lu != null ? r.lu * 1000 : Date.parse(r.last_updated || r.last_changed), Number(r.s ?? r.state)]).filter(([t, v]) => Number.isFinite(t) && Number.isFinite(v));
        h = { at: Date.now(), points };
      } catch (_e) { h = { at: Date.now(), points: [] }; }
      history.set(id, h);
    }
    const svg = into || grid.querySelector('[data-graph="' + CSS.escape(id) + '"]');
    if (!svg) return;
    const st = states[id], unit = st?.attributes?.unit_of_measurement || '';
    const pts = h.points.slice();
    const now = Number(st?.state);
    if (Number.isFinite(now) && !id.endsWith('_solar_power')) pts.push([Date.now(), now]);
    if (pts.length < 2) { svg.setAttribute('aria-label', nameOf(id) + ': no history for the last 24 hours'); svg.innerHTML = '<text x="0" y="16">No history for the last 24 hours</text>'; return; }
    const vals = pts.map((p) => p[1]), min = Math.min(...vals), max = Math.max(...vals);
    const f = (v) => v.toLocaleString(undefined, { maximumFractionDigits: Math.abs(v) >= 100 ? 0 : 1 });
    const growing = st?.attributes?.state_class === 'total_increasing';
    plot(svg, pts, nameOf(id) + ', last 24 hours: ' + (growing ? '+' + f(vals[vals.length - 1] - vals[0]) : (min === max ? f(min) : f(min) + ' to ' + f(max))) + (unit ? ' ' + unit : ''), { smooth: id.endsWith('_solar_power'), zero: id.endsWith('_solar_power') });
  }
  function drawSolar() {
    const svg = grid?.querySelector('[data-solar]');
    if (!svg) return;
    const pts = solarHistory();
    plot(svg, pts, 'Solar, last 24 hours: up to ' + num(Math.max(...pts.map((p) => p[1])), 1) + ' kW', { smooth: true, zero: true, colour: '#ffaa00' });
  }

  /* interactions */
  // where a cover was sent, until it gets there: its blocks show it, and its drawing's outline waits there
  function noteGoal(service, d) {
    const id = d.entity_id, g = goals.get(id) || {};
    const pos = { open_cover: 100, close_cover: 0, set_cover_position: d.position, toggle: posOf(id) > 0 ? 0 : 100 }[service];
    const tilt = { open_cover_tilt: 100, close_cover_tilt: 0, set_cover_tilt_position: d.tilt_position }[service];
    if (pos != null) g.pos = pos;
    if (tilt != null) g.tilt = tilt;
    if (service === 'stop_cover') { delete g.pos; delete g.tilt; }
    if (service === 'stop_cover_tilt') delete g.tilt;
    g.at = Date.now();
    goals.set(id, g);
  }
  // a light turned on without a brightness comes back at its last one (Matt, 28 Oct: some lights come on at 100%
  // otherwise), whether this page or the Dual Axis Controller turns it on; with none remembered yet, the light decides
  function asLastOn(domain, service, data) {
    const id = data?.entity_id;
    if (domain !== 'light' || typeof id !== 'string' || !lastBright[id] || !dimmable(id) || data.brightness_pct != null || data.brightness != null) return [service, data];
    if (service !== 'turn_on' && !(service === 'toggle' && states[id]?.state !== 'on')) return [service, data];
    return ['turn_on', { ...data, brightness_pct: lastBright[id] }];
  }
  function send(domain, service, id, data) {
    let d = { entity_id: id, ...(data || {}) };
    [service, d] = asLastOn(domain, service, d);
    if (domain === 'cover') noteGoal(service, d);
    used[id] = (used[id] || 0) + 1;
    local.set(USED_KEY, JSON.stringify(used));
    if (house.call(domain, service, d)) return Promise.resolve();
    return Promise.resolve(callService(domain, service, d));
  }
  function run(spec) {
    const [domain, service, id, json] = spec.split('|');
    send(domain, service, id, json ? JSON.parse(json) : null).catch(() => {});
  }
  // a cover's target while it's held (its drawing, its blocks or the keys): every view of it follows
  function holdCover(id, v) {
    dragging.set('pos|' + id, v);
    units.delete(id);
    moreParts = moreParts.map(() => '');
    [grid, sheet].forEach((scope) => scope.querySelectorAll('[data-blocks="' + CSS.escape(id) + '"]').forEach((b) => paintBlocks(b, v)));
    const meta = grid.querySelector('.tfAction[data-k="' + CSS.escape(id) + '"] .tfName .activityRowMeta');
    if (meta) meta.textContent = Math.round(v) + '%';
    if (more?.id === id) {
      const st = sheet.querySelector('.tfMoreState'), sub = sheet.querySelector('.tfMoreSub');
      if (st) { st.textContent = Math.round(v) + '%'; st.classList.add('live'); }
      if (sub) sub.textContent = 'Currently ' + posOf(id) + '%';
    }
    artsOf(id).forEach((art) => art.update(coverView(id)));
  }
  const keyStep = (ev, v) => {
    const st = ev.shiftKey ? 10 : 1;
    const n = { ArrowUp: v + st, ArrowRight: v + st, ArrowDown: v - st, ArrowLeft: v - st, PageUp: v + 25, PageDown: v - 25, Home: 0, End: 100 }[ev.key];
    return n == null ? null : Math.max(0, Math.min(100, Math.round(n)));
  };
  // the blocks: a tap goes to that block's stop; holding (350 ms) or dragging makes them a 1% slider that eases after
  // the pointer, with the value over the fill, and lets go there
  function holdBlocks(el, ev) {
    const id = el.dataset.blocks;
    el.setPointerCapture?.(ev.pointerId);
    const at = (e) => { const r = el.getBoundingClientRect(); return Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)); };
    const start = at(ev), x0 = ev.clientX;
    let fine = false, live = coverValue(id), tx = start, raf = 0;
    const chase = () => { live = Math.abs(tx - live) < 0.2 ? tx : live + (tx - live) * 0.14; holdCover(id, live); raf = requestAnimationFrame(chase); };
    const goFine = () => { if (fine) return; fine = true; el.classList.add('fine'); raf = requestAnimationFrame(chase); };
    const hold = setTimeout(goFine, 350);
    const move = (e) => { tx = at(e); if (Math.abs(e.clientX - x0) > 6) { clearTimeout(hold); goFine(); } };
    const up = () => {
      clearTimeout(hold);
      cancelAnimationFrame(raf);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.classList.remove('fine');
      holdCover(id, fine ? Math.round(live) : (Math.min(3, Math.floor(start / 25)) + 1) * 25);
      commit('pos', id);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }
  function openReading(el) {
    const [key, id] = el.dataset.open.split('|');
    const c = el.closest('.tfCard');
    open = { key, id, h: c ? Math.round(c.getBoundingClientRect().height) : 0 };
    units.delete(key);
    refresh();
    grid.querySelector('.tfOpen [data-close]')?.focus({ preventScroll: true });
  }
  function pickArea(panel) {
    activeArea = panel.dataset.area;
    // in place, so the accordion slides like the move panels
    grid.querySelectorAll('.tfAreaPanel').forEach((p) => { const on = p === panel; p.classList.toggle('active', on); p.setAttribute('aria-expanded', String(on)); p.querySelector('.panelExpanded')?.toggleAttribute('inert', !on); });
    units.set('areas', areasHtml(grid.querySelector('[data-k="areas"]')?.style.order || 1));
  }
  // what a bar sets, from 0–1 along it
  const DRAG = {
    bright: { value: (id, f) => Math.round(f * 100), text: (id, v) => (v ? v + '%' : 'Off'), send: (id, v) => (v > 0 ? ['light', 'turn_on', { brightness_pct: v }] : ['light', 'turn_off', {}]) },
    ct: { value: (id, f) => { const [lo, hi] = kelvinRange(id); return Math.round(lo + f * (hi - lo)); }, text: (id, v) => v.toLocaleString() + 'k', send: (id, v) => ['light', 'turn_on', { color_temp_kelvin: v }] },
    hue: { value: (id, f) => Math.round(f * 360), text: () => 'Colour', send: (id, v) => ['light', 'turn_on', { hs_color: [v, Math.max(60, attr(id).hs_color?.[1] || 100)] }] },
    pos: { value: (id, f) => Math.round(f * 100), text: (id, v) => Math.round(v) + '%', send: (id, v) => ['cover', 'set_cover_position', { position: Math.round(v) }] },
    tilt: { value: (id, f) => Math.round(f * 100), text: (id, v) => 'Tilt ' + v + '%', send: (id, v) => ['cover', 'set_cover_tilt_position', { tilt_position: v }] },
    vol: { value: (id, f) => Math.round(f * 100) / 100, text: (id, v) => Math.round(v * 100) + '%', send: (id, v) => ['media_player', 'volume_set', { volume_level: v }] },
  };
  function showDrag(bar, kind, id, f) {
    const v = DRAG[kind].value(id, f);
    dragging.set(kind + '|' + id, v);
    const pct = Math.round(f * 100) + '%';
    const i = bar.querySelector('i');
    if (kind === 'tilt') {
      // the tilt bar's fill sits 4 in from its edge; Shut and Open turn white once the fill is under them
      i.style.width = 'calc((100% - 8px) * ' + f + ')';
      const [shut, open] = bar.querySelectorAll('span');
      shut.classList.toggle('lit', f > 0.08);
      open.classList.toggle('lit', f > 0.92);
      units.delete(id);
      moreParts = moreParts.map(() => '');
      artsOf(id).forEach((art) => art.update(coverView(id)));
    } else if (i) i.style.width = pct;
    else { let b = bar.querySelector('b'); if (!b) { b = document.createElement('b'); bar.appendChild(b); } b.style.left = pct; }
    bar.setAttribute('aria-valuenow', String(Math.round(f * 100)));
    const meta = (bar.closest('.tfAction') || bar.closest('.tfMore'))?.querySelector('.tfName .activityRowMeta, .tfMoreState');
    if (meta) meta.textContent = DRAG[kind].text(id, v);
  }
  function commit(kind, id) {
    const v = dragging.get(kind + '|' + id);
    const [domain, service, data] = DRAG[kind].send(id, v);
    const done = () => setTimeout(() => { dragging.delete(kind + '|' + id); refresh(); }, 1500);
    send(domain, service, id, data).then(done, done);
  }
  // the same controls work on the page and in the stand-in more-info
  function bindControls(el) {
    el.addEventListener('click', (ev) => {
      const t = ev.target.closest('[data-open],[data-close],[data-act],[data-acts],[data-more],[data-more-close],[data-more-back],[data-details],[data-details-close],[data-go],[data-summary],[data-star],[data-favs-edit],[data-area-back],[data-board-more],[data-board-act],[data-board-show],[data-fav-hide],[data-energy-pick],.tfAreaPanel');
      if (boardOpen && !ev.target.closest('.tfBoardMenu,[data-board-more]')) closeBoardMenu();
      if (!t || !el.contains(t) || t.disabled) return;
      if (t.dataset.boardMore) { if (boardOpen?.key === t.dataset.boardMore) closeBoardMenu(true); else openBoardMenu(t.dataset.boardMore, t); }
      else if (t.dataset.boardAct) boardAct(boardOpen.key, t.dataset.boardAct);
      else if (t.dataset.boardShow) showCard(t.dataset.boardShow);
      else if (t.dataset.favHide) setFavShown(t.dataset.favHide, false);
      else if (t.dataset.energyPick) pickEnergy(t.dataset.energyPick);
      else if (t.dataset.act) run(t.dataset.act);
      else if (t.hasAttribute('data-details')) toggleDetails(!more?.details);
      else if (t.hasAttribute('data-details-close')) toggleDetails(false);
      else if (t.dataset.summary) openSummary(t.dataset.summary, t);
      else if (t.dataset.star) toggleStar(t.dataset.star);
      else if (t.hasAttribute('data-more-back')) { const from = more.id; more = more.back; showMore(); sheet.querySelector('.tfMore [data-more="' + CSS.escape(from) + '"]')?.focus({ preventScroll: true }); }
      else if (t.hasAttribute('data-favs-edit')) openMore('favourites', t);
      else if (t.dataset.acts) JSON.parse(t.dataset.acts).forEach(([domain, service, id, data]) => send(domain, service, id, data).catch(() => {}));
      else if (t.dataset.more) openMore(t.dataset.more, t);
      else if (t.hasAttribute('data-more-close')) closeMore();
      else if (t.dataset.go) openArea('room:' + t.dataset.go);
      else if (t.hasAttribute('data-area-back')) closeArea();
      else if (t.dataset.open) openReading(t);
      else if (t.hasAttribute('data-close')) { const was = open; open = null; units.delete(was.key); refresh(); grid.querySelector('[data-open="' + CSS.escape(was.key + '|' + was.id) + '"]')?.focus({ preventScroll: true }); }
      else if (t.classList.contains('tfAreaPanel') && !t.classList.contains('active')) pickArea(t);
    });
    el.addEventListener('keydown', (ev) => {
      const t = ev.target;
      if (t.dataset?.open && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); openReading(t); }
      if (t.dataset?.energyPick && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); pickEnergy(t.dataset.energyPick); }
      if (t.classList?.contains('tfAreaPanel') && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); pickArea(t); }
      if (t.dataset?.summary && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); openSummary(t.dataset.summary, t); }
      if (ev.key === 'Escape' && boardOpen && el === grid) { ev.preventDefault(); closeBoardMenu(true); return; }
      if (ev.key === 'Escape' && editing && el === grid) { ev.preventDefault(); setEditing(false); $('dashEditNav')?.focus(); return; }
      if (ev.key === 'Escape' && areaPage && el === grid) { ev.preventDefault(); closeArea(); }
      // a cover's blocks: arrows 1 (10 with Shift), Page Up and Down 25, Home closed, End open; sent after a pause
      if (t.dataset?.blocks) {
        const id = t.dataset.blocks, n = keyStep(ev, Math.round(coverValue(id)));
        if (n == null) return;
        ev.preventDefault();
        holdCover(id, n);
        clearTimeout(keyTimers.get(id));
        keyTimers.set(id, setTimeout(() => commit('pos', id), 500));
        return;
      }
      if (t.dataset?.drag && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(ev.key)) {
        ev.preventDefault();
        const [kind, id] = t.dataset.drag.split('|');
        const now = Number(t.getAttribute('aria-valuenow')) / 100;
        const f = ev.key === 'Home' ? 0 : ev.key === 'End' ? 1 : Math.max(0, Math.min(1, now + (ev.key === 'ArrowLeft' || ev.key === 'ArrowDown' ? -0.05 : 0.05)));
        showDrag(t, kind, id, f);
        commit(kind, id);
      }
    });
    // bars (Matt, 28 Oct and 2 Nov): a tap on a light that's off turns it on as it was last (its faint line), never to
    // where the tap landed. A finger sliding sideways moves the bar at once, from where it is (a light that's off, from
    // where it last was), so where it lands never makes it jump; a finger going up or down scrolls the page, and a quick
    // touch changes nothing. A mouse drags straight away, from the pointer
    el.addEventListener('pointerdown', (ev) => {
      const blocksEl = ev.target.closest('[data-blocks]');
      if (blocksEl && ev.button === 0) { ev.preventDefault(); holdBlocks(blocksEl, ev); return; }
      const bar = ev.target.closest('[data-drag]');
      if (!bar || ev.button > 0) return;
      const [kind, id] = bar.dataset.drag.split('|');
      // a light that only turns on and off: a click, or a finger's tap, toggles it
      const fixed = kind === 'bright' && !dimmable(id), finger = ev.pointerType !== 'mouse';
      if (fixed && !finger) { run(act('light', 'toggle', id)); return; }
      const off = kind === 'bright' && states[id]?.state !== 'on';
      const inset = kind === 'tilt' ? 4 : 0; // the tilt bar's fill sits 4 in
      const span = () => bar.getBoundingClientRect().width - inset * 2;
      const at = (e2) => { const r = bar.getBoundingClientRect(); return Math.max(0, Math.min(1, (e2.clientX - r.left - inset) / span())); };
      // waiting: a finger that may yet be a tap, a slide or a scroll; pressed: a mouse on a light that's off, which may
      // yet be a click; sliding: a finger moving the bar from where it was; dragging: a mouse moving it to the pointer
      let mode = finger ? 'waiting' : off ? 'pressed' : 'dragging', from = 0;
      const x0 = ev.clientX, y0 = ev.clientY, moved = (e2, by) => Math.hypot(e2.clientX - x0, e2.clientY - y0) > by;
      const capture = () => { try { bar.setPointerCapture(ev.pointerId); } catch { /* a pointer that's already gone */ } };
      if (!finger) { ev.preventDefault(); capture(); }
      if (mode === 'dragging') showDrag(bar, kind, id, at(ev));
      const slide = () => {
        mode = 'sliding';
        heldBar = bar;
        bar.classList.add('held');
        capture();
        if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.(8); // a small buzz where phones allow it
        from = off ? (lastBright[id] ?? 100) / 100 : Number(bar.getAttribute('aria-valuenow')) / 100;
      };
      const move = (e2) => {
        // sideways, the bar takes the finger; up or down, the page does (and the bar hears no more of it)
        if (mode === 'waiting' && moved(e2, BAR_SLOP)) {
          if (!fixed && Math.abs(e2.clientX - x0) > Math.abs(e2.clientY - y0)) slide(); else mode = 'gone';
        } else if (mode === 'pressed' && moved(e2, 4)) mode = 'dragging';
        if (mode === 'sliding') showDrag(bar, kind, id, Math.max(0, Math.min(1, from + (e2.clientX - x0) / span())));
        else if (mode === 'dragging') showDrag(bar, kind, id, at(e2));
      };
      const up = (e2) => {
        ['pointermove', 'pointerup', 'pointercancel'].forEach((t, i) => bar.removeEventListener(t, i ? up : move));
        bar.classList.remove('held');
        if (heldBar === bar) heldBar = null;
        if (mode === 'sliding' || mode === 'dragging') commit(kind, id);
        else if (e2.type === 'pointerup' && fixed) run(act('light', 'toggle', id));
        else if (e2.type === 'pointerup' && off && (mode === 'waiting' || mode === 'pressed')) send('light', 'turn_on', id).catch(() => {});
      };
      bar.addEventListener('pointermove', move);
      bar.addEventListener('pointerup', up);
      bar.addEventListener('pointercancel', up);
    });
    // once a finger is sliding a bar, it moves the bar and not the page
    el.addEventListener('touchmove', (ev) => { if (heldBar && ev.cancelable) ev.preventDefault(); }, { passive: false });
  }
  if (grid && testFocus) {
    loadPrefs();
    bindControls(grid);
    bindControls(sheet);
    sheet.addEventListener('click', (ev) => { if (ev.target === sheet) closeMore(); });
    // Home, from an area's page, goes back to the house
    root.getElementById('homeNav')?.addEventListener('click', () => { if (areaPage) closeArea(); });
    // the dashboard's edit mode: the pencil in the bottom bar, and dragging on the board
    root.querySelector('.bottomNav')?.insertAdjacentHTML('beforeend', '<button class="navBtn" id="dashEditNav" type="button" title="Edit" aria-label="Edit the dashboard" aria-pressed="false" hidden>' + PENCIL + '</button>');
    $('dashEditNav')?.addEventListener('click', () => setEditing(!editing));
    grid.addEventListener('pointerdown', boardDown);
    // the dashboard's bottom row holds as many tiles as fit, and its rows are measured again as the page changes size
    new ResizeObserver(() => { if (app.classList.contains('tfDash') && dashCols() !== dashColsSeen) refresh(); else queueFit(); }).observe(grid);
    window.addEventListener('resize', queueFit, { passive: true });
    // Escape folds the details away first, then closes
    sheet.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') { ev.stopPropagation(); if (more?.details) toggleDetails(false); else closeMore(); } });
  }

  applyDensity();
  return {
    // HomeCore demo: the site's rail opens Home and the Weather page, and its Devices page lists the same states
    openArea, closeArea,
    get page() { return areaPage; },
    get model() { return model; },
    // every icon on the demo's pages is the dashboard's chip (Matt, 9 Nov: "make it all the same"): a device's icon slot
    // and its colour while on, any colour by the same rule, and the filling and fitting of the glyphs
    chip(id) { const c = kindRgb(id); return iconSlot(id, iconFor(id)) + (c ? ' data-light style="' + colourVars(c) + '"' : ''); },
    tint(hex) { return colourVars([1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))); },
    paint(scope) { fillIcons(scope); },
    // Settings' choices measured again (they're measured on resize; a late font changes their words' widths too)
    refit() { fitChoices(); },
    update(next) {
      if (!testFocus) return;
      const first = !Object.keys(states).length;
      // the made-up entities live only in the house model: keep them until the next layout draws them again, or a drag
      // in between finds a made-up tile with no state and the board's layout stops halfway (Matt, 5 Nov)
      const madeUp = Object.fromEntries(Object.entries(states).filter(([id]) => isMadeUp(id)));
      states = { ...madeUp, ...(next || {}) };
      // every dimmable light that's on, remembered at its brightness for when it next comes on (not only those drawn)
      for (const id in states) if (id.startsWith('light.') && states[id].state === 'on' && dimmable(id)) noteBright(id, brightnessOf(states[id]));
      if (first) render(); else refresh();
    },
    // the bento's animation runs while it's mounted, so it goes while the card is away
    suspend() { suspended = true; bento?.destroy(); bento = null; dashBentos?.forEach((b) => b.destroy()); dashBentos = null; },
    resume() {
      suspended = false;
      if (!testFocus || !grid?.querySelector('[data-tf]')) return;
      if (bentoBox.isConnected) placeBento(bentoBox.style.order);
      placeDash(true);
    },
  };
}
