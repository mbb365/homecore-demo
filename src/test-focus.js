// Test focus and the density overlay.
// - Test focus (`layout: test-focus` in the YAML): a whole house on Home, built from the HomeCore display pieces so the
//   spacing rules can be pushed with real data. Rooms come from Home Assistant areas; house.js adds made-up devices
//   for what the house doesn't have. Area cards sit where the move panels were (an accordion, like them); the move
//   panels are hidden. Tapping a device's name opens this page's more-info, for real and made-up devices alike: a
//   popup or a sheet (Settings → Appearance → More info), with its details rolling out beside it. Covers follow
//   Claude Design's "Covers design": four blocks, a tilt bar and Open/Stop/Close on the tile, and the cover drawn in
//   its window in more-info. The normal Home never shows any of this.
// - Show density: every display card's height, and how many readings fit on the screen.
import { createHouse, isMadeUp, solarHistory, PLANT_RANGE } from './house.js';
import { ICONS as HC_ICONS, svg as hcSvg } from './hc-icons.js';
import { mountWeatherBento } from './weather-bento.js';
import { wbSmoothIcon } from './weather-bento-art.js';
import { createCoverArt, coverKind } from './cover-art.js';
import { cardInk, parseColour, hexRgb, rgbHex } from './look.js';
import { M, EASE, smoothD, gridLines, drawLine, stretchTo, closeDialog, toastBody, toastIn, toaster, springStep, squash, reduced } from './motion.js';
// HomeCore's icon for a Material Design one, by name (19 Nov); the demo's own inline icons use it too (demo-icons.js)
export const HC_FROM_MDI = {
  'mdi:lightbulb': 'light', 'mdi:lamps': 'light', 'mdi:power-plug': 'plug', 'mdi:thermostat': 'thermostat', 'mdi:home-thermometer': 'thermostat',
  'mdi:thermometer': 'temperature', 'mdi:water': 'humidity', 'mdi:water-percent': 'humidity', 'mdi:fan': 'fan',
  'mdi:blinds-horizontal': 'blinds', 'mdi:blinds-horizontal-closed': 'blinds', 'mdi:roller-shade': 'blinds', 'mdi:roller-shade-closed': 'blinds',
  'mdi:window-shutter': 'blinds', 'mdi:curtains': 'blinds', 'mdi:curtains-closed': 'blinds', 'mdi:lock': 'lock', 'mdi:door-open': 'door', 'mdi:door': 'door',
  'mdi:window-open': 'window', 'mdi:window-closed': 'window', 'mdi:motion-sensor': 'motion', 'mdi:account': 'person', 'mdi:account-multiple': 'person',
  'mdi:cctv': 'camera', 'mdi:doorbell': 'camera', 'mdi:speaker': 'speaker', 'mdi:multimedia': 'speaker', 'mdi:television': 'tv', 'mdi:robot-vacuum': 'vacuum',
  'mdi:lightning-bolt': 'energy', 'mdi:flash': 'energy', 'mdi:home-lightning-bolt': 'energy', 'mdi:white-balance-sunny': 'sun', 'mdi:solar-power-variant': 'sun',
  'mdi:security': 'alarm', 'mdi:shield-home': 'alarm', 'mdi:home': 'home',
};

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
const COVER_ICON = { curtain: ['mdi:curtains', 'mdi:curtains-closed'], blind: ['mdi:roller-shade', 'mdi:roller-shade-closed'], venetian: ['mdi:blinds-horizontal', 'mdi:blinds-horizontal-closed'], garage: ['mdi:garage-open', 'mdi:garage'] };
const COVER_NOUN = { curtain: 'curtains', blind: 'blind', venetian: 'blinds', garage: 'garage door' };
// the home view's summaries (Home Assistant's home-summaries.ts, with its English names), in its default order. Energy
// shows what the house uses now: this page can't read the energy dashboard's day
const SUMMARIES = {
  light: { name: 'Lights', icon: 'mdi:lightbulb', colour: '#ffc107' },
  climate: { name: 'Climate', icon: 'mdi:home-thermometer', colour: '#ff5722' },
  security: { name: 'Security', icon: 'mdi:security', colour: '#607d8b' },
  media_players: { name: 'Media players', icon: 'mdi:multimedia', colour: '#2196f3' },
  maintenance: { name: 'Maintenance', icon: 'mdi:wrench', colour: '#9e9e9e' },
  energy: { name: 'Energy', icon: 'mdi:lightning-bolt', colour: '#ffc107' },
  // HomeCore demo (Matt, 9 Nov): more to choose from, all off until switched on in the edit tray
  covers: { name: 'Covers', icon: 'mdi:blinds-horizontal', colour: '#9c27b0' },
  people: { name: 'People', icon: 'mdi:account-multiple', colour: '#03a9f4' },
  openings: { name: 'Doors and windows', icon: 'mdi:door-open', colour: '#ff9800' },
  leaks: { name: 'Leaks', icon: 'mdi:water', colour: '#2196f3' },
  vacuum: { name: 'Vacuum', icon: 'mdi:robot-vacuum', colour: '#4caf50' },
};
const EXTRA_SUMS = ['covers', 'people', 'openings', 'leaks', 'vacuum'];
// Home's summaries until they're changed in Edit Home page (Matt, 26 Nov): Lights, Climate, Security, Media players,
// Energy and Leaks
const HOME_SUMS = { hiddenSums: ['maintenance'], shownSums: ['leaks'] };
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
// a tray's Add… button: a plus before its words (Matt, 12 Nov: "proper buttons with a plus icon")
// a popup's Control page (Material Design Icons' tune-variant)
const TUNE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 13C6.14 13 4.59 14.28 4.14 16H2V18H4.14C4.59 19.72 6.14 21 8 21S11.41 19.72 11.86 18H22V16H11.86C11.41 14.28 9.86 13 8 13M8 19C6.9 19 6 18.1 6 17C6 15.9 6.9 15 8 15S10 15.9 10 17C10 18.1 9.1 19 8 19M19.86 6C19.41 4.28 17.86 3 16 3S12.59 4.28 12.14 6H2V8H12.14C12.59 9.72 14.14 11 16 11S19.41 9.72 19.86 8H22V6H19.86M16 9C14.9 9 14 8.1 14 7C14 5.9 14.9 5 16 5S18 5.9 18 7C18 8.1 17.1 9 16 9Z"/></svg>';
const PLUS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z"/></svg>';
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
const ACTION_DOMAINS = ['light', 'climate', 'cover', 'humidifier', 'media_player', 'vacuum', 'lock', 'alarm_control_panel', 'valve', 'water_heater'];
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
    view.querySelector('.settingsTitle').textContent = 'HomeCore settings'; // (Matt, 9 Nov)
    // one tab each (Matt, 27 Oct); the tab names the section, so the sections have no heading of their own
    const tabs = [['look', 'Appearance'], ['lights', 'Lights'], ['sums', 'Summaries']]; // (Sources went: Matt, 26 Nov)
    const tabPane = (k, html) => '<div class="houseTab' + (k === 'look' ? ' active' : '') + '" data-house-pane="' + k + '"><section class="card">' + html + '</section></div>';
    view.querySelector('.rubberTabs').insertAdjacentHTML('afterend', '<div class="settingsPane active" id="housePane">' +
      '<div class="tabs rubberTabs houseTabs"><div class="rubberIndicator" aria-hidden="true"></div>' +
        tabs.map(([k, t]) => '<button class="tab segBtn' + (k === 'look' ? ' active' : '') + '" type="button" data-house-tab="' + k + '">' + t + '</button>').join('') + '</div>' +
      // Appearance in groups, each named above its card (Matt, 8 Nov)
      tabPane('look', LOOK_GROUPS.map(([k, t]) => '<div class="tfSetGroup"><div class="sectionLabel">' + t + '</div><div class="toggleList" data-look-group="' + k + '"></div></div>').join('')) +
      // Lights as the Devices page has its devices (Matt, 26 Nov: "match like the devices page"): a table, each light's chip by its
      // name, or cards
      tabPane('lights', '<div class="hcGroups" id="lightTables"></div><div class="tfLightCards hcGroups" id="lightCards"></div>') +
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
      mark.style.transition = 'none';
      // the Motion Lab's tabs: the mark stretches across to the new tab
      if (animate) stretchTo(mark, mark.offsetLeft, mark.offsetWidth, on.offsetLeft, on.offsetWidth);
      else { mark.style.left = on.offsetLeft + 'px'; mark.style.width = on.offsetWidth + 'px'; }
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
    const body = $('lightTables'), cards = $('lightCards'), active = root.activeElement;
    const inside = body?.contains(active) || cards?.contains(active) ? active : null;
    if (!body || inside?.matches('select')) { fitChoices(); return; }
    const stars = new Set(starred()), opt = (v, t, cur, off) => '<option value="' + v + '"' + (v === cur ? ' selected' : '') + (off ? ' disabled' : '') + '>' + t + '</option>';
    /* the lights as the Devices page lists its devices (Matt, 26 Nov: "the filtering and searching… grouping, sort by name"):
       searched by name or room, grouped by room or not, sorted by name, room or on first; each group headed with its count */
    let lv = { q: '', group: 'area', sort: 'name' };
    try { lv = { ...lv, ...JSON.parse(localStorage.getItem('homecore-demo-light-list') || '{}') }; } catch (_e) { /* the defaults */ }
    const words = String(lv.q || '').trim().toLowerCase();
    const lightIds = Object.keys(states).filter((id) => id.startsWith('light.') && (!words || (nameOf(id) + ' ' + (whereIs.get(id) || '')).toLowerCase().includes(words)))
      .sort((a, b) => (lv.sort === 'on' ? (states[b].state === 'on') - (states[a].state === 'on') : 0) || (lv.sort === 'area' ? (whereIs.get(a) || '~').localeCompare(whereIs.get(b) || '~') : 0) || nameOf(a).localeCompare(nameOf(b)));
    const groups = lv.group === 'none' ? [{ name: '', ids: lightIds }] : [...lightIds.reduce((m, id) => { const k = whereIs.get(id) || 'No area'; if (!m.has(k)) m.set(k, []); m.get(k).push(id); return m; }, new Map())]
      .sort(([a], [b]) => (a === 'No area') - (b === 'No area') || a.localeCompare(b)).map(([name, ids]) => ({ name, ids }));
    // each group as the Devices page has its groups: its name and count above, its table in a card of its own (or its cards)
    const groupHead = (g) => (g.name ? '<div class="sectionLabel">' + esc(g.name) + ' <span class="hcCount">' + g.ids.length + '</span></div>' : '');
    const THEAD = '<thead><tr><th>Light</th><th>Room</th><th>Now</th><th class="metaSwitchCol">Favourite</th><th>Tile</th><th>Pad</th></tr></thead>';
    const rowOfLight = (id) => {
        const style = look.lightStyles[id] || '', pad = look.lightPads[id] || '', fav = stars.has(id), name = esc(nameOf(id));
        return '<tr><td><span class="hcNameCell"><span class="tfIcon"' + iconSlot(id, iconFor(id)) + lightAttrs(id) + '></span><strong>' + name + '</strong></span></td><td>' + esc(whereIs.get(id) || '—') + '</td><td>' + esc(valueOf(id)) + '</td>' +
          '<td class="metaSwitchCol"><button class="switch' + (fav ? ' on' : '') + '" type="button" role="switch" aria-checked="' + fav + '" data-light-fav="' + esc(id) + '" aria-label="' + name + ' is a favourite"></button></td>' +
          '<td><select class="settingsSelect" data-light-style="' + esc(id) + '" aria-label="' + name + ' tile">' + opt('', 'Default', style) + opt('tile', 'HomeCore tile', style) + opt('dac', 'Dual Axis Controller', style) + '</select></td>' +
          '<td><select class="settingsSelect" data-light-pad="' + esc(id) + '" aria-label="' + name + ' pad"' + (wantsDac(id) ? '' : ' disabled') + '>' + opt('', 'Default', pad) + opt('temperature', 'Temperature', pad) + opt('colour', 'Colour', pad) + '</select></td></tr>';
    };
    const html = groups.map((g) => '<section class="hcGroup">' + groupHead(g) + '<section class="card hcTableCard"><div class="metaTableWrap"><table class="metaTable tfLightTable hcDevTable">' + THEAD + '<tbody>' + g.ids.map(rowOfLight).join('') + '</tbody></table></div></section></section>').join('') ||
      '<p class="note hcEmpty">No lights match</p>';
    // on a phone each light is a card (Matt, 8 Nov): its name and where it is, then Favourite with its switch, then its
    // tile, and its pad when it's the Dual Axis Controller, as choices
    const pickSeg = (field, id, label, opts, cur) => '<div class="themeChoice" role="group" aria-label="' + label + '">' + opts.map(([v, t]) =>
      '<button class="wxLayoutBtn" type="button" aria-pressed="' + (v === cur) + '" data-light-pick="' + field + '|' + esc(id) + '" data-v="' + v + '">' + t + '</button>').join('') + '</div>';
    const cardOfLight = (id) => {
        const fav = stars.has(id), name = esc(nameOf(id)), where = [whereIs.get(id), valueOf(id)].filter(Boolean).map(esc).join(' · ');
        // each light the action card: its head (its chip, its name, where it is and how it is), then its settings inside
        return '<div class="tfAction hcLightCard' + (states[id]?.state === 'on' ? ' on' : '') + '"' + lightAttrs(id) + ' data-tone="light"><div class="tfActionHead"><span class="tfIcon"' + iconSlot(id, iconFor(id)) + '></span><div class="tfName"><span class="activityRowName">' + name + '</span><span class="activityRowMeta">' + where + '</span></div></div>' +
          '<div class="toggleList hcLightRows">' + settingRow('Favourite', '', '<button class="switch' + (fav ? ' on' : '') + '" type="button" role="switch" aria-checked="' + fav + '" data-light-fav="' + esc(id) + '" aria-label="' + name + ' is a favourite"></button>') +
          settingRow('Tile', '', pickSeg('lightStyles', id, name + ' tile', [['', 'Default'], ['tile', 'HomeCore tile'], ['dac', 'Dual Axis Controller']], look.lightStyles[id] || '')) +
          (wantsDac(id) ? settingRow('Pad', '', pickSeg('lightPads', id, name + ' pad', [['', 'Default'], ['temperature', 'Temperature'], ['colour', 'Colour']], look.lightPads[id] || '')) : '') + '</div></div>';
    };
    const cardsHtml = groups.map((g) => '<section class="hcGroup">' + groupHead(g) + '<div class="hcLightGrid">' + g.ids.map(cardOfLight).join('') + '</div></section>').join('') || '<p class="note hcEmpty">No lights match</p>';
    if (body.dataset.html !== html) { body.innerHTML = html; body.dataset.html = html; fillIcons(body); }
    if (cards.dataset.html !== cardsHtml) { cards.innerHTML = cardsHtml; cards.dataset.html = cardsHtml; fillIcons(cards); }
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
  /* a room's page (Matt, 11 Nov): each column stacks on its own, so a card that opens (a reading's last 24 hours)
     pushes down only what's under it, never what's beside it. The grid's rows are 1 px; each item spans its own
     height plus the gap, written into a sheet of its own so a redraw of the item doesn't wipe it */
  const stackSheet = document.createElement('style');
  root.appendChild(stackSheet);
  const stackSeen = new ResizeObserver(() => stack()), seen = new Set();
  // its height to the fraction (offsetHeight rounds), unless it's mid-animation and scaled
  const heightOf = (el) => { const h = el.getBoundingClientRect().height; return Math.abs(h - el.offsetHeight) < 1 ? h : el.offsetHeight; };
  function stack() {
    const on = app.classList.contains('tfAreaOpen') && !app.classList.contains('tfWeatherOpen');
    grid.classList.toggle('tfStack', on);
    seen.forEach((el) => { if (!on || !el.isConnected) { stackSeen.unobserve(el); seen.delete(el); } });
    if (!on) { stackSheet.textContent = ''; return; }
    const cs = getComputedStyle(grid), gap = parseFloat(cs.columnGap) || 0;
    const n = cs.gridTemplateColumns.split(' ').length;
    const items = [...grid.children].filter((el) => el.dataset.k && el.offsetParent);
    // each one's own width in columns, as the page's styles give it (span 6, the full row, or one column on a phone)
    stackSheet.disabled = true;
    const spans = items.map((el) => {
      const s = getComputedStyle(el), m = /span (\d+)/.exec(s.gridColumnStart + ' ' + s.gridColumnEnd);
      return Math.min(n, m ? +m[1] : s.gridColumnEnd === '-1' ? n : 1);
    });
    stackSheet.disabled = false;
    // each keeps the column the plain grid gives it (side by side in pairs), whatever the heights, so nothing jumps
    // across when a card opens; only the rows are its own
    let col = 0;
    const css = items.map((el, i) => {
      if (!seen.has(el)) { seen.add(el); stackSeen.observe(el); }
      const span = spans[i];
      if (col + span > n) col = 0;
      const start = col + 1;
      col = (col + span) % n;
      return '#homeView .grid.tfStack>[data-k="' + CSS.escape(el.dataset.k) + '"]{grid-column:' + start + ' / span ' + span + ';grid-row-end:span ' + Math.max(1, Math.ceil(heightOf(el) + gap)) + '}';
    }).join('\n');
    if (stackSheet.textContent !== css) stackSheet.textContent = css;
  }
  new MutationObserver(stack).observe(grid, { childList: true });
  new MutationObserver(stack).observe(app, { attributes: true, attributeFilter: ['class'] });
  let activeArea = null; // the area card that's open in the accordion
  let areaPage = null; // the section whose own page is open (a room's, from its card's Go, or the weather's), or null for the house
  let more = null; // { id, opener } while the stand-in more-info is open
  const history = new Map(); // entity id → { at, points }
  const energyText = new Map(); // the dashboard's energy: statistic id → { name, text, icon } its tile shows
  const dragging = new Map(); // "kind|entity id" → value while a bar is held
  // a bar is left alone from the pointer going down on it until it settles: pressed holds the bars under a pointer that
  // hasn't moved yet, and dragGen counts each hold, so an earlier hold's settling (1.5 s after it's sent) never lets go
  // of a later one of the same bar (18 Nov: a second slide right after the first was redrawn under the finger and lost)
  const pressed = new Set(), dragGen = new Map();
  const hold = (key) => dragGen.set(key, (dragGen.get(key) || 0) + 1);
  const lockedKeys = () => [...new Set([...dragging.keys(), ...pressed])];
  let stale = false; // a redraw was skipped for a held bar; it's done once the bar is let go
  let areaSliding = 0; // a phone's area is sliding in: its card isn't redrawn under it till it's done
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
      // the demo's weather art starts smooth (Matt, 10 Nov)
      wxStyle: ['bitmap', 'onebit', 'smooth', 'line'].includes(v.wxStyle) ? v.wxStyle : 'smooth', lights: v.lights === 'dac' ? 'dac' : 'tile', dacPad: v.dacPad === 'colour' ? 'colour' : 'temperature',
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
  // and every other widget of the Weather page (Matt, 11 Nov: "add the weather widgets from the weather page to the home
  // dashboard"), the same widgets, waiting in the edit tray's Weather section until they're added
  const DASH_WEATHER = [['wx', ['current']], ['avg', ['compared_to_average']], ['aq', ['aq_tile']], ['pollen', ['pollen_tile']], ['radar', ['radar_tile']],
    ['hourly', ['hourly']], ['sun', ['sun']], ['moon', ['moon']], ['uv', ['uv_index']], ['humidity', ['humidity']], ['pressure', ['pressure']],
    ['wind', ['wind']], ['visibility', ['visibility']]];
  const WIDGETS = DASH_WEATHER.map(([k]) => k);
  const NEW_CARDS = ['aq', 'pollen', 'radar', 'hourly', 'sun', 'moon', 'uv', 'humidity', 'pressure', 'wind', 'visibility'];
  // two columns, as on the Weather page (Next hours is wide); the rest one
  const WIDGET_COLS = { hourly: 2 };
  const dashBoxes = Object.fromEntries(DASH_WEATHER.map(([k]) => [k, Object.assign(document.createElement('div'), { className: 'tfDashBento tfDash-' + k })]));
  // each widget is drawn once it's on the board (or on its way from the tray), and kept from then on
  let dashBentos = null, dashBentoId = null;
  function placeDash(on) {
    const id = on ? weatherId() : null;
    if (dashBentos && dashBentoId !== id) { dashBentos.forEach((b) => b.destroy()); dashBentos = null; }
    Object.values(dashBoxes).forEach((box) => (id ? !box.isConnected && grid.append(box) : box.remove()));
    if (id && !dashBentos && !suspended) { dashBentos = new Map(); dashBentoId = id; }
    mountWidgets();
  }
  function mountWidgets() {
    if (!dashBentos || suspended) return;
    const off = new Set(dashPrefs().hidden);
    DASH_WEATHER.forEach(([k, cards]) => {
      if (dashBentos.has(k) || (off.has(k) && !(drag?.fromTray && drag.key === k))) return;
      dashBentos.set(k, mountWeatherBento(dashBoxes[k], { getHass, entityId: dashBentoId, style: look.wxStyle, cards, onOpen: undefined /* (no Weather page in this version) */ }));
    });
  }

  const attr = (id) => states[id]?.attributes || {};
  const nameOf = (id) => prefs.entities?.[id]?.name || attr(id).friendly_name || id;
  const has = (id, bit) => isMadeUp(id) || (Number(attr(id).supported_features) & bit) === bit;
  const cap = (s) => { const t = String(s ?? '').replace(/_/g, ' '); return t.charAt(0).toUpperCase() + t.slice(1); };
  const num = (v, d = 1) => Number(v).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
  const brightnessOf = (st) => (st?.state === 'on' ? (st.attributes.brightness != null ? Math.max(1, Math.round(st.attributes.brightness / 2.55)) : 100) : 0);
  const modesOf = (id) => attr(id).supported_color_modes || [];
  // a light's colour while it's on: its rgb or hue when it's set to a colour, else amber (lightRgb)
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
  // a white light (warm to cool, or brightness only) is the brightness bar's amber, not its kelvin's peach (Matt, 10 Nov:
  // they clashed); a light set to a colour is that colour
  const COLOUR_MODES = ['hs', 'xy', 'rgb', 'rgbw', 'rgbww'];
  const lightRgb = (id) => {
    const a = attr(id), coloured = COLOUR_MODES.includes(a.color_mode);
    return (coloured && a.rgb_color ? a.rgb_color : coloured && a.hs_color ? hueRgb(...a.hs_color) : [255, 170, 0]).map((v) => Math.round(Math.max(0, Math.min(255, v))));
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
  const colourVars = (rgb) => { const soft = rgb.map((v) => Math.round(v + (255 - v) * SOFTEN)); return '--light-soft:rgb(' + soft.join(',') + ');--light-ink:' + richInk(rgb, soft) ; };
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

  /* HomeCore's own icons (Matt, 19 Nov): where one of the twenty fits, it's drawn in place of the Material Design one:
     for an icon asked for by name, from HC_FROM_MDI; for a device, from what it is (its domain and device class). A
     device given its own icon in Home Assistant keeps it, as does anything the twenty don't cover */
  const HC = Object.fromEntries(HC_ICONS.map((i) => [i.id, i]));
  const hcForState = (st) => {
    const domain = st.entity_id.split('.')[0], dc = st.attributes?.device_class;
    if (domain === 'light') return 'light';
    if (domain === 'switch') return 'plug';
    if (domain === 'climate') return 'thermostat';
    if (domain === 'fan') return 'fan';
    if (domain === 'cover') return ['door', 'garage', 'gate'].includes(dc) ? 'door' : dc === 'window' ? 'window' : 'blinds';
    if (domain === 'lock') return 'lock';
    if (domain === 'camera') return 'camera';
    if (domain === 'media_player') return dc === 'tv' ? 'tv' : 'speaker';
    if (domain === 'vacuum') return 'vacuum';
    if (domain === 'alarm_control_panel') return 'alarm';
    if (domain === 'person') return 'person';
    if (domain === 'sun') return 'sun';
    if (domain === 'binary_sensor') return { door: 'door', garage_door: 'door', opening: 'door', window: 'window', motion: 'motion', occupancy: 'motion', presence: 'motion', moisture: 'humidity' }[dc] || null;
    if (domain === 'sensor') return { temperature: 'temperature', humidity: 'humidity', moisture: 'humidity', power: 'energy', energy: 'energy', illuminance: 'sun' }[dc] || null;
    return null;
  };
  const hcFor = (st, want) => {
    if (want) return HC_FROM_MDI[want] || null;
    if (!st || st.attributes?.icon || getHass()?.entities?.[st.entity_id]?.icon) return null;
    return hcForState(st);
  };
  let hcN = 0; // each drawn icon's cuts need their own mask id
  // Entity icons come from Home Assistant (ha-state-icon), so they match the rest of the dashboard
  function fillIcons(scope) {
    const hass = getHass();
    scope.querySelectorAll('[data-icon-for]').forEach((slot) => {
      const st = states[slot.dataset.iconFor];
      const want = slot.dataset.iconName || '';
      const hc = hcFor(st, want);
      if (hc) {
        if (slot.dataset.hc !== hc || !slot.querySelector(':scope>svg.hcGlyph')) { slot.innerHTML = hcSvg(HC[hc], 24, 'hcg' + ++hcN).replace('<svg ', '<svg class="hcGlyph" '); slot.dataset.hc = hc; }
        return;
      }
      if (slot.dataset.hc) { delete slot.dataset.hc; slot.textContent = ''; }
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
    chip.animate([was, now], { duration: M.warp.cdur, delay: M.warp.cdelay, easing: EASE[M.warp.ease], fill: 'backwards' }); // the Motion Lab's on/off colour
  }
  /* icon fit (Matt, 31 Oct: one size for every icon): Material Design Icons draw at different sizes in their 24 grid
     (curtains 22 across, a water drop 12), so in one box they look different sizes. Once drawn, each glyph is sized so
     its longest side leaves 7 clear in its room, 26 in a 40 (tiles, rows, summaries, popups and area cards alike; 18
     in the mini phone's 32), and centred on what's drawn */
  const ICON_SEL = '[data-icon-for]>:is(ha-state-icon,ha-icon,svg.hcGlyph),.tfIcon>svg';
  const firstSvg = (el) => { const q = [el]; while (q.length) { const n = q.shift(); if (n.localName === 'svg') return n; if (n.shadowRoot) q.push(...n.shadowRoot.children); q.push(...n.children); } return null; };
  // true once the icon is fitted (or there's nothing to fit); false while it's still loading or out of sight
  function fitIcon(el) {
    const svg = el.localName === 'svg' ? el : firstSvg(el);
    const shapes = svg ? [...svg.querySelectorAll('path,rect,circle,ellipse,polygon,polyline,line')].filter((x) => !x.closest('defs,mask')) : []; // (a HomeCore icon's cuts are a mask, not part of its shape)
    if (!shapes.length) return !svg;
    const room = el.closest('.tfIcon')?.offsetWidth;
    if (room === undefined) return true;
    if (!room) return false;
    const key = room + '|' + shapes.map((x) => x.getAttribute('d') || x.localName).join('|');
    if (el.dataset.fitted === key) return true;
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    for (const x of shapes) {
      const r = x.getBBox(), cs = getComputedStyle(x), pad = cs.stroke !== 'none' ? (parseFloat(cs.strokeWidth) || 0) / 2 : 0;
      if (!r.width && !r.height) continue;
      // a shape turned in place (a HomeCore fan's blades) is measured where it's drawn, not where it starts
      const m = x.transform?.baseVal?.consolidate?.()?.matrix, b = m ? (() => { const c = [[r.x, r.y], [r.x + r.width, r.y], [r.x, r.y + r.height], [r.x + r.width, r.y + r.height]].map(([u, v]) => [m.a * u + m.c * v + m.e, m.b * u + m.d * v + m.f]), xs = c.map((q) => q[0]), ys = c.map((q) => q[1]); return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) }; })() : r;
      x1 = Math.min(x1, b.x - pad); y1 = Math.min(y1, b.y - pad); x2 = Math.max(x2, b.x + b.width + pad); y2 = Math.max(y2, b.y + b.height + pad);
    }
    if (!(x2 > x1)) return false;
    const vb = svg.viewBox?.baseVal?.width ? svg.viewBox.baseVal : { x: 0, y: 0, width: 24, height: 24 };
    // a glyph fills its room less 14 (26 in the 40 chip); a bigger room (the sheet's big switch, 240) keeps that share
    const target = room > 40 ? room * (26 / 40) : room - 14, size = (target * vb.width) / Math.max(x2 - x1, y2 - y1), at = size / vb.width;
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
  const iconSlot = (id, icon, letter) => { icon = prefs.entities?.[id]?.icon || icon || lightIcon(id); return ' data-icon-for="' + esc(id) + '"' + (icon ? ' data-icon-name="' + esc(icon) + '"' : '') + (letter ? ' data-letter="' + esc(letter) + '"' : ''); };
  const iconFor = (id) => (id.endsWith('_solar_power') ? 'mdi:solar-power-variant' : attr(id).rang ? 'mdi:doorbell' : '');
  // a service call on a button: domain|service|entity|data
  const act = (domain, service, id, data) => esc([domain, service, id, data ? JSON.stringify(data) : ''].join('|'));
  // several at once (an area's lights): a JSON list of [domain, service, entity, data]
  const acts = (list) => esc(JSON.stringify(list));

  /* readings: tiles in a card; each opens its device's popup, with its last 24 hours (Matt, 16 Nov: a popup, not the
     card changing to the graph, so a narrow card stays as it is; as Move Assistant v0.90.0) */
  function readingRow(id) {
    const label = esc(nameOf(id) + ', ' + valueOf(id));
    return '<div class="activityRow tap" role="button" tabindex="0" data-more="' + esc(id) + '" aria-label="' + label + '. More info">' +
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
  // a card of readings; its title can open more-info (a plant) or its popup (Energy today, Favourites)
  function card(key, order, title, rows, extra = '', moreId = null, cls = '') {
    return '<section class="card tfCard' + (cls ? ' ' + cls : '') + '" data-tf data-k="' + esc(key) + '" style="order:' + order + '" aria-label="' + esc(title) + '">' +
      '<div class="activityHeader">' + (moreId ? '<button class="activityTitle tfTitleBtn" type="button" data-more="' + esc(moreId) + '" aria-label="' + esc(title + (states[moreId] ? ', ' + valueOf(moreId) : '') + '. More info') + '">' + esc(title) + '</button>' : '<div class="activityTitle">' + esc(title) + '</div>') + '</div>' +
      '<div class="activityRows">' + rows.join('') + '</div>' + extra + '</section>';
  }
  function roomCard(r, order) {
    const key = 'readings:' + r.id;
    const rows = r.readings.map((id) => readingRow(id));
    if (r.power != null) rows.push(sumRow('Power now', watts(r.power), 'mdi:flash'));
    return card(key, order, 'Readings', rows); // its plugs are tiles now, with the other devices (Matt, 12 Nov)
  }
  function energyCard(r, order) {
    const key = 'energy:' + r.id;
    const [now, today] = [r.solar.find((id) => id.endsWith('_power')), r.solar.find((id) => id.endsWith('_today'))];
    const rows = [now, today].filter(Boolean).map((id) => readingRow(id));
    const solarW = Number(states[now]?.state || 0) * 1000;
    if (model.grid) {
      rows.push(readingRow(model.grid));
      rows.push(sumRow('House use', watts(solarW + Number(states[model.grid].state)), 'mdi:home-lightning-bolt'));
    }
    return card(key, order, 'Energy', rows, '<div class="tfCardGraph"><svg class="tfGraph" data-solar role="img" aria-label="Solar, last 24 hours"></svg></div>');
  }
  const plantCard = (p, order) => card('plant:' + p.id, order, nameOf(p.id), p.readings.map((id) => readingRow(id)), '', p.id);

  /* action tiles: a name row, then sections stacked under it */
  // was: where a light's brightness was before it went off, a faint line on its bar
  function bar(kind, id, frac, label, valueText, marker, was = null) {
    const f = frac == null ? null : Math.max(0, Math.min(1, frac)), pct = f == null ? 0 : Math.round(f * 100);
    return '<div class="tfBar ' + kind + (!marker && pct >= 12 ? ' over' : '') + '" role="slider" tabindex="0" aria-label="' + esc(label) + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '"' + (valueText ? ' aria-valuetext="' + esc(valueText) + '"' : '') + ' data-drag="' + esc(kind + '|' + id) + '">' +
      (was != null ? '<span class="was" aria-hidden="true" style="left:' + was + '%"></span>' : '') +
      (marker ? (f == null ? '' : '<b style="left:' + pct + '%"></b>') : '<i style="width:' + pct + '%"></i>') + barGlyph(kind) + '</div>';
  }
  // what a slider sets, its icon in the bar's pocket at the left, as far in as it is from the top and bottom (Matt, 26 Nov:
  // "add that icon in there… on the left-hand side… the same spacing away, so it sits nicely in that pocket")
  const BAR_GLYPHS = {
    bright: 'M12,18V6A6,6 0 0,1 18,12A6,6 0 0,1 12,18M20,15.31L23.31,12L20,8.69V4H15.31L12,0.69L8.69,4H4V8.69L0.69,12L4,15.31V20H8.69L12,23.31L15.31,20H20V15.31Z',
    vol: 'M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.84 14,18.7V20.77C18,19.86 21,16.28 21,12C21,7.72 18,4.14 14,3.23M16.5,12C16.5,10.23 15.5,8.71 14,7.97V16C15.5,15.29 16.5,13.76 16.5,12M3,9V15H7L12,20V4L7,9H3Z',
    ct: 'M15 13V5A3 3 0 0 0 9 5V13A5 5 0 1 0 15 13M12 4A1 1 0 0 1 13 5V8H11V5A1 1 0 0 1 12 4Z',
    hue: 'M17.5,12A1.5,1.5 0 0,1 16,10.5A1.5,1.5 0 0,1 17.5,9A1.5,1.5 0 0,1 19,10.5A1.5,1.5 0 0,1 17.5,12M14.5,8A1.5,1.5 0 0,1 13,6.5A1.5,1.5 0 0,1 14.5,5A1.5,1.5 0 0,1 16,6.5A1.5,1.5 0 0,1 14.5,8M9.5,8A1.5,1.5 0 0,1 8,6.5A1.5,1.5 0 0,1 9.5,5A1.5,1.5 0 0,1 11,6.5A1.5,1.5 0 0,1 9.5,8M6.5,12A1.5,1.5 0 0,1 5,10.5A1.5,1.5 0 0,1 6.5,9A1.5,1.5 0 0,1 8,10.5A1.5,1.5 0 0,1 6.5,12M12,3A9,9 0 0,0 3,12A9,9 0 0,0 12,21A1.5,1.5 0 0,0 13.5,19.5C13.5,19.11 13.35,18.76 13.11,18.5C12.88,18.23 12.73,17.88 12.73,17.5A1.5,1.5 0 0,1 14.23,16H16A5,5 0 0,0 21,11C21,6.58 16.97,3 12,3Z',
  };
  const barGlyph = (kind) => (BAR_GLYPHS[kind] ? '<svg class="tfBarGlyph" viewBox="0 0 24 24" aria-hidden="true"><path d="' + BAR_GLYPHS[kind] + '"/></svg>' : '');
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
  const nameButton = (id, state = true) => '<button class="tfName" type="button" data-more="' + esc(id) + '" aria-label="' + esc(nameOf(id) + ', ' + valueOf(id) + '. More info') + '"><span class="activityRowName">' + esc(nameOf(id)) + '</span>' + (state ? '<span class="activityRowMeta">' + esc(valueOf(id)) + '</span>' : '') + '</button>';
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
    // in a popup's grid (the Lights summary) a light is its bars, brightness then warmth, never the Dual Axis Controller,
    // which stays in its more info (Matt, 26 Nov)
    const s = specFor(id), dac = id.startsWith('light.') && dacFor(id) && !inDialog && !(only && sizeOf(id) < 3), keep = only || (inDialog && id.startsWith('light.') ? ['bright', 'ct'] : null);
    const sections = dac ? ['<div class="tfDacPad" data-dac="' + (inDialog ? 'more:' : only ? 'dash:' : 'tile:') + esc(id) + '"></div>']
      // on the board, in the order given (a light's main control first, Edit tile)
      : only ? only.map((p) => s.sections[(s.parts || []).indexOf(p)]).filter(Boolean).map((sec, i) => sec.replace(/^<(\w+)/, '<$1 data-ce-item="' + esc(only[i]) + '"'))
      : s.sections.map((sec, i) => (sec && (!keep || keep.includes((s.parts || [])[i])) ? sec : '')).filter(Boolean);
    return '<div class="tfAction' + (dac ? ' tfDac' : '') + (s.on ? ' on' : '') + (!dac && !sections.length ? ' tfHeadOnly' : '') + '" data-k="' + esc(id) + '"' + (s.tone ? ' data-tone="' + s.tone + '"' : '') + lightAttrs(id) + '>' +
      '<div class="tfActionHead">' + iconButton(id, s) + nameButton(id, inDialog || !(cardOf(id).hidden || []).includes('state')) + '</div>' + sections.join('') + '</div>';
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
    '.halo.is-size-tile .halo__pad-shell{height:var(--tf-dac-pad,198px)!important;transition:height .25s cubic-bezier(.2,.7,.3,1)}' +
    // its frame is 280 at most; a popup's pad is full width (17 Nov), so the popup can lift that
    '.hc.hcTile{max-width:var(--tf-dac-max,280px)!important}';
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
    if (d === 'water_heater') {
      // its target, then its modes (made up, 17 Nov, so its popup can be seen)
      const t = Number(a.temperature), step = a.target_temp_step || 1, on = st.state !== 'off';
      return { on, tone: 'heat', icon: 'mdi:water-boiler', button: { act: act('water_heater', on ? 'turn_off' : 'turn_on', id), label: 'Turn ' + nameOf(id) + (on ? ' off' : ' on') }, parts: ['step', 'modes'], sections: [
        Number.isFinite(t) && stepper('Target temperature', t + ' °C', act('water_heater', 'set_temperature', id, { temperature: t - step }), act('water_heater', 'set_temperature', id, { temperature: t + step })),
        a.operation_list?.length && buttons('tfSeg', 'Mode', a.operation_list.map((m) => ({ label: cap(m), act: act('water_heater', 'set_operation_mode', id, { operation_mode: m }), pressed: (a.operation_mode || st.state) === m }))),
      ] };
    }
    // a switch, plug, input boolean or fan: a tile of its own, its icon the switch (Matt, 12 Nov: plugs as tiles on the
    // area page, beside the other devices)
    if (TOGGLES.includes(d)) {
      // and Off and On under its name, as a valve's Open and Close (Matt, 12 Nov: "these are switches so they should have
      // an on/off toggle")
      const on = st.state === 'on';
      return { on, button: toggle(d, 'Turn ' + nameOf(id) + (on ? ' off' : ' on')), parts: ['controls'], sections: [
        buttons('tfSeg', nameOf(id), [
          { label: 'Off', act: act(d, 'turn_off', id), pressed: !on },
          { label: 'On', act: act(d, 'turn_on', id), pressed: on },
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
    // a room's lock is one of its devices (Matt, 18 Nov: "an actual lock device inside the storage area")
    const lock = (r.locks || []).find((id) => states[id]);
    if (lock) {
      const locked = states[lock].state === 'locked';
      keys.push({ key: 'lock', kind: 'control', tone: 'heat', light: locked ? '' : colourVars([230, 74, 25]), icon: areaGlyph('', locked ? 'mdi:lock' : 'mdi:lock-open-variant'), label: inRoom(r, lock), value: locked ? 'Locked' : 'Unlocked', short: locked ? 'Locked' : 'Unlocked', on: !locked,
        acts: [['lock', locked ? 'unlock' : 'lock', lock]], aria: (locked ? 'Unlock ' : 'Lock ') + nameOf(lock) });
    }
    if (r.plugs.length) keys.push({ key: 'plugs', kind: 'control', tone: 'blue', light: plugsOn.length ? colourVars([255, 193, 7]) : '', icon: areaGlyph('', 'mdi:power-plug'), label: 'Plugs', value: plugsOn.length ? plugsOn.length + ' of ' + r.plugs.length + ' on' : 'All off', short: plugsOn.length ? plugsOn.length + ' on' : 'Off', on: plugsOn.length > 0,
      acts: r.plugs.map((id) => ['switch', plugsOn.length ? 'turn_off' : 'turn_on', id]), aria: (plugsOn.length ? 'Turn off' : 'Turn on') + ' the plugs in ' + r.name });
    // a leak is an alert, in red; an open door or window is only worth a note, never red (Matt, 27 Oct: the balcony door)
    r.alerts.forEach((id) => keys.push(attr(id).device_class === 'moisture' ? { key: 'alert:' + id, kind: 'alert', icon: areaGlyph(id), label: 'Leak' }
      : { key: 'note:' + id, kind: 'note', icon: areaGlyph(id), label: nameOf(id) + ' ' + valueOf(id).toLowerCase() }));
    return keys;
  }
  // the devices a room's key stands for
  const groupIds = (r, key) => {
    const of = (re) => r.actions.filter((id) => re.test(id));
    return ({ lights: r.lights, lock: (r.locks || []).filter((id) => states[id]).slice(0, 1), covers: of(/^cover\./), climate: of(/^climate\./).slice(0, 1), humidifier: of(/^humidifier\./).slice(0, 1), plugs: r.plugs,
      media: (() => { const players = of(/^media_player\./); return [players.find((id) => states[id]?.state === 'playing') || players.find((id) => states[id]?.state === 'paused') || players[0]].filter(Boolean); })() })[key] || [];
  };
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
  // a room's main: its temperature, else its first reading, else its first device
  // a room's main (Matt, 18 Nov): the one picked for it, if any; else its temperature; else the next best thing it has:
  // its humidity, a leak sensor, its lock, what's going on in it (a status), its solar, a door or window, a device
  const mainOf = (r) => (states[prefs.areaMains?.[r.id]] ? prefs.areaMains[r.id] : null) || r.readings.find((id) => attr(id).device_class === 'temperature') ||
    [...r.readings, ...(r.locks || []), ...(r.statuses || []), ...r.solar, ...r.openings, ...r.actions, ...r.plugs].find((id) => states[id]) || null;
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
    // a percentage beside a temperature is the humidity without saying so (Matt, 17 Nov: "remove the term 'humidity'"); on
    // its own it still says
    if (id.startsWith('climate.')) return [inRoom(r, id), off ? 'Off' : cap(a.hvac_action || states[id].state) + (a.temperature != null ? ' · ' + deg(a.temperature) : ''), h && h.value].filter(Boolean).join(' · ');
    return [!(t && t.id === id) && inRoom(r, id), t && t.id !== id && t.value, h && h.id !== id && h.value + (t ? '' : ' humidity')].filter(Boolean).join(' · ');
  };
  /* the open area is the area card itself (Tile · Room at Wide, two columns; Matt, 17 Nov: "the only difference is they
     come pre-grouped with defined behaviour"), as tall as the Areas card */
  function areaPanel(r) {
    const isActive = r.id === activeArea, keys = roomKeys(r), main = mainOf(r), h = main && headline(main);
    // a folded card's content can't be reached until it's open. Folded (Matt's Figma "Area card accordions v04" 521:9673,
    // 28 Oct): the room's icon with its name under it, cut with "…" when it doesn't fit; the main; then the room's control
    // icons two by two (an alert after them, in red; an open door or window plain); tapping anywhere opens it
    const chips = [...keys.filter((k) => k.kind === 'control'), ...keys.filter((k) => k.kind !== 'control' && k.kind !== 'reading')].slice(0, 4);
    return '<article class="workoutPanel tfAreaPanel' + (isActive ? ' active' : '') + '" data-area="' + esc(r.id) + '" tabindex="0" aria-expanded="' + isActive + '" aria-label="' + esc(r.name) + '">' +
      '<div class="panelExpanded"' + (isActive ? '' : ' inert') + '>' + roomTile(r, null, ' data-cols="2" data-rows="' + sizeOf('areas') + '"') + '</div>' +
      '<div class="panelCollapsed tfACollapsed"><div class="tfACTop">' + areaIcon(r, keys, true) + '<span class="tfACName">' + esc(r.name) + '</span></div>' +
      '<span class="tfACMain">' + (h ? esc(h.text + (h.unit ? ' ' + h.unit : '')) : '') + '</span>' +
      '<span class="tfACTiles" aria-hidden="true">' + chips.map((k) => '<span class="tfACTile"><span class="tfIcon' + (k.kind === 'alert' ? ' alert' : '') + '"' + (k.on && k.light ? ' data-light style="' + k.light + '"' : '') + '>' + k.icon + '</span></span>').join('') + '</span></div></article>';
  }
  let areaRooms = []; // the rooms with area cards, in Matt's order
  // the areas the Areas card shows (Matt, 11 Nov: chosen in the edit tray); one switched off keeps its page and its tile
  // the area open to start with: the dashboard's (Bedroom in the demo's default, Matt, 12 Nov), else the first
  const firstArea = (list) => (list.some((r) => r.id === prefs.dash?.openArea) ? prefs.dash.openArea : list[0]?.id) || null;
  // the areas in their order (Matt, 16 Nov: dragged in the edit tray's Areas tab, the same order on Home); none dragged
  // yet, the areas page's
  const byAreaOrder = (list) => { const o = prefs.areaOrder || []; const at = (r) => { const i = o.indexOf(r.id); return i < 0 ? o.length + list.indexOf(r) : i; }; return [...list].sort((a, b) => at(a) - at(b)); };
  const areasShown = () => { const off = new Set(prefs.dash?.areasOff || []); return byAreaOrder(areaRooms).filter((r) => !off.has(r.id)); };
  /* on a phone (Matt, 19 Nov: "it is changing the size of the cards as you swipe across… this is the mobile view only"):
     no accordion. The open area is one card, as tall for every area (about 4:3, from his drawing), and under it, on the
     page, every area as an Icon button, eight to a row; the open one's is On (Figma "Icon button" 902:2536, State=On),
     the rest Off. A button, or a sideways swipe on the card, changes the area in place (pickPhoneArea) */
  const PICK_ON = colourVars([255, 162, 75]); // Icon button, State=On: #ffd5ae
  const areaPick = (r) => {
    const on = r.id === activeArea;
    return '<button class="tfIcon tfAreaPick' + (on ? ' on' : '') + '" type="button" data-area-pick="' + esc(r.id) + '"' + (on ? ' data-light style="' + PICK_ON + '"' : '') +
      ' aria-label="' + esc(r.name) + '" aria-pressed="' + on + '"><span class="tfAreaGlyph"' + iconSlot('area:' + r.id, r.icon || 'mdi:texture-box', r.name) + '></span></button>';
  };
  const areasHtml = (order) => {
    const shown = areasShown();
    if (!shown.some((r) => r.id === activeArea)) activeArea = firstArea(shown);
    const open = shown.find((r) => r.id === activeArea);
    return '<div class="tfAreas" data-tf data-k="areas" style="order:' + order + '">' +
      '<section class="workoutGallery tfAreaGallery" aria-label="Areas">' + shown.map(areaPanel).join('') + '</section>' +
      '<div class="tfAreaPhone"><div class="tfAreaStage">' + (open ? roomTile(open, null, ' data-cols="2" data-rows="' + sizeOf('areas') + '"') : '') + '</div>' +
      '<div class="tfAreaPicks" role="group" aria-label="Areas">' + shown.map(areaPick).join('') + '</div></div></div>';
  };
  /* one room on its own (Tile · Room, Matt, 6 Nov; Figma 954:6176): a tile added from the edit tray instead of the Areas
     card, keyed room:<area>. The head is the room's icon and name; XS its reading in the head, S the reading big, M its
     devices too (up to four), L and XL the reading bigger with its second under it. It never opens out: the tile opens
     the room's page. Its interactions are the Areas card's open area's (Matt, 17 Nov: "bring them all"): the room's
     icon opens the room's page (18 Nov), a device's icon on its own and a device's name open its control (one device its
     own, a room's lights or covers as a group), a device's icon beside its name turns it on and off, the reading opens its more-info, and the edge lights up */
  const isRoomKey = (key) => key.startsWith('room:');
  const roomOf = (key) => areaRooms.find((r) => 'room:' + r.id === key);
  /* Edit area card (Matt, 23 Nov: "a 'what you see is what you get' type design… Just for the area cards… all the entities
     and devices available in that area, and then you'll drag them into the spaces available on the card. So there's 4
     spaces available at the bottom of the card, and then there's one large main data point"): an area's card is its main
     and four spaces, each one of its card's own keys (the lights, the covers…, kept as "key:lights") or one entity. Until
     something's moved, what the card has always shown: its main and its first four controls */
  const areaCard = (r) => {
    const saved = prefs.areaCards?.[r.id];
    if (saved) return { main: saved.main ?? null, slots: [0, 1, 2, 3].map((i) => saved.slots?.[i] ?? null) };
    const ctl = roomKeys(r).filter((k) => k.kind === 'control').slice(0, 4).map((k) => 'key:' + k.key);
    return { main: mainOf(r), slots: [0, 1, 2, 3].map((i) => ctl[i] || null) };
  };
  // what a space holds, as a key the card draws: one of the area's keys, or an entity as one (its icon, its name without
  // the room's, its state; a switch where it can be turned on and off, else it only opens)
  const SWITCHED = ['light', 'switch', 'fan', 'input_boolean', 'humidifier', 'climate'];
  function slotKey(r, item, keys) {
    if (item.startsWith('key:')) {
      const k = keys.find((x) => x.key === item.slice(4)), ids = k ? groupIds(r, k.key) : [];
      return k ? { ...k, group: true, more: ids.length === 1 ? ids[0] : 'group:' + r.id + ':' + k.key } : null;
    }
    const st = states[item];
    if (!st) return null;
    const d = item.split('.')[0], rgb = kindRgb(item), s0 = st.state;
    const acts = SWITCHED.includes(d) ? [[d, 'toggle', item]] : d === 'cover' ? [['cover', s0 === 'closed' ? 'open_cover' : 'close_cover', item]] : d === 'lock' ? [['lock', s0 === 'locked' ? 'unlock' : 'lock', item]] : null;
    const on = Boolean(rgb) || s0 === 'on';
    return { key: 'ent:' + item, more: item, kind: 'control', tone: d === 'light' ? 'light' : 'blue', light: rgb ? colourVars(rgb) : '', icon: areaGlyph(item), label: inRoom(r, item), value: valueOf(item), on,
      acts, aria: (on ? 'Turn off ' : 'Turn on ') + nameOf(item) };
  }
  function roomTile(r, key, attrs = '', edit = false, given = null) {
    // a tile on the board keeps its own devices and main reading (Edit tile); the Areas card's open area doesn't
    const own = key ? cardOf(key) : {}, off = new Set(own.hidden || []);
    const keys = roomKeys(r), lit = (k) => (k.on && k.light ? ' data-light style="' + k.light + '"' : '');
    // what the area's card was given in Edit area card (Matt, 23 Nov): its main and its four spaces, wherever it shows
    const picked = given || (prefs.areaCards?.[r.id] || edit ? areaCard(r) : null); // given: a dashboard card's own main and spaces
    const mainItem = picked ? picked.main : (states[own.main] && own.main) || mainOf(r);
    const mainKey = mainItem && slotKey(r, mainItem, keys);
    const main = mainKey ? mainKey.more : null;
    const h = mainKey && !mainKey.group ? headline(main) : null;
    const big = mainKey ? (mainKey.group ? mainKey.value : h ? h.text + (h.unit ? ' ' + h.unit : '') : '') : '';
    const sub = mainKey ? (mainKey.group ? mainKey.label : mainSub(r, main, keys)) : '';
    const opens = (k) => k.more || (() => { const ids = groupIds(r, k.key); return ids.length === 1 ? ids[0] : 'group:' + r.id + ':' + k.key; })();
    const spaces = picked ? picked.slots.map((it) => (it ? slotKey(r, it, keys) : null)) : null;
    const controls = spaces ? spaces.filter(Boolean) : inCardOrder(key || '', keys.filter((k) => k.kind === 'control' && !off.has(k.key)), (k) => k.key).slice(0, 4);
    /* the rule (Matt, 20 Nov: "If it is just an icon, it opens the panel or more info that controls that. if it is a tile
       with name and subtitle etc then it opens the more info and the icon in the tile becomes the binary toggle like it is
       (if defined by the device/entity)"): an icon on its own opens what it stands for (the room's lights panel, the
       thermostat); a tile (icon, name, state) opens it from anywhere on it, and its icon turns it on and off where it can
       be, else opens it too. The room's own head is as it was: its icon and name open the room's page */
    const opener = (k) => '<button class="tfIcon' + (k.on ? ' on' : '') + '" type="button" data-ce-item="' + esc(k.key) + '" data-tone="' + k.tone + '"' + lit(k) + ' data-more="' + esc(opens(k)) + '" aria-label="' + esc(r.name + ' ' + k.label.toLowerCase() + ', ' + k.value + '. Open') + '">' + k.icon + '</button>';
    const toggle = (k) => '<button class="tfIcon' + (k.on ? ' on' : '') + '" type="button" data-tone="' + k.tone + '"' + lit(k) + ' data-acts="' + acts(k.acts) + '" aria-label="' + esc(k.aria) + '" aria-pressed="' + k.on + '">' + k.icon + '</button>';
    const head = (k, i) => '<div class="tfRoomDev' + (k.on ? ' on' : '') + '" data-ce-item="' + esc(k.key) + '" data-more="' + esc(opens(k)) + '"' + (edit ? ' data-slot="' + i + '"' : '') + '>' + (k.acts?.length ? toggle(k) : '<span class="tfIcon' + (k.on ? ' on' : '') + '" data-tone="' + k.tone + '"' + lit(k) + ' aria-hidden="true">' + k.icon + '</span>') +
      '<button class="tfName tfRoomDevName" type="button" data-more="' + esc(opens(k)) + '" aria-label="' + esc(r.name + ' ' + k.label.toLowerCase() + ', ' + k.value + '. Open') + '"><span class="activityRowName">' + esc(k.label) + '</span><span class="activityRowMeta">' + esc(k.value) + '</span></button></div>';
    // Edit area card: all four spaces, an empty one a dashed outline to drop into
    const empty = (i) => '<button class="tfRoomDev hcSlotEmpty" type="button" data-slot="' + i + '" aria-label="Empty space ' + (i + 1) + '"></button>';
    const devices = edit ? [] : controls.map(opener); // (the editor shows the card wide: its spaces are the heads)
    // wide, the same devices as heads (icon, name, state), as the open room shows them (Matt, 6 Nov; Figma 954:6297): the
    // tile opens its control, its icon the switch
    const heads = edit ? spaces.map((k, i) => (k ? head(k, i) : empty(i))) : controls.map((k, i) => head(k, i));
    // the room's icon opens the room's page (Matt, 18 Nov), bare as the summaries' are; it used to turn off everything in
    // the room, which "just shouldn't happen"
    const glyph = '<span class="tfAreaGlyph"' + iconSlot('area:' + r.id, r.icon || 'mdi:texture-box', r.name) + '></span>';
    const roomIcon = '<button class="tfIcon tfIconOpen tfRoomIcon" type="button" data-go="' + esc(r.id) + '" aria-label="Open ' + esc(r.name) + '">' + glyph + '</button>';
    return '<div class="tfAction tfRoomTile"' + (key ? ' data-k="' + esc(key) + '"' : '') + attrs + ' data-go="' + esc(r.id) + '">' +
      '<div class="tfActionHead">' + roomIcon +
      '<button class="tfName" type="button" data-go="' + esc(r.id) + '" aria-label="Open ' + esc(r.name) + '"><span class="activityRowName">' + esc(r.name) + '</span>' +
      (big || sub ? '<span class="activityRowMeta">' + (big ? '<span class="tfRoomInline">' + esc(big) + (sub ? ' · ' : '') + '</span>' : '') + esc(sub) + '</span>' : '') + '</button></div>' +
      // the reading opens its more-info (the thermometer's, say)
      (big ? '<button class="tfRoomReading" type="button" data-more="' + esc(main) + '"' + (edit ? ' data-slot="main"' : '') + ' aria-label="' + esc((mainKey.group ? mainKey.label : nameOf(main)) + ', ' + (mainKey.group ? mainKey.value : valueOf(main)) + '. More info') + '"><span class="tfRoomBig">' + esc(big) + '</span>' + (sub ? '<span class="tfRoomSub">' + esc(sub) + '</span>' : '') + '</button>'
        : edit ? '<button class="tfRoomReading hcSlotEmpty hcSlotMain" type="button" data-slot="main" aria-label="Empty main space"></button>' : '') +
      (devices.length || edit ? '<div class="tfRoomDevices">' + devices.join('') + '</div><div class="tfRoomHeads">' + heads.join('') + '</div>' : '') + '</div>';
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
  // the favourites start, once, as Home's default (Matt, 26 Nov): Openable lock, Alarm, Curtains, Thermostat, Glass sphere
  // and Watering; after that the list is his, edited in Edit Home page. Seeded again for anyone with the old start
  const FAV_SEED = 2;
  let prefsReady = false;
  function seedFavourites() {
    if (!prefsReady || prefs.favSeed === FAV_SEED || !model.rooms.length) return;
    const first = (test) => Object.keys(states).find((id) => isMadeUp(id) && test(id));
    const start = ['lock.openable_lock', model.security.alarms[0], first((id) => id.startsWith('cover.') && /curtain/.test(id)), first((id) => id.startsWith('climate.')), 'light.big_sphere', first((id) => id.startsWith('valve.') && /watering/.test(id))];
    prefs = { ...prefs, favourites: [...new Set(start.filter((id) => id && states[id]))], favSeed: FAV_SEED };
    savePrefs();
  }
  // the dashboard's Favourites: the favourites in their order, less those hidden to the edit tray; then, with Show
  // suggestions on, suggestions from the dashboard's rooms to fill the card
  const suggestOn = () => prefs.suggest ?? false; // off until switched on: Home shows its six favourites (Matt, 26 Nov)
  // how many suggestions Home shows after the favourites, 1 to 12, 4 until one is picked (Matt, 23 Nov: "Number of
  // suggested entities")
  const SUGGEST_MAX = 12, suggestN = () => Math.min(SUGGEST_MAX, Math.max(1, prefs.home?.suggestN ?? 4));
  function dashFavourites() {
    const hidden = new Set(overview ? [] : prefs.favHidden || []), stars = starred().filter((id) => !hidden.has(id));
    const fill = suggestOn() ? suggestionIds().filter((id) => !hidden.has(id) && dashLight(id)).slice(0, overview ? suggestN() : undefined) : [];
    // Home's card grows with its favourites, so every one shows there (as Move Assistant v0.85.0); as a strip, ten
    return overview && !favsStrip() ? [...stars, ...fill] : [...stars, ...fill].slice(0, DASH_FAVOURITES);
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
    // a favourite's line is one thing, its state (Matt, 26 Nov: "thermostat should say heating. Curtains partially open…
    // not have to have multiple lines going on"): "Heating", not "Heating · Living Room"
    const meta = area ? String(say ?? valueOf(id)).split(' · ')[0] : (say ?? valueOf(id));
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
    // the order picked in Edit Home page
    const order = sumPrefs().sumOrder || [], at = (it) => (it.type === 'summary' && order.includes(it.key) ? order.indexOf(it.key) : order.length);
    return order.length ? out.map((it, i) => [it, i]).sort((a, b) => at(a[0]) - at(b[0]) || a[1] - b[1]).map(([it]) => it) : out;
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
  // a summary shows when it's on: Home Assistant's own unless switched off, the demo's extras only once switched on
  // Home's summaries are its own (Matt, 12 Nov: "they shouldn't be linked"): which show and their order, set in Edit Home
  // page; Dashboards keeps the ones chosen in its edit tray
  const sumPrefs = () => (overview ? { ...HOME_SUMS, ...(prefs.home || {}) } : prefs);
  const sumOn = (k) => (EXTRA_SUMS.includes(k) ? (sumPrefs().shownSums || []).includes(k) : !(sumPrefs().hiddenSums || []).includes(k));
  function extraSums(rooms, groups, of) {
    const covers = rooms.flatMap((r) => of(r, /^cover\./)), open = covers.filter((id) => ['open', 'opening'].includes(states[id]?.state)).length;
    const people = Object.keys(states).filter((id) => id.startsWith('person.')), home = people.filter((id) => states[id]?.state === 'home').length;
    const openings = model.security.openings.filter((id) => states[id]), opened = openings.filter((id) => states[id].state === 'on').length;
    const leaks = Object.keys(states).filter((id) => id.startsWith('binary_sensor.') && attr(id).device_class === 'moisture'), wet = leaks.filter((id) => states[id].state === 'on').length;
    const vac = model.vacuums.filter((id) => states[id]);
    return {
      covers: covers.length && { value: open ? open + ' open' : 'All closed', groups: groups((r) => of(r, /^cover\./)) },
      people: people.length && { value: home ? home + ' home' : 'Nobody home', groups: [{ name: 'People', ids: people }] },
      openings: openings.length && { value: opened ? opened + ' open' : 'All closed', groups: [{ name: 'Doors and windows', ids: openings }] },
      leaks: leaks.length && { value: wet ? count(wet, 'leak', 'leaks') : 'All dry', groups: [{ name: 'Leak sensors', ids: leaks }] },
      vacuum: vac.length && { value: cap(states[vac[0]].state), groups: [{ name: 'Vacuum', ids: vac }] },
    };
  }
  function summaryData(every = false) {
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
      ...extraSums(rooms, groups, of),
    };
    const out = [];
    const active = alerts.filter((x) => x.severity !== 'warning' && x.on);
    if (active.length) out.push({ key: 'alerts', name: 'Alerts', icon: 'mdi:alarm-plus', colour: '#f44336', value: count(active.length, 'active alert', 'active alerts'), groups: [{ name: 'Active', ids: active.map((x) => x.entity) }] });
    shortcutItems().forEach((it) => {
      if (it.type !== 'summary') out.push({ key: 'path:' + it.path, name: it.label || it.path, icon: it.icon || 'mdi:link-variant', colour: '', value: '' });
      else if (!it.hidden && all[it.key] && (every || sumOn(it.key))) out.push({ key: it.key, ...SUMMARIES[it.key], ...all[it.key] });
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
    prefs = { favourites: v.favourites ?? null, sources: v.sources, hiddenSums: v.hiddenSums, shownSums: v.shownSums, home: v.home, dash: v.dash, named: v.named, favHidden: v.favHidden, suggest: v.suggest, favSeed: v.favSeed, entities: v.entities, areaOrder: v.areaOrder, areaMains: v.areaMains, areaCards: v.areaCards };
    haHome = home?.value || {};
    haSecurity = security?.value || {};
    predicted = Array.isArray(usage?.entities) ? usage.entities : [];
    suggested = null;
    if (prefs.dash?.openArea) activeArea = null; // the dashboard's own open area, now it's known
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
  // a source's amount today, as its tile shows it
  const energyAmount = (t) => Number(t.value).toLocaleString(undefined, { maximumFractionDigits: t.value < 10 ? 2 : 1 }) + ' ' + t.unit;
  function energyGlance() {
    const tiles = energyTiles = energy?.length ? energy : MADE_UP_ENERGY.map(([key, name, value, unit]) => {
      if (key === 'solar') { const sun = Object.keys(states).find((x) => x.endsWith('_solar_today') && !x.includes('made_up_energy')); if (sun && Number.isFinite(Number(states[sun].state))) value = Number(states[sun].state); }
      const id = 'sensor.made_up_energy_' + key;
      states[id] = { entity_id: id, state: String(value), last_changed: new Date().toISOString(), attributes: { friendly_name: name + ' today', unit_of_measurement: unit, state_class: 'total_increasing' } };
      return { key, name, id, value, unit };
    });
    energyText.clear();
    // the sources Edit card leaves on, the graph on its main one to start with
    const own = cardOf('energy'), off = new Set(own.hidden || []), kept = inCardOrder('energy', tiles, (t) => t.id).filter((t) => !off.has(t.id)), shown = kept.length ? kept : tiles;
    if (!shown.some((t) => t.id === energyPick)) energyPick = (shown.find((t) => t.id === own.main) || shown[0]).id;
    const rows = shown.map((t) => {
      const text = energyAmount(t), icon = ENERGY_ICON[t.key], on = t.id === energyPick;
      energyText.set(t.id, { name: t.name, text, icon });
      return '<div class="activityRow tap' + (on ? ' picked' : '') + '" role="button" tabindex="0" data-ce-item="' + esc(t.id) + '" data-energy-pick="' + esc(t.id) + '" aria-pressed="' + on + '" aria-label="' + esc(t.name + ', ' + text) + '. Show its day in the graph">' +
        '<div class="tfIcon" aria-hidden="true"' + iconSlot('', icon, t.name) + '></div><div><div class="activityRowName">' + esc(t.name) + '</div><div class="activityRowMeta">' + esc(text) + '</div></div></div>';
    });
    // the picked source's day as a graph, above the glance or below it (its ⋯ in edit mode)
    const pick = shown.find((t) => t.id === energyPick), below = (dashPrefs().opts.energy?.graph || 'above') === 'below';
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
    drawLine(svg, line, [area].filter(Boolean)); // the Motion Lab's: over 1 s, the fill following
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
  const dashControl = (id) => cardControls(id).slice(0, sizeOf(id) - 1);
  // a tile's controls on the board: a light's as Edit tile leaves them, its main one first; the rest all of theirs
  function cardControls(id) {
    const own = cardOf(id), off = new Set(own.hidden || []), shown = inCardOrder(id, controlsOf(id)).filter((p) => !off.has(p));
    return !own.order && shown.includes(own.main) ? [own.main, ...shown.filter((p) => p !== own.main)] : shown;
  }
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
  /* Home's welcome message (Matt, 12 Nov: "dynamic to the time of day and then the name"), above the home's name; Edit
     Home page switches it off */
  const welcomeOn = () => prefs.home?.welcome ?? true;
  const myName = () => {
    const user = getHass()?.user;
    return user?.name || Object.values(states).find((st) => st.entity_id.startsWith('person.') && user?.id && st.attributes?.user_id === user.id)?.attributes.friendly_name
      || states['person.wembely']?.attributes.friendly_name || ''; // the demo: you are Wembely
  };
  const greeting = () => { const h = new Date().getHours(), name = myName(); return (h >= 5 && h < 12 ? 'Good morning' : h >= 12 && h < 18 ? 'Good afternoon' : 'Good evening') + (name ? ', ' + name : ''); };
  /* Schedule (Matt, 12 Nov: "replace the weather with a schedule calendar", his pick of the agenda list): Home Assistant's
     calendar card in HomeCore's parts, today's and tomorrow's events under their day, each with its time and its
     calendar's colour. The made-up house's calendars (Home and each Fraggle), as its made-up thermostat; an event that's
     over is quieter */
  const CALENDARS = { home: ['Home', '#03a9f4'], wembely: ['Wembely', '#7cb342'], red: ['Red', '#e53935'], gobo: ['Gobo', '#fb8c00'] };
  function scheduleEvents() {
    const day = (d, h = 0, m = 0) => { const t = new Date(); t.setDate(t.getDate() + d); t.setHours(h, m, 0, 0); return t; };
    return [
      { day: 0, start: day(0, 9), end: day(0, 10), name: 'Doozer delivery', cal: 'home' },
      { day: 0, start: day(0, 13), end: day(0, 14), name: 'Radish harvest', cal: 'wembely' },
      { day: 0, start: day(0, 17, 30), end: day(0, 19), name: 'Gobo\'s band practice', cal: 'gobo' },
      { day: 1, allDay: true, name: 'Bin day', cal: 'home' },
      { day: 1, start: day(1, 12), end: day(1, 13), name: 'Lunch with Red', cal: 'wembely' },
      { day: 1, start: day(1, 18), end: day(1, 20), name: 'Swimming in the Fraggle Pond', cal: 'red' },
    ];
  }
  function scheduleCard() {
    const now = Date.now(), evs = scheduleEvents();
    const row = (e) => { const [cal, colour] = CALENDARS[e.cal], past = !e.allDay && e.end.getTime() < now;
      return '<li class="hcSchedRow' + (past ? ' past' : '') + '" style="--cal:' + colour + '"><span class="hcSchedTime">' + (e.allDay ? 'All day' : esc(clock(e.start))) + '</span>' +
        '<span class="hcSchedBar" aria-hidden="true"></span><span class="tfRoomDevName"><span class="activityRowName">' + esc(e.name) + '</span><span class="activityRowMeta">' +
        esc((e.allDay ? '' : clock(e.start) + ' – ' + clock(e.end) + ' · ') + cal) + '</span></span></li>'; };
    const dayList = (d, label) => { const list = evs.filter((e) => e.day === d); return list.length ? '<div class="hcSchedDay"><div class="hcSchedLabel">' + label + '</div><ul>' + list.map(row).join('') + '</ul></div>' : ''; };
    return '<section class="card tfCard tfDashCard tfDash-sched" data-tf data-k="dash:sched" aria-label="Schedule"><div class="activityHeader"><div class="activityTitle">Schedule</div></div>' +
      '<div class="hcSchedList">' + dayList(0, 'Today') + dayList(1, 'Tomorrow') + '</div></section>';
  }
  const dashWrap = (cls, key, label, titled) => (inner) => '<section class="card tfCard tfDashCard ' + cls + '" data-tf data-k="' + key + '" aria-label="' + label + '">' +
    (titled ? '<div class="activityHeader">' + (key === 'favs' ? '<button class="activityTitle tfTitleBtn" type="button" data-more="favourites" aria-label="Favourites. More info">' + label + '</button>' : '<div class="activityTitle">' + label + '</div>') + '</div>' : '') + '<div class="activityRows">' + inner + '</div></section>';
  function dashboard(out, sums) {
    out.dash = true;
    // Home's head, from HomeCore Labs (Matt, 26 Nov: "steal the weather and the time and date"): the greeting, the name
    // with the time and date at the end of its line, and the weather above them; Home only, not an area's page
    const home = esc(getHass()?.config?.location_name || 'Home');
    out.push({ key: 'dash:title', html: '<h1 class="settingsTitle tfDashTitle" data-tf data-k="dash:title">' + ((overview ? welcomeOn() : dashPrefs().welcome) ? '<span class="tfGreeting">' + esc(greeting()) + '</span>' : '') +
      (overview ? '<span class="hcTitleLine"><span>' + home + '</span><span class="hcHomeClock" data-wx-clock>' + esc(wxClock()) + '</span></span>' + homeWxTile() : home) + '</h1>' });
    // the summaries: a row of their own, the bar only as wide as its tiles
    if (sums.length) out.push({ key: 'sums', wrap: (inner) => '<div class="tfDashBarRow" data-tf data-k="sums">' + dashWrap('tfDash-bar', 'sums-bar', 'Summaries', false)(inner).replace(' data-tf', '') + '</div>', tiles: sums.map((s) => ({ key: 'sum:' + s.key, html: summaryRow(s) })) });
    if (!overview && areasShown().length) out.push({ key: 'areas', html: areasHtml(0) });
    // what you've starred always shows, from any room; only the suggestions that fill the card keep to the dashboard's rooms
    const favs = dashFavourites();
    if (favs.length) out.push({ key: 'favs', wrap: dashWrap('tfDash-favs', 'favs', 'Favourites', true), tiles: favs.map((id) => ({ key: 'fav:' + id, html: deviceRow(id, { area: true }) })) });
    if (overview) {
      // Energy today, as on Dashboards (Matt, 12 Nov: "add energy stuff"), once switched on in Edit Home page (off to start
      // with: "by default do not show the energy")
      if (prefs.home?.energy) { out.push({ key: 'dash:energy', html: energyGlance() }); loadEnergy(); }
      if (prefs.home?.schedule !== false) out.push({ key: 'dash:sched', html: scheduleCard() });
      dashTileIds(0).forEach((id) => out.push({ key: 'dash:tile:' + id, wrap: (inner) => '<div class="tfDashTiles" data-tf data-k="dash:tile:' + esc(id) + '">' + inner + '</div>',
        tiles: [{ key: id, html: roomTile(roomOf(id), id) }] }));
      return out;
    }
    const items = activityItems();
    // HomeCore demo: its title opens the Activity page (Matt, 9 Nov), as Favourites' title opens its own view
    out.push({ key: 'dash:act', html: card('dash:act', 0, 'Activity', items.length ? items.map(activityRow) : ['<p class="tfDashNone">Nothing has changed in the last day.</p>'], '', null, 'tfDashCard tfDash-act')
      .replace('<div class="activityTitle">Activity</div>', '<button class="activityTitle tfTitleBtn" type="button" data-hc-open="activity" aria-label="Activity. Open the Activity page">Activity</button>') });
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
  const BOARD_NAMES = { title: 'The name', sums: 'Summaries', wx: 'Weather', areas: 'Areas', favs: 'Favourites', act: 'Activity', energy: 'Energy today', avg: 'Compared to average', aq: 'Air quality', pollen: 'Pollen', radar: 'Rain radar',
    sched: 'Schedule', hourly: 'Next hours', sun: 'Sun', moon: 'Moon', uv: 'UV index', humidity: 'Humidity', pressure: 'Pressure', wind: 'Wind', visibility: 'Visibility' };
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
  const SIZES = { wx: 5, areas: 5, favs: 5, act: 5, energy: 4, avg: 4, aq: 4, pollen: 4, radar: 4, hourly: 4, sun: 4, moon: 4, uv: 4, humidity: 4, pressure: 4, wind: 4, visibility: 4 };
  // a tile whose entity isn't in the states yet keeps its saved height (it can't be measured, and must never stop the board)
  const mostRows = (key) => (!key.includes('.') || !states[key] || (key.startsWith('light.') && wantsDac(key)) ? ROWS_MOST : Math.min(ROWS_MOST, cardControls(key).length + 1));
  const sizeOf = (key) => {
    const o = dashPrefs().opts[key] || {}, most = mostRows(key), h = Number(o.h) || (o.tall ? 5 : SIZES[key] || TILE_ROWS);
    return Math.max(1, Math.min(most, h));
  };
  const TILE_ROWS = 2, DAC_CHROME = 90; // a tile's padding (18 and 18), head (40) and gap (14) around the controller's pad
  // a card of tiles fills its height (Matt, 2 Nov): as many rows as fit at 56 or taller, every row the same height
  const FILL_MIN = 56;
  const boardName = (key) => BOARD_NAMES[key] || (key.startsWith('room:') ? areaRooms.find((r) => 'room:' + r.id === key)?.name || 'Area' : nameOf(key));
  const AREA_FOLDED = 128;
  let editing = false, drag = null, boardOpen = null, fitQueued = false, lastPlaced = new Map(), boardRows = 0, boardTop = 0;
  let cardEdit = null; // the card whose own page is open in the edit tray (Edit card), by its key
  const cardStyle = document.createElement('style'); // each card's own look
  root.appendChild(cardStyle);
  const cardSel = (key) => '[data-hc-card="' + String(key).replace(/["\\]/g, '\\$&') + '"]';
  // what's painted as the card: a card or tile itself; the weather widgets and Areas hold theirs
  const FACES = ':is(.wbCard,.tfAreaPanel)';
  const faceOf = (el) => (el?.matches('.tfDashBento,.tfAreas') ? el.querySelector('.wbCard,.tfAreaPanel') : el);
  const rgbaOf = (c, a) => 'rgba(' + c.slice(0, 3).map(Math.round).join(',') + ',' + +a.toFixed(3) + ')';
  // the page's header, above the grid at its own size (the cards' rules: padding 10, tiles 60, so a bar of summaries is
  // 80 or 140 and never fits the grid's rows; Matt, 27 Oct: "we have rules to follow")
  const HEAD = ['title', 'sums'];
  const pegsFor = (W) => {
    const n = Math.max(1, Math.floor((W + PEG_GAP) / (PEG_MIN + PEG_GAP)));
    return { n, w: Math.max(1, Math.min(PEG_MAX, Math.floor((W - (n - 1) * PEG_GAP) / n))) };
  };
  // a card the page hasn't offered before starts off the board, waiting in the edit tray (known: the ones it has)
  // a layout saved for this board's width (the demo's defaults have one for six columns) stands in for the main one
  /* HomeCore demo (12 Nov): Home is the overview, much like Home Assistant's default page today (Matt's grab): the name,
     the summaries, each area's tile at L and Favourites at L, laid out the same for everyone and not edited. The board
     you edit is Dashboards (the site's rail) */
  let overview = true;
  const OVERVIEW_ROOMS = ['living_room', 'kitchen', 'bedroom', 'bathroom', 'balcony', 'office'];
  // Home's areas: every one in order (Edit Home page's Areas tab lists them), and those switched on (Matt, 16 Nov: Home's
  // own switches, apart from the dashboard's Areas card)
  const overviewRooms = () => { const off = new Set(prefs.home?.areasOff || []); return overviewRoomsAll().filter((r) => !off.has(r.id)); };
  const overviewRoomsAll = () => (prefs.areaOrder?.length ? byAreaOrder(areaRooms) : [...areaRooms].sort((a, b) => ((OVERVIEW_ROOMS.indexOf(a.id) + 1) || 99) - ((OVERVIEW_ROOMS.indexOf(b.id) + 1) || 99)));
  function overviewPrefs() {
    const rooms = overviewRooms().map((r) => 'room:' + r.id), cells = { favs: { col: 3, row: 0 } };
    rooms.forEach((k, i) => { cells[k] = i < 3 ? { col: i, row: 0 } : i < 6 ? { col: i - 3, row: 5 } : { col: (i - 6) % 6, row: 10 + 5 * Math.floor((i - 6) / 6) }; });
    return { pegs: 6, cells, spans: { favs: 2 }, hidden: Object.keys(BOARD_NAMES).filter((k) => !['title', ...(prefs.home?.sums === false ? [] : ['sums']), ...(prefs.home?.favs === false ? [] : ['favs']), ...(prefs.home?.schedule === false ? [] : ['sched']), ...(prefs.home?.weather ? ['wx'] : []), ...(prefs.home?.energy ? ['energy'] : [])].includes(k)),
      opts: { favs: { h: 5 }, ...Object.fromEntries(rooms.map((k) => [k, { h: 5 }])) }, tiles: rooms, known: NEW_CARDS, areasOff: [] };
  }
  const dashPrefs = () => (overview ? overviewPrefs() : boardPrefs());
  const boardPrefs = () => {
    let d = { cells: {}, spans: {}, hidden: [], opts: {}, ...(prefs.dash || {}) };
    if (d.sumsOff) d = { ...d, hidden: [...d.hidden, 'sums'] }; // the summaries switched off in the edit tray
    const alt = d.byPegs?.[dashCols()];
    if (alt) d = { ...d, cells: alt.cells || d.cells, spans: alt.spans || d.spans };
    const fresh = NEW_CARDS.filter((k) => !(d.known || []).includes(k) && !d.hidden.includes(k));
    return fresh.length ? { ...d, hidden: [...d.hidden, ...fresh] } : d;
  };
  // what's saved is the visitor's own layout from then on, at every width (the per-width defaults go)
  function saveDash(next) { if (overview) return; const { byPegs: _defaults, ...own } = next; prefs = { ...prefs, dash: { ...own, known: NEW_CARDS } }; savePrefs(); }
  // what's on the board: each card's key, its element, its width in pegs ('full' the whole width) and whether it's a tile
  function boardItems() {
    const q = (sel) => grid.querySelector(sel);
    return [['title', q('.tfDashTitle'), 'full'], ['sums', q('.tfDashBarRow'), 'full'], ['wx', dashBoxes.wx, 2], ['areas', q('.tfAreas'), 'areas'],
      ['favs', q('.tfDash-favs'), 2], ['sched', q('.tfDash-sched'), 2], ['act', q('.tfDash-act'), 2], ['energy', q('.tfDash-energy'), 2], ['avg', dashBoxes.avg, 2],
      ...NEW_CARDS.map((k) => [k, dashBoxes[k], WIDGET_COLS[k] || 1]),
      ...[...grid.querySelectorAll('.tfDashTiles > [data-k]')].map((el) => [el.dataset.k, el, 1, true])]
      .filter(([, el]) => el?.isConnected).map(([key, el, span, tile = false]) => ({ key, el, span, tile }));
  }
  // a card's width in pegs on a board n pegs wide, each w: 'full' the whole width, the areas as wide as they're drawn
  const colsOf = (it, n, w) => {
    if (it.span === 'full') return n;
    // the areas: as wide as they need (Matt, 11 Nov: no width of their own to pick), so as wide as their rooms, up to the
    // board's edge from where they sit; the rooms that don't fit scroll
    if (it.span === 'areas') {
      // the open area two columns wide, whatever the card's width (Matt, 17 Nov: it took all the spare room, 2.7 wide)
      const open = 2 * w + PEG_GAP;
      it.el.style.setProperty('--area-open', open + 'px');
      const need = Math.ceil((open + Math.max(0, areasShown().length - 1) * (AREA_FOLDED + PEG_GAP) + PEG_GAP) / (w + PEG_GAP));
      return Math.max(Math.min(n, 2), Math.min(need, n - (dashPrefs().cells.areas?.col || 0)));
    }
    return Math.min(n, dashPrefs().spans[it.key] ?? it.span);
  };
  // a card's rows: its height's
  const rowsOf = (it) => sizeOf(it.key);
  // a phone's Areas (a phone's cards are as tall as what they hold, demo.css): its card 1325:982 (Matt's drawing), 14 to
  // the buttons, eight to a row 8 apart inside the page's 16. Its rows, for a board that places it, hold all of that
  const PHONE_AREAS = window.matchMedia('(max-width: 620px)');
  const phoneAreaRows = (W) => {
    const btn = (W - 32 - 7 * 8) / 8, lines = Math.ceil(areasShown().length / 8);
    return Math.max(1, Math.ceil((W * 982 / 1325 + 14 + lines * btn + (lines - 1) * 8 + PEG_GAP) / ROW_PITCH));
  };
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
  // the Areas card shows all of its open area: scrolled just enough when it's cut off at an edge (Matt, 17 Nov)
  function showOpenArea(smooth) {
    const gal = grid?.querySelector('.tfAreas[data-k="areas"] .tfAreaGallery'), on = gal?.querySelector('.tfAreaPanel.active');
    if (!on || gal.scrollWidth <= gal.clientWidth) return;
    const g = gal.getBoundingClientRect(), o = on.getBoundingClientRect();
    const by = o.right > g.right ? o.right - g.right : o.left < g.left ? o.left - g.left : 0;
    if (by) gal.scrollBy({ left: by, behavior: smooth ? 'smooth' : 'auto' });
  }
  function layoutBoard() {
    requestAnimationFrame(() => showOpenArea(false)); setTimeout(() => showOpenArea(false), 360); // and once its width has eased in
    if (!testFocus || !grid) return;
    // a phone is the same board two columns wide (Matt, 1 Nov: one rule everywhere, so Smalls stack beside a Medium
    // there too), its cards in the phone's order and not edited there
    const W = grid.clientWidth, phone = W < 2 * PEG + PEG_GAP, board = app.classList.contains('tfDash');
    if (overview) editing = false;
    app.classList.toggle('tfOverview', overview);
    const { n, w } = phone ? { n: 2, w: Math.floor((W - PEG_GAP) / 2) } : pegsFor(W);
    // the Weather page is laid on the same board, its columns the dashboard's (Matt, 1 Nov: one rule set)
    bentoBox.classList.add('tfPegs');
    bentoBox.classList.toggle('tfPhonePegs', phone); // a phone's Weather page: its cards L, not XL (Matt, 9 Nov: too long)
    bentoBox.style.setProperty('--peg-n', n);
    bentoBox.style.setProperty('--peg-w', w + 'px');
    const off = new Set(dashPrefs().hidden);
    NEW_CARDS.forEach((k) => dashBoxes[k]?.classList.toggle('tfNotAdded', off.has(k) && !(drag?.fromTray && drag.key === k)));
    mountWidgets();
    app.classList.toggle('tfBoard', board);
    app.classList.toggle('tfEditing', board && editing && !phone);
    const pen = $('dashEditNav');
    if (!board && homeEditing) setHomeEditing(false);
    if (pen && overview) { pen.hidden = !board; if (!homeEditing) { pen.classList.remove('active'); pen.setAttribute('aria-pressed', 'false'); pen.setAttribute('aria-label', 'Edit Home page'); pen.title = 'Edit'; pen.innerHTML = PENCIL; } }
    else if (pen) { pen.hidden = !board || phone; pen.classList.toggle('active', editing); pen.setAttribute('aria-pressed', String(editing)); pen.setAttribute('aria-label', overview ? 'Edit Home page' : editing ? 'Done editing' : 'Edit custom dashboard'); pen.title = editing ? 'Done' : 'Edit'; pen.innerHTML = editing ? TICK : PENCIL; }
    const items = board ? boardItems() : [];
    // each card's own look (Edit card) finds it by its key
    items.forEach((it) => { it.el.dataset.hcCard = it.key; it.el.classList.toggle('hcCardEdited', it.key === cardEdit); });
    paintCards();
    if (!board || !overview) grid.querySelectorAll(':scope > :is(.hcFloor,.hcFloorBox)').forEach((el) => el.remove()); // Home's floor names and boxes
    if (!board) {
      grid.style.height = '';
      grid.querySelectorAll('.tfBoardItem').forEach((el) => { el.classList.remove('tfBoardItem', 'tfBoardHidden'); el.style.left = el.style.top = el.style.width = el.style.height = ''; });
      grid.querySelector('.tfDash-act > .activityRows')?.style.removeProperty('max-height');
      editTools(false);
      if (app.classList.contains('tfDash')) phoneOrder();
      renderTray();
      return;
    }
    if (overview) { layoutHome(items, W, phone); alignHomeClock(); requestAnimationFrame(alignHomeClock); setTimeout(alignHomeClock, 450); return; }
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
      if (it.key === 'areas' && PHONE_AREAS.matches) it.rows = phoneAreaRows(parseFloat(it.el.style.width));
    });
    const dragged = drag && cards.find((it) => it.key === drag.key);
    const order = phone && phoneCards().map((it) => it.key), seq = (it) => (order.includes(it.key) ? order.indexOf(it.key) : -1);
    const placed = phone ? placeInOrder([...cards].sort((a, b) => seq(a) - seq(b)), n) : placeCards(cards, n, dragged);
    placed.forEach((p) => Object.assign(p, { x: p.cols === n ? 0 : p.col * pitch, y: boardTop + p.row * ROW_PITCH, w: p.cols === n ? W : p.cols * w + (p.cols - 1) * PEG_GAP, h: p.rows * ROW_PITCH - PEG_GAP }));
    cards.forEach((it) => {
      const p = placed.get(it.key);
      it.el.style.height = p.h + 'px';
      // a phone shows the weather card whole, its sentence and days, whatever its size on the big board (Matt, 9 Nov)
      it.el.dataset.rows = phone && it.key === 'wx' ? 5 : sizeOf(it.key);
      // the Areas card's open area is an area card as tall as it
      if (it.key === 'areas') it.el.querySelectorAll('.tfAreaPanel .tfRoomTile, .tfAreaStage>.tfRoomTile').forEach((t) => { t.dataset.rows = it.el.dataset.rows; });
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
    scaleBoard();
  }
  /* Home's own layout (Matt, 12 Nov, from his Figma "Home (overview)": "all these cards are for the DEFAULT homepage, not
     part of the rules for the wider system"). Columns up to 252 wide and 20 apart, five at most; every card 337 tall
     (on phones as tall as it needs), 20 apart; the summaries as wide as the cards. Favourites and the weather card are two
     columns, each area one: Favourites, three areas, the weather, three more, then the rest */
  // a two-column card is two columns and 16 (520 at 252), as Matt drew Favourites and the weather
  const HOME = { gap: 20, phoneGap: 16, inner: 16, col: 252, row: 337, nameGap: 32, sumsGap: 32, /* doubled (Matt, 26 Nov: "double the space between the summaries and the rest… and between the title and the summaries") */ full: 1336, floorTop: 12, floorHead: 24, floorGap: 16 };
  /* the area cards' size, picked in Edit Home page (Matt, 12 Nov: "change the size of the area cards", Small, Medium or
     Large; Large is his Figma card). Each gives up to 15% on a smaller screen, its reading with it */
  // the dashboard's S, M and L (2, 3 and 4 rows) a peg wide, so an area card on Home is the dashboard's at the same size
  // (Matt, 17 Nov: "make the cards used in the overview dashboard match the ones used on the custom dashboard")
  const AREA_SIZES = { s: { w: 252, h: 136, rows: 2 }, m: { w: 252, h: 212, rows: 3 }, l: { w: 252, h: 288, rows: 4 } };
  // the size picked in Edit Home page, Small until one is; it's the desktop's (a phone lays them out Large, layoutHome)
  const areaSize = () => (AREA_SIZES[prefs.home?.areaSize] ? prefs.home.areaSize : 's');
  const areaLayout = () => (['rows', 'columns', 'bento'].includes(prefs.home?.areaLayout) ? prefs.home.areaLayout : 'rows');
  // the cards that aren't areas: Stacked down the left beside the areas, or in Rows across the top over them (Matt, 12 Nov)
  const cardsAs = () => (prefs.home?.cardsAs === 'rows' ? 'rows' : 'stacked');
  // Home's areas by floor, top floor first, as Home Assistant's Areas dashboard groups them; an area with no floor goes
  // last, under Other areas (with no floors at all, the areas without a name over them)
  const FLOOR_ICON = { 0: 'mdi:home-floor-0', 1: 'mdi:home-floor-1', 2: 'mdi:home-floor-2', 3: 'mdi:home-floor-3', '-1': 'mdi:home-floor-negative-1' };
  function floorGroups() {
    const rooms = overviewRooms();
    const fl = Object.values(getHass()?.floors || {}).sort((a, b) => (b.level ?? -99) - (a.level ?? -99));
    const ids = new Set(fl.map((f) => f.floor_id));
    const groups = fl.map((f) => ({ id: f.floor_id, name: f.name, icon: f.icon || FLOOR_ICON[f.level] || 'mdi:home', rooms: rooms.filter((r) => r.floor === f.floor_id) }));
    const rest = rooms.filter((r) => !ids.has(r.floor));
    if (rest.length) groups.push({ id: '', name: fl.length ? 'Other areas' : '', icon: 'mdi:home', rooms: rest });
    return groups;
  }
  let homeDrag = null, homeOrderNow = [], homePlaced = new Map();
  function homeLand(box) {
    let land = grid.querySelector('.hcHomeLand');
    if (!box) { land?.remove(); return; }
    if (!land) { land = Object.assign(document.createElement('div'), { className: 'tfBoardLand hcHomeLand' }); grid.appendChild(land); }
    Object.assign(land.style, { left: box.x + 'px', top: box.y + 'px', width: box.w + 'px', height: box.h + 'px' });
  }
  /* with Edit Home page open, Home's cards move by dragging (Matt, 12 Nov: "the drag and drop functionality and
     behaviours", as on Dashboards): a card lifts and follows the pointer, where it would land shows dashed, the others
     make room, and the order is kept. Home's columns and sizes stay its own; only the order changes. Not on phones */
  function homeDown(ev) {
    if (!overview || !homeEditing || ev.button !== 0 || grid.clientWidth < 2 * PEG + PEG_GAP) return;
    const el = ev.target.closest('.tfBoardItem'), it = el && boardItems().find((x) => x.el === el);
    // the areas keep the areas page's order (Matt, 12 Nov: "I can't move them"); the cards above the floors move
    if (!it || HEAD.includes(it.key) || isRoomKey(it.key)) return;
    ev.preventDefault();
    const g = grid.getBoundingClientRect(), box = homePlaced.get(it.key);
    homeDrag = { key: it.key, el, on: false, x0: ev.clientX, y0: ev.clientY, left: box.x, top: box.y, order: [...homeOrderNow] };
    const move = (e) => {
      const dx = (e.clientX - homeDrag.x0) / boardScale(), dy = (e.clientY - homeDrag.y0) / boardScale();
      if (!homeDrag.on && Math.hypot(dx, dy) < 5) return;
      // it lifts with a small bounce (Matt, 12 Nov: "the small bouncy effect")
      if (!homeDrag.on) { homeDrag.on = true; el.classList.add('tfDragging'); if (!reduced()) el.animate([{ scale: '1' }, { scale: '1.05' }, { scale: '1.02' }], { duration: 260, easing: 'cubic-bezier(.2,1.35,.4,1)' }); }
      Object.assign(el.style, { left: homeDrag.left + dx + 'px', top: homeDrag.top + dy + 'px' });
      // it goes where the card nearest the pointer is (before it, or after it past its middle)
      const px = e.clientX - g.left, py = e.clientY - g.top + grid.scrollTop;
      let best = null, bestD = Infinity;
      homePlaced.forEach((b, key) => { if (key === it.key || !homeDrag.order.includes(key)) return; const d = Math.hypot(px - (b.x + b.w / 2), py - (b.y + b.h / 2)); if (d < bestD) { bestD = d; best = { key, b }; } });
      if (!best) return;
      const rest = homeDrag.order.filter((x) => x !== it.key), i = rest.indexOf(best.key) + (px > best.b.x + best.b.w / 2 ? 1 : 0);
      const next = [...rest.slice(0, i), it.key, ...rest.slice(i)];
      if (next.join() !== homeDrag.order.join()) { homeDrag.order = next; layoutBoard(); }
      else homeLand(homePlaced.get(it.key));
    };
    const up = () => {
      removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
      const d = homeDrag; homeDrag = null;
      el.classList.remove('tfDragging');
      if (d.on) homePrefs({ order: d.order });
      layoutBoard();
      // and settles into its place with a little overshoot (its move's easing), then a squash, as Dashboards' cards land
      if (d.on && !reduced()) setTimeout(() => squash(el), 340);
    };
    addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  }
  // Schedule's and Favourites' lower edge fades while there's more below (no scrollbar: Matt, 12 Nov)
  const schedFade = (el) => el.classList.toggle('hcMore', el.scrollHeight - el.scrollTop - el.clientHeight > 1);
  function layoutHome(items, W, phone) {
    const hidden = new Set(dashPrefs().hidden);
    items.forEach((it) => it.el.classList.toggle('tfBoardHidden', hidden.has(it.key)));
    const shown = items.filter((it) => !hidden.has(it.key) && getComputedStyle(it.el).display !== 'none');
    // the dashboard's columns and gap (Matt, 17 Nov: Home's cards as wide as the custom dashboard's): as many columns as fit
    // at 200 or more, stretched to fill the page, 16 apart; two across on a phone
    const gap = PEG_GAP, cols = phone ? { n: 2, w: Math.floor((W - gap) / 2) } : pegsFor(W);
    let top = 0;
    const strip = favsStrip();
    app.classList.toggle('hcSumsFit', sumsFit());
    app.classList.toggle('hcFavStrip', strip);
    const heads = shown.filter((it) => HEAD.includes(it.key) || (strip && it.key === 'favs'));
    heads.sort((a, b) => ['title', 'sums', 'favs'].indexOf(a.key) - ['title', 'sums', 'favs'].indexOf(b.key));
    heads.forEach((it) => {
      it.el.classList.add('tfBoardItem');
      it.el.toggleAttribute('data-narrow', false);
      // the summaries and Favourites each a strip across the page, one row, the tiles sharing it (Matt, 26 Nov: "just as
      // strips across the top"); sideways where they can't all fit. A phone has its own two columns. As wide as the cards and
      // areas under them (six of the page's columns), never stretched past them (Matt, 26 Nov)
      Object.assign(it.el.style, { width: (it.key === 'title' || phone ? W : Math.min(W, 6 * cols.w + 5 * gap)) + 'px', height: '', left: '0px', top: top + 'px' });
      // its tiles in one row while they fit at 200 or more, else in even rows (halves, thirds…), as HomeCore Labs has them
      // (Matt, 26 Nov: "way too cramped… have a look at the home core lab size"): never squeezed or sideways
      const bar = it.key !== 'title' && (it.el.querySelector('.tfDash-bar>.activityRows') || (it.key === 'favs' && it.el.querySelector(':scope>.activityRows'))), count = bar ? bar.children.length : 0;
      if (bar) {
        bar.classList.remove('hcBarRows');
        if (!phone && bar.scrollWidth > bar.clientWidth + 1) for (let rows = 2; rows <= count; rows++) { bar.classList.add('hcBarRows'); bar.style.setProperty('--bar-cols', String(Math.ceil(count / rows))); if (bar.scrollWidth <= bar.clientWidth + 1) break; }
      }
      top += it.el.offsetHeight + (it.key === 'title' ? HOME.nameGap : HOME.sumsGap);
    });
    /* the cards above the floors (Matt, 12 Nov: Favourites and Schedule "above the floors"), a row at a time in the
       order you dragged them into, 520 and 337 as drawn; on a phone each the whole width and as tall as it needs. Then
       each floor: its name, then its areas at the size picked, as many to a row as fit (two on a phone, as tall as they
       need). Everything gives up to 15% on a smaller screen */
    const own = ['favs', 'sched', 'wx', 'energy'];
    const saved = homeDrag?.order || prefs.home?.order;
    const order = saved ? [...saved.filter((x) => own.includes(x)), ...own.filter((x) => !saved.includes(x))] : own;
    homeOrderNow = order;
    const tops = shown.filter((it) => own.includes(it.key) && !(strip && it.key === 'favs')).sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
    homePlaced = new Map();
    const put = (it, box) => {
      homePlaced.set(it.key, box);
      Object.assign(it.el.style, { width: box.w + 'px', height: box.h + 'px' });
      // the card being dragged follows the pointer; where it will land shows instead
      if (homeDrag?.on && homeDrag.key === it.key) { homeLand(box); return; }
      Object.assign(it.el.style, { left: box.x + 'px', top: box.y + 'px' });
    };
    const tw = phone ? W : 2 * cols.w + gap, th = HOME.row; // two columns, 337 as drawn
    /* the cards that aren't areas (Favourites as a card, Schedule, Weather, Energy): Stacked (the start) down the left,
       a column 520 wide, one under another, the areas to their right in whichever layout (Matt, 12 Nov, his Figma "Home
       (overview)": the weather under Favourites, the areas beside them), the page as tall as the taller side; or Rows,
       across the top a row at a time, the areas under them. On a phone everything runs down the page */
    const side = cardsAs() === 'stacked' && !phone && tops.length > 0;
    let x = 0, rowH = 0, colB = top;
    tops.forEach((it) => {
      it.el.classList.add('tfBoardItem');
      it.el.dataset.rows = 5; it.el.dataset.cols = 2; it.el.toggleAttribute('data-narrow', false);
      if (!side && x && x + tw > W) { top += rowH + gap; x = 0; rowH = 0; }
      // Favourites (as a card) is as tall as its favourites need: whole rows of tiles, two across, so one is one row and
      // nine are five, nothing to fade or scroll (Matt, 12 Nov, as Move Assistant v0.85.0; it was 337 whatever the count).
      // The others 337 as drawn; on a phone each as tall as it needs
      let h = th;
      if (phone || it.key === 'favs') { Object.assign(it.el.style, { width: tw + 'px', height: '' }); h = it.el.offsetHeight; }
      if (side) { put(it, { x: 0, y: colB, w: tw, h }); colB += h + gap; return; }
      put(it, { x, y: top, w: tw, h });
      x += tw + gap; rowH = Math.max(rowH, h);
    });
    if (tops.length && !side) top += rowH + gap;
    // the areas' part of the page: what's right of the column (all of it on a phone)
    const aX = side ? tw + gap : 0, aW = side ? W - tw - gap : W;
    /* the areas (Edit Home page, Matt, 12 Nov): grouped by floor or not, laid out as Rows (each floor's name, then its
       areas a row at a time), Columns (a column per floor, side by side) or Bento, where each floor can be a box the
       boxes fitting together, and each floor's first area can be big (two by two, its devices by name) */
    // a phone (620 or narrower) always shows them Large, whatever's picked; the pick is the desktop's (Matt, 17 Nov: "bigger
    // on mobile, but still maintain their chosen size on desktop")
    const size = phone || window.matchMedia('(max-width:620px)').matches ? 'l' : areaSize(), dims = AREA_SIZES[size], lay = areaLayout(), byFloor = prefs.home?.byFloor !== false;
    const cw = cols.w, ch = dims.h; // a column wide, the dashboard's height for the size
    const n = phone ? 2 : Math.max(1, Math.floor((aW + gap) / (cw + gap)));
    const roomEls = new Map(shown.filter((it) => isRoomKey(it.key)).map((it) => [it.key, it]));
    const groupsAll = byFloor ? floorGroups() : [{ id: '', name: '', icon: '', rooms: overviewRooms() }];
    const floors = groupsAll.map((f) => ({ ...f, cards: f.rooms.map((r) => roomEls.get('room:' + r.id)).filter(Boolean) })).filter((f) => f.cards.length);
    const bento = lay === 'bento', mixed = bento && prefs.home?.bentoMixed !== false, boxes = bento && byFloor && prefs.home?.bentoBoxes !== false;
    const columns = lay === 'columns' && byFloor && !phone;
    const BOX = 12; // a floor's box: 12 around its name and areas, its corners the cards' and 12 (they nest)
    const headH = (f) => (f.name ? HOME.floorHead + HOME.floorGap : 0);
    /* Mixed sizes by rank (Matt, 23 Nov: "put the highest ranked (in the order set...) areas larger, and the lower ones
       smaller"): the first three in the order set, across the whole home, are large (two wide, as the Balcony was); the rest
       are the half size, and never grow to fill a gap */
    const RANKED = 3, rankIds = overviewRooms().map((r) => 'room:' + r.id);
    const ranked = (it) => mixed && rankIds.indexOf(it.key) > -1 && rankIds.indexOf(it.key) < RANKED;
    const bigs = (f) => f.cards.filter(ranked).length;
    // a group's cards in its own columns (c), each in the first free cell from the top left; a big one two by two (on a
    // phone the whole width). Gives each card's place inside the group, and the group's height
    const pack = (f, c, w) => {
      const taken = new Set(), at = [];
      f.cards.forEach((it) => {
        // a large one is two wide, as tall as the others (Matt, 18 Nov: "why is the living room SO big?")
        const big = ranked(it) && c >= 2, sc = big ? 2 : 1, sr = 1;
        it.el.classList.add('tfBoardItem');
        it.el.dataset.cols = sc; it.el.toggleAttribute('data-narrow', false);
        for (let r = 0; ; r++) {
          const c0 = [...Array(Math.max(0, c - sc + 1)).keys()].find((x0) => [...Array(sc).keys()].every((dx) => [...Array(sr).keys()].every((dy) => !taken.has((r + dy) + ',' + (x0 + dx)))));
          if (c0 != null) { [...Array(sc).keys()].forEach((dx) => [...Array(sr).keys()].forEach((dy) => taken.add((r + dy) + ',' + (c0 + dx)))); at.push({ it, r, c: c0, sc, sr }); break; }
        }
      });
      const rowsN = Math.max(0, ...at.map((p) => p.r + p.sr));
      // in Bento a card with nothing under it grows down to the group's foot, so the box has no hole (not on a phone,
      // where each row is as tall as it needs)
      if (bento && !phone && !mixed) at.forEach((p) => { while (p.r + p.sr < rowsN && !taken.has((p.r + p.sr) + ',' + p.c) && p.sc === 1) { taken.add((p.r + p.sr) + ',' + p.c); p.sr++; } });
      // its rows as the dashboard counts them (a big one, or one grown down in Bento, more), so it shows what the dashboard's
      // area card shows at that size
      at.forEach((p) => { p.it.el.dataset.rows = Math.min(5, p.sr * dims.rows); Object.assign(p.it.el.style, { width: (p.sc * w + (p.sc - 1) * gap) + 'px', height: (p.sr * ch + (p.sr - 1) * gap) + 'px' }); });
      // a phone's row as tall as its tallest card, measured once they've all let go of their old height
      const rowH = [...Array(rowsN)].map(() => ch);
      const rowY = []; let y = headH(f);
      rowH.forEach((h, r) => { rowY[r] = y; y += h + gap; });
      return { h: y - (rowsN ? gap : 0), places: at.map((p) => ({ it: p.it, x: p.c * (w + gap), y: rowY[p.r], w: p.sc * w + (p.sc - 1) * gap, h: rowH.slice(p.r, p.r + p.sr).reduce((a, b) => a + b, 0) + (p.sr - 1) * gap })) };
    };
    const oldHeads = new Map([...grid.querySelectorAll(':scope > .hcFloor')].map((el) => [el.dataset.floor, el]));
    const oldBoxes = new Map([...grid.querySelectorAll(':scope > .hcFloorBox')].map((el) => [el.dataset.floor, el]));
    const floorHeads = [];
    const headAt = (f, x, y, w) => {
      if (!f.name) return;
      let head = oldHeads.get(f.id);
      oldHeads.delete(f.id);
      if (!head) { head = Object.assign(document.createElement('div'), { className: 'hcFloor' }); head.dataset.floor = f.id; grid.appendChild(head); }
      // the floor's name on its own (Matt, 12 Nov: "remove the icon")
      if (head.dataset.sig !== f.name) { head.dataset.sig = f.name; head.innerHTML = '<h2 class="hcFloorName">' + esc(f.name) + '</h2>'; }
      Object.assign(head.style, { left: x + 'px', top: y + 'px', width: w + 'px' });
      floorHeads.push(head);
    };
    const boxAt = (f, x, y, w, h) => {
      let box = oldBoxes.get(f.id);
      oldBoxes.delete(f.id);
      if (!box) { box = Object.assign(document.createElement('div'), { className: 'hcFloorBox' }); box.dataset.floor = f.id; box.setAttribute('aria-hidden', 'true'); grid.prepend(box); }
      Object.assign(box.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
    };
    // in a floor's box its name starts where its areas' icons do (Matt, 12 Nov), the cards' own padding in
    const cardPad = (f) => parseFloat(getComputedStyle(f.cards[0].el).paddingLeft) || 0;
    const place = (f, g, x0, y0, indent = 0) => { headAt(f, x0 + indent, y0, (g.w ?? W) - indent); g.places.forEach((p) => put(p.it, { x: x0 + p.x, y: y0 + p.y, w: p.w, h: p.h })); };
    if (floors.length && tops.length && !side) top += HOME.floorTop;
    if (columns) {
      // a column per floor, as wide as a card, side by side; more floors than fit go on under the tallest
      let x = 0, rowB = top;
      floors.forEach((f) => {
        const g = { ...pack(f, 1, cw), w: cw };
        if (x && x + cw > aW) { top = rowB + gap + HOME.floorTop; x = 0; }
        place(f, g, aX + x, top);
        rowB = Math.max(rowB, top + g.h); x += cw + gap;
      });
      top = rowB + gap;
    } else if (boxes) {
      // each floor a box, as many cards wide as suits it (two rows for more than three), its 12 round the cards (Matt, 17 Nov:
      // the cards a column wide in a box too, not 12 narrower), the boxes fitting together: each where it sits highest, from
      // the left, by their own widths
      let sky = [{ x0: 0, x1: aW, t: top }];
      const topOver = (x0, x1) => Math.max(...sky.filter((g) => g.x1 > x0 && g.x0 < x1).map((g) => g.t));
      const raise = (x0, x1, t) => {
        const out = [];
        sky.forEach((g) => { if (g.x1 <= x0 || g.x0 >= x1) out.push(g); else { if (g.x0 < x0) out.push({ x0: g.x0, x1: x0, t: g.t }); if (g.x1 > x1) out.push({ x0: x1, x1: g.x1, t: g.t }); } });
        out.push({ x0, x1, t });
        sky = out.sort((a, b) => a.x0 - b.x0);
      };
      floors.forEach((f) => {
        const cells = f.cards.length + bigs(f);
        let c = phone ? 2 : Math.min(n, Math.max(bigs(f) ? 2 : 1, cells <= 3 ? cells : Math.ceil(cells / 2)));
        while (!phone && c > 1 && c * cw + (c - 1) * gap + 2 * BOX > aW) c--; // a phone keeps two, a little narrower
        // its box as many cards wide as suits it, or fewer when that lets it sit higher, beside another box; a card a column
        // wide, unless even one in its box can't be (a phone, or one column beside the stack)
        let pick = null;
        for (let cc = c; cc >= (phone ? c : 1); cc--) {
          const inner = Math.min(cw, Math.floor((aW - 2 * BOX - (cc - 1) * gap) / cc));
          const g = { ...pack(f, cc, inner), w: cc * inner + (cc - 1) * gap }, bw = g.w + 2 * BOX, h = g.h + 2 * BOX;
          sky.map((s2) => s2.x0).filter((x0) => x0 + bw <= aW + 0.5).forEach((x0) => { const t = topOver(x0, x0 + bw); if (!pick || t < pick.t - 0.5) pick = { cc, inner, bw, h, t, x: x0 }; });
        }
        if (!pick) { const inner = Math.min(cw, aW - 2 * BOX), g0 = pack(f, 1, inner); pick = { cc: 1, inner, bw: inner + 2 * BOX, h: g0.h + 2 * BOX, t: topOver(0, aW), x: 0 }; }
        const g = { ...pack(f, pick.cc, pick.inner), w: pick.cc * pick.inner + (pick.cc - 1) * gap }, bw = pick.bw, h = pick.h, bx = pick.x, best = pick.t;
        boxAt(f, aX + bx, best, bw, h);
        place(f, g, aX + bx + BOX, best + BOX, cardPad(f));
        raise(bx, Math.min(aW, bx + bw + gap), best + h + gap);
      });
      top = Math.max(...sky.map((g) => g.t));
    } else {
      // Rows: each floor's name, then its areas a row at a time (Bento's big first area too). Fit together (Matt, 17 Nov:
      // "make more rows for the cards, so the width the group takes up is smaller"): the fewest columns that keep the areas
      // no taller than the cards stacked beside them (with none beside them, about as tall as they're wide), leaving no
      // gap, or in Bento one a card grows down into; the width left over stays empty
      const fitCols = (f) => {
        if (!prefs.home?.fitTogether || phone) return n;
        const besideH = side ? colB - gap - top : null;
        const shape = (c) => { const cells = f.cards.length + (c >= 2 ? bigs(f) : 0), rows = Math.ceil(cells / c); return { holes: rows * c - cells, rows, h: headH(f) + rows * ch + (rows - 1) * gap, w: c * cw + (c - 1) * gap }; };
        const neat = (x) => x.holes === 0 || (bento && !mixed && x.holes === 1 && x.rows > 1);
        for (let c = 1; c <= n; c++) { const x = shape(c); if (neat(x) && x.h <= (besideH ?? x.w)) return c; }
        for (let c = 1; c <= n; c++) { const x = shape(c); if (x.h <= (besideH ?? x.w)) return c; }
        return n;
      };
      /* not by floor, Bento with mixed sizes, fitted together (Matt, 26 Nov): four columns of the page's grid beside the
         cards (each a column wide, never stretched to fill the page): the large areas down the left two, the next ones in the column beside them, the last
         ones in the column beside that, the rest in rows underneath (Living Room, Bathroom, Dining room; Kitchen, Balcony,
         Workshop; Bedroom, Office, Laundry; then Spare room, Storage, Hallway). Where four columns don't fit beside the cards, as before */
      const quarter = cw; // each a column of the page's grid, the size the cards already are (Matt, 26 Nov: "sticking to those sizes")
      if (!byFloor && mixed && prefs.home?.fitTogether && !phone && floors.length === 1 && n >= 4 && bigs(floors[0])) {
        const f = floors[0], big = f.cards.filter(ranked), small = f.cards.filter((it) => !ranked(it)), k = big.length;
        const nextCol = small.slice(0, k), lastCol = small.length > 2 * k ? small.slice(small.length - k) : small.slice(k), rest = small.slice(k, small.length - lastCol.length);
        const at = [...big.map((it, r) => ({ it, r, c: 0, sc: 2 })), ...nextCol.map((it, r) => ({ it, r, c: 2, sc: 1 })), ...lastCol.map((it, r) => ({ it, r, c: 3, sc: 1 })),
          ...rest.map((it, i) => ({ it, r: k + Math.floor(i / 4), c: i % 4, sc: 1 }))];
        const rowsN = Math.max(0, ...at.map((q) => q.r + 1));
        at.forEach((q) => {
          q.it.el.classList.add('tfBoardItem');
          q.it.el.dataset.cols = q.sc; q.it.el.dataset.rows = dims.rows; q.it.el.toggleAttribute('data-narrow', false);
          Object.assign(q.it.el.style, { width: (q.sc * quarter + (q.sc - 1) * gap) + 'px', height: ch + 'px' });
        });
        place(f, { w: aW, places: at.map((q) => ({ it: q.it, x: q.c * (quarter + gap), y: q.r * (ch + gap), w: q.sc * quarter + (q.sc - 1) * gap, h: ch })) }, aX, top);
        top += rowsN * (ch + gap);
      } else floors.forEach((f, i) => {
        if (i) top += HOME.floorTop;
        const g = pack(f, fitCols(f), cw);
        place(f, { ...g, w: aW }, aX, top);
        top += g.h + gap;
      });
    }
    if (side) top = Math.max(top, colB);
    oldHeads.forEach((el) => el.remove());
    oldBoxes.forEach((el) => el.remove());
    if (!homeDrag?.on) homeLand(null);
    grid.style.height = Math.max(0, top - gap) + 'px';
    readingOrder([...shown.filter((it) => HEAD.includes(it.key)).map((it) => it.el), ...tops.map((it) => it.el), ...floorHeads, ...floors.flatMap((f) => f.cards.map((it) => it.el))]);
    editTools(false);
    // while Edit Home page is open the cards rest: a tap doesn't work their controls or open them
    items.forEach((it) => [...it.el.children].forEach((c) => c.toggleAttribute('inert', homeEditing)));
    drawDashGraph(); // Energy today's hours
    grid.querySelector('.tfDash-favs>.activityRows')?.classList.toggle('hcFadeList', !strip);
    grid.querySelectorAll('.hcSchedList, .hcFadeList').forEach(schedFade);
    requestAnimationFrame(() => app.classList.add('tfBoardReady'));
    items.forEach((it) => itemSizes.observe(it.el));
    renderTray();
  }
  const queueFit = () => { if (fitQueued) return; fitQueued = true; requestAnimationFrame(() => { fitQueued = false; layoutBoard(); }); };
  // a card whose content changes height (a forecast arriving, a reading opening) may need more rows
  const itemSizes = new ResizeObserver(() => { if (!drag) queueFit(); });
  // edit mode's tools: the grid of cells, each card's grip (top middle) and ⋯ (its own controls rest), where a dragged
  // card will land, and on the Favourites card a hide button for each favourite (hidden cards and favourites wait in the
  // edit tray); returns the board's height with them
  /* edit mode's grid (Matt, 10 Nov; were solid cells): a field of dots and a crosshair wherever the gutters cross, all
     from the grid the cards snap to. The crosshairs sit in the middle of the gutters, so a card's corners land just inside
     four of them; the dots run through the same points, a quarter of a row apart down and about as far across (each
     column step split evenly), so they line up with the cards too */
  function gridMarks(n, rows, w) {
    const P = w + PEG_GAP, W = n * w + (n - 1) * PEG_GAP, H = rows * ROW_PITCH - PEG_GAP, half = PEG_GAP / 2;
    const dx = P / Math.max(1, Math.round(P / (ROW_PITCH / 4))), dy = ROW_PITCH / 4, arm = 6;
    let x = '';
    for (let i = 0; i <= n; i++) for (let j = 0; j <= rows; j++) {
      const cx = i * P - half, cy = j * ROW_PITCH - half;
      x += 'M' + (cx - arm) + ' ' + cy + 'H' + (cx + arm) + 'M' + cx + ' ' + (cy - arm) + 'V' + (cy + arm);
    }
    return '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '"><defs><pattern id="tfGridDots" patternUnits="userSpaceOnUse" x="' + (-half) + '" y="' + (-half) + '" width="' + dx.toFixed(3) + '" height="' + dy + '">' +
      '<circle cx="0" cy="0" r="1.4"></circle><circle cx="' + dx.toFixed(3) + '" cy="0" r="1.4"></circle><circle cx="0" cy="' + dy + '" r="1.4"></circle><circle cx="' + dx.toFixed(3) + '" cy="' + dy + '" r="1.4"></circle></pattern></defs>' +
      '<rect class="tfGridDots" x="' + (-half) + '" y="' + (-half) + '" width="' + (W + PEG_GAP) + '" height="' + (H + PEG_GAP) + '" fill="url(#tfGridDots)"></rect><path class="tfGridCross" d="' + x + '"></path></svg>';
  }
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
      cells.innerHTML = gridMarks(n, rows, w);
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
    if (!on) { drag = null; trayPicking = tilePicking = false; closeBoardMenu(); closeCardEditor(false); }
    layoutBoard();
    if (on) { editStart = JSON.stringify(prefs); trayPage(tray, 'Edit custom dashboard', null); } // a phone starts at the list
    else if (editStart && JSON.stringify(prefs) !== editStart) toast('Changes saved');
    scaleBoard();
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
    // the areas have none (Matt, 11 Nov): they're as wide as they need
    // a room's tile too (Matt, 6 Nov): narrow, wide or really wide, like the cards
    const width = RESIZABLE.includes(key) || isRoomKey(key) ? '<div class="tfHeight tfWidth" role="group" aria-label="Width"><span class="tfHeightLabel" aria-hidden="true">Width</span><div class="tfHeightTabs">' +
      WIDTH_NAMES.map((name, i) => '<button type="button" role="menuitemradio" aria-checked="' + (i + 1 === Math.min(span, n)) + '" aria-label="' + name + ', ' + (i + 1) + (i ? ' columns' : ' column') + '" data-board-act="w:' + (i + 1) + '"' + (i < n ? '' : ' disabled') + '>' + name + '</button>').join('') + '</div></div>' : '';
    // Edit card: the card's own page in the edit tray (Matt, 20 Nov), after its size
    menu.innerHTML = height + width + item('edit', tile ? 'Edit tile' : 'Edit card') +
      (key === 'energy' ? item('graph', (dash.opts.energy?.graph || 'above') === 'above' ? 'Graph below' : 'Graph above') : '') +
      item('left', 'Move left', full || p.col === 0) + item('right', 'Move right', full || p.col + p.cols >= n) +
      item('up', 'Move up', p.row <= 0) + item('down', 'Move down') + (tile ? item('remove', 'Remove') : item('hide', 'Hide'));
    grid.appendChild(menu);
    const left = Math.min(p.x + p.w - menu.offsetWidth, grid.clientWidth - menu.offsetWidth); // it scales up from its top right, so it stays in the card's corner
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
    if (act === 'edit') { closeBoardMenu(); openCardEditor(key); return; }
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
    // a size: the menu stays while its highlight stretches across to the new one (the Motion Lab's tabs), then goes
    const tab = /^[hw]:/.test(act) && !reduced() && boardOpen?.menu.querySelector('[data-board-act="' + CSS.escape(act) + '"]');
    if (tab) {
      const open = boardOpen;
      tab.parentElement.querySelectorAll('[aria-checked]').forEach((b) => b.setAttribute('aria-checked', String(b === tab)));
      setTimeout(() => { if (boardOpen === open) closeBoardMenu(); }, M.tabs.dur);
    } else closeBoardMenu();
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
  toaster.show = (message) => toast(message); // the shell's messages (Add to the list) use it too
  function toast(message, undo = null) {
    const el = $('toast');
    if (!el) return;
    toastBody(el, message); // the Motion Lab's confirmation: a tick, the message at 18
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
    toastIn(el);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show', 'withAction'), undo ? 5000 : M.confirm.stay);
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
    // a phone's area buttons are named in one too (their icons say nothing on their own)
    const pick = ev.target.closest?.('.tfAreaPick');
    if (pick) { if (pick !== tipFor) showTip(pick, pick.getAttribute('aria-label')); else clearTimeout(tipHideTimer); return; }
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
    if (el.classList.contains('tfAreaPick')) { showTip(el, el.getAttribute('aria-label')); return; }
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
    const { n, w } = pegsFor(grid.clientWidth), edge = (tray.getBoundingClientRect().left - grid.getBoundingClientRect().left) / boardScale();
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
  const TRAY_TABS = [['page', 'Page'], ['cards', 'Cards'], ['areas', 'Areas'], ['favs', 'Favourites']];
  let trayTab = 'page';
  /* on a phone a tray's tabs are a list, each opening its own page with ‹ back to the list, as HomeCore settings and
     Settings (Matt, 17 Nov: "the trays too"); wider, the tabs as they were */
  const trayListHtml = (tabs, attr) => '<section class="hcRowsCard hcTrayList">' + tabs.map(([k, t]) => '<button class="hcRow hcConfigRow" type="button" ' + attr + '="' + k + '">' +
    '<span class="hcRowText"><span class="hcRowName">' + esc(t) + '</span></span><span class="hcRowEnd">' + CHEVRON + '</span></button>').join('') + '</section>';
  // which of its pages a phone shows: the list (null) or a tab's; its head says which, with ‹ back to the list
  const trayPage = (el, title, k, name) => {
    el.classList.toggle('hcTrayIn', Boolean(k));
    el.querySelector('.tfTrayHead .activityTitle').textContent = k ? name : title;
    el.querySelector('.tfTrayInner').scrollTop = 0;
  };
  const TRAY_BACK = '<button class="back hcTrayBack" type="button" data-tray-back aria-label="Back">' + BACK + '</button>';
  // which tab each of the tray's sections sits under
  const trayTabOf = (sec) => (sec.matches('.hcTraySums,[data-tray="welcome"],[data-tray="phone"]') ? 'page'
    : sec.querySelector('[data-room-add]') ? 'areas' : sec.querySelector('[data-tray="favs"]') ? 'favs' : 'cards');
  function showTrayTab(animate = false) {
    const inner = tray.querySelector('.tfTrayInner'), bar = tray.querySelector('.hcTrayTabs'), mark = bar.querySelector('.rubberIndicator');
    const head = inner.querySelector('.tfTrayHead');
    if (head.nextElementSibling !== bar) head.after(bar); // the tabs straight under the head (Summaries is added after it)
    const list = inner.querySelector('.hcTrayList'); if (bar.nextElementSibling !== list) bar.after(list); // a phone's list of them
    let first = true;
    inner.querySelectorAll(':scope>.tfTraySection').forEach((sec) => { sec.hidden = trayTabOf(sec) !== trayTab; sec.classList.toggle('hcFirst', !sec.hidden && first); if (!sec.hidden) first = false; });
    bar.querySelectorAll('[data-tray-tab]').forEach((b) => { const on = b.dataset.trayTab === trayTab; b.classList.toggle('active', on); b.setAttribute('aria-selected', String(on)); });
    const on = bar.querySelector('.tab.active');
    if (!on?.offsetWidth) return;
    mark.style.transition = 'none';
    if (animate) stretchTo(mark, mark.offsetLeft, mark.offsetWidth, on.offsetLeft, on.offsetWidth);
    else { mark.style.left = on.offsetLeft + 'px'; mark.style.width = on.offsetWidth + 'px'; }
  }
  const tray = Object.assign(document.createElement('aside'), { className: 'tfEditTray' });
  tray.setAttribute('aria-label', 'Edit custom dashboard');
  tray.innerHTML = '<button class="tfTrayTuck" type="button" data-tray-tuck></button>' +
    '<div class="tfTrayInner"><div class="tfTrayHead">' + TRAY_BACK + '<div class="activityTitle">Edit custom dashboard</div><button class="pill" type="button" data-tray-done>Done</button></div>' +
    // tabs instead of one long scroll (Matt, 12 Nov), HomeCore settings' tabs
    '<div class="tabs rubberTabs hcTrayTabs" role="tablist" aria-label="Edit custom dashboard"><div class="rubberIndicator" aria-hidden="true"></div>' +
      TRAY_TABS.map(([k, t], i) => '<button class="tab segBtn' + (i ? '' : ' active') + '" type="button" role="tab" aria-selected="' + !i + '" data-tray-tab="' + k + '">' + t + '</button>').join('') + '</div>' +
    trayListHtml(TRAY_TABS, 'data-tray-go') +
    // a card's own page (Edit card), in place of the tabs while it's open
    '<section class="hcCardEdit" data-tray="cardedit" aria-live="off"></section>' +
    '<section class="tfTraySection" data-tray="welcome"></section>' +
    '<section class="tfTraySection" data-tray="cards"></section>' +
    '<section class="tfTraySection" data-tray="weather"></section>' +
    '<section class="tfTraySection"><div class="sectionLabel">Tiles</div><p class="tfTrayNote">Remove a tile from its ⋯.</p>' +
    '<button class="pill tfTrayAdd hcAddBtn" type="button" data-tile-add aria-expanded="false">' + PLUS + '<span>Add tile</span></button>' +
    '<div class="tfTrayPick" data-pick="tiles" hidden><input class="addInput" type="search" placeholder="Search devices" aria-label="Search devices" autocomplete="off" data-tile-search>' +
    '<ul class="tfTrayList" data-tray="tilepick"></ul></div></section>' +
    '<section class="tfTraySection"><div class="sectionLabel">Areas</div><p class="tfTrayNote">Which areas the Areas card shows. Drag to change their order, here and on Home.</p>' +
    // Add area first, where it's seen, then the list (Matt, 17 Nov: under all the areas it was out of sight)
    '<button class="pill tfTrayAdd hcAddBtn" type="button" data-room-add aria-expanded="false">' + PLUS + '<span>Add area</span></button>' +
    '<ul class="tfTrayList" data-tray="roompick" hidden></ul>' +
    '<ul class="tfTrayList hcHeList" data-tray="areas"></ul></section>' +
    '<section class="tfTraySection" data-tray="phone"></section>' +
    '<section class="tfTraySection"><div class="sectionLabel">Favourites</div><ul class="tfTrayList" data-tray="favs"></ul>' +
    '<button class="pill tfTrayAdd hcAddBtn" type="button" data-fav-add aria-expanded="false">' + PLUS + '<span>Add favourite</span></button>' +
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
  /* Edit Home page (Matt, 12 Nov): Home Assistant's Edit Overview page, as a tray at the side like the dashboard's
     editor ("a side roll over like the other dashboard editor"), changes showing on Home as they're made. Its welcome
     message, favourites (drag to order, remove, add), Suggested entities and the summaries (drag to order, each on or
     off). Each setting explains itself in a popover from its (i), with a Learn more link, instead of a line under it
     (OpenHomeFoundation/roadmap#57, "Every field can explain itself"). Not yet: Add shortcut */
  const INFO_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11,9H13V7H11M12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M11,17H13V11H11V17Z"/></svg>';
  const LEARN_MORE = 'https://www.home-assistant.io/dashboards/';
  const HOME_INFO = {
    welcome: ['Welcome message', '<p>Shows a <strong>greeting</strong> above your home\'s name: good morning, afternoon or evening, then your name.</p>'],
    favs: ['Favourite entities', '<p>The devices you use most, at the top of Home.</p><ul><li><strong>Drag</strong> one to change the order</li><li>Press <strong>×</strong> to take it off</li></ul>'],
    schedule: ['Schedule', '<p>Today\'s and tomorrow\'s events from your calendars, each in its calendar\'s colour.</p>'],
    weather: ['Weather', '<p>The forecast card: now, the next hours in a sentence and the week ahead. Its <strong>Now</strong> opens the Weather page.</p>'],
    energy: ['Energy today', '<p>What your home has used and made today, hour by hour, with <strong>Electricity</strong>, <strong>Solar</strong>, <strong>Gas</strong> and <strong>Water</strong> under it.</p>'],
    suggest: ['Suggested entities', '<p>Fills Favourites with devices you often use, after your own. They change as you use your home.</p>'],
    sums: ['Summaries', '<p>Each summary sums up one kind of thing across your home, like <strong>Lights</strong>: how many are on.</p><ul><li>Switch one off to hide it</li><li><strong>Drag</strong> one to change the order</li></ul>'],
  };
  const homeTray = Object.assign(document.createElement('aside'), { className: 'tfEditTray hcHomeTray' });
  homeTray.setAttribute('aria-label', 'Edit Home page');
  homeTray.toggleAttribute('inert', true);
  let homeEditing = false, homePicking = false, homeStart = '', penHome = null;
  let homeTab = 'page';
  // the open tab's mark, as on HomeCore settings' tabs
  function placeHomeMark(animate, from) {
    const bar = homeTray.querySelector('.hcTrayTabs'), mark = bar?.querySelector('.rubberIndicator'), on = bar?.querySelector('.tab.active');
    if (!on?.offsetWidth) { requestAnimationFrame(() => homeTray.querySelector('.hcTrayTabs .tab.active')?.offsetWidth && placeHomeMark(animate, from)); return; }
    mark.style.transition = 'none';
    if (animate && from) stretchTo(mark, from.left, from.width, on.offsetLeft, on.offsetWidth);
    else { mark.style.left = on.offsetLeft + 'px'; mark.style.width = on.offsetWidth + 'px'; }
  }
  const infoBtn = (k) => '<button class="hcInfoBtn" type="button" data-info="' + k + '" aria-expanded="false" aria-label="About ' + esc(HOME_INFO[k][0]) + '">' + INFO_SVG + '</button>';
  const sw = (on, label, attr) => '<button class="switch' + (on ? ' on' : '') + '" type="button" role="switch" aria-checked="' + on + '" aria-label="' + esc(label) + '" ' + attr + '></button>';
  const heGrip = (label) => '<button class="tfTrayBtn hcHeGrip" type="button" data-he-grip aria-label="Move ' + esc(label) + '. Use the up and down arrows">' + GRIP + '</button>';
  // Matt, 12 Nov: the summaries as wide as the cards (as drawn) or as wide as their own tiles; Favourites as its card or
  // a strip under the summaries, the same pattern as theirs
  const sumsFit = () => prefs.home?.sumsWidth === 'fit';
  const favsStrip = () => prefs.home?.favsAs === 'strip'; // its card until Strip is picked (Matt, 26 Nov: "display as a card by default")
  const homeSeg = (label, attr, value, opts) => '<div class="hcHeLine hcHeChoiceLine"><span class="activityRowName">' + label + '</span><div class="themeChoice hcHeChoice" role="group" aria-label="' + esc(label) + '">' +
    opts.map(([v, text]) => '<button class="wxLayoutBtn" type="button" ' + attr + '="' + v + '" aria-pressed="' + (value === v) + '">' + text + '</button>').join('') + '</div></div>';
  const homeSumOrder = () => summaryData(true).filter((x) => SUMMARIES[x.key]).map((x) => x.key);
  function drawHomeTray() {
    if (!homeEditing) return;
    const favs = starred();
    const favLi = (id) => '<li class="hcHeRow" data-he-id="' + esc(id) + '">' + heGrip(nameOf(id)) + '<span class="tfIcon"' + iconSlot(id, iconFor(id)) + '></span>' +
      trayName(id, whereIs.get(id) || valueOf(id)) + '<button class="tfTrayBtn" type="button" data-he-remove="' + esc(id) + '" aria-label="Take ' + esc(nameOf(id)) + ' off Favourites">' + CROSS + '</button></li>';
    const sumLi = (k) => { const x = SUMMARIES[k]; return '<li class="hcHeRow hcHeSum" data-he-id="' + esc(k) + '"' + (x.colour && sumInk(x.colour) ? ' style="' + sumInk(x.colour).slice(1) + '"' : '') + '>' + heGrip(x.name) +
      '<span class="tfIcon"' + iconSlot('', x.icon, x.name) + '></span><span class="activityRowName">' + esc(x.name) + '</span>' + sw(sumOn(k), x.name, 'data-he-sum="' + esc(k) + '"') + '</li>'; };
    const search = homeTray.querySelector('[data-he-search]')?.value || '';
    // tabs instead of folding sections (Matt, 12 Nov: "use tabs as well"), as the dashboard's tray: Page, Favourites, Summaries
    const tabs = [['page', 'Page'], ['favs', 'Favourites'], ['sums', 'Summaries'], ['areas', 'Areas']];
    const areasOff = new Set(prefs.home?.areasOff || []);
    const areaLi = (r) => '<li class="hcHeRow" data-he-id="' + esc(r.id) + '">' + heGrip(r.name) +
      '<span class="tfIcon"><span class="tfAreaGlyph"' + iconSlot('area:' + r.id, r.icon || 'mdi:texture-box', r.name) + '></span></span><span class="activityRowName">' + esc(r.name) + '</span>' +
      sw(!areasOff.has(r.id), 'Show ' + r.name + ' on Home', 'data-he-area="' + esc(r.id) + '"') + '</li>';
    const bodies = {
      page: '<div class="hcHeLine"><span class="activityRowName">Welcome message</span>' + infoBtn('welcome') + sw(welcomeOn(), 'Welcome message', 'data-he-welcome') + '</div>' +
        '<hr class="hcHeRule">' +
        '<div class="hcHeLine"><span class="activityRowName">Schedule</span>' + infoBtn('schedule') + sw(prefs.home?.schedule !== false, 'Schedule', 'data-he-card="schedule"') + '</div>' +
        '<div class="hcHeLine"><span class="activityRowName">Weather</span>' + infoBtn('weather') + sw(!!prefs.home?.weather, 'Weather', 'data-he-card="weather"') + '</div>' +
        '<div class="hcHeLine"><span class="activityRowName">Energy today</span>' + infoBtn('energy') + sw(!!prefs.home?.energy, 'Energy today', 'data-he-card="energy"') + '</div>' +
        homeSeg('Cards', 'data-he-cards-as', cardsAs(), [['stacked', 'Stacked'], ['rows', 'Rows']]) +
        '<hr class="hcHeRule">' +
        // the areas: by floor or not, their layout, Bento's two ways, their size (Matt, 12 Nov)
        '<div class="hcHeLine"><span class="activityRowName">Group by floor</span>' + sw(prefs.home?.byFloor !== false, 'Group by floor', 'data-he-flag="byFloor"') + '</div>' +
        homeSeg('Layout', 'data-he-area-layout', areaLayout(), [['rows', 'Rows'], ['columns', 'Columns'], ['bento', 'Bento']]) +
        (areaLayout() === 'bento' ? '<div class="hcHeLine"><span class="activityRowName">Floors as boxes</span>' + sw(prefs.home?.bentoBoxes !== false, 'Floors as boxes', 'data-he-flag="bentoBoxes"') + '</div>' +
          '<div class="hcHeLine"><span class="activityRowName">Mixed sizes</span>' + sw(prefs.home?.bentoMixed !== false, 'Mixed sizes', 'data-he-flag="bentoMixed"') + '</div>' : '') +
        homeSeg('Area cards', 'data-he-area-size', areaSize(), [['s', 'Small'], ['m', 'Medium'], ['l', 'Large']]) +
        // Fit together (Matt, 17 Nov): the areas as a neat block, not spread over every column that fits
        '<div class="hcHeLine"><span class="activityRowName">Fit together</span>' + sw(!!prefs.home?.fitTogether, 'Fit together', 'data-he-fit') + '</div>',
      // Favourites on Home at all (Matt, 12 Nov: "a show favourites toggle")
      favs: '<div class="hcHeLine"><span class="activityRowName">Show favourites</span>' + sw(prefs.home?.favs !== false, 'Show favourites', 'data-he-card="favs"') + '</div>' +
        '<hr class="hcHeRule">' +
        '<div class="hcHeLabel"><span class="activityRowName">Favourite entities</span>' + infoBtn('favs') + '</div>' +
        homeSeg('Show as', 'data-he-favs-as', favsStrip() ? 'strip' : 'card', [['card', 'Card'], ['strip', 'Strip']]) +
        '<ul class="tfTrayList hcHeList" data-he-list="favs">' + (favs.map(favLi).join('') || '<li class="tfTrayNote">No favourites yet.</li>') + '</ul>' +
        '<button class="pill tfTrayAdd hcAddBtn" type="button" data-he-add aria-expanded="' + homePicking + '">' + PLUS + '<span>Add favourite</span></button>' +
        '<div class="tfTrayPick" data-he-pick' + (homePicking ? '' : ' hidden') + '><input class="addInput" type="search" placeholder="Search devices" aria-label="Search devices" autocomplete="off" data-he-search value="' + esc(search) + '">' +
        '<ul class="tfTrayList">' + (homePicking ? pickHtml(search, (id) => PICK_DOMAINS.test(id), new Set(favs), 'data-he-pick-id') : '') + '</ul></div>' +
        '<hr class="hcHeRule">' +
        '<div class="hcHeLine"><span class="activityRowName">Suggested entities</span>' + infoBtn('suggest') + sw(suggestOn(), 'Suggested entities', 'data-he-suggest') + '</div>' +
        (suggestOn() ? '<div class="hcHeLine"><span class="activityRowName">Number of suggested entities</span><div class="tfStep hcHeStep" role="group" aria-label="Number of suggested entities">' +
          '<button type="button" data-he-suggest-n="-1" aria-label="Fewer suggested entities"' + (suggestN() <= 1 ? ' disabled' : '') + '>' + STEP.down + '</button><output>' + suggestN() + '</output>' +
          '<button type="button" data-he-suggest-n="1" aria-label="More suggested entities"' + (suggestN() >= SUGGEST_MAX ? ' disabled' : '') + '>' + STEP.up + '</button></div></div>' : ''),
      sums: '<div class="hcHeLine"><span class="activityRowName">Show summaries</span>' + infoBtn('sums') + sw(prefs.home?.sums !== false, 'Show summaries', 'data-he-card="sums"') + '</div>' +
        homeSeg('Width', 'data-he-sums-width', sumsFit() ? 'fit' : 'match', [['match', 'Match the cards'], ['fit', 'Fit the summaries']]) +
        '<hr class="hcHeRule">' +
        '<ul class="tfTrayList hcHeList" data-he-list="sums">' + homeSumOrder().map(sumLi).join('') + '</ul>',
      areas: '<p class="tfTrayNote">Which areas show on Home. Drag to change their order, here and on the custom dashboard.</p>' +
        '<ul class="tfTrayList hcHeList" data-he-list="areas">' + overviewRoomsAll().map(areaLi).join('') + '</ul>',
    };
    homeTray.querySelector('[data-he-body]').innerHTML =
      // the note about the areas page first (Matt, 12 Nov: "to the top of the rollover"), as Home Assistant's dialog has it
      '<p class="tfTrayNote hcHeAreasNote">You can rearrange your floors and areas in the order that best represents your house on the <button type="button" class="hcHeLink" data-oops>areas page</button>.</p>' +
      '<div class="tabs rubberTabs hcTrayTabs" role="tablist" aria-label="Edit Home page"><div class="rubberIndicator" aria-hidden="true"></div>' +
        tabs.map(([k, t]) => '<button class="tab segBtn' + (k === homeTab ? ' active' : '') + '" type="button" role="tab" aria-selected="' + (k === homeTab) + '" data-he-tab="' + k + '">' + t + '</button>').join('') + '</div>' +
      trayListHtml(tabs, 'data-he-go') +
      '<div class="hcHeTabBody" role="tabpanel">' + bodies[homeTab] + '</div>';
    placeHomeMark(false);
    fillIcons(homeTray);
  }
  const homeSave = (next) => { prefs = { ...prefs, ...next }; savePrefs(); refresh(); drawHomeTray(); };
  // and the page lays itself out again at once (a choice like Stacked or Rows changes no card, so nothing else would)
  const homePrefs = (next) => { homeSave({ home: { ...(prefs.home || {}), ...next } }); layoutBoard(); };
  function setHomeEditing(on) {
    closeInfo();
    homeEditing = on;
    homePicking = false;
    homeTray.classList.toggle('open', on);
    homeTray.toggleAttribute('inert', !on);
    app.classList.toggle('hcHomeEditing', on);
    if (testFocus && grid) { layoutBoard(); scaleBoard(); }
    const pen = $('dashEditNav'), head = homeTray.querySelector('.tfTrayHead');
    if (pen && on) { penHome = pen.parentElement; head.appendChild(pen); }
    if (pen && !on && penHome) penHome.appendChild(pen);
    if (pen) { pen.classList.toggle('active', on); pen.setAttribute('aria-pressed', String(on)); pen.setAttribute('aria-label', on ? 'Done editing Home' : 'Edit Home page'); pen.title = on ? 'Done' : 'Edit'; pen.innerHTML = on ? TICK : PENCIL; }
    if (on) { homeStart = JSON.stringify(prefs); drawHomeTray(); trayPage(homeTray, 'Edit Home page', null); } // a phone starts at the list
    else if (homeStart && JSON.stringify(prefs) !== homeStart) toast('Changes saved');
  }
  homeTray.innerHTML = '<div class="tfTrayInner"><div class="tfTrayHead">' + TRAY_BACK + '<div class="activityTitle">Edit Home page</div></div><div class="hcHeBody" data-he-body></div></div>';
  app.appendChild(homeTray);
  // the (i)'s popover: what the setting does, and Learn more; closes on a tap outside it or Escape
  let infoFor = null;
  const infoPop = Object.assign(document.createElement('div'), { className: 'card hcInfoPop', hidden: true });
  infoPop.setAttribute('role', 'dialog');
  app.appendChild(infoPop);
  function closeInfo() { if (!infoFor) return; infoFor.setAttribute('aria-expanded', 'false'); infoFor = null; infoPop.hidden = true; }
  function openInfo(btn) {
    const was = infoFor; closeInfo(); if (was === btn) return;
    // Edit Home's settings, or any (i) that carries its own words (data-info-title, -text and -more: the account page's fields)
    const [title, html, more] = HOME_INFO[btn.dataset.info] || [btn.dataset.infoTitle, '<p>' + esc(btn.dataset.infoText) + '</p>', btn.dataset.infoMore];
    infoPop.setAttribute('aria-label', title);
    infoPop.innerHTML = '<div class="hcInfoTitle">' + esc(title) + '</div><div class="hcInfoText">' + html + '</div><a class="hcInfoMore" href="' + esc(more || LEARN_MORE) + '" target="_blank" rel="noopener">Learn more</a>';
    infoPop.hidden = false; infoFor = btn; btn.setAttribute('aria-expanded', 'true');
    const r = btn.getBoundingClientRect(), pw = infoPop.offsetWidth, ph = infoPop.offsetHeight;
    infoPop.style.left = Math.max(8, Math.min(innerWidth - pw - 8, r.left + r.width / 2 - pw / 2)) + 'px';
    infoPop.style.top = (r.bottom + 8 + ph > innerHeight - 8 ? Math.max(8, r.top - 8 - ph) : r.bottom + 8) + 'px';
  }
  root.addEventListener('pointerdown', (ev) => { if (infoFor && !ev.composedPath().some((n) => n === infoPop || n === infoFor)) closeInfo(); }, true);
  root.addEventListener('click', (ev) => { const b = ev.target.closest?.('button[data-info-text]'); if (b) openInfo(b); });
  root.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape') return;
    if (infoFor) { ev.stopPropagation(); const b = infoFor; closeInfo(); b.focus(); return; }
    if (homePicking) { ev.stopPropagation(); homePicking = false; drawHomeTray(); return; }
    if (homeEditing) { ev.stopPropagation(); setHomeEditing(false); $('dashEditNav')?.focus(); }
  }, true);
  // a row moves up or down its list: its grip dragged, or the arrows on it
  const homeList = (ul) => (ul.dataset.heList === 'favs' ? starred() : ul.dataset.heList === 'areas' ? overviewRoomsAll().map((r) => r.id) : homeSumOrder());
  const homeOrder = (ul, ids) => (ul.dataset.heList === 'favs' ? homeSave({ favourites: ids }) : ul.dataset.heList === 'areas' ? (homeSave({ areaOrder: ids }), layoutBoard()) : homePrefs({ sumOrder: ids }));
  homeTray.addEventListener('keydown', (ev) => {
    const g = ev.target.closest('[data-he-grip]'); if (!g || !['ArrowUp', 'ArrowDown'].includes(ev.key)) return;
    ev.preventDefault();
    const li = g.closest('[data-he-id]'), ul = li.parentElement, ids = homeList(ul), i = ids.indexOf(li.dataset.heId), to = i + (ev.key === 'ArrowUp' ? -1 : 1);
    if (to < 0 || to >= ids.length) return;
    ids.splice(to, 0, ids.splice(i, 1)[0]);
    homeOrder(ul, ids);
    homeTray.querySelector('[data-he-list="' + ul.dataset.heList + '"] [data-he-id="' + CSS.escape(li.dataset.heId) + '"] [data-he-grip]')?.focus();
  });
  homeTray.addEventListener('pointerdown', (ev) => {
    const g = ev.target.closest('[data-he-grip]'); if (!g || ev.button !== 0) return;
    const ul = g.closest('[data-he-list]'), list = ul.dataset.heList;
    listDrag(ev, g.closest('[data-he-id]'), 'heId', (ids) => homeOrder(ul, ids), (id) => homeTray.querySelector('[data-he-list="' + list + '"] [data-he-id="' + CSS.escape(id) + '"]'));
  });
  homeTray.addEventListener('input', (ev) => { if (ev.target.matches('[data-he-search]')) { const at = ev.target.selectionStart; drawHomeTray(); const i = homeTray.querySelector('[data-he-search]'); i.focus(); i.setSelectionRange(at, at); } });
  homeTray.addEventListener('click', (ev) => {
    const t = ev.target;
    const info = t.closest('[data-info]'); if (info) { openInfo(info); return; }
    const heGo = t.closest('[data-he-go]');
    if (heGo) { homeTab = heGo.dataset.heGo; homePicking = false; closeInfo(); drawHomeTray(); trayPage(homeTray, 'Edit Home page', homeTab, heGo.textContent); return; }
    if (t.closest('[data-tray-back]')) { closeInfo(); trayPage(homeTray, 'Edit Home page', null); return; }
    const tabBtn = t.closest('[data-he-tab]');
    if (tabBtn) { const m = homeTray.querySelector('.hcTrayTabs .rubberIndicator'), from = { left: m.offsetLeft, width: m.offsetWidth }; homeTab = tabBtn.dataset.heTab; homePicking = false; closeInfo(); drawHomeTray(); placeHomeMark(true, from); homeTray.querySelector('.tfTrayInner').scrollTop = 0; return; }
    if (t.closest('[data-he-welcome]')) { homePrefs({ welcome: !welcomeOn() }); return; }
    const cardSw = t.closest('[data-he-card]'); if (cardSw) { const k = cardSw.dataset.heCard, on = ['schedule', 'sums', 'favs'].includes(k) ? prefs.home?.[k] !== false : !!prefs.home?.[k]; homePrefs({ [k]: !on }); return; }
    const fa = t.closest('[data-he-favs-as]'); if (fa) { homePrefs({ favsAs: fa.dataset.heFavsAs }); return; }
    const sw2 = t.closest('[data-he-sums-width]'); if (sw2) { homePrefs({ sumsWidth: sw2.dataset.heSumsWidth }); return; }
    const as = t.closest('[data-he-area-size]'); if (as) { homePrefs({ areaSize: as.dataset.heAreaSize }); return; }
    const ca = t.closest('[data-he-cards-as]'); if (ca) { homePrefs({ cardsAs: ca.dataset.heCardsAs }); return; }
    const al = t.closest('[data-he-area-layout]'); if (al) { homePrefs({ areaLayout: al.dataset.heAreaLayout }); return; }
    if (t.closest('[data-he-fit]')) { homePrefs({ fitTogether: !prefs.home?.fitTogether }); return; }
    const fl = t.closest('[data-he-flag]'); if (fl) { const key = fl.dataset.heFlag; homePrefs({ [key]: prefs.home?.[key] === false }); return; }
    if (t.closest('[data-he-suggest]')) { homeSave({ suggest: !suggestOn() }); return; }
    if (t.closest('[data-he-suggest-n]')) { homePrefs({ suggestN: Math.min(SUGGEST_MAX, Math.max(1, suggestN() + +t.closest('[data-he-suggest-n]').dataset.heSuggestN)) }); return; }
    const ha = t.closest('[data-he-area]'); if (ha) { const off = new Set(prefs.home?.areasOff || []), id = ha.dataset.heArea; if (off.has(id)) off.delete(id); else off.add(id); homePrefs({ areasOff: [...off] }); return; }
    const sm = t.closest('[data-he-sum]');
    if (sm) {
      const k = sm.dataset.heSum, on = !sumOn(k), h = { ...HOME_SUMS, ...(prefs.home || {}) };
      homePrefs(EXTRA_SUMS.includes(k) ? { shownSums: on ? [...(h.shownSums || []), k] : (h.shownSums || []).filter((x) => x !== k) }
        : { hiddenSums: on ? (h.hiddenSums || []).filter((x) => x !== k) : [...(h.hiddenSums || []), k] });
      return;
    }
    const rm = t.closest('[data-he-remove]'); if (rm) { homeSave({ favourites: starred().filter((x) => x !== rm.dataset.heRemove) }); return; }
    if (t.closest('[data-he-add]')) { homePicking = !homePicking; drawHomeTray(); if (homePicking) homeTray.querySelector('[data-he-search]').focus({ preventScroll: true }); return; }
    const pick = t.closest('[data-he-pick-id]'); if (pick) { homePicking = false; homeTray.querySelector('[data-he-search]').value = ''; homeSave({ favourites: [...starred(), pick.dataset.hePickId] }); }
  });
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
    const hiddenCards = dashPrefs().hidden.filter((k) => !HEAD.includes(k) && boardItems().some((it) => it.key === k));
    const trayCard = (k, verb) => '<button class="tfTrayCard" type="button" data-tray-card="' + esc(k) + '" aria-label="' + esc(boardName(k)) + ': drag it onto the board, or press to ' + verb + '">' +
      '<span class="tfTrayGrip" aria-hidden="true">' + GRIP + '</span>' + esc(boardName(k)) + '</button>';
    const cardsOff = hiddenCards.filter((k) => !WIDGETS.includes(k)), widgetsOff = WIDGETS.filter((k) => hiddenCards.includes(k));
    // the welcome message, as on Home (Matt, 12 Nov: "a greeting option to the custom dashboard"); off to start with
    trayPut('welcome', '<div class="hcHeLine"><span class="activityRowName">Welcome message</span>' + infoBtn('welcome') +
      '<button class="switch' + (dashPrefs().welcome ? ' on' : '') + '" type="button" role="switch" aria-checked="' + !!dashPrefs().welcome + '" aria-label="Welcome message" data-dash-welcome></button></div>' +
      '<div class="hcHeLine"><span class="activityRowName">Show summaries</span><button class="switch' + (prefs.dash?.sumsOff ? '' : ' on') + '" type="button" role="switch" aria-checked="' + !prefs.dash?.sumsOff + '" aria-label="Show summaries" data-dash-sums></button></div>');
    requestAnimationFrame(() => showTrayTab(false));
    trayPut('cards', '<div class="sectionLabel">Hidden and new cards</div>' + (cardsOff.length ? '<div class="tfTrayCards">' + cardsOff.map((k) => trayCard(k, 'put it back')).join('') + '</div>' : '<p class="tfTrayNote">Cards you hide, and new ones, wait here.</p>'));
    // the Weather page's widgets that aren't on the board (Matt, 11 Nov); one hidden from its ⋯ comes back here
    trayPut('weather', '<div class="sectionLabel">Weather</div>' + (widgetsOff.length ? '<p class="tfTrayNote">The Weather page\'s widgets. Drag one onto the board, or press to add it.</p><div class="tfTrayCards">' +
      widgetsOff.map((k) => trayCard(k, 'add it')).join('') + '</div>' : '<p class="tfTrayNote">Every weather widget is on the board.</p>'));
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
    const off = new Set(prefs.dash?.areasOff || []);
    trayPut('areas', byAreaOrder(areaRooms).map((r) => '<li class="hcHeRow" data-area-id="' + esc(r.id) + '"><button class="tfTrayBtn hcHeGrip" type="button" data-area-grip aria-label="Move ' + esc(r.name) + '. Use the up and down arrows">' + GRIP + '</button>' +
      '<span class="tfIcon"><span class="tfAreaGlyph"' + iconSlot('area:' + r.id, r.icon || 'mdi:texture-box', r.name) + '></span></span><span class="activityRowName">' + esc(r.name) + '</span>' +
      '<button class="switch' + (off.has(r.id) ? '' : ' on') + '" type="button" role="switch" aria-checked="' + !off.has(r.id) + '" aria-label="Show ' + esc(r.name) + ' in the Areas card" data-area-on="' + esc(r.id) + '"></button></li>').join(''));
    if (roomPicking) { const there = new Set(tilesNow()); trayPut('roompick', byAreaOrder(areaRooms).filter((r) => !there.has('room:' + r.id)).map((r) => '<li><button class="tfTrayPickItem" type="button" data-room-pick="' + esc(r.id) + '">' +
      '<span class="tfIcon"><span class="tfAreaGlyph"' + iconSlot('area:' + r.id, r.icon || 'mdi:texture-box', r.name) + '></span></span><span class="tfTrayName"><span class="activityRowName">' + esc(r.name) + '</span></span></button></li>').join('') || '<li class="tfTrayNote">Every area is on the board.</li>'); }
    tray.querySelector('[data-pick="favs"]').hidden = !trayPicking;
    tray.querySelector('[data-fav-add]').setAttribute('aria-expanded', String(trayPicking));
    if (trayPicking) trayPut('pick', pickHtml(tray.querySelector('[data-fav-search]').value, (id) => PICK_DOMAINS.test(id), new Set(starred()), 'data-fav-pick'));
    trayPut('suggest', '<div><strong>Show suggestions</strong><div class="status">Fills the card after your favourites.</div></div>' +
      '<button class="switch' + (suggestOn() ? ' on' : '') + '" type="button" role="switch" aria-checked="' + suggestOn() + '" data-fav-suggest aria-label="Show suggestions"></button>');
    if (cardEdit) drawCardEditor();
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
  /* ---------- a card's own page (Matt, 20 Nov: "complete control over cards") ----------
     Edit card (Edit tile on a tile) in a card's ⋯ opens the card's own page in the edit tray, ‹ back to the tray. Every
     card and tile: its background (the theme's or a colour) and how much of it shows, and its stroke (the system's, none,
     or 1 to 3 px) and the stroke's colour; text turns light or dark to suit, as Appearance's does. Some say what they
     show and what leads: Favourites which favourites, an area's tile its devices and main reading, Energy today its
     sources and the one its graph opens on, a light's tile its controls and the one first (a short tile shows only that).
     The card stays live on the board, the rest faded; the board slides left if the tray's over it. Kept with the board,
     prefs.dash.opts[key].card */
  function cardOf(key) { return dashPrefs().opts[key]?.card || {}; }
  // a card's parts in the order they were dragged into (card.order), the rest after in their own order
  const inCardOrder = (key, items, idOf = (x) => x) => {
    const o = cardOf(key).order || [], at = (x) => { const i = o.indexOf(idOf(x)); return i < 0 ? o.length + items.indexOf(x) : i; };
    return [...items].sort((a, b) => at(a) - at(b));
  };
  // a drag on the card's own page, or on the card itself, sets the order: Favourites' is the favourites' own
  const saveCardOrder = (key, ids) => { if (key === 'favs') { const stars = new Set(starred()); trayHtml.favs = null; saveFavs({ favourites: ids.filter((id) => stars.has(id)) }); layoutBoard(); } else setCard(key, { order: ids }, true); };
  // each section of a device's tile, named for its page
  const PART_NAMES = { bright: 'Brightness', ct: 'Warmth', hue: 'Colour', step: 'Target', modes: 'Modes', blocks: 'Position', tilt: 'Tilt', buttons: 'Open, stop and close',
    playback: 'Playback', volume: 'Volume', controls: 'Buttons', rooms: 'Rooms to clean' };
  const partName = (id, p) => (p === 'controls' ? { lock: 'Lock, unlock and open', alarm_control_panel: 'Arm and disarm', valve: 'Open and close', vacuum: 'Start, dock and locate' }[id.split('.')[0]] || 'Off and on' : PART_NAMES[p] || cap(p));
  const cardKind = (key) => (key === 'favs' ? 'favs' : key === 'energy' ? 'energy' : isRoomKey(key) ? 'room' : key.includes('.') && states[key] && !(key.startsWith('light.') && wantsDac(key)) ? 'device' : null);
  function paintCards() {
    const opts = overview ? {} : boardPrefs().opts, cs = getComputedStyle(app);
    const ground = parseColour(cs.getPropertyValue('--bg').trim() || cs.getPropertyValue('--color-bg-ground').trim() || '#000');
    const css = Object.entries(opts).map(([key, o]) => {
      const c = o?.card;
      if (!c) return '';
      // three ids outweigh Appearance's rules; its outline only out of edit mode, or while this page is open
      const on = '#app#app#app:not(.tfOverview) ', seen = '#app#app#app:not(.tfOverview):is(:not(.tfEditing),.hcCardEditing) ', at = cardSel(key);
      const faces = (pre) => pre + at + ':not(.tfDashBento,.tfAreas),' + pre + at + ' ' + FACES;
      let out = '';
      if (c.bg || c.opacity != null) {
        const base = c.bg ? [...hexRgb(c.bg), 1] : parseColour(cs.getPropertyValue('--card').trim() || '#000'), a = c.opacity != null ? c.opacity / 100 : base[3];
        const ink = cardInk(base.slice(0, 3), a, ground.slice(0, 3)), fill = rgbaOf(base, a);
        // names and titles: light mode's title grey (#55504A) on a light card, the text colour on a dark one
        // and the icons' chips as the light or dark theme has them, whichever suits (#app sets them from its own text)
        const dark = ink.text === '#d9d9d9', title = dark ? ink.text : '#55504a', chips = dark ? ';--hc-icon:#3a3a3a;--hc-icon-ink:#d9d9d9' : ';--hc-icon:#e6e6e6;--hc-icon-ink:#55504a';
        out += faces(on) + '{--card:' + fill + ';--group-bg:' + fill + ';--text:' + ink.text + ';--muted:' + ink.muted + ';--tile:' + ink.tile + ';--title:' + title + chips + ';color:var(--text)' +
          (a > 0 && a < 1 ? ';-webkit-backdrop-filter:blur(24px);backdrop-filter:blur(24px)' : '') + '}' +
          // what sits in it (the open area's tile, a weather card's insides) reads on it too
          on + at + ' :is(.tfAction,.card,.workoutPanel,.wbCard){--text:' + ink.text + ';--muted:' + ink.muted + ';--tile:' + ink.tile + ';--title:' + title + chips + '}';
      }
      const line = c.line && c.stroke !== 'none' ? c.line : null;
      if (line) out += faces(on) + '{--line:' + line + ';--lineb:' + line + ';--hc-hair:inset 0 0 0 .2px ' + line + ',inset 0 -.2px 0 ' + line + ';--hc-hair-all:inset 0 0 0 .4px ' + line + '}';
      if (c.stroke === 'none') out += faces(on) + '{border-color:transparent!important;box-shadow:none!important}' + faces(seen) + '{outline:none!important}';
      else if (c.stroke) out += faces(seen) + '{outline:' + c.stroke + 'px solid ' + (line || 'var(--line)') + '!important;outline-offset:-' + c.stroke + 'px!important}';
      return out;
    }).join('');
    if (cardStyle.textContent !== css) cardStyle.textContent = css;
  }
  // the light or dark theme changing changes what's under a card that lets the background through
  new MutationObserver(() => paintCards()).observe(app, { attributes: true, attributeFilter: ['class'] });
  // saves a card's own settings; what it shows changing draws it again
  function setCard(key, patch, redraw = false) {
    const dash = dashPrefs(), { card: was, ...rest } = dash.opts[key] || {}, next = { ...(was || {}), ...patch };
    Object.keys(next).forEach((k) => { if (next[k] == null) delete next[k]; });
    saveDash({ ...dash, opts: { ...dash.opts, [key]: Object.keys(next).length ? { ...rest, card: next } : rest } });
    if (redraw) { if (key === 'energy') units.delete('dash:energy'); refresh(); layoutBoard(); } else paintCards();
    drawCardEditor();
  }
  // where the tray is over the card, the board slides left until it isn't (no further than the rail)
  /* the board beside an open tray (Matt, 20 Nov: the trays "overtake a lot of the screen"): the whole board scales down,
     from its top left, until it fits in the room left of the tray, every card keeping its place and proportion; the
     tray closed or tucked, it's its size again. The page's scroll follows the scaled height. Pointer maths on the board
     (drags) divides by the scale */
  const boardScale = () => parseFloat(grid.style.scale) || 1;
  function scaleBoard() {
    const open = tray.classList.contains('open') && !trayTucked ? tray : homeTray.classList.contains('open') ? homeTray : null;
    const phone = grid.clientWidth < 2 * PEG + PEG_GAP;
    let k = 1;
    if (open && !phone) {
      // the tray at rest (it may still be sliding in): against the window's right edge
      const left = grid.getBoundingClientRect().left, room = window.innerWidth - open.offsetWidth - 24 - left;
      k = Math.max(0.35, Math.min(1, room / grid.clientWidth));
    }
    const was = boardScale();
    grid.style.scale = k < 1 ? k.toFixed(4) : '';
    grid.style.setProperty('--board-k', k < 1 ? k.toFixed(4) : '1'); // the handles and menus scale back up by it
    grid.style.marginBottom = k < 1 ? -Math.round((1 - k) * grid.offsetHeight) + 'px' : '';
  }
  /* the card's parts dragged into place on the card itself (Matt, 20 Nov: "WYSIWYG"): a favourite, an area's device,
     an energy source or a tile's control follows the pointer; the part nearest it marks where it'll go; let go, the card
     is drawn again in that order. A press without a drag still does what the part does */
  const ceItemsOf = (card) => [...card.querySelectorAll(cardEdit === 'favs' ? '[data-k^="fav:"]' : '[data-ce-item]')].filter((el) => el.offsetWidth);
  const ceIdOf = (el) => (cardEdit === 'favs' ? el.dataset.k.slice(4) : el.dataset.ceItem);
  function cardItemDown(ev) {
    if (!cardEdit || ev.button !== 0) return;
    const card = grid.querySelector(cardSel(cardEdit)), el = card && ev.target.closest(cardEdit === 'favs' ? '[data-k^="fav:"]' : '[data-ce-item]');
    if (!el || !card.contains(el)) return;
    ev.stopPropagation(); // not the part's own drag (a bar's), nor the board's
    const items = ceItemsOf(card), from = items.indexOf(el);
    if (from < 0 || items.length < 2) return;
    const x0 = ev.clientX, y0 = ev.clientY, mids = items.map((x) => { const r = x.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    let started = false, to = from;
    const move = (e) => {
      const dx = e.clientX - x0, dy = e.clientY - y0;
      if (!started) { if (Math.hypot(dx, dy) < 5) return; started = true; el.classList.add('hcCeDragging'); }
      const k = boardScale();
      el.style.transform = 'translate(' + (dx / k).toFixed(1) + 'px,' + (dy / k).toFixed(1) + 'px)';
      let best = Infinity, near = from;
      mids.forEach(([mx, my], i) => { const d = Math.hypot(e.clientX - mx, e.clientY - my); if (d < best) { best = d; near = i; } });
      if (near !== to) { items[to]?.classList.remove('hcCeOver'); to = near; if (to !== from) items[to].classList.add('hcCeOver'); }
    };
    const up = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
      if (!started) return;
      const eat = (e) => { e.preventDefault(); e.stopImmediatePropagation(); };
      window.addEventListener('click', eat, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', eat, { capture: true }), 300);
      items.forEach((x) => x.classList.remove('hcCeOver'));
      el.classList.remove('hcCeDragging');
      el.style.transform = '';
      if (to === from) return;
      const ids = items.map(ceIdOf);
      ids.splice(to, 0, ids.splice(from, 1)[0]);
      // the rest of the card's parts (hidden ones) keep their places after these
      const all = [...ids, ...(cardEdit === 'favs' ? starred() : cardOf(cardEdit).order || []).filter((x) => !ids.includes(x))];
      saveCardOrder(cardEdit, all);
      const now = grid.querySelector(cardSel(cardEdit))?.querySelector(cardEdit === 'favs' ? '[data-k="fav:' + CSS.escape(ids[to]) + '"]' : '[data-ce-item="' + CSS.escape(ids[to]) + '"]');
      if (now && !reduced()) squash(now);
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  }
  function openCardEditor(key) {
    cardEdit = key;
    trayTucked = false;
    tray.classList.add('hcTrayCard');
    app.classList.add('hcCardEditing');
    trayHtml.cardedit = null;
    layoutBoard();
    tray.querySelector('.tfTrayInner').scrollTop = 0;
    grid.querySelector(cardSel(key))?.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
    tray.querySelector('.hcTrayBack')?.focus({ preventScroll: true });
  }
  function closeCardEditor(refocus = true) {
    if (!cardEdit) return;
    const key = cardEdit;
    cardEdit = null;
    tray.classList.remove('hcTrayCard');
    app.classList.remove('hcCardEditing');
    grid.querySelectorAll('.hcCardEdited').forEach((el) => el.classList.remove('hcCardEdited'));
    trayPage(tray, 'Edit custom dashboard', null);
    if (!refocus) return;
    layoutBoard();
    grid.querySelector('[data-board-more="' + CSS.escape(key) + '"]')?.focus({ preventScroll: true });
  }
  const ceLine = (label, html, attr = '') => '<div class="hcHeLine hcCeLine"' + attr + '><span class="activityRowName">' + esc(label) + '</span><span class="hcCeEnd">' + html + '</span></div>';
  const ceSeg = (label, attr, value, opts) => '<div class="themeChoice hcHeChoice" role="group" aria-label="' + esc(label) + '">' +
    opts.map(([v, text]) => '<button class="wxLayoutBtn" type="button" ' + attr + '="' + esc(v) + '" aria-pressed="' + (String(value) === v) + '">' + esc(text) + '</button>').join('') + '</div>';
  const ceSwatch = (k, label) => '<label class="hcSwatch"><input type="color" data-ce-colour="' + k + '" aria-label="' + esc(label) + '"></label>';
  // a row that shows or hides something in the card; the last one shown can't go
  const chip = (slot) => '<span class="tfIcon"' + slot + '></span>';
  const ceShow = (icon, name, meta, on, attr, last, id = null) => '<li class="hcCeRow' + (icon ? '' : ' hcCeBare') + (id == null ? ' hcCeFixed' : '') + '"' + (id == null ? '' : ' data-ce-row="' + esc(id) + '"') + '>' +
    (id == null ? '<span></span>' : '<button class="tfTrayBtn hcHeGrip" type="button" data-ce-grip aria-label="Move ' + esc(name) + '. Use the up and down arrows">' + GRIP + '</button>') + icon +
    '<span class="tfTrayName"><span class="activityRowName">' + esc(name) + '</span>' + (meta ? '<span class="activityRowMeta">' + esc(meta) + '</span>' : '') + '</span>' +
    '<button class="switch' + (on ? ' on' : '') + '" type="button" role="switch" aria-checked="' + on + '" aria-label="Show ' + esc(name) + '" ' + attr + (on && last ? ' disabled' : '') + '></button></li>';
  // the main one: side by side when there are few, else a list to pick from
  const ceMain = (label, value, opts) => (opts.length < 2 ? '' : opts.length <= 4 && opts.every(([, t]) => t.length <= 14)
    ? '<div class="hcHeLine hcHeChoiceLine"><span class="activityRowName">' + esc(label) + '</span>' + ceSeg(label, 'data-ce-main', value, opts.map(([v, t]) => [v, t])) + '</div>'
    : '<div class="sectionLabel hcCeSub">' + esc(label) + '</div><div class="hcHeList" role="radiogroup" aria-label="' + esc(label) + '">' + opts.map(([v, t, meta, icon]) =>
      '<button class="hcCeRow hcCePick hcCeFixed' + (icon ? '' : ' hcCeBare') + '" type="button" role="radio" aria-checked="' + (v === value) + '" data-ce-main="' + esc(v) + '"><span></span>' + (icon || '') +
      '<span class="tfTrayName"><span class="activityRowName">' + esc(t) + '</span>' + (meta ? '<span class="activityRowMeta">' + esc(meta) + '</span>' : '') + '</span><span class="hcCeTick" aria-hidden="true">' + TICK + '</span></button>').join('') + '</div>');
  // what the card shows, and its main, for the cards that have them
  function cardContent(key) {
    const own = cardOf(key), off = new Set(own.hidden || []), kind = cardKind(key);
    const group = (label, body, note = '') => '<div class="hcCeGroup"><div class="sectionLabel">' + label + '</div>' + (note ? '<p class="tfTrayNote">' + note + '</p>' : '') + body + '</div>';
    const DRAG_NOTE = 'Drag to change the order, here or on the card.';
    if (kind === 'favs') {
      const hidden = new Set(prefs.favHidden || []), stars = starred(), shown = stars.filter((id) => !hidden.has(id)).length + (suggestOn() ? 1 : 0);
      return group('Shown', '<ul class="hcHeList">' + stars.map((id) => ceShow(chip(iconSlot(id, iconFor(id))), nameOf(id), whereIs.get(id) || '', !hidden.has(id), 'data-ce-fav="' + esc(id) + '"', shown < 2, id)).join('') + '</ul>' +
        ceLine('Suggestions', '<button class="switch' + (suggestOn() ? ' on' : '') + '" type="button" role="switch" aria-checked="' + suggestOn() + '" aria-label="Show suggestions" data-ce-suggest' + (suggestOn() && shown < 2 ? ' disabled' : '') + '></button>'));
    }
    if (kind === 'energy') {
      const tiles = energyTiles.length ? energyTiles : [], shown = tiles.filter((t) => !off.has(t.id));
      return group('Shown', '<ul class="hcHeList">' + inCardOrder(key, tiles, (t) => t.id).map((t) => ceShow(chip(iconSlot('', ENERGY_ICON[t.key], t.name)), t.name, energyAmount(t), !off.has(t.id), 'data-ce-hide="' + esc(t.id) + '"', shown.length < 2, t.id)).join('') + '</ul>', DRAG_NOTE) +
        group('Main', ceMain('Graph', shown.some((t) => t.id === own.main) ? own.main : shown[0]?.id, shown.map((t) => [t.id, t.name, energyAmount(t), chip(iconSlot('', ENERGY_ICON[t.key], t.name))])));
    }
    if (kind === 'room') {
      const r = roomOf(key);
      if (!r) return '';
      const keys = roomKeys(r), controls = keys.filter((k) => k.kind === 'control');
      const reads = [...r.readings, ...r.actions.filter((id) => /^climate\./.test(id)), ...r.solar].filter((id, i, all) => states[id] && all.indexOf(id) === i);
      const main = (states[own.main] && own.main) || mainOf(r);
      return (controls.length ? group('Shown', '<ul class="hcHeList">' + inCardOrder(key, controls, (k) => k.key).map((k) => ceShow('<span class="tfIcon">' + k.icon + '</span>', k.label, k.value, !off.has(k.key), 'data-ce-hide="' + esc(k.key) + '"', false, k.key)).join('') + '</ul>', DRAG_NOTE) : '') +
        (reads.length > 1 ? group('Main', ceMain('Main reading', main, reads.map((id) => [id, inRoom(r, id), valueOf(id), chip(iconSlot(id))]))) : '');
    }
    if (kind === 'device') {
      // the state under its name, then each of its controls; the first of them comes first, and a short tile shows only it
      // the first control shown comes first; a short tile shows only it
      const all = inCardOrder(key, controlsOf(key));
      return group('Shown', '<ul class="hcHeList">' + ceShow('', 'State under the name', valueOf(key), !off.has('state'), 'data-ce-hide="state"', false) +
        all.map((p) => ceShow('', partName(key, p), '', !off.has(p), 'data-ce-hide="' + esc(p) + '"', false, p)).join('') + '</ul>',
        (all.length > 1 ? DRAG_NOTE + ' The first comes first; a short tile shows only it. ' : '') + '<span class="hcCeWarn">Showing more makes the tile taller, which can move the cards under it.</span>');
    }
    return '';
  }
  function drawCardEditor() {
    if (!cardEdit) return;
    const key = cardEdit, c = cardOf(key), stroke = c.stroke == null ? 'system' : String(c.stroke);
    tray.querySelector('.tfTrayHead .activityTitle').textContent = 'Edit ' + boardName(key);
    trayPut('cardedit', '<div class="hcCeGroup"><div class="sectionLabel">Look</div>' +
      ceLine('Background', ceSeg('Background', 'data-ce-bg', c.bg ? 'colour' : 'theme', [['theme', 'Theme'], ['colour', 'Colour']]) + (c.bg ? ceSwatch('bg', 'Background colour') : '')) +
      ceLine('Opacity', '<span class="hcRangeWrap"><span class="hcRangeValue" data-ce-value="opacity"></span><span class="tfBar pos hcLookBar" role="slider" tabindex="0" aria-label="Background opacity" aria-valuemin="0" aria-valuemax="100" data-ce-bar="opacity"><i></i></span></span>') +
      ceLine('Stroke', ceSeg('Stroke', 'data-ce-stroke', stroke, [['system', 'System'], ['none', 'None'], ['1', '1 px'], ['2', '2 px'], ['3', '3 px']])) +
      (stroke === 'none' ? '' : ceLine('Stroke colour', ceSwatch('line', 'Stroke colour'))) + '</div>' +
      cardContent(key) +
      '<div class="hcCeGroup">' + ceLine('Back to how it was', '<button class="pill" type="button" data-ce-reset' + (Object.keys(c).length ? '' : ' disabled') + '>Reset</button>') + '</div>');
    syncCardEditor();
  }
  // the values that change as they're dragged or picked, set on the controls rather than drawn again
  function syncCardEditor() {
    const sec = tray.querySelector('[data-tray="cardedit"]'), face = faceOf(grid.querySelector(cardSel(cardEdit)));
    if (!sec || !face) return;
    const fs = getComputedStyle(face), c = cardOf(cardEdit), bg = parseColour(fs.backgroundColor), line = parseColour(fs.getPropertyValue('--line').trim() || '#808080');
    // the system's line is see-through: its swatch shows it as it looks on the card
    const lineSeen = line.slice(0, 3).map((v, i) => v * line[3] + bg[i] * (1 - line[3]));
    const val = { bg: c.bg || rgbHex(bg.slice(0, 3)), line: c.line || rgbHex(lineSeen), opacity: c.opacity ?? Math.round((parseColour(getComputedStyle(app).getPropertyValue('--card').trim() || '#000')[3]) * 100) };
    sec.querySelectorAll('[data-ce-colour]').forEach((el) => { if (root.activeElement !== el) el.value = val[el.dataset.ceColour]; });
    sec.querySelectorAll('[data-ce-bar]').forEach((el) => { const v = val[el.dataset.ceBar]; el.querySelector('i').style.width = v + '%'; el.setAttribute('aria-valuenow', v); el.setAttribute('aria-valuetext', v + '%'); });
    sec.querySelectorAll('[data-ce-value]').forEach((el) => { el.textContent = val[el.dataset.ceValue] + '%'; });
  }
  function cardEditClick(t) {
    const key = cardEdit, c = cardOf(key), off = new Set(c.hidden || []), mark = [...t.attributes].find((a) => a.name.startsWith('data-ce-'));
    if (t.dataset.ceBg) {
      // Colour starts from the colour it has, so nothing changes until one's picked
      if (t.dataset.ceBg === 'colour' && !c.bg) { setCard(key, { bg: rgbHex(parseColour(getComputedStyle(faceOf(grid.querySelector(cardSel(key)))).backgroundColor).slice(0, 3)) }); try { tray.querySelector('[data-ce-colour="bg"]')?.showPicker(); } catch (_e) { /* a press on the swatch opens it */ } }
      else if (t.dataset.ceBg === 'theme') setCard(key, { bg: null });
    } else if (t.dataset.ceStroke) setCard(key, { stroke: t.dataset.ceStroke === 'system' ? null : t.dataset.ceStroke === 'none' ? 'none' : Number(t.dataset.ceStroke) });
    else if (t.dataset.ceHide) {
      const showing = off.has(t.dataset.ceHide);
      if (showing) off.delete(t.dataset.ceHide); else off.add(t.dataset.ceHide);
      setCard(key, { hidden: off.size ? [...off] : null }, true);
      // a tile's control shown that its height can't hold: the tile grows a row for it (and shrinks again as one's hidden,
      // sizeOf keeping to what it holds); the cards under it move down (the page says so)
      if (showing && cardKind(key) === 'device' && t.dataset.ceHide !== 'state') {
        const need = Math.min(ROWS_MOST, cardControls(key).length + 1), d = dashPrefs();
        if (sizeOf(key) < need) { saveDash({ ...d, opts: { ...d.opts, [key]: { ...(d.opts[key] || {}), h: need, tall: undefined } } }); refresh(); layoutBoard(); toast(boardName(key) + ' is now ' + SIZE_NAMES[need - 1]); }
      }
    }
    else if (t.dataset.ceMain) {
      if (key === 'energy') energyPick = t.dataset.ceMain; // the graph moves to it now too
      setCard(key, { main: t.dataset.ceMain }, true);
    } else if (t.dataset.ceFav) { const hidden = new Set(prefs.favHidden || []), id = t.dataset.ceFav; if (hidden.has(id)) hidden.delete(id); else hidden.add(id); saveFavs({ favHidden: [...hidden] }); layoutBoard(); }
    else if (t.hasAttribute('data-ce-suggest')) { saveFavs({ suggest: !suggestOn() }); layoutBoard(); }
    else if (t.hasAttribute('data-ce-reset')) {
      const before = prefs;
      setCard(key, { bg: null, opacity: null, stroke: null, line: null, hidden: null, main: null, order: null }, true);
      toast(boardName(key) + ' reset', undoTo(before));
    }
    // the control pressed was drawn again: focus goes back to it
    if (mark && !t.isConnected) tray.querySelector('[data-tray="cardedit"] [' + mark.name + (mark.value ? '="' + CSS.escape(mark.value) + '"' : '') + ']')?.focus({ preventScroll: true });
  }
  tray.addEventListener('input', (ev) => {
    const k = ev.target.dataset?.ceColour;
    if (k && cardEdit) setCard(cardEdit, { [k]: ev.target.value });
  });
  // the opacity bar: dragged anywhere along it, or the arrow keys (Shift for tens), Home and End
  const setCardBar = (bar, v) => setCard(cardEdit, { [bar.dataset.ceBar]: Math.max(0, Math.min(100, Math.round(v))) });
  const ceRows = () => [...tray.querySelectorAll('[data-tray="cardedit"] [data-ce-row]')];
  const ceFind = (id) => tray.querySelector('[data-tray="cardedit"] [data-ce-row="' + CSS.escape(id) + '"]');
  tray.addEventListener('pointerdown', (ev) => {
    const g = ev.target.closest('[data-ce-grip]');
    if (g && cardEdit && ev.button === 0) { listDrag(ev, g.closest('[data-ce-row]'), 'ceRow', (ids) => saveCardOrder(cardEdit, ids), ceFind); return; }
    const bar = ev.target.closest('[data-ce-bar]');
    if (!bar || !cardEdit || ev.button > 0) return;
    ev.preventDefault();
    bar.focus({ preventScroll: true });
    bar.setPointerCapture(ev.pointerId);
    const at = (e) => { const r = bar.getBoundingClientRect(); setCardBar(bar, ((e.clientX - r.left) / r.width) * 100); };
    at(ev);
    const end = () => { bar.removeEventListener('pointermove', at); bar.removeEventListener('pointerup', end); bar.removeEventListener('pointercancel', end); };
    bar.addEventListener('pointermove', at);
    bar.addEventListener('pointerup', end);
    bar.addEventListener('pointercancel', end);
  });
  tray.addEventListener('keydown', (ev) => {
    if (!cardEdit) return;
    if (ev.key === 'Escape' && !ev.target.matches?.('input')) { ev.preventDefault(); ev.stopPropagation(); closeCardEditor(); return; }
    const g = ev.target.closest?.('[data-ce-grip]');
    if (g && ['ArrowUp', 'ArrowDown'].includes(ev.key)) {
      ev.preventDefault();
      const ids = ceRows().map((x) => x.dataset.ceRow), id = g.closest('[data-ce-row]').dataset.ceRow, i = ids.indexOf(id), to = i + (ev.key === 'ArrowUp' ? -1 : 1);
      if (to < 0 || to >= ids.length) return;
      ids.splice(to, 0, ids.splice(i, 1)[0]);
      saveCardOrder(cardEdit, ids);
      ceFind(id)?.querySelector('[data-ce-grip]')?.focus({ preventScroll: true });
      return;
    }
    const bar = ev.target.closest?.('[data-ce-bar]');
    if (!bar) return;
    const now = Number(bar.getAttribute('aria-valuenow')), step = ev.shiftKey ? 10 : 1;
    const next = { ArrowRight: now + step, ArrowUp: now + step, ArrowLeft: now - step, ArrowDown: now - step, Home: 0, End: 100 }[ev.key];
    if (next == null) return;
    ev.preventDefault();
    setCardBar(bar, next);
  });
  tray.addEventListener('click', (ev) => {
    const t = ev.target.closest('button');
    if (!t) return;
    if (t.hasAttribute('data-tray-tab')) { trayTab = t.dataset.trayTab; showTrayTab(true); tray.querySelector('.tfTrayInner').scrollTop = 0; return; }
    if (t.hasAttribute('data-tray-go')) { trayTab = t.dataset.trayGo; showTrayTab(false); trayPage(tray, 'Edit custom dashboard', trayTab, TRAY_TABS.find(([k]) => k === trayTab)[1]); return; }
    if (t.hasAttribute('data-tray-back')) { if (cardEdit) closeCardEditor(); else trayPage(tray, 'Edit custom dashboard', null); return; }
    if (cardEdit && t.closest('[data-tray="cardedit"]')) { cardEditClick(t); return; }
    if (t.hasAttribute('data-tray-done')) setEditing(false);
    else if (t.hasAttribute('data-info')) openInfo(t);
    else if (t.hasAttribute('data-dash-sums')) { saveDash({ ...boardPrefs(), hidden: boardPrefs().hidden.filter((k) => k !== 'sums'), sumsOff: !prefs.dash?.sumsOff }); refresh(); renderTray(); }
    else if (t.hasAttribute('data-dash-welcome')) { const d = dashPrefs(); saveDash({ ...d, welcome: !d.welcome }); refresh(); renderTray(); }
    else if (t.hasAttribute('data-tray-tuck')) { trayTucked = !trayTucked; renderTray(); scaleBoard(); }
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
    else if (t.dataset.areaOn) { const off = new Set(prefs.dash?.areasOff || []); if (off.has(t.dataset.areaOn)) off.delete(t.dataset.areaOn); else off.add(t.dataset.areaOn); saveDash({ ...dashPrefs(), areasOff: [...off] }); refresh(); renderTray(); }
    else if (t.hasAttribute('data-fav-suggest')) saveFavs({ suggest: !suggestOn() });
  });
  tray.addEventListener('input', (ev) => { if (ev.target.matches('[data-fav-search],[data-tile-search]')) renderTray(); });
  // an area moves up or down the list: its grip dragged, or the arrows on it; the order is Home's too
  const saveAreaOrder = (ids) => { prefs = { ...prefs, areaOrder: ids }; savePrefs(); refresh(); renderTray(); };
  tray.addEventListener('keydown', (ev) => {
    const g = ev.target.closest?.('[data-area-grip]'); if (!g || !['ArrowUp', 'ArrowDown'].includes(ev.key)) return;
    ev.preventDefault();
    const id = g.closest('[data-area-id]').dataset.areaId, ids = byAreaOrder(areaRooms).map((r) => r.id), i = ids.indexOf(id), to = i + (ev.key === 'ArrowUp' ? -1 : 1);
    if (to < 0 || to >= ids.length) return;
    ids.splice(to, 0, ids.splice(i, 1)[0]);
    saveAreaOrder(ids);
    tray.querySelector('[data-area-id="' + CSS.escape(id) + '"] [data-area-grip]')?.focus();
  });
  tray.addEventListener('pointerdown', (ev) => {
    const g = ev.target.closest('[data-area-grip]'); if (!g || ev.button !== 0) return;
    listDrag(ev, g.closest('[data-area-id]'), 'areaId', saveAreaOrder, (id) => tray.querySelector('[data-area-id="' + CSS.escape(id) + '"]'));
  });
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
        const r = grid.getBoundingClientRect(), { w } = pegsFor(grid.clientWidth), k = boardScale();
        drag = !overTray && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top + boardTop * k
          ? { key, col: Math.max(0, Math.floor((e.clientX - r.left) / k / (w + PEG_GAP))), row: Math.max(0, Math.floor(((e.clientY - r.top) / k - boardTop) / ROW_PITCH)), fromTray: true } : null;
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
  const PHONE_H = { sums: 201, wx: 364, favs: 364, areas: 364, act: 364, energy: 288, avg: 288, aq: 288, pollen: 288, radar: 288,
    hourly: 288, sun: 288, moon: 288, uv: 288, humidity: 288, pressure: 288, wind: 288, visibility: 288 }, PHONE_TILE = 136, PHONE_DAC = 288, PHONE_SCALE = 0.8;
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
  /* a row dragged up or down a list (Matt, 16 Nov: "the correct animation and feel"): Dashboards' drag, the Motion
     Lab's, along the list. It lifts 3.5% and follows the pointer on a spring (pull, keep), stretching a little with its
     speed; the rows in the way slide aside (the lab's gap, with its overshoot); let go, it springs into its place (slide)
     and squashes as it lands. Where it'll go follows the pointer, not the spring */
  function listDrag(ev, li, key, save, findNow) {
    ev.preventDefault();
    const D = M.drag, still = reduced(), lift = 1 + D.lift / 100;
    const rows = [...li.parentElement.children].filter((x) => x.dataset[key]);
    const from = rows.indexOf(li), rects = rows.map((x) => x.getBoundingClientRect()), last = rows.length - 1;
    const shift = rects[from].height + (rows.length > 1 ? rects[1].top - rects[0].bottom : 0);
    const mid = (i) => rects[i].top + rects[i].height / 2;
    const y0 = ev.clientY, lo = rects[0].top - rects[from].top, hi = rects[last].top - rects[from].top;
    let dy = 0, y = 0, vy = 0, lt = 1, to = from, raf = 0;
    li.classList.add('hcListDragging');
    rows.forEach((x) => { if (x !== li) x.style.transition = still ? 'none' : 'transform ' + D.gap + 'ms ' + EASE.land; });
    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (still) { y = dy; li.style.transform = 'translateY(' + y + 'px)'; return; }
      vy = springStep(vy, dy - y, D.pull / 100, D.keep / 100); y += vy; lt += (lift - lt) * 0.25;
      const st = Math.min(Math.abs(vy) / 48, 1);
      li.style.transform = 'translateY(' + y.toFixed(2) + 'px) scale(' + (lt * (1 - 0.063 * st)).toFixed(4) + ',' + (lt * (1 + 0.1 * st)).toFixed(4) + ')';
    };
    raf = requestAnimationFrame(frame);
    const move = (e) => {
      dy = Math.max(lo, Math.min(hi, e.clientY - y0));
      const c = mid(from) + dy, next = rows.filter((x, i) => i !== from && mid(i) < c).length;
      if (next === to) return;
      to = next;
      rows.forEach((x, i) => { if (x !== li) x.style.transform = from < to && i > from && i <= to ? 'translateY(' + -shift + 'px)' : to < from && i >= to && i < from ? 'translateY(' + shift + 'px)' : ''; });
    };
    const up = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
      cancelAnimationFrame(raf);
      const was = li.getBoundingClientRect(), id = li.dataset[key];
      rows.forEach((x) => { x.style.transition = 'none'; x.style.transform = ''; });
      li.classList.remove('hcListDragging');
      const ids = rows.map((x) => x.dataset[key]);
      ids.splice(to, 0, ids.splice(from, 1)[0]);
      save(ids);
      const now = findNow(id) || li;
      requestAnimationFrame(() => rows.forEach((x) => { x.style.transition = ''; }));
      if (still) return;
      const r = now.getBoundingClientRect(), fy = was.top + was.height / 2 - (r.top + r.height / 2);
      now.classList.add('hcListLanding');
      const a = now.animate([{ transform: 'translateY(' + fy + 'px) scale(' + lt + ')', filter: 'drop-shadow(0 10px 30px rgba(0,0,0,.35))' }, { transform: 'none', filter: 'drop-shadow(0 0 0 rgba(0,0,0,0))' }], { duration: D.slide, easing: EASE.land });
      a.finished.then(() => { now.classList.remove('hcListLanding'); squash(now); }, () => now.classList.remove('hcListLanding'));
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  }
  function reorderFav(ev, li) {
    listDrag(ev, li, 'trayFav', (ids) => { const stars = new Set(starred()); trayHtml.favs = null; saveFavs({ favourites: ids.filter((id) => stars.has(id)) }); },
      (id) => tray.querySelector('[data-tray-fav="' + CSS.escape(id) + '"]'));
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
    if (!editing || cardEdit || ev.button !== 0 || ev.target.closest('[data-board-more],.tfBoardMenu,.tfFavHides')) return;
    const el = ev.target.closest('.tfBoardItem');
    const it = el && boardItems().find((x) => x.el === el);
    if (!it || HEAD.includes(it.key)) return;
    const p = lastPlaced.get(it.key), { w } = pegsFor(grid.clientWidth);
    if (!p) return;
    ev.preventDefault();
    closeBoardMenu();
    const x0 = ev.clientX, y0 = ev.clientY;
    let started = false, raf = 0;
    /* the Motion Lab's drag: the card resists until it's pulled 44 (stretching toward the pointer), then follows on a
       spring (pull, keep), tilting with its speed and lifted 3.5%; let go, it springs to its place and squashes as it
       lands. Where it'll go follows the pointer, not the spring */
    const D = M.drag, still = reduced();
    let dx = 0, dy = 0, x = 0, y = 0, vx = 0, vy = 0, free = still || D.stick === 0, spring = 0;
    const paint = (tilt, a, s1, s2) => { el.style.transform = 'translate(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px) rotate(' + tilt.toFixed(2) + 'deg) rotate(' + a + 'rad) scale(' + s1.toFixed(4) + ',' + s2.toFixed(4) + ') rotate(' + -a + 'rad)'; };
    const frame = () => {
      spring = requestAnimationFrame(frame);
      if (still) { x = dx; y = dy; paint(0, 0, 1, 1); return; }
      if (!free) { const t = Math.min(Math.hypot(dx, dy) / Math.max(1, D.stick), 1); x = dx * 0.35; y = dy * 0.35; paint(0, Math.atan2(dy, dx), 1 + 0.155 * t, 1 - 0.1 * t); return; }
      vx = springStep(vx, dx - x, D.pull / 100, D.keep / 100); vy = springStep(vy, dy - y, D.pull / 100, D.keep / 100); x += vx; y += vy;
      const sp = Math.hypot(vx, vy), st = Math.min(sp / 48, 1), tilt = Math.max(-D.tilt, Math.min(D.tilt, vx * 0.32)), lift = 1 + D.lift / 100;
      paint(tilt, Math.atan2(vy, vx), lift * (1 + 0.1 * st), lift * (1 - 0.063 * st));
    };
    const move = (e) => {
      dx = (e.clientX - x0) / boardScale(); dy = (e.clientY - y0) / boardScale();
      if (!started) { if (Math.hypot(dx, dy) < 4) return; started = true; drag = { key: it.key, col: p.col, row: p.row }; el.classList.add('tfDragging', 'mvDrag'); spring = requestAnimationFrame(frame); }
      if (!free && Math.hypot(dx, dy) > D.stick) { free = true; vx = dx * 0.085; vy = dy * 0.085; }
      drag.col = Math.round((p.x + dx) / (w + PEG_GAP));
      drag.row = Math.round((p.y + dy - boardTop) / ROW_PITCH);
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; layoutBoard(); });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      if (!started) return;
      // the click that ends a drag doesn't open the card's page or popup too (Matt, 11 Nov)
      const eat = (e) => { e.preventDefault(); e.stopImmediatePropagation(); };
      window.addEventListener('click', eat, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', eat, { capture: true }), 300);
      cancelAnimationFrame(raf);
      cancelAnimationFrame(spring);
      // where it is on screen now, to slide from once it's in its place
      const was = el.getBoundingClientRect(), key = it.key;
      el.style.transition = 'none'; // it slides from where it was dropped (below), not from its old place as well
      layoutBoard();
      el.classList.remove('tfDragging', 'mvDrag');
      el.style.transform = '';
      drag = null;
      saveCells(dashPrefs(), cellsNow());
      layoutBoard();
      refresh();
      const now = boardItems().find((x2) => x2.key === key)?.el;
      requestAnimationFrame(() => { el.style.transition = ''; if (now) now.style.transition = ''; });
      if (!now || still) return;
      now.style.transition = 'none';
      const r = now.getBoundingClientRect();
      const fx = was.left + was.width / 2 - (r.left + r.width / 2), fy = was.top + was.height / 2 - (r.top + r.height / 2);
      now.style.zIndex = '20';
      const a = now.animate([{ transform: 'translate(' + fx + 'px,' + fy + 'px) scale(' + (1 + D.lift / 100) + ')' }, { transform: 'none' }], { duration: D.slide, easing: EASE.land });
      a.finished.then(() => { now.style.zIndex = ''; squash(now); }, () => { now.style.zIndex = ''; });
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
    if (!areaRooms.some((r) => r.id === activeArea)) activeArea = firstArea(areaRooms);
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
    // an area's page follows Home Assistant's area view (Matt, 26 Nov), and says so in its top left corner
    if (page.room) out.push({ key: 'areanote', html: '<p class="hcNotDesigned hcAreaNote" data-tf data-k="areanote" style="order:' + (++order) + '">This follows the same pattern as current Home Assistant. Check the <a href="https://mbb365.github.io/homecore-labs/" target="_blank" rel="noopener">HomeCore Labs</a> for ideas on how to update this.</p>' });
    out.push({ key: 'areahead', html: areaHead(page, ++order) });
    // an area's page isn't designed yet: it says so under its header (Matt, 16 Nov: "this is not designed", "below the
    // header")
    // Edit area card opens over the area's page, as Home Assistant's card editor does (Matt, 26 Nov)
    const editingCard = Boolean(page.room && aceArea === page.room.id);
    if (aceArea && !editingCard) { aceArea = null; acePick = null; }
    app.classList.toggle('hcSecEditing', editingCard);
    if (page.key === 'weather') { out.weather = ++order; return out; }
    if (page.demo) return demoPage(out, page.key, order);
    if (page.room) { areaView(out, page.room, order); if (editingCard) out.push({ key: 'areaedit', html: aceHtml(page.room, 9999) }); return out; }
    // the section: a room's energy, readings and plants, then its tiles
    const ids = page.ids, name = page.room ? page.room.id : page.key, r = page.room;
    if (r?.solar.length) out.push({ key: 'energy:' + r.id, html: energyCard(r, ++order) });
    if (r && (r.readings.length || r.power != null)) out.push({ key: 'readings:' + r.id, html: roomCard(r, ++order) });
    r?.plants.forEach((p) => out.push({ key: 'plant:' + p.id, html: plantCard(p, ++order) }));
    const tileIds = [...ids, ...(r?.plugs || []).filter((x) => !ids.includes(x))];
    if (tileIds.length) out.push({ key: 'block:' + name, order: ++order, tiles: tileIds.map((id) => ({ key: id, html: actionTile(id) })) });
    return out;
  }
  /* an area's page as Home Assistant's area view (its areas strategy, Matt 26 Nov: "more like the current Home Assistant
     version, but give it the home core like treatment"): its temperature and humidity as badges under the header, then
     its devices in Home Assistant's groups (Lights, Covers, Climate, Media players, Security, Actions, Others), each
     headed with its icon and name. Each is HomeCore's tile, with the one feature Home Assistant gives it (a light's
     brightness, a cover's open and close, a thermostat's target, a fan's speed, an alarm's modes, a lock's commands),
     which makes it the action card; nothing else, and the tile stays a tile */
  const AREA_GROUPS = [
    ['lights', 'Lights', 'M10 2L12 9H2L4 2M6 10H8V20H11V22H3V20H6V10M20 8L22 15H12L14 8M16 16H18V20H21V22H13V20H16V16Z'],
    ['covers', 'Covers', 'M20 19V3H4V19H2V21H22V19H20M16 9H18V11H16V9M14 11H6V9H14V11M18 7H16V5H18V7M14 5V7H6V5H14M6 19V13H14V14.82C13.55 15.14 13.25 15.66 13.25 16.25C13.25 17.22 14.03 18 15 18S16.75 17.22 16.75 16.25C16.75 15.66 16.45 15.13 16 14.82V13H18V19H6Z'],
    ['climate', 'Climate', 'M19 8C20.11 8 21 8.9 21 10V16.76C21.61 17.31 22 18.11 22 19C22 20.66 20.66 22 19 22C17.34 22 16 20.66 16 19C16 18.11 16.39 17.31 17 16.76V10C17 8.9 17.9 8 19 8M19 9C18.45 9 18 9.45 18 10V11H20V10C20 9.450 19.55 9 19 9M5 20V12H2L12 3L16.4 6.96C15.54 7.69 15 8.78 15 10V16C14.37 16.83 14 17.870 14 19L14.1 20H5Z'],
    ['media_players', 'Media players', 'M9 13V5C9 3.9 9.9 3 11 3H20C21.1 3 22 3.9 22 5V11H18.57L17.29 9.26C17.23 9.17 17.11 9.17 17.05 9.26L15.06 12C15 12.06 14.88 12.07 14.82 12L13.39 10.25C13.33 10.18 13.22 10.18 13.16 10.25L11.05 12.91C10.97 13 11.04 13.15 11.16 13.15H17.5V15H11C9.89 15 9 14.11 9 13M6 22V21H4V22H2V2H4V3H6V2H8.39C7.54 2.74 7 3.8 7 5V13C7 15.21 8.79 17 11 17H15.7C14.67 17.83 14 19.08 14 20.5C14 21.03 14.11 21.53 14.28 22H6M4 7H6V5H4V7M4 11H6V9H4V11M4 15H6V13H4V15M6 19V17H4V19H6M23 13V15H21V20.5C21 21.88 19.88 23 18.5 23S16 21.88 16 20.5 17.12 18 18.5 18C18.86 18 19.19 18.07 19.5 18.21V13H23Z'],
    ['security', 'Security', 'M12,12H19C18.47,16.11 15.72,19.78 12,20.92V12H5V6.3L12,3.19M12,1L3,5V11C3,16.55 6.84,21.73 12,23C17.16,21.73 21,16.55 21,11V5L12,1Z'],
    ['actions', 'Actions', 'M12,2A2,2 0 0,1 14,4C14,4.74 13.6,5.39 13,5.73V7H14A7,7 0 0,1 21,14H22A1,1 0 0,1 23,15V18A1,1 0 0,1 22,19H21V20A2,2 0 0,1 19,22H5A2,2 0 0,1 3,20V19H2A1,1 0 0,1 1,18V15A1,1 0 0,1 2,14H3A7,7 0 0,1 10,7H11V5.73C10.4,5.39 10,4.74 10,4A2,2 0 0,1 12,2M7.5,13A2.5,2.5 0 0,0 5,15.5A2.5,2.5 0 0,0 7.5,18A2.5,2.5 0 0,0 10,15.5A2.5,2.5 0 0,0 7.5,13M16.5,13A2.5,2.5 0 0,0 14,15.5A2.5,2.5 0 0,0 16.5,18A2.5,2.5 0 0,0 19,15.5A2.5,2.5 0 0,0 16.5,13Z'],
    ['others', 'Others', 'M11,13.5V21.5H3V13.5H11M12,2L17.5,11H6.5L12,2M17.5,13C20,13 22,15 22,17.5C22,20 20,22 17.5,22C15,22 13,20 13,17.5C13,15 15,13 17.5,13Z'],
  ];
  function areaGroupOf(id) {
    const d = id.split('.')[0], dc = attr(id).device_class;
    if (d === 'light') return 'lights';
    if (d === 'cover' || (d === 'binary_sensor' && ['door', 'garage_door', 'window'].includes(dc))) return 'covers';
    if (['climate', 'humidifier', 'water_heater', 'fan'].includes(d)) return 'climate';
    if (d === 'media_player') return 'media_players';
    if (['alarm_control_panel', 'lock', 'camera'].includes(d)) return 'security';
    if (['script', 'scene', 'automation'].includes(d)) return 'actions';
    if (['vacuum', 'lawn_mower', 'valve', 'switch', 'button', 'input_boolean', 'input_button', 'select', 'number', 'input_select', 'input_number', 'counter', 'timer'].includes(d)) return 'others';
    return null;
  }
  // Home Assistant's one feature for a tile in an area (its computeAreaTileCardConfig)
  function areaFeature(id) {
    const d = id.split('.')[0];
    if (!['light', 'cover', 'climate', 'fan', 'alarm_control_panel', 'lock'].includes(d)) return [];
    const parts = specFor(id)?.parts || [];
    return d === 'cover' ? (parts.includes('buttons') ? ['buttons'] : []) : parts.slice(0, 1);
  }
  function areaView(out, r, order) {
    const h = getHass(), shown = (id) => { const e = h?.entities?.[id]; return states[id] && states[id].state !== 'unavailable' && !e?.hidden && !e?.entity_category; };
    const ids = [...new Set([...r.actions, ...r.plugs, ...(r.locks || []), ...r.openings, ...Object.keys(states).filter((id) => model.areaOf?.(id) === r.id)])].filter(shown);
    // its temperature and humidity, as Home Assistant's badges
    const reading = (cls) => r.readings.find((id) => attr(id).device_class === cls);
    const badges = [reading('temperature'), reading('humidity')].filter(Boolean);
    if (badges.length) out.push({ key: 'areabadges', html: '<div class="hcAreaBadges" data-tf data-k="areabadges" style="order:' + (++order) + '">' +
      badges.map((id) => '<button class="hcAreaBadge" type="button" data-more="' + esc(id) + '" aria-label="' + esc(nameOf(id) + ', ' + valueOf(id)) + '"><span class="tfIcon"' + iconSlot(id, attr(id).icon || '') + '></span><span>' + esc(valueOf(id)) + '</span></button>').join('') + '</div>' });
    AREA_GROUPS.forEach(([g, label, path]) => {
      const mine = ids.filter((id) => areaGroupOf(id) === g);
      if (!mine.length) return;
      out.push({ key: 'agroup:' + g, html: '<h2 class="hcAreaGroupHead" data-tf data-k="agroup:' + g + '" style="order:' + (++order) + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + path + '"/></svg>' + esc(label) + '</h2>' });
      out.push({ key: 'block:' + r.id + ':' + g, order: ++order, tiles: mine.map((id) => ({ key: id, html: actionTile(id, false, areaFeature(id)) })) });
    });
    if (!ids.some(areaGroupOf)) out.push({ key: 'areanone', html: '<p class="tfDashNone" data-tf data-k="areanone" style="order:' + (++order) + '">Nothing in this area yet.</p>' });
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
  /* Edit area card (Matt, 23 Nov), on the area's page: its card as Home has it (two columns wide, Large), its main and four
     spaces to drop into (an empty one dashed), and under it everything in the area, by device, each with its icon, name
     and state. Drag one onto a space, or tap it and then the space (the keyboard too): the card is drawn again straight
     away with real values. Onto a full space they swap; a space dragged (or tapped, then the list) back to the list is
     emptied. Each thing is in one place at a time. Kept with the rest of the page's settings */
  let aceArea = null, acePick = null, aceDrag = null, aceNoClick = 0;
  const aceRoom = () => areaRooms.find((r) => r.id === aceArea);
  const slotGet = (c, sl) => (sl === 'main' ? c.main : c.slots[sl]);
  const slotPut = (c, sl, v) => { if (sl === 'main') c.main = v; else c.slots[sl] = v; };
  const slotOf = (c, item) => (c.main === item ? 'main' : c.slots.indexOf(item) >= 0 ? c.slots.indexOf(item) : null);
  const slotParse = (v) => (v === 'main' ? 'main' : Number(v));
  const slotName = (sl) => (sl === 'main' ? 'Main' : 'Space ' + (sl + 1));
  // everything in the area: its card's own keys first (the lights together, the covers…), then its entities by device
  function aceGroups(r) {
    const keys = roomKeys(r), h = getHass();
    const ids = [...new Set([...r.actions, ...r.plugs, ...(r.locks || []), ...r.readings, ...r.openings, ...r.solar, ...(r.alerts || []), ...(r.statuses || []), ...r.plants.flatMap((pl) => [pl.id, ...pl.readings])])].filter((id) => states[id]);
    const byDev = new Map();
    ids.forEach((id) => {
      const dev = h?.devices?.[h?.entities?.[id]?.device_id], name = (dev && (dev.name_by_user || dev.name)) || nameOf(id);
      if (!byDev.has(name)) byDev.set(name, []);
      byDev.get(name).push(id);
    });
    const own = keys.filter((k) => k.kind === 'control').map((k) => 'key:' + k.key);
    return [...(own.length ? [{ name: r.name + ' as a whole', items: own }] : []), ...[...byDev].map(([name, items]) => ({ name, items }))];
  }
  const ACE_CHECK = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function aceRow(r, item, c, keys) {
    const k = slotKey(r, item, keys), at = slotOf(c, item);
    if (!k) return '';
    const icon = item.startsWith('key:') ? '<span class="tfIcon" aria-hidden="true">' + k.icon + '</span>' : '<span class="tfIcon" aria-hidden="true"' + iconSlot(item) + '></span>';
    const name = item.startsWith('key:') ? k.label : nameOf(item);
    return '<button class="activityRow hcAceRow' + (at != null ? ' hcAceUsed' : '') + '" type="button" data-ace-item="' + esc(item) + '" aria-pressed="' + (acePick?.item === item && acePick.slot == null) + '" aria-label="' + esc(name + ', ' + k.value + (at != null ? '. On the card: ' + slotName(at) : '') + '. Pick to place it') + '">' +
      icon + '<span class="hcAceText"><span class="activityRowName">' + esc(name) + '</span><span class="activityRowMeta">' + esc(k.value) + '</span></span>' +
      (at != null ? '<span class="hcAceAt">' + ACE_CHECK + 'On the card · ' + slotName(at) + '</span>' : '') + '</button>';
  }
  // a popup as Add to dashboard's card editor is (Matt, 26 Nov: "the stuff you play with on the left-hand side and the
  // preview on the right-hand side"): on the left each of the card's spaces with what lives there, picked from what's in the
  // area as an entity is picked (Matt, 26 Nov: "we click on that space, then we can choose what lives there"); the card on
  // the right, where tapping a space opens its picker; "This is an idea" at the head's right, then Done
  function aceHtml(r, order) {
    const c = areaCard(r), keys = roomKeys(r), size = AREA_SIZES.l, groups = aceGroups(r);
    const label = (it) => { const k = it && slotKey(r, it, keys); return k ? (it.startsWith('key:') ? k.label : nameOf(it)) + ' · ' + k.value : ''; };
    // a space's picker: its button, and under it the list (it drops down from the field, not over the page as the Mac's own
    // menu did: Matt, 26 Nov), what's already in another space greyed out
    const option = (sl, it, now) => {
      const text = label(it);
      if (!text) return '';
      const taken = slotOf(c, it) != null && it !== now;
      return '<button class="hcAceOpt" type="button" role="option" aria-selected="' + (it === now) + '"' + (taken ? ' aria-disabled="true"' : '') + ' data-ace-choose="' + sl + '|' + esc(it) + '">' + esc(text) + '</button>';
    };
    const picker = (sl) => {
      const now = slotGet(c, sl);
      return '<div class="hcInfoField hcAceField" data-ace-field="' + sl + '"><span class="hcInfoFieldLabel" id="hcAceL' + sl + '">' + slotName(sl) + '</span><div class="hcAcePick">' +
        '<button class="hcInfoInput hcAcePickBtn" type="button" data-ace-open="' + sl + '" aria-haspopup="listbox" aria-expanded="false" aria-labelledby="hcAceL' + sl + ' hcAceV' + sl + '"><span id="hcAceV' + sl + '">' + esc(label(now) || 'Empty') + '</span>' + CHEVRON + '</button>' +
        '<div class="card hcAceMenu" role="listbox" aria-labelledby="hcAceL' + sl + '" hidden>' +
          '<button class="hcAceOpt hcAceEmpty" type="button" role="option" aria-selected="' + (now == null) + '" data-ace-choose="' + sl + '|">Empty</button>' +
          groups.map((g) => { const opts = g.items.map((it) => option(sl, it, now)).join(''); return opts ? '<div class="hcAceGroupName">' + esc(g.name) + '</div>' + opts : ''; }).join('') +
        '</div></div></div>';
    };
    return '<div class="hcSecBack hcAceBack" data-tf data-k="areaedit" style="order:' + order + '">' +
      '<section class="hcAce hcLe hcSecDialog hcSecEditDialog hcAceDialog" role="dialog" aria-modal="true" aria-labelledby="hcAceTitle">' +
      '<div class="hcLeHead hcSecHeadBorder"><button class="tfBack" type="button" data-ace-toggle aria-label="Close">' + CLOSE + '</button><div class="activityTitle" id="hcAceTitle">Edit ' + esc(r.name) + ' card</div><span class="hcAceIdea">This is an idea</span></div>' +
      '<div class="hcLeBody hcSecEditBody">' +
        '<div class="hcLeSide hcSecForm hcAceFields">' + ['main', 0, 1, 2, 3].map(picker).join('') + '</div>' +
        '<div class="hcLePreviewWrap hcAcePreview">' +
          '<div class="hcAceCard" style="--ace-w:' + (2 * size.w + PEG_GAP) + 'px;--ace-h:' + size.h + 'px">' + roomTile(r, null, ' data-cols="2" data-rows="' + size.rows + '"', true) + '</div>' +
          '<p class="hcAceHint">Pick what lives in each space, or tap a space on the card.</p><p class="hcAceHint">Drag one space onto another to swap them.</p></div>' +
      '</div>' +
      '<div class="hcLeFoot"><button class="primary" type="button" data-ace-toggle>Done</button></div>' +
      '</section></div>';
  }
  // a move, kept and drawn again; the focus goes back where it was
  function aceMove(src, target) {
    const r = aceRoom();
    if (!r) return;
    const c = areaCard(r), from = src.slot != null ? src.slot : slotOf(c, src.item);
    if (target === 'list') { if (from == null) { acePick = null; aceMark(); return; } slotPut(c, from, null); }
    else { const old = slotGet(c, target); slotPut(c, target, src.item); if (from != null && from !== target) slotPut(c, from, old); }
    prefs = { ...prefs, areaCards: { ...(prefs.areaCards || {}), [r.id]: c } };
    savePrefs();
    acePick = null;
    const was = root.activeElement, sel = was?.dataset?.aceOpen != null ? '[data-ace-open="' + was.dataset.aceOpen + '"]' : was?.dataset?.slot != null ? '[data-slot="' + was.dataset.slot + '"]' : was?.dataset?.aceItem ? '[data-ace-item="' + CSS.escape(was.dataset.aceItem) + '"]' : null;
    render();
    if (sel) grid.querySelector('.hcAce ' + sel)?.focus({ preventScroll: true });
  }
  // what's picked shows: its row pressed, its space outlined, and every space ready to take it
  function aceMark() {
    const ace = grid.querySelector('.hcAce');
    if (!ace) return;
    ace.classList.toggle('hcAcePicking', Boolean(acePick));
    ace.querySelectorAll('[data-ace-item]').forEach((b) => b.setAttribute('aria-pressed', String(acePick?.slot == null && acePick?.item === b.dataset.aceItem)));
    ace.querySelectorAll('.hcAceCard [data-slot]').forEach((b) => b.classList.toggle('hcPicked', acePick?.slot != null && String(acePick.slot) === b.dataset.slot));
  }
  // one space's list open at a time, under its field (or above it where the popup has no room below)
  function aceMenu(sl) {
    grid.querySelectorAll('.hcAce [data-ace-open]').forEach((b) => {
      const open = sl != null && b.dataset.aceOpen === String(sl), menu = b.nextElementSibling;
      b.setAttribute('aria-expanded', String(open));
      menu.hidden = !open;
      if (!open) return;
      const box = b.closest('.hcAceDialog').getBoundingClientRect(), at = b.getBoundingClientRect();
      menu.classList.toggle('up', at.bottom + Math.min(menu.scrollHeight, 300) + 12 > box.bottom - 70 && at.top - box.top > box.bottom - at.bottom);
      (menu.querySelector('[aria-selected="true"]') || menu.querySelector('.hcAceOpt'))?.focus({ preventScroll: true });
      menu.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
    });
  }
  function aceToggle() {
    const r = areaRooms.find((x) => 'room:' + x.id === areaPage);
    aceArea = aceArea ? null : r?.id || null;
    acePick = null;
    render();
    grid.querySelector(aceArea ? '.hcAceDialog [data-ace-toggle]' : '.hcAceToggle')?.focus({ preventScroll: true });
  }
  function bindAce() {
    grid.addEventListener('click', (ev) => {
      if (ev.target.closest?.('[data-ace-toggle]') || ev.target.classList?.contains('hcAceBack')) { ev.stopPropagation(); ev.preventDefault(); aceToggle(); return; }
      const ace = ev.target.closest?.('.hcAce');
      if (!ace) return;
      // nothing on the card works while it's being edited: a tap places, picks or takes away
      ev.stopPropagation(); ev.preventDefault();
      const opener = ev.target.closest('[data-ace-open]'), choice = ev.target.closest('[data-ace-choose]');
      if (choice) {
        if (choice.getAttribute('aria-disabled') === 'true') return;
        const [slRaw, ...rest] = choice.dataset.aceChoose.split('|'), item = rest.join('|'), sl = slotParse(slRaw), had = slotGet(areaCard(aceRoom()), sl);
        aceMenu(null);
        if (item) aceMove({ item }, sl); else if (had != null) aceMove({ item: had, slot: sl }, 'list');
        grid.querySelector('.hcAce [data-ace-open="' + slRaw + '"]')?.focus({ preventScroll: true });
        return;
      }
      if (opener) { aceMenu(opener.getAttribute('aria-expanded') === 'true' ? null : opener.dataset.aceOpen); return; }
      aceMenu(null);
      if (performance.now() < aceNoClick) return;
      const c = areaCard(aceRoom()), slotEl = ev.target.closest('.hcAceCard [data-slot]'), row = ev.target.closest('[data-ace-item]');
      if (slotEl) {
        // a space on the card opens its picker
        aceMenu(slotEl.dataset.slot);
        return;
      }
      if (row) {
        if (acePick?.slot != null) { aceMove(acePick, 'list'); return; }
        acePick = acePick?.item === row.dataset.aceItem ? null : { item: row.dataset.aceItem };
        aceMark();
        return;
      }
      if (ev.target.closest('.hcAceList') && acePick?.slot != null) aceMove(acePick, 'list');
    }, true);
    grid.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Escape' || !aceArea) return;
      if (grid.querySelector('.hcAceMenu:not([hidden])')) { ev.stopPropagation(); ev.preventDefault(); const sl = grid.querySelector('.hcAceMenu:not([hidden])').closest('[data-ace-field]').dataset.aceField; aceMenu(null); grid.querySelector('.hcAce [data-ace-open="' + sl + '"]')?.focus(); return; }
      ev.stopPropagation(); ev.preventDefault();
      if (acePick) { acePick = null; aceMark(); } else aceToggle();
    }, true);
    // dragging: with a mouse or pen once it's moved 6, with a finger once it's been held a moment (so the page still
    // scrolls under a swipe); a copy of what's dragged follows the pointer, and what it's over is outlined
    grid.addEventListener('touchmove', (ev) => { if (aceDrag?.on) ev.preventDefault(); }, { passive: false });
    grid.addEventListener('pointerdown', (ev) => {
      const ace = ev.target.closest?.('.hcAce');
      if (!ace || ev.button || !ev.isPrimary) return;
      const c = areaCard(aceRoom()), slotEl = ev.target.closest('.hcAceCard [data-slot]'), row = ev.target.closest('[data-ace-item]');
      const src = slotEl ? { item: slotGet(c, slotParse(slotEl.dataset.slot)), slot: slotParse(slotEl.dataset.slot), el: slotEl } : row ? { item: row.dataset.aceItem, el: row } : null;
      if (!src?.item) return;
      const touch = ev.pointerType === 'touch', x0 = ev.clientX, y0 = ev.clientY;
      let x = x0, y = y0, ghost = null, over = null;
      const drag = aceDrag = { on: false };
      const begin = () => {
        drag.on = true;
        const k = slotKey(aceRoom(), src.item, roomKeys(aceRoom()));
        ghost = Object.assign(document.createElement('div'), { className: 'hcAceGhost' });
        ghost.innerHTML = '<span class="tfIcon">' + (src.el.querySelector('.tfIcon')?.innerHTML || '') + '</span><span class="activityRowName">' + esc(k?.label || '') + '</span>';
        app.appendChild(ghost);
        ace.classList.add('hcAceDragging');
        moveTo();
      };
      const targetAt = () => { const el = root.elementFromPoint(x, y); return el?.closest('.hcAceCard [data-slot]') || (el?.closest('.hcAceList') ? ace.querySelector('.hcAceList') : null); };
      const moveTo = () => {
        ghost.style.transform = 'translate(' + (x + 12) + 'px,' + (y + 12) + 'px)';
        const t = targetAt();
        if (t !== over) { over?.classList.remove('hcOver'); over = t; over?.classList.add('hcOver'); }
      };
      const hold = touch ? setTimeout(begin, 280) : 0;
      const move = (e) => {
        if (e.pointerId !== ev.pointerId) return;
        x = e.clientX; y = e.clientY;
        if (!drag.on) { if (Math.hypot(x - x0, y - y0) >= BAR_SLOP) { if (touch) end(); else begin(); } return; }
        moveTo();
      };
      const end = (e) => {
        clearTimeout(hold);
        removeEventListener('pointermove', move, true); removeEventListener('pointerup', end, true); removeEventListener('pointercancel', end, true);
        if (aceDrag === drag) aceDrag = null;
        if (!drag.on) return;
        ghost?.remove(); over?.classList.remove('hcOver'); ace.classList.remove('hcAceDragging');
        aceNoClick = performance.now() + 400;
        if (e?.type !== 'pointerup' || !over) return;
        aceMove(src, over.dataset.slot != null ? slotParse(over.dataset.slot) : 'list');
      };
      addEventListener('pointermove', move, true); addEventListener('pointerup', end, true); addEventListener('pointercancel', end, true);
    });
  }
  /* Home's time and date and its weather, as HomeCore Labs has them (Matt, 26 Nov): the time and date end where the
     summaries end, on the name's line, in a thin type the greeting's size; above them the weather, no background: its
     icon (the weather card's own, which opens its more info), what it's doing, the temperature */
  const wxClock = () => {
    const now = new Date(), lang = getHass()?.locale?.language || undefined;
    return now.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' }) + '  ' + now.toLocaleDateString(lang, { weekday: 'long', day: 'numeric', month: 'long' });
  };
  setInterval(() => { grid?.querySelectorAll('[data-wx-clock]').forEach((c) => { const t = wxClock(); if (c.textContent !== t) c.textContent = t; }); alignHomeClock(); }, 10000);
  const WX_WORDS = { sunny: 'Sunny', 'clear-night': 'Clear', partlycloudy: 'Partly cloudy', cloudy: 'Cloudy', fog: 'Fog', rainy: 'Rain', pouring: 'Heavy rain', snowy: 'Snow',
    'snowy-rainy': 'Sleet', hail: 'Hail', lightning: 'Thunder', 'lightning-rainy': 'Thunderstorms', windy: 'Windy', 'windy-variant': 'Windy', exceptional: 'Unsettled' };
  function homeWxTile() {
    const id = weatherId(), st = id && states[id];
    if (!st) return '';
    const t = st.attributes?.temperature, unit = st.attributes?.temperature_unit || '';
    const art = wbSmoothIcon(st.state, false, st.state === 'clear-night', 'homewx'), kind = 'wb' + art.k[0].toUpperCase() + art.k.slice(1) + (art.night ? ' wbNight' : '');
    return '<span class="hcHomeWx"><button class="hcHomeWxIcon" type="button" data-more="' + esc(id) + '" aria-label="' + esc(nameOf(id)) + ', more info" title="Weather">' +
      '<span class="wbWx ' + kind + '" aria-hidden="true">' + art.svg + '</span></button>' +
      '<span class="hcHomeWxWords">' + esc(WX_WORDS[st.state] || cap(st.state)) + '</span>' + (t != null ? '<span class="hcHomeWxTemp">' + esc(Math.round(t) + unit) + '</span>' : '') + '</span>';
  }
  function alignHomeClock() {
    const title = grid?.querySelector('.tfDashTitle'), bar = grid?.querySelector('.tfDashBarRow > *');
    if (!overview || !title || !bar) return;
    const tr = title.getBoundingClientRect(), right = tr.right;
    title.style.setProperty('--sums-end', Math.max(0, Math.round(right - bar.getBoundingClientRect().right)) + 'px');
    const clock = title.querySelector('.hcHomeClock');
    if (clock) title.style.setProperty('--wx-above', Math.round(tr.bottom - clock.getBoundingClientRect().top + 8) + 'px');
    // clear of the page's pencil, which sits up there too
    const wx = title.querySelector('.hcHomeWx'), pen = $('dashEditNav')?.getBoundingClientRect();
    if (wx) {
      const end = right - bar.getBoundingClientRect().right, r = wx.getBoundingClientRect(), top = tr.bottom - (parseFloat(getComputedStyle(title).getPropertyValue('--wx-above')) || 40) - r.height;
      const hits = pen?.width && pen.bottom > top && pen.top < top + r.height;
      title.style.setProperty('--wx-end', Math.round(hits ? Math.max(end, right - pen.left + 12) : end) + 'px');
    }
  }
  const areaHead = (x, order) => '<div class="settingsHeader tfAreaHead" data-tf data-k="areahead" style="order:' + order + '">' +
    '<button class="back" type="button" data-area-back aria-label="Back to the house">' + BACK + '</button><div class="settingsTitle">' + esc(x.name) + '</div>' +
    // an area's page edits its card (Matt, 23 Nov: "You should edit the area card by going to the area page itself")
    (x.room ? '<button class="pill hcAceToggle" type="button" data-ace-toggle>Edit area card</button>' : '') + '</div>';
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
    aceArea = null; acePick = null;
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
    stale = false;
    if (!grid.querySelector('[data-tf]')) { render(); return; }
    const out = layout();
    if (signOf(out) !== signature) { render(); return; }
    // a tile is held while one of its device's bars or drawing is (a favourite holds its device too)
    const isHeld = (key) => lockedKeys().some((k) => {
      const id = k.slice(k.indexOf('|') + 1);
      return key === id || key.endsWith(':' + id);
    });
    out.forEach((n) => (n.tiles || [n]).forEach((u) => {
      if (units.get(u.key) === u.html) return;
      if (isHeld(u.key) || (u.key === 'areas' && areaSliding)) { stale = true; return; }
      const el = grid.querySelector('[data-k="' + CSS.escape(u.key) + '"]');
      if (!el) return;
      units.set(u.key, u.html);
      replace(el, u.html);
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
    valve: (a) => [['Position', a.current_position != null ? a.current_position + '% open' : null]],
    fan: (a) => [['Speed', a.percentage != null ? a.percentage + '%' : null], ['Oscillating', a.oscillating != null ? (a.oscillating ? 'Yes' : 'No') : null], ['Direction', a.direction && cap(a.direction)]],
    water_heater: (a) => [['Current temperature', a.current_temperature != null ? a.current_temperature + ' °C' : null], ['Target', a.temperature != null ? a.temperature + ' °C' : null], ['Mode', a.operation_mode && cap(a.operation_mode)], ['Away', a.away_mode && cap(a.away_mode)]],
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
  // a device opened from inside a popup (a summary's lock) opens over the top of it (Matt, 11 Nov): the popup it came
  // from parks here, where it was, dimmed and inert under the new one, and is back when that one closes
  const under = document.createElement('div');
  under.className = 'tfMoreBackdrop tfMoreUnder';
  under.hidden = true;
  app.insertBefore(under, sheet);
  // a popup knows when something has scrolled under its pinned head (hcScrolled), so a see-through one can leave its
  // head clear until then (look.js; Matt, 24 Nov)
  app.addEventListener('scroll', (ev) => { const t = ev.target; if (t.classList?.contains('tfMore') || t.classList?.contains('tfMoreSideInner')) t.classList.toggle('hcScrolled', t.scrollTop > 0); }, true);
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
  // the icon picker (Home Assistant's: type to search, each icon shown beside its name, pick one): the icons this page
  // can draw, from Material Design Icons as Home Assistant names them
  let iconNames = null;
  const loadIconNames = () => iconNames ? Promise.resolve(iconNames) : import('./demo-icons.js').then((m) => (iconNames = [...new Set([...Object.keys(m.DEMO_ICONS), ...Object.keys(HC_FROM_MDI)])].filter((n) => n.startsWith('mdi:')).sort()));
  function showIcons(input) {
    const list = input.closest('.hcIconPick')?.querySelector('.hcIconList');
    if (!list) return;
    loadIconNames().then((names) => {
      const q = input.value.trim().toLowerCase().replace(/^mdi:/, ''), hits = names.filter((n) => n.slice(4).includes(q));
      list.innerHTML = hits.length ? hits.map((n) => '<button class="hcIconOpt" type="button" role="option" tabindex="-1" data-icon-opt="' + esc(n) + '"><span class="tfIcon" data-icon-for="" data-icon-name="' + esc(n) + '"></span><span>' + esc(n) + '</span></button>').join('')
        : '<div class="hcIconNone">No icons match</div>';
      list.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      fillIcons(list);
    });
  }
  function hideIcons() {
    sheet.querySelectorAll('.hcIconList:not([hidden])').forEach((l) => { l.hidden = true; l.closest('.hcIconPick').querySelector('[data-icon-pick]').setAttribute('aria-expanded', 'false'); });
  }
  // the icon at the field's start follows what's typed or picked (its own when the field is empty)
  function previewIcon(input) {
    const chip = input.closest('.hcInfoFieldBox')?.querySelector('.hcInfoFieldIcon');
    if (!chip) return;
    const v = input.value.trim();
    chip.dataset.iconName = v.startsWith('mdi:') && v.length > 4 ? v : input.placeholder.startsWith('mdi:') && input.placeholder.length > 4 ? input.placeholder : '';
    if (!chip.dataset.iconName) delete chip.dataset.iconName;
    chip.textContent = '';
    delete chip.dataset.hc;
    fillIcons(chip.parentElement); // (it fills the icons inside what it's given)
  }
  sheet.addEventListener('focusin', (ev) => { if (ev.target.matches?.('[data-icon-pick]')) showIcons(ev.target); });
  sheet.addEventListener('input', (ev) => { if (ev.target.matches?.('[data-icon-pick]')) { showIcons(ev.target); previewIcon(ev.target); } });
  sheet.addEventListener('mousedown', (ev) => { if (ev.target.closest('.hcIconList')) ev.preventDefault(); }); // the field keeps its focus
  sheet.addEventListener('click', (ev) => {
    const opt = ev.target.closest('[data-icon-opt]');
    if (opt) { const input = opt.closest('.hcIconPick').querySelector('[data-icon-pick]'); input.value = opt.dataset.iconOpt; previewIcon(input); hideIcons(); return; }
    if (ev.target.matches?.('[data-icon-pick]')) { showIcons(ev.target); return; }
    if (!ev.target.closest('.hcIconPick')) hideIcons();
  });
  sheet.addEventListener('keydown', (ev) => {
    const input = ev.target.matches?.('[data-icon-pick]') ? ev.target : null, list = input?.closest('.hcIconPick')?.querySelector('.hcIconList');
    if (!input || !list || list.hidden) return;
    if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); hideIcons(); return; }
    const opts = [...list.querySelectorAll('[data-icon-opt]')], at = opts.findIndex((o) => o.classList.contains('active'));
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      ev.preventDefault();
      const next = opts[Math.max(0, Math.min(opts.length - 1, at + (ev.key === 'ArrowDown' ? 1 : -1)))];
      opts.forEach((o) => o.classList.toggle('active', o === next));
      next?.scrollIntoView({ block: 'nearest' });
    } else if (ev.key === 'Enter' && at > -1) { ev.preventDefault(); input.value = opts[at].dataset.iconOpt; previewIcon(input); hideIcons(); }
  });
  // a switch in a device's settings flips; Use device area off shows the area to pick
  sheet.addEventListener('click', (ev) => {
    const sw = ev.target.closest('.hcInfoSettings .switch');
    if (!sw) return;
    const on = !sw.classList.contains('on');
    sw.classList.toggle('on', on);
    sw.setAttribute('aria-checked', String(on));
    if (sw.dataset.setToggle === 'area') { const pick = sheet.querySelector('.hcInfoAreaPick'); if (pick) pick.hidden = on; }
  });
  // the head's menu closes with a click anywhere but its button
  sheet.addEventListener('click', (ev) => { if (ev.target.closest('[data-more-menu]')) return; sheet.querySelectorAll('.hcInfoMenu:not([hidden])').forEach((m) => { m.hidden = true; m.previousElementSibling.setAttribute('aria-expanded', 'false'); }); });
  sheet.addEventListener('touchstart', (ev) => { touchAt = { x: ev.touches[0].clientX, y: ev.touches[0].clientY }; }, { passive: true });
  sheet.addEventListener('touchmove', (ev) => {
    if (!touchAt || ev.touches.length > 1 || ev.target.closest?.('input,textarea,select')) return;
    const t = ev.touches[0], dx = touchAt.x - t.clientX, dy = touchAt.y - t.clientY;
    touchAt = { x: t.clientX, y: t.clientY };
    if (Math.abs(dy) >= Math.abs(dx) && !scrollsInside(ev.target, dy)) ev.preventDefault();
  }, { passive: false });
  sheet.addEventListener('wheel', (ev) => {
    if (Math.abs(ev.deltaX) > Math.abs(ev.deltaY) && ev.target.closest?.('[data-more-pages]')) return; // sideways: the pages
    if (!scrollsInside(ev.target, ev.deltaY)) ev.preventDefault();
  }, { passive: false });
  // phones (Matt, 11 Nov; rule popup.sheet): flick the sheet down to hide it. It follows the finger from its handle (the
  // sheet's ::before), its head, or its page once that's scrolled to its top; let go far enough down (120), or fast, and it's taken away, else
  // it springs back. A tap stays a tap: nothing moves under 8, and a drag's click is eaten
  const onPhone = () => window.innerWidth <= 620;
  let flick = null;
  sheet.addEventListener('pointerdown', (ev) => {
    const pair = sheet.querySelector('.tfMorePair');
    if (!onPhone() || !pair || !pair.contains(ev.target) || !ev.isPrimary || sheet._closing) return;
    if (ev.target.closest('input,textarea,select,.tfDacPad,[data-cover-art],.tfMoreSide,[data-drag],[data-blocks]')) return; // a slider, the blocks and the pad own their finger (18 Nov: the sheet grabbed a slider pulled down)
    flick = { x: ev.clientX, y: ev.clientY, t: performance.now(), dy: 0, v: 0, pair, from: ev.target, grab: ev.target.matches('.tfMore') || Boolean(ev.target.closest('.tfMoreHead')) };
  }, true);
  sheet.addEventListener('pointermove', (ev) => {
    if (!flick || !ev.isPrimary) return;
    const dy = ev.clientY - flick.y, now = performance.now();
    if (!flick.on) {
      if (Math.abs(ev.clientX - flick.x) > 8 || dy < -8 || (!flick.grab && scrollsInside(flick.from, -1))) { flick = null; return; }
      if (dy < 8) return;
      flick.on = true;
      try { sheet.setPointerCapture(ev.pointerId); } catch { /* a pointer that's gone */ }
    }
    flick.v = (dy - flick.dy) / Math.max(1, now - flick.t);
    flick.dy = dy; flick.t = now;
    flick.pair.style.transform = 'translateY(' + Math.max(0, dy) + 'px)';
  });
  const flickEnd = (ev) => {
    if (!flick || !ev.isPrimary) return;
    const f = flick;
    flick = null;
    if (!f.on) return;
    const eat = (e) => { e.preventDefault(); e.stopImmediatePropagation(); };
    window.addEventListener('click', eat, { capture: true, once: true });
    setTimeout(() => window.removeEventListener('click', eat, { capture: true }), 300);
    const away = ev.type === 'pointerup' && (f.dy > 120 || f.v > 0.5);
    const from = 'translateY(' + Math.max(0, f.dy) + 'px)';
    f.pair.style.transform = '';
    if (!away || reduced()) {
      if (away) closeMoreNow();
      else f.pair.animate([{ transform: from }, { transform: 'none' }], { duration: 320, easing: EASE.spring });
      return;
    }
    const was = more;
    sheet._closing = true;
    sheet.style.pointerEvents = 'none';
    sheet.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: EASE.exit, fill: 'forwards' });
    const a = f.pair.animate([{ transform: from }, { transform: 'translateY(calc(100% + 40px))' }], { duration: 220, easing: EASE.exit, fill: 'forwards' });
    let called = false;
    const go = () => { if (called) return; called = true; sheet._closing = false; sheet.style.pointerEvents = ''; sheet.getAnimations().forEach((x) => x.cancel()); f.pair.getAnimations().forEach((x) => x.cancel()); if (more === was) closeMoreNow(); };
    a.finished.then(go, go);
    setTimeout(go, 300);
  };
  sheet.addEventListener('pointerup', flickEnd);
  sheet.addEventListener('pointercancel', flickEnd);
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
    const s = ACTION_DOMAINS.includes(d) || TOGGLES.includes(d) ? specFor(id) : quickSpec(id);
    const pop = popOf(id), view = more?.view || '', mode = more?.mode || '';
    if (more) { more.page = 0; more.pages = 1; }
    // Home Assistant's more info (Matt, 26 Nov: "more like the more info cards are now, but to look like home core"):
    // the head, the state and when it changed, the device's controls; History and Details are views of their own
    // an Activity row's entry (Matt, 26 Nov, Home Assistant's logbook entry): the name and its state, which opens its controls,
    // then its history and what happened to it, each with Show more
    if (view === 'log') return [haHead(id, null, true), logEntity(id), logGroup('History', historyOf(id, false)), logGroup('Activity', '<div class="hcLogList" data-log="' + esc(id) + '"></div>')];
    if (view === 'history') return [haHead(id, 'History'), historyOf(id, false), activityOf(id)];
    if (view === 'details') return [haHead(id, 'Details'), infoOf(id)];
    if (view === 'settings') return [haHead(id, 'Settings'), settingsOf(id), '<div class="hcInfoFoot"><button class="hcInfoDelete" type="button" data-oops>Delete</button><button class="primary" type="button" data-settings-save>Update</button></div>'];
    // its controls as they were for now (each kind is made Home Assistant's in turn), in one block: no pages to swipe
    const pg = pop?.pages[0], tabs = pg?.tabs || [];
    const ctl = pop ? pg.space + '<div class="tfMoreCtl"' + lightAttrs(id).replace(' data-light', '') + '>' + pg.rows.filter(Boolean).join('') + '</div>'
      : (NEW_INFO.includes(d) ? moreSpace(id) : '') + (d === 'plant' ? plantProblems(id).join('') : '') + s.sections.filter(Boolean).join('');
    // a light's views (Colour, the pad) sit under its controls, as Home Assistant's row of buttons does
    const modes = tabs.length ? '<div class="tfMoreDots hcMorePageIcons" role="tablist" aria-label="Views">' + tabs.map((tb) => '<button type="button" role="tab" aria-selected="' + ((tb.mode || '') === mode) + '" aria-label="' + tb.name + '" title="' + tb.name + '" data-more-page="0" data-more-mode="' + (tb.mode || '') + '">' + tb.svg + '</button>').join('') + '</div>' : '';
    // a device that turns on and off has its switch at the foot's left, on the line with its other options (Matt, 26 Nov)
    // only where its controls have no Off and On of their own (Matt, 26 Nov: a light keeps it; a switch, with its Off/On,
    // doesn't), and as Home Assistant's power button, the line in the circle, not a toggle
    const hasOnOff = />Off<\/button>/.test(ctl) && />On<\/button>/.test(ctl);
    const onOff = ['light', 'switch', 'fan', 'input_boolean', 'humidifier', 'siren', 'automation'].includes(d) && st && st.state !== 'unavailable' && !hasOnOff;
    const sw = onOff ? '<button class="hcMorePower' + (st.state === 'on' ? ' on' : '') + '" type="button" role="switch" aria-checked="' + (st.state === 'on') + '" aria-label="' + esc(nameOf(id)) + (st.state === 'on' ? ', on' : ', off') + '" title="' + (st.state === 'on' ? 'Turn off' : 'Turn on') + '" data-act="' + act(d, 'toggle', id) + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16.56,5.44L15.11,6.89C16.84,7.94 18,9.83 18,12A6,6 0 0,1 12,18A6,6 0 0,1 6,12C6,9.83 7.16,7.94 8.88,6.88L7.44,5.44C5.36,6.88 4,9.28 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12C20,9.28 18.64,6.88 16.56,5.44M13,3H11V13H13"/></svg></button>' : '';
    const foot = sw || modes ? '<div class="hcMoreFootRow">' + (sw || '<span></span>') + modes + '<span></span></div>' : '';
    const body = ctl || foot ? '<div class="tfMorePages hcMoreBody' + (pop ? ' tfMorePop' : '') + '"><section class="tfMorePage" aria-label="Control" data-mode="' + mode + '">' + ctl + foot + '</section></div>' : '';
    // a reading or anything else without Home Assistant's new design: its history and what happened, under the state
    return [haHead(id), stateHead(id), ...(body ? [body] : []), ...(NEW_INFO.includes(d) ? [] : [historyOf(id), activityOf(id)])];
  }
  // the kinds Home Assistant gives its new more info (its DOMAINS_WITH_NEW_MORE_INFO): their controls, no history under them
  const NEW_INFO = ['alarm_control_panel', 'cover', 'climate', 'fan', 'humidifier', 'input_boolean', 'lawn_mower', 'light', 'lock', 'siren', 'script', 'switch', 'timer', 'vacuum', 'valve', 'water_heater', 'media_player'];
  const HISTORY_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 17H7V10H9V17M13 17H11V7H13V17M17 17H15V13H17V17M19 19H5V5H19V19.1M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3Z"/></svg>';
  const COG_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8M12,10A2,2 0 0,0 10,12A2,2 0 0,0 12,14A2,2 0 0,0 14,12A2,2 0 0,0 12,10M10,22C9.75,22 9.54,21.82 9.5,21.58L9.13,18.93C8.5,18.68 7.96,18.34 7.44,17.94L4.95,18.95C4.73,19.03 4.46,18.95 4.34,18.73L2.34,15.27C2.21,15.05 2.27,14.78 2.46,14.63L4.57,12.97L4.5,12L4.57,11L2.46,9.37C2.27,9.22 2.21,8.95 2.34,8.73L4.34,5.27C4.46,5.05 4.73,4.96 4.95,5.05L7.44,6.05C7.96,5.66 8.5,5.32 9.13,5.07L9.5,2.42C9.54,2.18 9.75,2 10,2H14C14.25,2 14.46,2.18 14.5,2.42L14.87,5.07C15.5,5.32 16.04,5.66 16.56,6.05L19.05,5.05C19.27,4.96 19.54,5.05 19.66,5.27L21.66,8.73C21.79,8.95 21.73,9.22 21.54,9.37L19.43,11L19.5,12L19.43,13L21.54,14.63C21.73,14.78 21.79,15.05 21.66,15.27L19.66,18.73C19.54,18.95 19.27,19.04 19.05,18.95L16.56,17.95C16.04,18.34 15.5,18.68 14.87,18.93L14.5,21.58C14.46,21.82 14.25,22 14,22H10M11.25,4L10.88,6.61C9.68,6.86 8.62,7.5 7.85,8.39L5.44,7.35L4.69,8.65L6.8,10.2C6.4,11.37 6.4,12.64 6.8,13.8L4.68,15.36L5.43,16.66L7.86,15.62C8.63,16.5 9.68,17.14 10.87,17.38L11.24,20H12.76L13.13,17.39C14.32,17.14 15.37,16.5 16.14,15.62L18.57,16.66L19.32,15.36L17.2,13.81C17.6,12.64 17.6,11.37 17.2,10.2L19.31,8.65L18.56,7.35L16.15,8.39C15.38,7.5 14.32,6.86 13.11,6.62L12.74,4H11.25Z"/></svg>';
  const DOTS_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12,16A2,2 0 0,1 14,18A2,2 0 0,1 12,20A2,2 0 0,1 10,18A2,2 0 0,1 12,16M12,10A2,2 0 0,1 14,12A2,2 0 0,1 12,14A2,2 0 0,1 10,12A2,2 0 0,1 12,10M12,4A2,2 0 0,1 14,6A2,2 0 0,1 12,8A2,2 0 0,1 10,6A2,2 0 0,1 12,4Z"/></svg>';
  // Home Assistant's head: Close (Back from a view, or into the popup it was opened from), the area and device over the
  // name, then History, Settings and the menu (Device info, Related, Details)
  function haHead(id, view, log = false) {
    const h = getHass(), ent = h?.entities?.[id], dev = ent?.device_id ? h?.devices?.[ent.device_id] : null, devName = dev && (dev.name_by_user || dev.name);
    const area = model.areaOf?.(id), areaName = area ? model.rooms.find((r) => r.id === area)?.name || h?.areas?.[area]?.name || '' : '';
    const crumbs = [areaName, devName && devName !== nameOf(id) ? devName : null, view ? nameOf(id) : null].filter(Boolean);
    // Back from a view, or from the controls to the entry they were opened from
    const lead = view || more?.trail?.length ? '<button class="tfBack" type="button" data-more-pop aria-label="Back">' + ARROW + '</button>'
      : more?.back ? '<button class="tfBack" type="button" data-more-back aria-label="Back">' + ARROW + '</button>' : '<button class="tfBack" type="button" data-more-close aria-label="Close">' + CLOSE + '</button>';
    const item = (label, attrs) => '<button class="hcInfoMenuItem" type="button" role="menuitem" ' + attrs + '>' + esc(label) + '</button>';
    const tools = view ? '' : '<div class="hcInfoTools">' +
      (log ? '' : '<button class="tfBack" type="button" data-more-view="history" aria-label="History" title="History">' + HISTORY_SVG + '</button>') +
      '<button class="tfBack" type="button" data-more-view="settings" aria-label="Settings" title="Settings">' + COG_SVG + '</button>' +
      '<div class="hcInfoMenuWrap"><button class="tfBack" type="button" data-more-menu aria-haspopup="menu" aria-expanded="false" aria-label="Menu" title="Menu">' + DOTS_SVG + '</button>' +
        '<div class="card hcInfoMenu" role="menu" hidden>' + (dev ? item('Device info', 'data-path="/config/devices/device/' + esc(ent.device_id) + '"') : '') + item('Related', 'data-oops') + item('Details', 'data-more-view="details"') + '</div></div></div>';
    return '<div class="tfMoreHead hcInfoHead">' + lead + '<div class="hcInfoTitle">' + (crumbs.length ? '<span class="hcInfoCrumb">' + crumbs.map(esc).join(' ▸ ') + '</span>' : '') +
      '<span class="activityTitle" id="tfMoreTitle">' + esc(view || nameOf(id)) + '</span></div>' + tools + '</div>';
  }
  // Home Assistant's entity settings, behind the gear (Matt, 26 Nov): name, icon, how it shows, its unit, its entity ID,
  // its area, voice assistants, Enabled and Visible, then Delete and Update. Update keeps the name and the icon (in the
  // saved prefs, as entities[id]); Home Assistant's areas and entity IDs are never changed here
  const SHOW_AS = {
    cover: ['Awning', 'Blind', 'Curtain', 'Damper', 'Door', 'Garage door', 'Gate', 'Shade', 'Shutter', 'Window'],
    binary_sensor: ['Battery', 'Cold', 'Connectivity', 'Door', 'Garage door', 'Gas', 'Heat', 'Light', 'Lock', 'Moisture', 'Motion', 'Moving', 'Occupancy', 'Opening', 'Plug', 'Power', 'Presence', 'Problem', 'Running', 'Safety', 'Smoke', 'Sound', 'Tamper', 'Update', 'Vibration', 'Window'],
    switch: ['Switch', 'Light', 'Fan', 'Lock', 'Cover', 'Valve', 'Siren'],
  };
  function settingsOf(id) {
    const d = id.split('.')[0], a = attr(id), h = getHass(), ent = h?.entities?.[id], dev = ent?.device_id ? h?.devices?.[ent.device_id] : null;
    const mine = prefs.entities?.[id] || {}, area = model.areaOf?.(id);
    const field = (label, input, lead = '') => '<label class="hcInfoField"><span class="hcInfoFieldLabel">' + esc(label) + '</span><span class="hcInfoFieldBox">' + lead + input + '</span></label>';
    const select = (label, opts, now, attrs = '') => field(label, '<select class="hcInfoInput" ' + attrs + '>' + opts.map(([v, txt]) => '<option value="' + esc(v) + '"' + (v === now ? ' selected' : '') + '>' + esc(txt) + '</option>').join('') + '</select>');
    const toggle = (title, status, on, attrs = '') => '<div class="toggleRow hcInfoToggle"><div><strong>' + esc(title) + '</strong>' + (status ? '<div class="status">' + status + '</div>' : '') + '</div>' +
      '<button class="switch' + (on ? ' on' : '') + '" type="button" role="switch" aria-checked="' + on + '" aria-label="' + esc(title) + '" ' + attrs + '></button></div>';
    const iconNow = mine.icon || a.icon || '';
    const shown = SHOW_AS[d], cls = d === 'switch' ? 'Switch' : (a.device_class ? cap(String(a.device_class).replace(/_/g, ' ')) : '');
    const rooms = [['', 'No area'], ...model.rooms.map((r) => [r.id, r.name])];
    return '<div class="hcInfoSettings">' +
      field('Name', '<input class="hcInfoInput" type="text" data-set="name" value="' + esc(nameOf(id)) + '" placeholder="' + esc(a.friendly_name || '') + '">') +
      '<div class="hcIconPick">' + field('Icon', '<input class="hcInfoInput" type="text" data-set="icon" data-icon-pick role="combobox" aria-expanded="false" aria-autocomplete="list" autocomplete="off" spellcheck="false" value="' + esc(mine.icon || '') + '" placeholder="' + esc(iconNow || 'mdi:') + '">', '<span class="tfIcon hcInfoFieldIcon"' + iconSlot(id, iconNow) + '></span>') +
        '<div class="card hcIconList" role="listbox" aria-label="Icons" hidden></div></div>' +
      (shown ? select(d === 'switch' ? 'Show switch as' : 'Show as', shown.map((x) => [x, x]), shown.includes(cls) ? cls : shown[0]) : '') +
      (d === 'sensor' && a.unit_of_measurement ? select('Unit of measurement', [[a.unit_of_measurement, a.unit_of_measurement]], a.unit_of_measurement) +
        select('Display precision', [['', 'Default'], ['0', '0'], ['1', '0.1'], ['2', '0.01']], '') : '') +
      field('Entity ID', '<input class="hcInfoInput" type="text" value="' + esc(id.split('.').slice(1).join('.')) + '" readonly>', '<span class="hcInfoPrefix">' + esc(d) + '.</span>') +
      (dev ? toggle('Use device area', 'You can change the device area in the device settings', true, 'data-set-toggle="area"') : '') +
      '<div class="hcInfoAreaPick"' + (dev ? ' hidden' : '') + '>' + select('Area', rooms, area || '', 'data-set="area"') + '</div>' +
      '<button class="tfMoreLink hcInfoLink" type="button" data-oops><span><strong>Voice assistants</strong><span class="status">Configure aliases and expose settings for voice assistants</span></span>' + CHEVRON + '</button>' +
      toggle('Enabled', 'Disabled entities will not be added to Home Assistant.', true) +
      toggle('Visible', 'Hidden entities will not be included in auto-populated dashboards or when their area, device or label is referenced. Their history is still tracked and you can still interact with them with actions.', true) +
      '</div>';
  }
  // Update: the name and icon it was given (none if it's Home Assistant's own again), then back to its info
  function saveSettings() {
    const id = more?.id, box = sheet.querySelector('.hcInfoSettings');
    if (!id || !box) return;
    const name = box.querySelector('[data-set="name"]').value.trim(), icon = box.querySelector('[data-set="icon"]').value.trim();
    const mine = { ...(name && name !== attr(id).friendly_name ? { name } : {}), ...(icon ? { icon } : {}) };
    const entities = { ...(prefs.entities || {}) };
    if (Object.keys(mine).length) entities[id] = mine; else delete entities[id];
    prefs = { ...prefs, entities };
    savePrefs();
    more.view = more.trail?.length ? more.trail.pop() : null;
    refresh();
    renderMore();
  }
  // the state, big, and when it last changed
  function stateHead(id) {
    const st = states[id], word = headLine(id, '') || cap(String(st.state).replace(/_/g, ' '));
    return '<div class="hcInfoState"><div class="hcInfoStateNow">' + esc(word) + '</div>' + (st.last_changed ? '<div class="hcInfoStateWhen">Last changed ' + esc(ago(Date.parse(st.last_changed))) + '</div>' : '') + '</div>';
  }
  // its last 24 hours
  const historyOf = (id, named = true) => '<div class="tfMoreGraph">' + (named ? '<div class="tfMoreGroupName">History</div>' : '') + '<svg class="tfGraph tfDay" data-day="' + esc(id) + '" role="img" aria-label="' + esc(nameOf(id)) + ', last 24 hours"></svg></div>';
  // what happened to it, newest first: the logbook's changes, else its last one
  function activityOf(id) {
    const st = states[id], unit = attr(id).unit_of_measurement, said = (logbook || []).filter((e) => e.entity_id === id).sort((x, y) => y.when - x.when).slice(0, 8);
    const rows = said.length ? said.map((e) => [e.state, e.when * 1000]) : st.last_changed ? [[st.state, Date.parse(st.last_changed)]] : [];
    return '<div class="tfMoreGroup hcInfoActivity"><div class="tfMoreGroupName">Activity</div><div class="tfMoreRows">' +
      (rows.length ? rows.map(([s, at]) => '<div class="tfMoreRow"><span>' + esc(cap(String(s).replace(/_/g, ' ')) + (unit && !isNaN(Number(s)) ? (unit === '%' ? '' : ' ') + unit : '')) + '</span><span>' + esc(ago(at)) + '</span></div>').join('') : '<div class="tfMoreRow"><span>Nothing in the last 24 hours</span></div>') + '</div></div>';
  }
  // an Activity entry's head row: its icon, name and when it changed, its state at the right; it opens the controls
  function logEntity(id) {
    const st = states[id], word = valueOf(id) || cap(String(st.state).replace(/_/g, ' '));
    return '<button class="hcLogEntity" type="button" data-more-view="" aria-label="' + esc(nameOf(id) + ', ' + word + ', controls') + '"><span class="tfIcon"' + iconSlot(id, attr(id).icon || '') + '></span>' +
      '<span class="hcLogEntityText"><span class="hcLogEntityName">' + esc(nameOf(id)) + '</span>' + (st.last_changed ? '<span class="hcLogEntityWhen">' + esc(ago(Date.parse(st.last_changed))) + '</span>' : '') + '</span>' +
      '<span class="hcLogEntityState">' + esc(word) + '</span>' + CHEVRON + '</button>';
  }
  const logGroup = (name, html) => '<section class="hcLogGroup" aria-label="' + name + '"><div class="hcLogGroupHead"><h3 class="hcLogTitle">' + name + '</h3><button class="hcLogMore" type="button" data-more-view="history">Show more</button></div>' + html + '</section>';
  // a state it was in, in words (as its tile says it now)
  function wordAt(id, s) {
    const d = id.split('.')[0], a = attr(id), n = Number(s);
    if (['light', 'switch', 'fan', 'input_boolean', 'automation', 'siren', 'humidifier'].includes(d)) return s === 'on' ? 'On' : 'Off';
    if (d === 'binary_sensor' || d === 'alarm_control_panel') { const real = states[id]; states[id] = { ...real, state: s }; try { return valueOf(id); } finally { states[id] = real; } }
    if (s !== '' && Number.isFinite(n)) return n.toLocaleString(undefined, { maximumFractionDigits: Math.abs(n) >= 100 ? 0 : 1 }) + (a.unit_of_measurement ? (a.unit_of_measurement === '%' ? '%' : ' ' + a.unit_of_measurement) : '');
    return cap(String(s).replace(/_/g, ' '));
  }
  // its last changes, newest first, under the day they fell on, each a dot on a line (on in its colour, off grey)
  async function fillLog(id, el) {
    const pts = await dayOf(id);
    if (!el.isConnected || !states[id]) return;
    const ch = [];
    let was;
    pts.forEach(([t, s]) => { if (s !== was && !['unavailable', 'unknown'].includes(s)) ch.push([t, s]); was = s; });
    let rows = ch.reverse().slice(0, 5);
    if (!rows.length && states[id].last_changed) rows = [[Date.parse(states[id].last_changed), states[id].state]];
    const dayName = (t) => { const d0 = new Date(t), today = new Date(); const diff = Math.round((new Date(today.toDateString()) - new Date(d0.toDateString())) / 864e5);
      return (diff === 0 ? 'Today · ' : diff === 1 ? 'Yesterday · ' : '') + d0.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); };
    const tone = alarmOf(id) ? ' alarm' : id.startsWith('light.') ? ' light' : '';
    let html = '', day = '';
    rows.forEach(([t, s]) => {
      const name = dayName(t);
      if (name !== day) { html += (day ? '</div>' : '') + '<div class="hcLogDay">' + esc(name) + '</div><div class="hcLogRows">'; day = name; }
      html += '<button class="hcLogRow" type="button" data-more-view="history"><span class="hcLogDot' + (isOn(id, s) ? ' on' + tone : '') + '"></span><span class="hcLogWhat">' + esc(wordAt(id, s)) + '</span>' +
        '<span class="hcLogTime">' + esc(new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })) + '</span>' + CHEVRON + '</button>';
    });
    el.innerHTML = rows.length ? html + '</div>' : '<div class="hcLogDay">Nothing in the last 24 hours</div>';
  }
  // under the name, as the drawings have it (17 Nov): its area and its state in a word or a number; a light its value
  const headLine = (id, areaName) => {
    const d = id.split('.')[0], st = states[id], a = st.attributes;
    if (d === 'light') return valueOf(id);
    const word = d === 'climate' ? cap(a.hvac_action || st.state) : d === 'humidifier' ? cap(a.action || st.state) : d === 'water_heater' ? cap(a.operation_mode || st.state)
      : d === 'fan' && st.state === 'on' && a.percentage != null ? a.percentage + '%' : (d === 'valve' || d === 'cover') && a.current_position != null && st.state !== 'closed' ? a.current_position + '%' : valueOf(id);
    return [areaName, word].filter(Boolean).join(' · ');
  };
  // the big space (Matt, 10 Nov: the data and action space is left largely undefined, for contributors to design;
  // for now a large number and the basic information, stacked to fill the room it has): the device's main number
  // (its reading, brightness, position, battery, else its state in a word) at the top, its facts spread under it
  const NO_SPACE = ['lock', 'alarm_control_panel', 'switch', 'input_boolean', 'fan', 'valve', 'media_player', 'automation', 'script', 'scene', 'button'];
  function moreSpace(id) {
    // a device whose visual controller is its data and action (Matt, 10 Nov: the curtains' drawing) fills the space with it
    const d = id.split('.')[0];
    // a device that is only its controls or a state word has no space (Matt, 10 Nov: Popup · Device, rule popup.space):
    // a lock, an alarm, a switch, a valve, a media player, and a light that isn't the Dual Axis Controller (its bars say
    // its brightness)
    if (NO_SPACE.includes(d) || (d === 'light' && !dacFor(id))) {
      // its icon, big, is the switch (Matt, 11 Nov; rules popup.device, popup.sheet): the tile's icon button at 240,
      // toggling like the tile's
      const s = ACTION_DOMAINS.includes(d) || TOGGLES.includes(d) ? specFor(id) : quickSpec(id);
      return s?.button ? '<div class="tfMoreSpace tfMoreSwitch' + (s.on ? ' on' : '') + '"' + (s.tone ? ' data-tone="' + s.tone + '"' : '') + lightAttrs(id) + '>' + iconButton(id, s) + '</div>' : '';
    }
    if (d === 'cover') return '<div class="tfMoreSpace tfMoreFill"><div data-cover-art="' + esc(id) + '"></div></div>';
    if (d === 'light' && dacFor(id)) return '<div class="tfMoreSpace tfMoreFill"><div class="tfDacPad" data-dac="more:' + esc(id) + '"></div></div>';
    const { big, lines } = bigOf(id);
    return '<div class="tfMoreSpace"><div class="tfMoreBig' + (held('pos', id) != null ? ' live' : '') + '"><span class="tfMoreNum">' + esc(big[0]) + '</span>' + (big[1] ? '<span class="tfMoreUnit">' + esc(big[1]) + '</span>' : '') + '</div>' +
      '<div class="tfMoreFacts">' + lines.map(([k, v]) => '<div class="tfMoreFact"><span>' + esc(k) + '</span><span>' + esc(v) + '</span></div>').join('') + '</div></div>';
  }
  /* the redrawn popups (Matt, 17 Nov; Figma "HomeCore · Source of truth · 2", the More info band 1144:1380): one set
     per kind, each the same 604.4 tall. The space at the top (a pad, the device's data, its big switch, the alarm's
     keypad) is 224 at least and takes what the rows under it leave; rows that don't fit scroll in their own block under
     it, and the tabs stay at the foot. A row after the first is named above it in a muted 14 where the drawing names it.
     A kind not drawn yet (a media player, a vacuum, a plant, a reading) keeps its popup as it was */
  const PALETTE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.5,12A1.5,1.5 0 0,1 16,10.5A1.5,1.5 0 0,1 17.5,9A1.5,1.5 0 0,1 19,10.5A1.5,1.5 0 0,1 17.5,12M14.5,8A1.5,1.5 0 0,1 13,6.5A1.5,1.5 0 0,1 14.5,5A1.5,1.5 0 0,1 16,6.5A1.5,1.5 0 0,1 14.5,8M9.5,8A1.5,1.5 0 0,1 8,6.5A1.5,1.5 0 0,1 9.5,5A1.5,1.5 0 0,1 11,6.5A1.5,1.5 0 0,1 9.5,8M6.5,12A1.5,1.5 0 0,1 5,10.5A1.5,1.5 0 0,1 6.5,9A1.5,1.5 0 0,1 8,10.5A1.5,1.5 0 0,1 6.5,12M12,3A9,9 0 0,0 3,12A9,9 0 0,0 12,21A1.5,1.5 0 0,0 13.5,19.5C13.5,19.11 13.35,18.76 13.11,18.5C12.88,18.23 12.73,17.88 12.73,17.5A1.5,1.5 0 0,1 14.23,16H16A5,5 0 0,0 21,11C21,6.58 16.97,3 12,3Z"/></svg>';
  const DAC_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="4"/></svg>';
  const POP_DOMAINS = ['light', 'climate', 'fan', 'humidifier', 'water_heater', 'alarm_control_panel', 'cover', 'lock', 'valve', 'switch', 'input_boolean'];
  const popField = (label, html) => '<div class="tfMoreField"><div class="tfMoreLabel">' + esc(label) + '</div>' + html + '</div>';
  const popSeg = (label, items) => buttons('tfSeg', label, items);
  // a track with its icon inside at the left and its value inside the level at its right end (brightness, a fan's
  // speed, a valve's position, a cover's tilt)
  const popLevel = (kind, id, pct, label, text, icon) => '<div class="tfBar tfPopBar ' + kind + '" role="slider" tabindex="0" aria-label="' + esc(label) + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(pct) + '" aria-valuetext="' + esc(text) + '" data-drag="' + esc(kind + '|' + id) + '">' +
    '<i style="width:' + Math.max(0, Math.min(100, pct)) + '%"><output class="tfBarVal">' + esc(text) + '</output></i>' + (icon ? '<span class="tfBarIcon"' + iconSlot('', icon, label) + '></span>' : '') + '</div>';
  // a track with a handle (warmth, flipped: cold at the left, warm at the right; colour's spectrum), its value centred
  const popMarker = (kind, id, pct, label, text) => '<div class="tfBar tfPopBar ' + kind + '" role="slider" tabindex="0" aria-label="' + esc(label) + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(pct ?? 0) + '"' + (text ? ' aria-valuetext="' + esc(text) + '"' : '') + ' data-drag="' + esc(kind + '|' + id) + '">' +
    (text ? '<output class="tfBarVal mid">' + esc(text) + '</output>' : '') + (pct == null ? '' : '<b style="left:' + pct + '%"></b>') + '</div>';
  // the big switch: the tile's icon button, 224 (an off one the tile's chip with its hairline, its glyph in the text colour)
  const popSwitch = (id, s) => '<div class="tfMoreSpace tfMoreSwitch' + (s.on ? ' on' : '') + '"' + (s.tone ? ' data-tone="' + s.tone + '"' : '') + lightAttrs(id) + '>' + iconButton(id, s) + '</div>';
  // the data: the main number and its unit at the top, its facts spread under it
  const popData = (big, unit, facts) => '<div class="tfMoreSpace"><div class="tfMoreBig"><span class="tfMoreNum">' + esc(big) + '</span>' + (unit ? '<span class="tfMoreUnit">' + esc(unit) + '</span>' : '') + '</div>' +
    '<div class="tfMoreFacts">' + facts.filter(([, v]) => v != null && v !== '').map(([k, v]) => '<div class="tfMoreFact"><span>' + esc(k) + '</span><span>' + esc(v) + '</span></div>').join('') + '</div></div>';
  // the alarm asks for its code before a mode it guards (Home Assistant: disarming whenever it has a code; arming when
  // code_arm_required)
  const needsCode = (id, service) => { const a = attr(id); return Boolean(a.code_format) && (service === 'alarm_disarm' || a.code_arm_required !== false); };
  const CODE_VERB = { alarm_disarm: 'Disarm', alarm_arm_home: 'Arm home', alarm_arm_away: 'Arm away', alarm_arm_night: 'Arm night', alarm_arm_vacation: 'Arm vacation' };
  function askCode(id, service, opener) {
    if (more?.id !== id) openMore(id, opener);
    if (more?.id !== id) return;
    more.view = null;
    more.pending = { service, label: CODE_VERB[service] || 'Send' };
    more.code = ''; more.codeState = ''; more.codeSaid = '';
    renderMore();
    sheet.querySelector('[data-code]')?.focus({ preventScroll: true });
  }
  // the alarm opens on its code pad for the next thing to do (Matt, 26 Nov: "when you open up the alarm and it's off, it
  // should just go to the arm home thing or cancel"): off, Arm home; on, Disarm. Cancel closes it, as does the right code
  function padFirst() {
    const id = more?.id;
    if (!id?.startsWith('alarm_control_panel.') || more.pending || !states[id]) return;
    const service = states[id].state === 'disarmed' ? 'alarm_arm_home' : 'alarm_disarm';
    if (!needsCode(id, service)) return;
    more.pending = { service, label: CODE_VERB[service], first: true };
    more.code = ''; more.codeState = ''; more.codeSaid = '';
  }
  function endCode() { if (more) { more.pending = null; more.code = ''; more.codeState = ''; more.codeSaid = ''; } }
  async function submitCode() {
    const p = more?.pending, id = more?.id;
    if (!p || more.codeState === 'right') return;
    const code = more.code || '';
    // said in place: the popup leaves a part with a focused field alone when it redraws
    const say = (state, words) => {
      more.codeState = state; more.codeSaid = words;
      const pad = sheet.querySelector('.hcCodePad'), field = sheet.querySelector('[data-code]'), said = sheet.querySelector('.hcCodeSaid');
      if (field) field.value = more.code || '';
      if (said) said.textContent = words;
      if (pad) { pad.classList.remove('wrong', 'right'); void pad.offsetWidth; pad.classList.add(state); }
    };
    if (!code) { say('wrong', 'Type the code first'); return; }
    try { await send('alarm_control_panel', p.service, id, { code }); }
    catch (_e) { if (more?.pending !== p) return; more.code = ''; say('wrong', 'Wrong code. Try again'); sheet.querySelector('[data-code]')?.focus({ preventScroll: true }); return; }
    if (more?.pending !== p) return;
    say('right', 'Code accepted');
    setTimeout(() => { if (more?.pending === p && p.first) closeMore(); else if (more?.pending === p) { endCode(); if (sheet.contains(root.activeElement)) root.activeElement.blur(); renderMore(); sheet.querySelector('.tfMore')?.focus({ preventScroll: true }); } }, 900);
  }
  const codeField = () => '<input class="tfMoreCode" type="password" inputmode="numeric" autocomplete="off" placeholder="Code" aria-label="Code" data-code value="' + esc(more?.code || '') + '">';
  // a button that sends its code too, when one's typed (a lock's, the alarm's)
  const coded = (domain, service, id, label, pressed) => ({ label, pressed, html: null, coded: [domain, service, id].join('|') });
  const codedSeg = (label, items) => '<div class="tfSeg" role="group" aria-label="' + esc(label) + '">' + items.map((it) => '<button type="button" data-coded="' + esc(it.coded) + '" aria-pressed="' + Boolean(it.pressed) + '">' + esc(it.label) + '</button>').join('') + '</div>';
  const onOff = (id, d, on) => popSeg(nameOf(id), [{ label: 'Off', act: act(d, 'turn_off', id), pressed: !on }, { label: 'On', act: act(d, 'turn_on', id), pressed: on }]);
  function popOf(id) {
    const d = id.split('.')[0], st = states[id], a = st.attributes;
    if (!POP_DOMAINS.includes(d)) return null;
    const s = ACTION_DOMAINS.includes(d) || TOGGLES.includes(d) ? specFor(id) : quickSpec(id);
    if (d === 'light') {
      /* the light, as Home Assistant's more-info has it (Matt, 17 Nov; Figma Popup · Light 1187:5847): the space is two
         vertical sliders, Brightness and Warmth, each named above; the pill picks the view: Sliders, Colour (the
         spectrum in Warmth's place, Brightness staying where it is) and the Dual Axis Controller's pad over the whole
         space. Shapes and controls only for now: no values. The head's icon is still its switch */
      const on = st.state === 'on', modes = modesOf(id), [kMin, kMax] = kelvinRange(id), b = held('bright', id, on ? brightnessOf(st) : 0);
      const k = held('ctf', id, on && a.color_mode === 'color_temp' ? a.color_temp_kelvin : null);
      const hue = held('huev', id, on && COLOUR_MODES.includes(a.color_mode) && a.hs_color ? a.hs_color[0] : null);
      const warmOk = modes.includes('color_temp'), colourOk = modes.some((m) => COLOUR_MODES.includes(m)), padOk = dacFor(id);
      const vbar = (kind, label, now, inner) => '<div class="tfBar tfVBar ' + kind + '" data-axis="y" role="slider" tabindex="0" aria-orientation="vertical" aria-label="' + esc(nameOf(id) + ' ' + label.toLowerCase()) + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(now) + '" data-drag="' + kind + '|' + esc(id) + '">' + inner + '</div>';
      // no names above them (Matt, 17 Nov): each slider says what it is to a screen reader only
      const col = (label, html, cls = '') => '<div class="tfVCol' + cls + '">' + html + '</div>';
      const brightCol = col('Brightness', vbar('bright', 'Brightness', b, '<i style="height:' + b + '%"></i><span class="tfBarIcon"' + iconSlot('', 'mdi:white-balance-sunny', 'Brightness') + '></span>'));
      const warmF = k == null ? null : (kMax - k) / (kMax - kMin); // warm at the top
      const warmCol = warmOk ? col('Warmth', vbar('ctf', 'Warmth', warmF == null ? 0 : warmF * 100, warmF == null ? '' : '<b style="top:' + Math.round((1 - warmF) * 1000) / 10 + '%"></b>'), ' tfVWarm') : '';
      const colourCol = colourOk ? col('Colour', vbar('huev', 'Colour', hue == null ? 0 : (1 - hue / 360) * 100, hue == null ? '' : '<b style="top:' + Math.round((hue / 360) * 1000) / 10 + '%"></b>'), ' tfVColour') : '';
      const cols = '<div class="tfVCols">' + brightCol + (warmCol || colourCol ? '<div class="tfVSwap">' + warmCol + colourCol + '</div>' : '') + '</div>';
      const pad = padOk ? '<div class="tfLightPad"><div class="tfDacPad" data-dac="more:' + esc(id) + '"></div></div>' : '';
      const views = [colourOk && { name: 'Colour', svg: PALETTE_SVG, mode: 'colour' }, padOk && { name: 'Dual Axis Controller', svg: DAC_SVG, mode: 'dac' }, { name: 'Sliders', svg: TUNE_SVG, mode: '' }].filter(Boolean);
      return { infoButton: true, pages: [{ name: 'Control', svg: TUNE_SVG, space: '<div class="tfMoreSpace tfLightSpace">' + cols + pad + '</div>', rows: [], tabs: views.length > 1 ? views : [] }] };
    }
    if (d === 'climate') {
      const step = a.target_temp_step || 0.5, t = Number(a.temperature), lo = Number(a.target_temp_low), hi = Number(a.target_temp_high), set = (data) => act('climate', 'set_temperature', id, data);
      const modesRow = (label, list, key, service, field) => list?.length && popField(label, popSeg(label, list.map((m) => ({ label: cap(m), act: act('climate', service, id, { [field]: m }), pressed: (key === 'state' ? st.state : a[key]) === m }))));
      const range = Number.isFinite(lo) && Number.isFinite(hi) && popField('Range', '<div class="tfMoreRange">' +
        stepper('Low', num(lo) + ' °C', set({ target_temp_low: lo - step, target_temp_high: hi }), set({ target_temp_low: lo + step, target_temp_high: hi })) +
        stepper('High', num(hi) + ' °C', set({ target_temp_low: lo, target_temp_high: hi - step }), set({ target_temp_low: lo, target_temp_high: hi + step })) + '</div>');
      const hum = Number(a.humidity);
      return { pages: [{ name: 'Control', svg: TUNE_SVG,
        space: popData(num(a.current_temperature), '°C', [['Target', Number.isFinite(t) ? num(t) + ' °C' : null], ['Action', a.hvac_action && cap(a.hvac_action)]]),
        rows: [
          Number.isFinite(t) && stepper('Target temperature', num(t) + ' °C', set({ temperature: t - step }), set({ temperature: t + step })),
          range,
          modesRow('Mode', a.hvac_modes, 'state', 'set_hvac_mode', 'hvac_mode'),
          modesRow('Fan', a.fan_modes, 'fan_mode', 'set_fan_mode', 'fan_mode'),
          modesRow('Swing', a.swing_modes, 'swing_mode', 'set_swing_mode', 'swing_mode'),
          modesRow('Preset', a.preset_modes, 'preset_mode', 'set_preset_mode', 'preset_mode'),
          Number.isFinite(hum) && a.min_humidity != null && popField('Humidity', stepper('Target humidity', hum + '%', act('climate', 'set_humidity', id, { humidity: hum - 1 }), act('climate', 'set_humidity', id, { humidity: hum + 1 }))),
        ] }] };
    }
    if (d === 'fan') {
      const on = st.state === 'on', pct = held('fan', id, on ? Number(a.percentage) || 0 : 0), speed = a.percentage != null;
      return { pages: [{ name: 'Control', svg: TUNE_SVG, space: popSwitch(id, s), rows: speed ? [
        popLevel('fan', id, pct, nameOf(id) + ' speed', pct + '%', 'mdi:fan'),
        a.oscillating != null && popField('Oscillate', popSeg('Oscillate', [{ label: 'Off', act: act('fan', 'oscillate', id, { oscillating: false }), pressed: !a.oscillating }, { label: 'On', act: act('fan', 'oscillate', id, { oscillating: true }), pressed: Boolean(a.oscillating) }])),
        a.direction && popField('Direction', popSeg('Direction', [['forward', 'Forward'], ['reverse', 'Reverse']].map(([v, l]) => ({ label: l, act: act('fan', 'set_direction', id, { direction: v }), pressed: a.direction === v })))),
        a.preset_modes?.length && popField('Preset', popSeg('Preset', a.preset_modes.map((m) => ({ label: cap(m), act: act('fan', 'set_preset_mode', id, { preset_mode: m }), pressed: a.preset_mode === m })))),
      ] : [onOff(id, 'fan', on)] }] };
    }
    if (d === 'humidifier') {
      const h = Number(a.humidity);
      return { pages: [{ name: 'Control', svg: TUNE_SVG, space: popData(String(a.current_humidity), '%', [['Target', Number.isFinite(h) ? h + '%' : null], ['Action', a.action && cap(a.action)]]), rows: [
        Number.isFinite(h) && stepper('Target humidity', h + '%', act('humidifier', 'set_humidity', id, { humidity: h - 1 }), act('humidifier', 'set_humidity', id, { humidity: h + 1 })),
        a.available_modes?.length && popField('Mode', popSeg('Mode', a.available_modes.map((m) => ({ label: cap(m), act: act('humidifier', 'set_mode', id, { mode: m }), pressed: a.mode === m })))),
      ] }] };
    }
    if (d === 'water_heater') {
      const t = Number(a.temperature), step = a.target_temp_step || 1;
      return { pages: [{ name: 'Control', svg: TUNE_SVG, space: popData(num(a.current_temperature).replace(/\.0$/, ''), '°C', [['Target', Number.isFinite(t) ? String(t).replace(/\.0$/, '') + ' °C' : null], ['Mode', cap(a.operation_mode || st.state)]]), rows: [
        Number.isFinite(t) && stepper('Target temperature', t + ' °C', act('water_heater', 'set_temperature', id, { temperature: t - step }), act('water_heater', 'set_temperature', id, { temperature: t + step })),
        a.operation_list?.length && popField('Mode', popSeg('Mode', a.operation_list.map((m) => ({ label: cap(m), act: act('water_heater', 'set_operation_mode', id, { operation_mode: m }), pressed: (a.operation_mode || st.state) === m })))),
        a.away_mode != null && popField('Away', popSeg('Away', [{ label: 'Off', act: act('water_heater', 'set_away_mode', id, { away_mode: false }), pressed: a.away_mode !== 'on' }, { label: 'On', act: act('water_heater', 'set_away_mode', id, { away_mode: true }), pressed: a.away_mode === 'on' }])),
      ] }] };
    }
    if (d === 'alarm_control_panel') {
      const modes = [...ALARM_MODES, ['armed_vacation', 'Vacation', 'alarm_arm_vacation', 32]].filter(([, , , bit]) => !bit || has(id, bit));
      // Home Assistant's way (Matt, 26 Nov: "no way to press enter or see that you've got it correct or incorrect"): its
      // modes; picking one that needs the code asks for it, its keypad ending in Clear, 0 and Enter, then says whether it
      // was right (the field green, the mode sent) or wrong (red, a shake, emptied to try again)
      const p = more?.id === id ? more.pending : null;
      if (p) {
        const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'submit'];
        const glyph = (k) => k === 'clear' ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/></svg>'
          : k === 'submit' ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z"/></svg>' : k;
        const pad = '<div class="tfMoreSpace tfMoreKeypad hcCodePad' + (more.codeState ? ' ' + more.codeState : '') + '"><div class="hcCodeTitle">Enter code to ' + esc(p.label.toLowerCase()) + '</div>' + codeField() +
          '<div class="hcCodeSaid" role="status" aria-live="polite">' + esc(more.codeSaid || '') + '</div>' +
          '<div class="tfKeypad">' + keys.map((k) => '<button type="button" data-key="' + k + '"' + (k === 'clear' ? ' aria-label="Clear"' : k === 'submit' ? ' aria-label="Enter" class="hcCodeEnter"' : '') + '>' + glyph(k) + '</button>').join('') + '</div></div>';
        return { pages: [{ name: 'Control', svg: TUNE_SVG, space: pad, rows: ['<div class="hcCodeFoot"><button type="button" data-code-cancel>Cancel</button><button class="primary" type="button" data-code-submit>' + esc(p.label) + '</button></div>'] }] };
      }
      return { pages: [{ name: 'Control', svg: TUNE_SVG, space: '', rows: [codedSeg(nameOf(id), modes.map(([state, label, service]) => coded('alarm_control_panel', service, id, label, st.state === state)))] }] };
    }
    if (d === 'cover') {
      if (a.current_position == null) return { pages: [{ name: 'Control', svg: TUNE_SVG, space: popSwitch(id, s), rows: [popSeg(nameOf(id), [{ label: 'Open', act: act('cover', 'open_cover', id), pressed: st.state !== 'closed' }, { label: 'Close', act: act('cover', 'close_cover', id), pressed: st.state === 'closed' }])] }] };
      const moving = st.state === 'opening' || st.state === 'closing', v = coverValue(id), tilt = tiltOf(id);
      return { pages: [{ name: 'Control', svg: TUNE_SVG, space: '<div class="tfMoreSpace tfMoreArt"><div data-cover-art="' + esc(id) + '"></div></div>', rows: [
        has(id, SET_POSITION) && blocks(id, v),
        tilt != null && popField('Tilt', popLevel('tiltp', id, held('tiltp', id, tilt), nameOf(id) + ' tilt', Math.round(held('tiltp', id, tilt)) + '%')),
        popSeg(nameOf(id), [has(id, OPEN) && { label: 'Open', act: act('cover', 'open_cover', id), disabled: v >= 100 && !moving }, has(id, STOP) && { label: 'Stop', act: act('cover', 'stop_cover', id) }, has(id, CLOSE_COVER) && { label: 'Close', act: act('cover', 'close_cover', id), disabled: v <= 0 && !moving }]),
      ] }] };
    }
    if (d === 'lock') {
      return { pages: [{ name: 'Control', svg: TUNE_SVG, space: popSwitch(id, s), rows: [codeField(),
        codedSeg(nameOf(id), [coded('lock', 'lock', id, 'Lock', st.state === 'locked'), coded('lock', 'unlock', id, 'Unlock', st.state === 'unlocked'), has(id, LOCK_OPEN) && coded('lock', 'open', id, 'Open', st.state === 'open')].filter(Boolean))] }] };
    }
    if (d === 'valve') {
      const isOpen = st.state === 'open';
      if (a.current_position == null) return { pages: [{ name: 'Control', svg: TUNE_SVG, space: popSwitch(id, s), rows: [popSeg(nameOf(id), [{ label: 'Open', act: act('valve', 'open_valve', id), pressed: isOpen }, { label: 'Close', act: act('valve', 'close_valve', id), pressed: !isOpen }])] }] };
      const pos = held('valve', id, Number(a.current_position) || 0);
      return { pages: [{ name: 'Control', svg: TUNE_SVG, space: popSwitch(id, s), rows: [
        popLevel('valve', id, pos, nameOf(id) + ' position', Math.round(pos) + '%', 'mdi:valve'),
        popSeg(nameOf(id), [{ label: 'Open', act: act('valve', 'open_valve', id) }, has(id, 8) && { label: 'Stop', act: act('valve', 'stop_valve', id) }, { label: 'Close', act: act('valve', 'close_valve', id) }]),
      ] }] };
    }
    // a switch, a plug, an input boolean: its big switch, then Off and On
    return { pages: [{ name: 'Control', svg: TUNE_SVG, space: popSwitch(id, s), rows: [onOff(id, d, st.state === 'on')] }] };
  }
  // a device without a tile of its own (a switch, a plug, an input boolean, a fan; a scene or script): its icon is still
  // its button (Matt, 12 Nov: Sparkles' popup should have a large icon to click in the data and action space)
  function quickSpec(id) {
    const d = id.split('.')[0], on = states[id]?.state === 'on';
    const button = TOGGLES.includes(d) ? { act: act(d, 'toggle', id), label: 'Turn ' + nameOf(id) + (on ? ' off' : ' on') }
      : d === 'scene' || d === 'script' ? { act: act(d, 'turn_on', id), label: 'Run ' + nameOf(id) } : null;
    return { sections: [], on, button, icon: iconFor(id) };
  }
  function bigOf(id) {
    const st = states[id], a = attr(id), d = id.split('.')[0];
    const rows = (DETAILS[d]?.(a) || []).filter(([, v]) => v != null && v !== '');
    const take = (label) => { const i = rows.findIndex(([k]) => k === label); return i < 0 ? null : rows.splice(i, 1)[0][1]; };
    const split = (v) => { const m = String(v).match(/^(-?[\d.,]+)\s*(.*)$/); return m ? [m[1], m[2]] : [String(v), '']; };
    const word = () => [cap(String(st.state).replace(/_/g, ' ')), ''];
    let big;
    if (d === 'light') { take('Brightness'); big = st.state === 'on' && dimmable(id) ? [String(brightnessOf(st)), '%'] : word(); }
    else if (d === 'climate') big = split(take('Current temperature') || num(a.current_temperature) + ' °C');
    else if (d === 'cover') { take('Position'); big = a.current_position != null ? [String(posOf(id)), '%'] : word(); }
    else if (d === 'humidifier') big = split(take('Current humidity') || st.state);
    else if (d === 'vacuum') big = split(take('Battery') || st.state);
    else if (d === 'plant') big = split(take('Moisture') || st.state);
    else if (['media_player', 'lock', 'alarm_control_panel', 'valve'].includes(d)) big = word();
    else big = split(st.state + (a.unit_of_measurement ? ' ' + a.unit_of_measurement : ''));
    const lines = rows.length ? rows.slice(0, 4) : [['State', valueOf(id)]];
    return { big, lines };
  }
  // Info: the device's details, when it changed, where it is and what it is, and the way to its device page
  function infoOf(id) {
    const st = states[id], h = getHass(), ent = h?.entities?.[id], dev = ent?.device_id ? h?.devices?.[ent.device_id] : null;
    const area = model.areaOf?.(id), areaName = area ? model.rooms.find((r) => r.id === area)?.name || h?.areas?.[area]?.name || '' : '';
    const rows = [...(DETAILS[id.split('.')[0]]?.(attr(id)) || []), ['Changed', st.last_changed && ago(Date.parse(st.last_changed))], ['Area', areaName],
      ['Device', dev && (dev.name_by_user || dev.name)], ['Integration', ent?.platform && cap(ent.platform.replace(/_/g, ' '))], ['Entity', id]].filter(([, v]) => v != null && v !== '');
    return '<div class="tfMoreRows">' + rows.map(([k, v]) => '<div class="tfMoreRow"><span>' + esc(k) + '</span><span>' + esc(v) + '</span></div>').join('') + '</div>' + madeUpNote(id) +
      (dev ? '<button class="tfDetailsBtn tfMoreLink" type="button" data-path="/config/devices/device/' + esc(ent.device_id) + '"><span>Device page</span>' + CHEVRON + '</button>' : '');
  }
  const detailsOf = () => ''; // a device's details are its Info page now (10 Nov); nothing opens beside the popup
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
    if (lockedKeys().some((k) => k.endsWith('|' + more.id))) { stale = true; syncArts(); return; }
    const parts = partsOf(more.id), box = sheet.querySelector('.tfMore');
    if (!parts) { closeMore(); return; }
    const was = focusOf(sheet), side = detailsOf(more.id);
    const wide = more.frame ? more.frame.wide : more.id.startsWith('summary:') || more.id.startsWith('group:');
    if (sheet.hidden || !box || parts.length !== moreParts.length || box.classList.contains('wide') !== wide) {
      // drawn again while open (a light turning off loses its colour): it stays scrolled where it was. A new page in it
      // starts at its top, and Back returns to where that page was left
      const keep = turning ? more.scroll || 0 : !sheet.hidden && box ? box.scrollTop : 0;
      // the dialog and, beside it, its details: one dialog for screen readers. Already open, it doesn't rise in again
      sheet.innerHTML = '<div class="tfMorePair' + (sheet.hidden ? '' : ' still') + '" role="dialog" aria-modal="true" aria-labelledby="tfMoreTitle"><section class="tfMore' + (wide ? ' wide' : '') + '"' + (more.frame ? ' style="height:' + more.frame.h + 'px"' : '') + ' tabindex="-1">' + parts.join('') + '</section>' +
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
      sheet.querySelectorAll('[data-log]').forEach((el) => fillLog(el.dataset.log, el));
      drawPlantGraphs(sheet);
      if (keep) sheet.querySelector('.tfMore').scrollTop = keep;
      settlePages();
      refocus(sheet, was);
      if (!sheet.contains(root.activeElement)) { const c = sheet.querySelector('[data-more-close]'); (c?.offsetParent ? c : sheet.querySelector('.tfMore'))?.focus({ preventScroll: true }); }
    } else {
      // only the parts that changed, so the drawing and a focused button stay
      parts.forEach((p, i) => {
        if (p === moreParts[i] || p.includes('data-cover-art') || box.children[i].contains(root.activeElement?.matches?.('input,select') ? root.activeElement : null)) return;
        if (lockedKeys().some((k) => box.children[i].querySelector('[data-drag="' + CSS.escape(k) + '"]'))) { stale = true; return; }
        const t = document.createElement('div');
        t.innerHTML = p;
        // where its rows and pages were scrolled stays (17 Nov: the thermostat's rows jumped back to the top each time
        // its reading changed, so they couldn't be scrolled down)
        const scrolled = [...box.children[i].querySelectorAll('.tfMoreCtl,.tfMorePage')].map((e) => e.scrollTop);
        const next = swapIn(box.children[i], t.firstElementChild);
        next.querySelectorAll('.tfMoreCtl,.tfMorePage').forEach((e, k) => { if (scrolled[k]) e.scrollTop = scrolled[k]; });
        fillIcons(next);
        drawPlantGraphs(next);
        mountDacs(next);
      });
      if (side !== moreSide) { const body = sheet.querySelector('.tfMoreSideBody'); if (body) body.innerHTML = side; moreSide = side; }
      // a day graph swapped in empty (its page redrawn for a new reading) is drawn again
      box.querySelectorAll('[data-day]').forEach((svg) => { if (!svg.innerHTML) drawDay(svg.dataset.day, svg, more.at); });
      box.querySelectorAll('[data-log]').forEach((el) => { if (!el.innerHTML) fillLog(el.dataset.log, el); });
      settlePages();
      if (!sheet.contains(root.activeElement)) refocus(sheet, was);
    }
    sheet.querySelector('.tfMorePair')?.classList.toggle('details', Boolean(more.details && side));
    // Settings: the popup grows to hold every field, no scrolling to reach Update (Matt, 26 Nov)
    // a reading's popup (a humidity, a temperature: its state, its graph, what happened) hugs what it holds too (Matt, 26 Nov:
    // "make those pop-up cards hug to the size of it"); the devices with controls keep their height
    const kind = more.id.includes('.') && !more.id.includes(':') ? more.id.split('.')[0] : '';
    sheet.querySelector('.tfMore')?.classList.toggle('hcFit', more.view === 'settings' || more.view === 'log' || (kind && !NEW_INFO.includes(kind)));
    moreParts = parts;
    syncArts();
  }
  // the page the popup is on (swiped, or picked from its dots) stays through redraws; the dots follow a swipe
  function settlePages() {
    const track = sheet.querySelector('[data-more-pages]');
    if (!track || !more) return;
    track.scrollTo({ left: (more.page || 0) * track.clientWidth, behavior: 'instant' });
    markPage();
    fitPage(track);
  }
  // the pages take the height of the one showing (a lock's Control is one row; its Info is more), the popup easing
  // between them
  function fitPage(track) {
    const page = track.children[more?.page || 0];
    if (page) track.style.height = page.scrollHeight + 'px';
  }
  function markPage() {
    const page = more?.page || 0;
    sheet.querySelectorAll('[data-more-page]').forEach((b) => {
      const on = Number(b.dataset.morePage) === page && (b.dataset.moreMode == null || b.dataset.moreMode === (more.mode || ''));
      if (b.hasAttribute('data-more-toggle')) { b.setAttribute('aria-pressed', String(on)); return; } // the light's (i)
      b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1;
    });
    // a colour light's Colour mode keeps its page still: a swipe changes the mode, not the page
    sheet.querySelector('[data-more-pages]')?.classList.toggle('tfMoreHold', Boolean(more.mode) && page === 0);
  }
  function turnPage(page, focus) {
    const track = sheet.querySelector('[data-more-pages]');
    if (!track || !more) return;
    more.page = Math.max(0, Math.min((more.pages || 2) - 1, page));
    track.scrollTo({ left: more.page * track.clientWidth, behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    markPage();
    fitPage(track);
    if (focus) sheet.querySelector('.tfMoreDots [aria-selected="true"]')?.focus({ preventScroll: true });
  }
  // a tab: its page (Info slides in), and for a colour light its mode, the second track changing in place
  function pickTab(page, mode, focus) {
    if (!more) return;
    if (mode != null && mode !== (more.mode || '')) {
      more.mode = mode;
      sheet.querySelectorAll('.tfMorePage').forEach((p) => { p.dataset.mode = mode; });
      sheet.querySelectorAll('[data-more-mode]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.moreMode === mode)));
    }
    turnPage(page, focus);
  }
  // a colour light's page swiped sideways: Controls to Colour and back (the strip itself turns to Info)
  let swipe = null;
  sheet.addEventListener('touchstart', (ev) => { const t = ev.touches[0]; swipe = ev.target.closest?.('[data-more-pages]') && !ev.target.closest?.('[data-drag],[data-blocks],.tfDacPad,[data-cover-art]') && ev.touches.length === 1 ? { x: t.clientX, y: t.clientY } : null; }, { passive: true }); // never from a slider, which a finger may cross
  sheet.addEventListener('touchend', (ev) => {
    if (!swipe || !more || (more.page || 0) !== 0 || !sheet.querySelector('[data-more-mode]')) { swipe = null; return; }
    const t = ev.changedTouches[0], dx = t.clientX - swipe.x, dy = t.clientY - swipe.y;
    swipe = null;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    // a view along, in the pill's order (Colour, the pad, Sliders); from Sliders, left is the strip's own turn to Info
    const views = [...sheet.querySelectorAll('.tfMoreDots [data-more-mode]')].map((b) => b.dataset.moreMode), at = views.indexOf(more.mode || '');
    if (dx > 0 && at > 0) pickTab(0, views[at - 1]);
    else if (dx < 0 && more.mode && at < views.length - 1) pickTab(0, views[at + 1]);
  }, { passive: true });
  let pageTimer = 0;
  sheet.addEventListener('scroll', (ev) => {
    const track = ev.target;
    if (!track.matches?.('[data-more-pages]') || !more) return;
    clearTimeout(pageTimer);
    pageTimer = setTimeout(() => { if (!more) return; /* closed meanwhile */ const page = Math.round(track.scrollLeft / Math.max(1, track.clientWidth)); if (page !== (more.page || 0)) { more.page = page; markPage(); fitPage(track); } }, 80);
  }, true);
  // the alarm's keypad types into its code; a lock's or the alarm's buttons send that code with them (17 Nov). The code
  // is kept on the popup, so a redraw doesn't lose it
  sheet.addEventListener('input', (ev) => { if (ev.target.matches?.('[data-code]') && more) more.code = ev.target.value; });
  // Enter in the alarm's code field sends it; Cancel and the big button under the keypad
  sheet.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && ev.target.matches?.('[data-code]') && more?.pending) { ev.preventDefault(); submitCode(); } });
  sheet.addEventListener('click', (ev) => {
    if (!more?.pending) return;
    if (ev.target.closest('[data-code-submit]')) submitCode();
    else if (ev.target.closest('[data-code-cancel]') && more.pending.first) closeMore();
    else if (ev.target.closest('[data-code-cancel]')) { endCode(); if (sheet.contains(root.activeElement)) root.activeElement.blur(); renderMore(); }
  });
  sheet.addEventListener('click', (ev) => {
    const key = ev.target.closest('[data-key]'), send1 = ev.target.closest('[data-coded]');
    if (!more || !(key || send1)) return;
    const field = sheet.querySelector('[data-code]');
    if (key) {
      const k = key.dataset.key, code = more.code || '';
      if (k === 'submit') { submitCode(); return; }
      if (more.codeState) { more.codeState = ''; more.codeSaid = ''; sheet.querySelector('.hcCodePad')?.classList.remove('wrong', 'right'); const said = sheet.querySelector('.hcCodeSaid'); if (said) said.textContent = ''; }
      more.code = k === 'clear' ? '' : k === 'back' ? code.slice(0, -1) : (code + k).slice(0, 12);
      if (field) field.value = more.code;
      return;
    }
    const [domain, service, id] = send1.dataset.coded.split('|'), code = more.code;
    if (domain === 'alarm_control_panel' && needsCode(id, service)) { askCode(id, service, send1); return; }
    more.code = ''; // cleared first: the popup redraws as the state changes
    if (field) field.value = '';
    send(domain, service, id, code ? { code } : null).catch(() => {});
  });
  // "5 minutes ago" moves on while it's open
  setInterval(() => { if (more) renderMore(); }, 15 * 1000);
  function openMore(id, opener) {
    // opened from inside a popup (a summary's device): it opens over the top of it (Matt, 11 Nov: not in its place; the
    // summary stays where it is, dimmed under it, and is back when the device's popup closes). One under at a time:
    // from inside a popup that's already over one, it opens in that popup's place, which keeps the size and place it
    // first opened at, with Back and the device's name where the other's was (Matt, 29 Oct). Back returns there
    const inside = Boolean(more && opener && sheet.contains(opener)), box = inside && sheet.querySelector('.tfMore');
    if (inside) more.scroll = box.scrollTop;
    if (inside && !more.under) {
      const pair = sheet.querySelector('.tfMorePair');
      const parked = { more, parts: moreParts, opener };
      pair.classList.add('still');
      pair.style.transform = '';
      pair.inert = true;
      under.innerHTML = '';
      under.appendChild(pair);
      under.classList.toggle('wide', sheet.classList.contains('wide'));
      under.hidden = false;
      sheet.hidden = true;
      sheet.innerHTML = '';
      more = { id, opener, back: null, frame: null, under: parked, at: Number(opener?.dataset?.at) || null };
      showMore();
      return;
    }
    more = { id, opener: inside ? more.opener : opener, back: inside ? more : null, frame: inside ? more.frame || { wide: box.classList.contains('wide'), h: box.offsetHeight } : null, under: inside ? more.under : null, at: Number(opener?.dataset?.at) || null };
    showMore();
  }
  let turning = false; // a new page in the open popup (a device, or Back)
  function showMore() {
    moreParts = [];
    turning = !sheet.hidden;
    arts.forEach((art, k) => { if (k !== more.id && sheet.contains(art.el)) { art.destroy(); arts.delete(k); } });
    padFirst();
    renderMore();
    turning = false;
  }
  function closeMore() {
    if (!more) return;
    // the Motion Lab's dialog close: the dim goes and it shrinks back, then it's taken away
    const was = more;
    closeDialog(sheet, () => { if (more === was) closeMoreNow(); });
  }
  function closeMoreNow() {
    const opener = more?.opener, parked = more?.under;
    more = null;
    arts.forEach((art, k) => { if (sheet.contains(art.el)) { art.destroy(); arts.delete(k); } });
    dacs.forEach((el, k) => { if (/^more2?:/.test(k)) dacs.delete(k); });
    sheet.hidden = true;
    sheet.innerHTML = '';
    const quiet = { preventScroll: true };
    if (parked) {
      // the popup it opened over comes back as it was, with what opened the device focused
      const pair = under.firstElementChild;
      more = parked.more;
      moreParts = parked.parts;
      if (pair) { pair.inert = false; sheet.appendChild(pair); }
      sheet.classList.toggle('wide', under.classList.contains('wide'));
      under.hidden = true;
      under.innerHTML = '';
      sheet.hidden = false;
      const box = sheet.querySelector('.tfMore');
      if (box) box.scrollTop = more.scroll || 0;
      renderMore();
      (parked.opener?.isConnected ? parked.opener : sheet.querySelector('[data-more-close]'))?.focus(quiet);
      return;
    }
    // focus goes back to what opened it, without moving the page
    if (opener?.isConnected) opener.focus(quiet);
    else if (opener?.dataset?.more) grid.querySelector('[data-more="' + CSS.escape(opener.dataset.more) + '"]')?.focus(quiet);
    else if (opener?.dataset?.summary) grid.querySelector('[data-summary="' + CSS.escape(opener.dataset.summary) + '"]')?.focus(quiet);
    else if (opener?.hasAttribute?.('data-favs-edit')) grid.querySelector('[data-favs-edit]')?.focus(quiet);
  }

  /* graphs: the last 24 hours of an open reading, and the balcony's solar */
  /* a plant's problems (Matt, 10 Nov: Maintenance's Monstera and Basil): each reading it's unhappy about (its state
     above says which, so the graph is headed with the reading's name), its last 24 hours, with a dashed line where the
     plant wants it (Home Assistant's plant ranges, as the made-up home checks them) */
  const PLANT_KEYS = { moisture: 'moisture', light: 'light', brightness: 'light', temperature: 'temperature', fertility: 'fertility', conductivity: 'fertility' };
  function plantProblems(id) {
    const said = String(attr(id).problem || ''), base = 'sensor.' + id.split('.')[1] + '_';
    return said === 'none' ? [] : said.split(',').map((x) => x.trim().split(' ')).map(([k, way]) => {
      const key = PLANT_KEYS[k], sid = base + key;
      if (!key || !states[sid] || !PLANT_RANGE[key]) return '';
      const unit = attr(sid).unit_of_measurement || '', [lo, hi] = PLANT_RANGE[key], low = way === 'low';
      return '<div class="tfMoreGroup tfPlantProblem"><div class="tfMoreGroupName">' + esc(nameOf(sid)) + '</div>' +
        '<svg class="tfGraph tfPlantGraph" data-plant-graph="' + esc(sid) + '" data-guide="' + (low ? lo : hi) + '" data-guide-word="' + esc('Wants ' + (low ? '' : 'up to ') + (low ? lo : hi).toLocaleString() + (unit === '%' ? '%' : unit ? ' ' + unit : '') + (low ? ' or more' : '')) + '" role="img" aria-label="' + esc(nameOf(sid)) + ', last 24 hours"></svg></div>';
    }).filter(Boolean);
  }
  const drawPlantGraphs = (scope) => scope.querySelectorAll('[data-plant-graph]').forEach((svg) => drawHistory(svg.dataset.plantGraph, svg, { guide: Number(svg.dataset.guide), guideWord: svg.dataset.guideWord }).then(() => drawIn(svg)));
  function plot(svg, pts, label, opts = {}) {
    const vals = pts.map((p) => p[1]).concat(opts.guide != null ? [opts.guide] : []), min = opts.zero ? 0 : Math.min(...vals), max = Math.max(...vals);
    const W = Math.max(120, svg.clientWidth || 260), H = Math.max(60, svg.clientHeight || 130), top = 8, bottom = H - 20;
    const t0 = Date.now() - 24 * 3600 * 1000, span = 24 * 3600 * 1000;
    const x = (t) => Math.max(0, Math.min(W, ((t - t0) / span) * W));
    const y = (v) => (max === min ? (top + bottom) / 2 : bottom - ((v - min) / (max - min)) * (bottom - top));
    let d = 'M' + x(pts[0][0]).toFixed(1) + ' ' + y(pts[0][1]).toFixed(1);
    if (M.graphs.curve === 'smooth' && pts.length > 2) d = smoothD(pts.map((p) => [x(p[0]), y(p[1])])); // every graph: the Motion Lab's smooth line
    else for (let i = 1; i < pts.length; i++) d += opts.smooth ? 'L' + x(pts[i][0]).toFixed(1) + ' ' + y(pts[i][1]).toFixed(1) : 'H' + x(pts[i][0]).toFixed(1) + 'V' + y(pts[i][1]).toFixed(1);
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('aria-label', label);
    svg.innerHTML = gridLines(W, top, bottom) + '<path d="' + d + 'V' + bottom + 'H' + x(pts[0][0]).toFixed(1) + 'Z" fill="' + (opts.colour || 'var(--primary)') + '" fill-opacity="' + (M.graphs.fill ? '.14' : '0') + '"/>' +
      '<path d="' + d + '" fill="none" stroke="' + (opts.colour || 'var(--primary)') + '" stroke-width="' + M.graphs.weight + '" stroke-linejoin="round" stroke-linecap="round"/>' +
      '<text x="0" y="' + (H - 4) + '">24 h ago</text><text x="' + W + '" y="' + (H - 4) + '" text-anchor="end">Now</text>' +
      (opts.guide != null ? '<line class="tfGuide" x1="0" x2="' + W + '" y1="' + y(opts.guide).toFixed(1) + '" y2="' + y(opts.guide).toFixed(1) + '"/>' +
        '<text class="tfGuideWord" x="' + W + '" y="' + (y(opts.guide) < 20 ? y(opts.guide) + 14 : y(opts.guide) - 5).toFixed(1) + '" text-anchor="end">' + esc(opts.guideWord || '') + '</text>' : '');
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
      // a made-up reading has no history to ask for: its day is the one its card drew (Matt, 16 Nov: the popup is where
      // a reading opens now, so its last 24 hours must be there too)
      if (isMadeUp(id) && Number.isFinite(Number(states[id]?.state))) pts = madeUpHistory(id).map(([t, v]) => [t, String(v)]);
      else try {
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
    // a plant's soil dries through the day (watered a day ago, 22 points wetter), and its light follows the sun, at its
    // brightest around midday, ending at now's reading (so a dry Monstera and a dim Basil show how they got there)
    if (isMadeUp(id) && id.endsWith('_moisture')) return [...Array(48)].map((_, i) => [now - (48 - i) * 30 * 60 * 1000, Math.round((v + 22 * Math.pow(1 - i / 48, 1.2)) * 10) / 10]);
    if (isMadeUp(id) && id.endsWith('_light')) {
      const sun = (t) => { const h = new Date(t).getHours() + new Date(t).getMinutes() / 60; return Math.max(0, Math.sin(((h - 6) / 14) * Math.PI)); };
      const k = (t) => 0.8 + 0.2 * sun(t);
      return [...Array(48)].map((_, i) => now - (48 - i) * 30 * 60 * 1000).map((t) => [t, Math.round((v * k(t)) / k(now))]);
    }
    return [...Array(48)].map((_, i) => [now - (48 - i) * 30 * 60 * 1000, Math.round(v * (0.96 + 0.04 * Math.sin(i / 6)) * 10) / 10]);
  }
  async function drawHistory(id, into, extra = {}) {
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
    plot(svg, pts, nameOf(id) + ', last 24 hours: ' + (growing ? '+' + f(vals[vals.length - 1] - vals[0]) : (min === max ? f(min) : f(min) + ' to ' + f(max))) + (unit ? ' ' + unit : ''), { smooth: id.endsWith('_solar_power'), zero: id.endsWith('_solar_power') , ...extra });
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
    const done = house.call(domain, service, d);
    if (done) return done === true ? Promise.resolve() : done;
    return Promise.resolve(callService(domain, service, d));
  }
  function run(spec, opener) {
    const [domain, service, id, json] = spec.split('|');
    if (domain === 'alarm_control_panel' && needsCode(id, service)) { askCode(id, service, opener); return; }
    send(domain, service, id, json ? JSON.parse(json) : null).catch(() => {});
  }
  // a cover's target while it's held (its drawing, its blocks or the keys): every view of it follows
  function holdCover(id, v) {
    dragging.set('pos|' + id, v);
    hold('pos|' + id);
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
    pressed.add('pos|' + id); hold('pos|' + id);
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
      pressed.delete('pos|' + id);
      holdCover(id, fine ? Math.round(live) : (Math.min(3, Math.floor(start / 25)) + 1) * 25);
      commit('pos', id);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }
  function pickArea(panel) {
    activeArea = panel.dataset.area;
    // in place, so the accordion slides like the move panels
    grid.querySelectorAll('.tfAreaPanel').forEach((p) => { const on = p === panel; p.classList.toggle('active', on); p.setAttribute('aria-expanded', String(on)); p.querySelector('.panelExpanded')?.toggleAttribute('inert', !on); });
    units.set('areas', areasHtml(grid.querySelector('[data-k="areas"]')?.style.order || 1));
    setTimeout(() => showOpenArea(true), 340); // once it has opened out
  }
  /* a phone's Areas: another area in the card slides in (Matt, 19 Nov: "make the transition be a slide"): one further
     along comes in from the right as the one going leaves to the left, and the other way back */
  function pickPhoneArea(id) {
    const el = grid.querySelector('.tfAreas[data-k="areas"]');
    if (!el || !id || id === activeArea) return;
    const old = el.querySelector('.tfAreaStage>.tfRoomTile'), ghost = old && !reduced() ? old.cloneNode(true) : null;
    const order = areasShown().map((r) => r.id), dir = order.indexOf(id) > order.indexOf(activeArea) ? 1 : -1;
    activeArea = id;
    const html = areasHtml(el.style.order || 1);
    units.set('areas', html);
    replace(el, html);
    const stage = grid.querySelector('.tfAreas[data-k="areas"] .tfAreaStage'), tile = stage?.querySelector(':scope>.tfRoomTile');
    if (!stage || reduced()) return;
    stage.style.setProperty('--dir', dir);
    if (ghost) {
      ghost.classList.add('tfAreaGoing');
      ghost.inert = true;
      ghost.setAttribute('aria-hidden', 'true');
      stage.appendChild(ghost);
      setTimeout(() => ghost.remove(), 340);
      clearTimeout(areaSliding);
      areaSliding = setTimeout(() => { areaSliding = 0; if (stale) refresh(); }, 340);
    }
    if (tile) { tile.classList.add('tfAreaLand'); tile.addEventListener('animationend', () => tile.classList.remove('tfAreaLand'), { once: true }); }
  }
  // a sideways swipe on the card: the next area or the one before (none past the ends). It's a swipe once the finger has
  // gone BAR_SLOP more across than up or down; up and down is the page's, which scrolls as ever (the card is pan-y)
  const SWIPE = 40;
  function swipeAreas(ev) {
    if (ev.pointerType === 'mouse' || !ev.isPrimary || !ev.target.closest?.('.tfAreaStage') || !PHONE_AREAS.matches) return;
    const x0 = ev.clientX, y0 = ev.clientY, id = ev.pointerId;
    let axis = null;
    const move = (e) => { if (e.pointerId === id && !axis && Math.hypot(e.clientX - x0, e.clientY - y0) >= BAR_SLOP) axis = Math.abs(e.clientX - x0) > Math.abs(e.clientY - y0) ? 'x' : 'y'; };
    const end = (e) => {
      if (e.pointerId !== id) return;
      removeEventListener('pointermove', move, true); removeEventListener('pointerup', end, true); removeEventListener('pointercancel', end, true);
      const dx = e.clientX - x0;
      if (e.type !== 'pointerup' || axis !== 'x' || Math.abs(dx) < SWIPE) return;
      // the swipe isn't a tap on what it started on
      const swallow = (c) => { c.stopPropagation(); c.preventDefault(); };
      root.addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => root.removeEventListener('click', swallow, true), 400);
      const shown = areasShown(), to = shown[shown.findIndex((r) => r.id === activeArea) + (dx < 0 ? 1 : -1)];
      if (to) pickPhoneArea(to.id);
    };
    addEventListener('pointermove', move, true); addEventListener('pointerup', end, true); addEventListener('pointercancel', end, true);
  }
  // what a bar sets, from 0–1 along it
  const DRAG = {
    bright: { value: (id, f) => Math.round(f * 100), text: (id, v) => (v ? v + '%' : 'Off'), send: (id, v) => (v > 0 ? ['light', 'turn_on', { brightness_pct: v }] : ['light', 'turn_off', {}]) },
    ct: { value: (id, f) => { const [lo, hi] = kelvinRange(id); return Math.round(lo + f * (hi - lo)); }, text: (id, v) => v.toLocaleString() + 'k', send: (id, v) => ['light', 'turn_on', { color_temp_kelvin: v }] },
    hue: { value: (id, f) => Math.round(f * 360), text: () => 'Colour', send: (id, v) => ['light', 'turn_on', { hs_color: [v, Math.max(60, attr(id).hs_color?.[1] || 100)] }] },
    pos: { value: (id, f) => Math.round(f * 100), text: (id, v) => Math.round(v) + '%', send: (id, v) => ['cover', 'set_cover_position', { position: Math.round(v) }] },
    tilt: { value: (id, f) => Math.round(f * 100), text: (id, v) => 'Tilt ' + v + '%', send: (id, v) => ['cover', 'set_cover_tilt_position', { tilt_position: v }] },
    vol: { value: (id, f) => Math.round(f * 100) / 100, text: (id, v) => Math.round(v * 100) + '%', send: (id, v) => ['media_player', 'volume_set', { volume_level: v }] },
    // the redrawn popups' tracks (17 Nov): warmth flipped (cold at the left), a fan's speed, a valve's position, a
    // cover's tilt as a level
    ctf: { value: (id, f) => { const [lo, hi] = kelvinRange(id); return Math.round(hi - f * (hi - lo)); }, text: (id, v) => v.toLocaleString() + 'k', send: (id, v) => ['light', 'turn_on', { color_temp_kelvin: v }] },
    fan: { value: (id, f) => { const st = attr(id).percentage_step || 1; return Math.round((f * 100) / st) * st; }, text: (id, v) => Math.round(v) + '%', send: (id, v) => ['fan', 'set_percentage', { percentage: Math.round(v) }] },
    valve: { value: (id, f) => Math.round(f * 100), text: (id, v) => v + '%', send: (id, v) => ['valve', 'set_valve_position', { position: v }] },
    tiltp: { value: (id, f) => Math.round(f * 100), text: (id, v) => v + '%', send: (id, v) => ['cover', 'set_cover_tilt_position', { tilt_position: v }] },
    // the light popup's vertical colour (17 Nov): red at the top, through the spectrum, to red at the bottom
    huev: { value: (id, f) => Math.round((1 - f) * 360), text: () => 'Colour', send: (id, v) => ['light', 'turn_on', { hs_color: [v, Math.max(60, attr(id).hs_color?.[1] || 100)] }] },
  };
  function showDrag(bar, kind, id, f) {
    const v = DRAG[kind].value(id, f);
    dragging.set(kind + '|' + id, v);
    hold(kind + '|' + id);
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
    } else if (bar.dataset.axis === 'y') {
      // a vertical slider (the light's popup, 17 Nov): its level rises from the bottom; its handle sits as high as it's set
      if (i) i.style.height = pct;
      else { let b = bar.querySelector('b'); if (!b) { b = document.createElement('b'); bar.appendChild(b); } b.style.top = Math.round((1 - f) * 1000) / 10 + '%'; }
    } else if (i) i.style.width = pct;
    else { let b = bar.querySelector('b'); if (!b) { b = document.createElement('b'); bar.appendChild(b); } b.style.left = pct; }
    bar.setAttribute('aria-valuenow', String(Math.round(f * 100)));
    const val = bar.querySelector('.tfBarVal'); // a redrawn popup's track says its value inside it
    if (val) val.textContent = DRAG[kind].text(id, v);
    const meta = bar.closest('.tfMore') ? bar.closest('.tfMore').querySelector('.tfMoreState') : bar.closest('.tfAction')?.querySelector('.tfName .activityRowMeta');
    if (meta) meta.textContent = DRAG[kind].text(id, v);
  }
  function commit(kind, id) {
    const key = kind + '|' + id, v = dragging.get(key), gen = dragGen.get(key);
    const [domain, service, data] = DRAG[kind].send(id, v);
    // settled: the bar is let go, unless a later hold has it; the page is drawn again either way
    const done = () => setTimeout(() => { if (dragGen.get(key) === gen) dragging.delete(key); refresh(); }, 1500);
    send(domain, service, id, data).then(done, done);
  }
  // the same controls work on the page and in the stand-in more-info
  function bindControls(el) {
    el.addEventListener('click', (ev) => {
      const t = ev.target.closest('[data-act],[data-acts],[data-more],[data-more-close],[data-more-back],[data-details],[data-details-close],[data-go],[data-summary],[data-star],[data-favs-edit],[data-area-back],[data-board-more],[data-board-act],[data-board-show],[data-fav-hide],[data-energy-pick],[data-more-page],[data-more-view],[data-more-pop],[data-more-menu],[data-settings-save],[data-path],[data-area-pick],.tfAreaPanel');
      if (boardOpen && !ev.target.closest('.tfBoardMenu,[data-board-more]')) closeBoardMenu();
      if (!t || !el.contains(t) || t.disabled) return;
      if (t.dataset.boardMore) { if (boardOpen?.key === t.dataset.boardMore) closeBoardMenu(true); else openBoardMenu(t.dataset.boardMore, t); }
      else if (t.dataset.boardAct) boardAct(boardOpen.key, t.dataset.boardAct);
      else if (t.dataset.boardShow) showCard(t.dataset.boardShow);
      else if (t.dataset.favHide) setFavShown(t.dataset.favHide, false);
      else if (t.dataset.energyPick) pickEnergy(t.dataset.energyPick);
      else if (t.dataset.areaPick) pickPhoneArea(t.dataset.areaPick);
      else if (t.dataset.act) run(t.dataset.act, t);
      else if (t.hasAttribute('data-details')) toggleDetails(!more?.details);
      else if (t.hasAttribute('data-details-close')) toggleDetails(false);
      else if (t.dataset.summary) openSummary(t.dataset.summary, t);
      else if (t.dataset.star) toggleStar(t.dataset.star);
      else if (t.hasAttribute('data-more-back')) { const from = more.id; more = more.back; showMore(); sheet.querySelector('.tfMore [data-more="' + CSS.escape(from) + '"]')?.focus({ preventScroll: true }); }
      else if (t.hasAttribute('data-favs-edit')) openMore('favourites', t);
      else if (t.dataset.acts) JSON.parse(t.dataset.acts).forEach(([domain, service, id, data]) => send(domain, service, id, data).catch(() => {}));
      else if (t.dataset.more) openMore(t.dataset.more, t);
      else if (t.hasAttribute('data-more-close')) closeMore();
      else if (t.hasAttribute('data-settings-save')) saveSettings();
      else if (t.dataset.morePop != null) { more.view = more.trail?.length ? more.trail.pop() : null; renderMore(); sheet.querySelector('[data-more-pop],[data-more-close]')?.focus({ preventScroll: true }); }
      else if (t.dataset.moreView != null) { (more.trail ||= []).push(more.view || null); more.view = t.dataset.moreView || null; renderMore(); sheet.querySelector('[data-more-pop],[data-more-close]')?.focus({ preventScroll: true }); }
      else if (t.hasAttribute('data-more-menu')) { const m = t.nextElementSibling, open = m.hidden; m.hidden = !open; t.setAttribute('aria-expanded', String(open)); if (open) m.querySelector('button')?.focus({ preventScroll: true }); }
      else if (t.dataset.morePage) pickTab(t.hasAttribute('data-more-toggle') && (more?.page || 0) === Number(t.dataset.morePage) ? 0 : Number(t.dataset.morePage), t.dataset.moreMode ?? null, true); // the (i) again: back
      else if (t.dataset.path) go(t.dataset.path);
      else if (t.dataset.go) openArea('room:' + t.dataset.go);
      else if (t.hasAttribute('data-area-back')) closeArea();
      else if (t.classList.contains('tfAreaPanel') && !t.classList.contains('active')) pickArea(t);
    });
    el.addEventListener('keydown', (ev) => {
      const t = ev.target;
      if (t.dataset?.more && t.tagName !== 'BUTTON' && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); openMore(t.dataset.more, t); }
      if (t.dataset?.energyPick && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); pickEnergy(t.dataset.energyPick); }
      if (t.classList?.contains('tfAreaPanel') && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); pickArea(t); }
      if (t.dataset?.summary && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); openSummary(t.dataset.summary, t); }
      if (ev.key === 'Escape' && boardOpen && el === grid) { ev.preventDefault(); closeBoardMenu(true); return; }
      if (ev.key === 'Escape' && cardEdit && el === grid) { ev.preventDefault(); closeCardEditor(); return; }
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
      const key = kind + '|' + id;
      pressed.add(key); hold(key); // from here to the pointer going up, nothing redraws the bar
      const inset = kind === 'tilt' ? 4 : 0; // the tilt bar's fill sits 4 in
      const up_down = bar.dataset.axis === 'y'; // a vertical slider: up is more
      const span = () => (up_down ? bar.getBoundingClientRect().height : bar.getBoundingClientRect().width - inset * 2);
      const at = (e2) => { const r = bar.getBoundingClientRect(); return Math.max(0, Math.min(1, up_down ? 1 - (e2.clientY - r.top) / span() : (e2.clientX - r.left - inset) / span())); };
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
          if (!fixed && (up_down ? Math.abs(e2.clientY - y0) > Math.abs(e2.clientX - x0) : Math.abs(e2.clientX - x0) > Math.abs(e2.clientY - y0))) slide(); else mode = 'gone';
        } else if (mode === 'pressed' && moved(e2, 4)) mode = 'dragging';
        if (mode === 'sliding') showDrag(bar, kind, id, Math.max(0, Math.min(1, from + (up_down ? y0 - e2.clientY : e2.clientX - x0) / span())));
        else if (mode === 'dragging') showDrag(bar, kind, id, at(e2));
      };
      const up = (e2) => {
        ['pointermove', 'pointerup', 'pointercancel'].forEach((t, i) => bar.removeEventListener(t, i ? up : move));
        bar.classList.remove('held');
        if (heldBar === bar) heldBar = null;
        pressed.delete(key);
        if (mode === 'sliding' || mode === 'dragging') commit(kind, id);
        else if (e2.type === 'pointerup' && fixed) run(act('light', 'toggle', id));
        else if (e2.type === 'pointerup' && off && (mode === 'waiting' || mode === 'pressed')) send('light', 'turn_on', id).catch(() => {});
        if (stale && mode !== 'sliding' && mode !== 'dragging') refresh(); // what was kept back while the bar was pressed
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
    grid.addEventListener('pointerdown', swipeAreas); // a phone's Areas card
    bindAce(); // Edit area card
    bindControls(sheet);
    sheet.addEventListener('click', (ev) => { if (ev.target === sheet) closeMore(); });
    // Home, from an area's page, goes back to the house
    root.getElementById('homeNav')?.addEventListener('click', () => { if (areaPage) closeArea(); });
    // the dashboard's edit mode: the pencil in the bottom bar, and dragging on the board
    root.querySelector('.bottomNav')?.insertAdjacentHTML('beforeend', '<button class="navBtn" id="dashEditNav" type="button" title="Edit" aria-label="Edit the dashboard" aria-pressed="false" hidden>' + PENCIL + '</button>');
    $('dashEditNav')?.addEventListener('click', () => (overview ? setHomeEditing(!homeEditing) : setEditing(!editing)));
    grid.addEventListener('pointerdown', cardItemDown, true); // a card's parts, while its page is open
    grid.addEventListener('pointerdown', boardDown);
    grid.addEventListener('pointerdown', homeDown);
    grid.addEventListener('scroll', (ev) => { if (ev.target.classList?.contains('hcSchedList') || ev.target.classList?.contains('hcFadeList')) schedFade(ev.target); }, true);
    grid.addEventListener('click', (ev) => { if (overview && homeEditing && ev.target.closest('.tfBoardItem')) { ev.preventDefault(); ev.stopPropagation(); } }, true);
    // the dashboard's bottom row holds as many tiles as fit, and its rows are measured again as the page changes size
    new ResizeObserver(() => { if (app.classList.contains('tfDash') && dashCols() !== dashColsSeen) refresh(); else queueFit(); }).observe(grid);
    window.addEventListener('resize', queueFit, { passive: true });
    // Escape folds the details away first, then closes
    sheet.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') { ev.stopPropagation(); if (more?.details) toggleDetails(false); else closeMore(); }
    else if ((ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') && ev.target.closest?.('.tfMoreDots')) {
      // tab by tab: a colour light's Colour and Controls are two tabs on one page
      ev.preventDefault();
      const all = [...sheet.querySelectorAll('.tfMoreDots [data-more-page]')], at = all.findIndex((b) => b.getAttribute('aria-selected') === 'true');
      const next = all[Math.max(0, Math.min(all.length - 1, at + (ev.key === 'ArrowRight' ? 1 : -1)))];
      if (next) pickTab(Number(next.dataset.morePage), next.dataset.moreMode ?? null, true);
    }
  });
  }

  applyDensity();
  return {
    // HomeCore demo: the site's rail opens Home and the Weather page, and its Devices page lists the same states
    openArea, closeArea,
    get page() { return areaPage; },
    get model() { return model; },
    // Home (the overview) or Dashboards (the board you edit): the same view, its own cards
    get overview() { return overview; },
    // a device's more info, from a page of the demo's own (My Cool Dashboard)
    more(id, opener) { openMore(id, opener); },
    // a device's more info open on its History (its graph and what happened): the Activity page's rows
    barGlyph,
    moreHistory(id, opener) { openMore(id, opener); if (more?.id === id) { more.view = 'log'; more.trail = []; renderMore(); } },
    setOverview(on) {
      if (overview === on) return;
      if (editing) setEditing(false);
      if (homeEditing) setHomeEditing(false);
      overview = on;
      lastPlaced = new Map();
      if (testFocus && grid) render();
    },
    // every icon on the demo's pages is the dashboard's chip (Matt, 9 Nov: "make it all the same"): a device's icon slot
    // and its colour while on, any colour by the same rule, and the filling and fitting of the glyphs
    chip(id) { const c = kindRgb(id); return iconSlot(id, iconFor(id)) + (c ? ' data-light style="' + colourVars(c) + '"' : ''); },
    tint(hex) { return colourVars([1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))); },
    // a light's colour on its card (the action card's chip takes it while on)
    light(id) { return lightAttrs(id); },
    // where a light's brightness was while it was last on (its off line)
    lastBright(id) { return lastBright[id] ?? null; },
    // HomeCore settings drawn again (its lights' list, after a search or another grouping)
    resync() { syncSettings(); },
    // the official area card, for a page of the demo's own (My Cool Dashboard), at a width in columns (1 or 2) and rows;
    // bind() gives that page the controls' clicks (its lights, its devices, opening the room)
    areaCard(id, cols = 2, rows = 2, given = null) { const r = model.rooms.find((x) => x.id === id); return r ? roomTile(r, null, ' data-cols="' + cols + '" data-rows="' + rows + '"', false, given) : ''; },
    // what an area card can hold: its main reading and its four spaces as they start, and everything it could hold, by
    // device (Edit area card's list), each with its name
    areaSlots(id) {
      const r = model.rooms.find((x) => x.id === id);
      if (!r) return null;
      const keys = roomKeys(r), start = areaCard(r), label = (it) => { const k = slotKey(r, it, keys); return k ? (it.startsWith('key:') ? k.label : nameOf(it)) : null; };
      return { main: start.main, slots: start.slots, label, groups: aceGroups(r).map((g) => ({ name: g.name, items: g.items.filter((it) => label(it)) })).filter((g) => g.items.length) };
    },
    bind(el) { bindControls(el); },
    // HomeCore's toast, with Undo when given one
    toast(message, undo = null) { toast(message, undo); },
    paint(scope) { fillIcons(scope); },
    // Settings' choices measured again (they're measured on resize; a late font changes their words' widths too)
    refit() { fitChoices(); },
    // the summaries to choose from, and switching one (the edit tray's popout)
    sums() { return Object.entries(SUMMARIES).map(([key, x]) => ({ key, ...x, on: sumOn(key) })); },
    setSum(key, on) {
      if (EXTRA_SUMS.includes(key)) { const shown = new Set(prefs.shownSums || []); if (on) shown.add(key); else shown.delete(key); prefs = { ...prefs, shownSums: [...shown] }; }
      else { const hidden = new Set(prefs.hiddenSums || []); if (on) hidden.delete(key); else hidden.add(key); prefs = { ...prefs, hiddenSums: [...hidden] }; }
      savePrefs(); refresh();
    },
    // the areas to choose from for the Areas card, and switching one (the edit tray's popout)
    areas() { const shown = new Set(areasShown().map((r) => r.id)); return areaRooms.map((r) => ({ id: r.id, name: r.name, icon: r.icon || 'mdi:texture-box', on: shown.has(r.id) })); },
    setArea(id, on) {
      const off = new Set(prefs.dash?.areasOff || []);
      if (on) off.delete(id); else off.add(id);
      saveDash({ ...dashPrefs(), areasOff: [...off] });
      refresh();
    },
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
