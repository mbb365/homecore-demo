// My Cool Dashboard (Matt, 26 Nov): the custom dashboard rebuilt as Home Assistant's own, a sections view, in HomeCore's
// look, with fewer settings. A dismissable note; sections, each its cards in a 12-column grid; the pencil for edit mode,
// where a section can be added, renamed or deleted and each card edited, duplicated or deleted; Add card opens Home
// Assistant's "Add to dashboard" (by card or by entity) with seven cards only: Tile, Area, Button, Entities, Glance,
// History graph and Sensor. A card opens in its editor (its settings on the left, a preview on the right), Cancel or
// Save. Saved in this browser.
import { mountWeatherBento } from '../weather-bento.js';

const KEY = 'homecore-demo-dashboard';
const START = () => ({ sections: [{ title: 'New section', cards: [] }], note: true });
const HOUR = 36e5;

// the cards on offer, in Home Assistant's order and words, each its size in the section's 12 columns (its grid_options)
const CARDS = [
  { type: 'tile', name: 'Tile', about: 'The tile card gives you a quick overview of your entity. The card allows you to toggle the entity and show the more info dialog.', cols: 6 },
  { type: 'area', name: 'Area', about: 'The area card shows the entities of an area, with its sensors.', cols: 12 },
  { type: 'button', name: 'Button', about: 'The button card allows you to add buttons to perform tasks.', cols: 3 },
  { type: 'entities', name: 'Entities', about: 'The entities card is the most common type of card. It groups items together into lists.', cols: 12 },
  { type: 'glance', name: 'Glance', about: 'The glance card is useful to group multiple sensors in a compact overview.', cols: 12 },
  { type: 'history-graph', name: 'History graph', about: 'The history graph card allows you to display a graph for each of the entities listed.', cols: 12 },
  { type: 'sensor', name: 'Sensor', about: 'The sensor card gives you a quick overview of your sensors state with an optional graph to visualize change over time.', cols: 6 },
];
const CARD = Object.fromEntries(CARDS.map((c) => [c.type, c]));
/* Nice to have edition (Matt, 26 Nov: "add in our weather widgets… a section for pre-made cards"): the Weather page's
   widgets, each the dashboard's own, by its key, its widget on the Weather page and its name; the forecast, Next hours and
   Compared to average two columns wide */
const WIDGETS = [['wx', 'current', 'Weather'], ['hourly', 'hourly', 'Next hours'], ['sun', 'sun', 'Sun'], ['moon', 'moon', 'Moon'], ['uv', 'uv_index', 'UV index'], ['aq', 'aq_tile', 'Air quality'],
  ['pollen', 'pollen_tile', 'Pollen'], ['radar', 'radar_tile', 'Rain radar'], ['humidity', 'humidity', 'Humidity'], ['pressure', 'pressure', 'Pressure'], ['wind', 'wind', 'Wind'],
  ['visibility', 'visibility', 'Visibility'], ['avg', 'compared_to_average', 'Compared to average']];
const WIDE_WIDGETS = ['wx', 'hourly', 'avg'];
const widgetOf = (k) => WIDGETS.find((x) => x[0] === k) || WIDGETS[0];
CARD['hc-weather'] = { type: 'hc-weather', name: 'Weather widget', cols: 6 };
/* each card's size in its section, as Home Assistant's grid_options: columns of 12 (3 a step, 1 in precise mode) and rows
   of a tile's height (60, 16 between), or auto (as tall as it needs); full width whatever the section's size */
// (a weather widget as tall as it needs at its width, so none spills into the next)
const GRID = { 'hc-weather': { columns: 6, rows: 'auto' }, tile: { columns: 6, rows: 1 }, button: { columns: 3, rows: 2 }, sensor: { columns: 6, rows: 2 }, area: { columns: 12, rows: 2 }, entities: { columns: 12, rows: 'auto' }, glance: { columns: 12, rows: 'auto' }, 'history-graph': { columns: 12, rows: 'auto' } };
// how many slots an area card fills (set by the page, which knows the areas)
let slotCount = () => 0;
const sizeOf = (c) => {
  let d = GRID[c.type] || { columns: 12, rows: 'auto' };
  const g = c.grid_options || {};
  const n = c.features?.length || 0, rows = g.rows ?? (c.type === 'tile' ? 1 + (c.features_position === 'inline' ? Math.min(1, n) : n) : d.rows); // the action card a row taller for each control
  if (c.type === 'hc-weather' && WIDE_WIDGETS.includes(c.widget) && g.columns == null) d = { ...d, columns: 12 };
  // an area card holds two slots at Small: more than two and it's Medium at least (Matt, 26 Nov: "it should automatically
  // switch to the medium format as soon as the person goes beyond the 2 slots")
  const fit = c.type === 'area' && rows !== 'auto' && rows < 3 && slotCount(c) > 2 ? 3 : rows;
  return { columns: g.columns === 'full' ? 12 : g.columns ?? d.columns, rows: fit, full: g.columns === 'full' };
};
const ROW = 60, GAP = 16;
const slotStyle = (c) => { const z = sizeOf(c); return (z.full ? 'grid-column:1/-1;' : '') + '--cols:' + z.columns + (z.rows === 'auto' ? '' : ';--rows:' + z.rows + ';height:' + (z.rows * ROW + (z.rows - 1) * GAP) + 'px'); };
// the screens Home Assistant's Screen condition offers, by its breakpoints
const SCREENS = [['mobile', 'Mobile', '(max-width: 767px)'], ['tablet', 'Tablet', '(min-width: 768px) and (max-width: 1023px)'], ['desktop', 'Desktop', '(min-width: 1024px) and (max-width: 1279px)'], ['wide', 'Wide', '(min-width: 1280px)']];
const USERS = [['wembely', 'Wembely'], ['red', 'Red'], ['gobo', 'Gobo']];
const ME = 'wembely';
const CONDITIONS = { state: 'Entity state', numeric_state: 'Entity numeric state', screen: 'Screen', user: 'User' };
/* the tile card's editor is Concept A (Matt's tile editor concept, home-assistant/frontend #53898): Essentials (entity,
   name as one row of chips, state, features), Appearance (icon & colour, structure, extras), Layout, Extras
   (interactions, visibility). The other cards keep Home Assistant's Config, Visibility and Layout */
const TILE_TABS = [['essentials', 'Essentials'], ['appearance', 'Appearance'], ['layout', 'Layout'], ['extras', 'Extras']];
const CARD_TABS = [['config', 'Config'], ['visibility', 'Visibility'], ['layout', 'Layout']];
const NAME_PARTS = { entity: 'Entity', device: 'Device', area: 'Area', floor: 'Floor' };
const COLOURS = [['', 'State color'], ['primary', 'Primary', '#03a9f4'], ['accent', 'Accent', '#ff9800'], ['red', 'Red', '#f44336'], ['pink', 'Pink', '#e91e63'], ['purple', 'Purple', '#9c27b0'],
  ['indigo', 'Indigo', '#3f51b5'], ['blue', 'Blue', '#2196f3'], ['cyan', 'Cyan', '#00bcd4'], ['teal', 'Teal', '#009688'], ['green', 'Green', '#4caf50'], ['lime', 'Lime', '#cddc39'],
  ['yellow', 'Yellow', '#ffeb3b'], ['amber', 'Amber', '#ffc107'], ['orange', 'Orange', '#ff9800'], ['deep-orange', 'Deep orange', '#ff5722'], ['brown', 'Brown', '#795548'], ['grey', 'Grey', '#9e9e9e']];
const ACTIONS = [['more-info', 'More info'], ['toggle', 'Toggle'], ['none', 'Nothing']];
const TOGGLES = ['light', 'switch', 'fan', 'input_boolean', 'humidifier', 'automation'];
// a tile's features for a light, as Home Assistant names them (its tile card's light features, and Toggle)
const FEATURES = { 'light-brightness': 'Light brightness', 'light-color-temp': 'Light color temperature', 'light-color': 'Light color', toggle: 'Toggle' };

export function renderSections(page, ctx) {
  const { getHass, esc, icon, device, paint, head, homecore } = ctx;
  let dash = START();
  try { dash = { ...START(), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch (_e) { /* a fresh one */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(dash)); } catch (_e) { /* this visit only */ } };
  let editing = false, dialog = null, histories = new Map(), lastStates = null;
  /* every change can be taken back (Matt, 26 Nov: "an undo button in the top corner next to the done"): the dashboard as it
     was before each change, newest last; Undo (beside Done, or in a change's toast) puts the last one back */
  const history = [];
  const remember = () => { history.push(JSON.stringify(dash.sections)); if (history.length > 50) history.shift(); };
  const undo = () => { const was = history.pop(); if (was == null) return; dash.sections = JSON.parse(was); save(); flash = null; draw(); homecore.toast?.('Undone'); };
  const told = (message, canUndo) => homecore.toast?.(message, canUndo ? undo : null);
  let flash = null; // the card just added, ringed in blue for a moment
  const hass = () => getHass();
  const st = (id) => hass()?.states?.[id];
  const attr = (id) => st(id)?.attributes || {};
  const nameOf = (id) => attr(id).friendly_name || id;
  const cap = (s) => { const t = String(s ?? '').replace(/_/g, ' '); return t.charAt(0).toUpperCase() + t.slice(1); };
  const rooms = () => homecore.model?.rooms || [];
  // a state in Home Assistant's words: a reading with its unit, a light's brightness, a cover's position, a thermostat's action
  function stateText(id) {
    const s = st(id); if (!s) return 'Unavailable';
    const d = id.split('.')[0], a = s.attributes, n = Number(s.state);
    if (d === 'light' && s.state === 'on' && a.brightness != null) return 'On · ' + Math.round((a.brightness / 255) * 100) + '%';
    if (d === 'cover') return a.current_position != null && s.state === 'open' && a.current_position < 100 ? 'Open · ' + a.current_position + '%' : cap(s.state);
    if (d === 'climate') return cap(a.hvac_action || s.state) + (a.temperature != null ? ' · ' + a.temperature + ' °C' : '');
    if (d === 'binary_sensor') {
      const on = s.state === 'on', dc = a.device_class;
      if (dc === 'moisture') return on ? 'Wet' : 'Dry';
      if (['door', 'window', 'opening', 'garage_door'].includes(dc)) return on ? 'Open' : 'Closed';
      if (['motion', 'occupancy', 'presence'].includes(dc)) return on ? 'Detected' : 'Clear';
      return on ? 'On' : 'Off';
    }
    if (s.state !== '' && Number.isFinite(n) && a.unit_of_measurement) return (Number.isInteger(n) ? n : n.toFixed(1)) + (a.unit_of_measurement === '%' ? '' : ' ') + a.unit_of_measurement;
    return cap(s.state);
  }
  const isOn = (id) => ['on', 'open', 'unlocked', 'playing', 'heat', 'cool'].includes(st(id)?.state);
  const entities = (pred = () => true) => Object.keys(hass()?.states || {}).filter((id) => !id.startsWith('update.') && pred(id)).sort((x, y) => nameOf(x).localeCompare(nameOf(y)));
  const numeric = (id) => id.startsWith('sensor.') && Number.isFinite(Number(st(id)?.state)) && attr(id).unit_of_measurement;
  const first = (pred, fallback) => entities(pred)[0] || fallback;

  // a new card as Home Assistant suggests it: one of your entities already in it (Sensor shows a humidity, as asked)
  function fresh(type) {
    const light = first((id) => id.startsWith('light.')), humid = first((id) => numeric(id) && attr(id).device_class === 'humidity'), temp = first((id) => numeric(id) && attr(id).device_class === 'temperature');
    const some = entities((id) => /^(light|switch|lock|cover|climate)\./.test(id)).slice(0, 3);
    return {
      tile: { type: 'tile', entity: light },
      area: { type: 'area', area: rooms()[0]?.id || '' },
      button: { type: 'button', entity: light, show_name: true, show_icon: true },
      entities: { type: 'entities', entities: some },
      glance: { type: 'glance', entities: entities((id) => numeric(id)).slice(0, 3), show_name: true, show_state: true },
      'history-graph': { type: 'history-graph', entities: [temp].filter(Boolean), hours_to_show: 24 },
      sensor: { type: 'sensor', entity: humid, graph: 'line', hours_to_show: 24 },
    }[type];
  }

  /* ---- the area card's own main reading and spaces (Matt, 26 Nov: "list the entities and put them into the slots…
     the same way that you do the features") ---- */
  const slotsOf = (c) => { const a = homecore.areaSlots?.(c.area); return a ? { main: c.main ?? a.main, slots: c.slots ?? a.slots.filter(Boolean) } : { main: null, slots: [] }; };
  const areaGiven = (c) => (c.main == null && c.slots == null ? null : (() => { const s = slotsOf(c); return { main: s.main, slots: [0, 1, 2, 3].map((i) => s.slots[i] ?? null) }; })());
  const AREA_SIZES = [[2, 'Small'], [3, 'Medium'], [4, 'Large'], [5, 'XL']];
  slotCount = (c) => slotsOf(c).slots.length;
  /* ---- the tile's name and state, as Concept A sets them ---- */
  // a name is a row of parts, read in order: typed text, or the entity's, device's, area's or floor's name
  const partName = (id, p) => {
    if (p.type === 'text') return p.text || '';
    const h = hass(), ent = h?.entities?.[id], dev = ent?.device_id ? h?.devices?.[ent.device_id] : null, room = rooms().find((r) => r.id === areaOf(id));
    if (p.type === 'device') return dev?.name_by_user || dev?.name || nameOf(id);
    if (p.type === 'area') return room?.name || '';
    if (p.type === 'floor') return (room?.floor && h?.floors?.[room.floor]?.name) || 'Ground floor';
    // the entity's own name: its friendly name less its area's at the start
    const n = nameOf(id); return room && n.toLowerCase().startsWith(room.name.toLowerCase() + ' ') ? n.slice(room.name.length + 1) : n;
  };
  const nameParts = (c) => c.name_parts || (c.name ? [{ type: 'text', text: c.name }] : [{ type: 'entity' }]);
  const tileName = (c) => (c.name_parts ? c.name_parts.map((p) => partName(c.entity, p)).filter(Boolean).join(' ') || nameOf(c.entity) : c.name || nameOf(c.entity));
  // what the state line says: Home Assistant's default for the kind (a light its brightness), else the content picked
  const STATE_DEFAULT = { light: 'brightness', climate: 'current_temperature', cover: 'current_position', fan: 'percentage' };
  const stateOptions = (id) => [['state', 'State'], ...Object.entries({ brightness: 'Brightness', color_temp_kelvin: 'Colour temperature', current_temperature: 'Current temperature', temperature: 'Target temperature', current_position: 'Position', percentage: 'Speed', battery_level: 'Battery' }).filter(([k]) => attr(id)[k] != null || STATE_DEFAULT[id.split('.')[0]] === k), ['last_changed', 'Last changed'], ['last_updated', 'Last updated'], ['area', 'Area']];
  function tileState(c) {
    const id = c.entity, k = c.state_content, s = st(id), a = s?.attributes || {};
    if (!k) return stateText(id);
    if (k === 'state') return cap(s?.state);
    if (k === 'last_changed' || k === 'last_updated') { const t = Date.parse(s?.[k] || s?.last_changed || s?.last_updated); if (!t) return 'Just now'; const m = Math.round((Date.now() - t) / 6e4); return m < 1 ? 'Just now' : m < 60 ? m + ' minutes ago' : Math.round(m / 60) + ' hours ago'; }
    if (k === 'area') return rooms().find((r) => r.id === areaOf(id))?.name || '';
    if (k === 'brightness') return s?.state === 'on' && a.brightness != null ? Math.round((a.brightness / 255) * 100) + '%' : cap(s?.state);
    if (k === 'color_temp_kelvin') return a.color_temp_kelvin ? a.color_temp_kelvin + ' K' : cap(s?.state);
    if (['current_temperature', 'temperature'].includes(k)) return a[k] != null ? a[k] + ' °C' : '';
    if (['current_position', 'percentage', 'battery_level'].includes(k)) return a[k] != null ? a[k] + '%' : '';
    return cap(s?.state);
  }
  /* ---- Visibility: a card shows when all its conditions are met (none, always) ---- */
  function passes(k) {
    if (k.condition === 'state') return !k.entity || !k.state || (k.not ? st(k.entity)?.state !== k.state : st(k.entity)?.state === k.state);
    if (k.condition === 'numeric_state') { const v = Number(st(k.entity)?.state); return !k.entity || (Number.isFinite(v) && (k.above == null || k.above === '' || v > Number(k.above)) && (k.below == null || k.below === '' || v < Number(k.below))); }
    if (k.condition === 'screen') return !(k.screens || []).length || (k.screens || []).some((s) => matchMedia(SCREENS.find((x) => x[0] === s)?.[2] || 'all').matches);
    if (k.condition === 'user') return !(k.users || []).length || k.users.includes(ME);
    return true;
  }
  const shown = (c) => (c.visibility || []).every(passes);
  /* ---- the cards, drawn in HomeCore's parts ---- */
  const chip = (id, ic) => (ic ? '<span class="tfIcon hcChip" data-icon-for="' + esc(id) + '" data-icon-name="' + esc(ic) + '"></span>' : device(id));
  // an area's icon: HomeCore's area glyph in its chip, as Edit Home page lists them (Matt, 26 Nov: "shouldn't be circles")
  const areaIcon = (r) => '<span class="tfIcon"><span class="tfAreaGlyph" data-icon-for="area:' + esc(r.id) + '" data-icon-name="' + esc(r.icon || 'mdi:texture-box') + '" data-letter="' + esc(r.name) + '"></span></span>';
  // a chip's own attributes, for a chip that is itself a button (a tile's icon, which toggles)
  const slot = (id, ic) => (ic ? ' data-icon-for="' + esc(id) + '" data-icon-name="' + esc(ic) + '"' : homecore.chip(id));
  /* a light's features: Home Assistant's sliders as HomeCore's bars (brightness amber, colour temperature warm to cool,
     colour round the wheel) and Toggle as two halves, Off and On */
  const kelvins = (id) => [attr(id).min_color_temp_kelvin || 2000, attr(id).max_color_temp_kelvin || 6500];
  const modes = (id) => attr(id).supported_color_modes || [];
  const canFeature = (id, type) => id.startsWith('light.') && (type === 'toggle' || type === 'light-brightness' ? true : type === 'light-color-temp' ? modes(id).includes('color_temp') : modes(id).some((m) => ['hs', 'xy', 'rgb', 'rgbw', 'rgbww'].includes(m)));
  // where each light's colour temperature and colour were while it was last on, kept in this browser, for their off line
  // (brightness's is HomeCore's own)
  const LAST_KEY = 'homecore-demo-last-colour';
  let lastColour = {};
  try { lastColour = JSON.parse(localStorage.getItem(LAST_KEY) || '{}'); } catch (_e) { /* none yet */ }
  const noteColour = (id, type, v) => { const k = id + '|' + type; if (v == null || lastColour[k] === v) return; lastColour[k] = v; try { localStorage.setItem(LAST_KEY, JSON.stringify(lastColour)); } catch (_e) { /* this visit only */ } };
  function featureVal(id, type) {
    const a = attr(id), on = st(id)?.state === 'on';
    if (type === 'light-brightness') return on ? Math.round(((a.brightness || 0) / 255) * 100) : 0;
    let v = null;
    if (type === 'light-color-temp') { const [lo, hi] = kelvins(id); v = on && a.color_temp_kelvin ? Math.round(((a.color_temp_kelvin - lo) / (hi - lo)) * 100) : null; }
    if (type === 'light-color') v = on && a.hs_color ? Math.round((a.hs_color[0] / 360) * 100) : null;
    if (on) noteColour(id, type, v);
    return v;
  }
  function featureHtml(id, type) {
    if (!canFeature(id, type)) return '';
    if (type === 'toggle') {
      const on = st(id)?.state === 'on';
      return '<div class="hcSecFeat hcSecFeatToggle" role="group" aria-label="' + esc(nameOf(id)) + '"><button type="button" aria-pressed="' + !on + '" data-sec-set="' + esc(id) + '|off" aria-label="Off">' + icon('mdi:power-off') + '</button><button type="button" aria-pressed="' + on + '" data-sec-set="' + esc(id) + '|on" aria-label="On">' + icon('mdi:power') + '</button></div>';
    }
    const v = held?.id === id && held.type === type ? held.v : featureVal(id, type), label = FEATURES[type];
    // a light that's off keeps a faint line where each setting was (Matt, 26 Nov: "that line still there at 60%"); its colour
    // temperature and colour bars go grey, the spectrum still showing through ("you should be able to see that it's a grayed
    // out spectrum")
    const off = st(id)?.state !== 'on' && !(held?.id === id);
    const was = !off ? null : type === 'light-brightness' ? homecore.lastBright?.(id) : lastColour[id + '|' + type] ?? null;
    const line = was != null ? '<span class="was" aria-hidden="true" style="left:' + was + '%"></span>' : '';
    const inner = type === 'light-brightness' ? line + '<i style="width:' + (v || 0) + '%"></i>' : off ? line : v == null ? '' : '<b style="left:' + v + '%"></b>';
    const glyph = homecore.barGlyph?.({ 'light-brightness': 'bright', 'light-color-temp': 'ct', 'light-color': 'hue' }[type]) || '';
    return '<div class="tfBar hcSecFeat hcSecFeat-' + type + (off && type !== 'light-brightness' ? ' hcSecOff' : '') + (type === 'light-brightness' && (v || 0) >= 12 ? ' over' : '') + '" role="slider" tabindex="0" aria-label="' + esc(nameOf(id) + ' ' + label.toLowerCase()) + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + (v ?? 0) + '" data-sec-slide="' + esc(id) + '|' + type + '"' +
      (type === 'light-color-temp' ? ' style="--k-lo:' + kcol(kelvins(id)[0]) + ';--k-hi:' + kcol(kelvins(id)[1]) + '"' : '') + '>' + inner + glyph + '</div>';
  }
  // a colour temperature as the colour it is (warm amber to cool blue-white)
  const kcol = (k) => (k <= 2700 ? '#ffb46b' : k <= 3500 ? '#ffd2a1' : k <= 4500 ? '#ffe9d1' : k <= 5500 ? '#fff6ec' : '#e6efff');
  let held = null; // a feature slider being moved: { id, type, v }
  function setFeature(id, type, v) {
    if (type === 'light-brightness') return v <= 0 ? hass().callService('light', 'turn_off', { entity_id: id }) : hass().callService('light', 'turn_on', { entity_id: id, brightness_pct: Math.round(v) });
    if (type === 'light-color-temp') { const [lo, hi] = kelvins(id); return hass().callService('light', 'turn_on', { entity_id: id, color_temp_kelvin: Math.round(lo + (v / 100) * (hi - lo)) }); }
    if (type === 'light-color') return hass().callService('light', 'turn_on', { entity_id: id, hs_color: [Math.round((v / 100) * 360) % 360, 100] });
  }
  const graph = (ids, hours, h = 120) => '<svg class="hcSecGraph" data-graph="' + esc(ids.join(',')) + '" data-hours="' + hours + '" viewBox="0 0 300 ' + h + '" preserveAspectRatio="none" role="img" aria-label="' + esc(ids.map(nameOf).join(', ')) + ', last ' + hours + ' hours"></svg>';
  function cardHtml(c) {
    const t = c.type;
    if (t === 'hc-weather') {
      // the dashboard's own weather widget, drawn by the Weather page's code once it's on the page (mountWx)
      const [k, card] = widgetOf(c.widget), z = sizeOf(c);
      return '<div class="tfDashBento tfDash-' + k + ' hcSecWx" data-rows="' + (z.rows === 'auto' ? 4 : z.rows) + '" data-wx="' + card + '" data-wx-k="' + k + '"></div>';
    }
    if (t === 'tile') {
      // HomeCore's tile (60 tall, 10 in, the chip 40, 12 between, its corners the tile's), its features under it
      if (!st(c.entity)) return missing(c);
      const id = c.entity, name = tileName(c), on = isOn(id), feats = (c.features || []).filter((f) => canFeature(id, f.type)), inline = c.features_position === 'inline' && feats.length;
      // its actions: the icon (Toggle unless set) and the rest of it (More info unless set)
      const act = (a, fallback) => { const x = a?.action || fallback; return x === 'toggle' && TOGGLES.concat(['lock', 'cover']).includes(id.split('.')[0]) ? ' data-sec-toggle="' + esc(id) + '"' : x === 'more-info' ? ' data-sec-more="' + esc(id) + '"' : ' data-sec-none'; };
      const pic = c.show_entity_picture && attr(id).entity_picture, hex = COLOURS.find((x) => x[0] === c.color)?.[2];
      const chipAttrs = pic ? '' : slot(id, c.icon) + (hex && on ? ' data-light style="' + homecore.tint(hex) + '"' : '');
      const iconBtn = '<button class="tfIcon hcSecIconBtn" type="button"' + act(c.icon_tap_action, 'toggle') + ' aria-label="' + esc(name) + '"' + chipAttrs + '>' + (pic ? '<img src="' + esc(pic) + '" alt="">' : '') + '</button>';
      const nameBtn = '<button class="tfName" type="button"' + act(c.tap_action, 'more-info') + '><span class="activityRowName">' + esc(name) + '</span>' + (c.hide_state ? '' : '<span class="activityRowMeta">' + esc(tileState(c)) + '</span>') + '</button>';
      // with features (stacked) it isn't a tile with things hung under it: it becomes HomeCore's action card, its head
      // (the icon and the name) and its controls inside the one card (Matt, 26 Nov: "it turns into the action as soon as
      // you add a feature to it")
      // any kind of entity: a feature makes it the card; Inline shows only its first feature (Matt, 26 Nov: "If it has no
      // feature inside it… it is the tile… As soon as it gets put inside something, it becomes a card, and then underneath
      // that, it can have an action inside")
      if (feats.length) {
        return '<div class="tfAction hcSecAction' + (on ? ' on' : '') + '"' + (hex ? (on ? ' data-light style="' + homecore.tint(hex) + '"' : '') : homecore.light?.(id) || '') + (id.startsWith('light.') ? ' data-tone="light"' : '') + '>' +
          '<div class="tfActionHead">' + iconBtn.replace(chipAttrs, pic ? '' : slot(id, c.icon)) + nameBtn + '</div>' + (inline ? feats.slice(0, 1) : feats).map((f) => featureHtml(id, f.type)).join('') + '</div>';
      }
      return '<div class="card hcSecTile' + (c.vertical || sizeOf(c).columns <= 3 ? ' vertical' : '') + (on ? ' on' : '') + '"' + (id.startsWith('light.') && !hex ? ' data-tone="light"' : '') + '>' +
        '<div class="activityRow' + (on ? ' on' : '') + '">' +
        '<button class="tfIcon hcSecIconBtn" type="button"' + act(c.icon_tap_action, 'toggle') + ' aria-label="' + esc(name) + '"' + chipAttrs + '>' + (pic ? '<img src="' + esc(pic) + '" alt="">' : '') + '</button>' +
        '<button class="tfName" type="button"' + act(c.tap_action, 'more-info') + '><span class="activityRowName">' + esc(name) + '</span>' + (c.hide_state ? '' : '<span class="activityRowMeta">' + esc(tileState(c)) + '</span>') + '</button>' +
        '</div></div>';
    }
    // the cards in HomeCore's pattern (Matt, 26 Nov: "the spacing is all wrong"): the card 10 in, its title 8 further in, its
    // rows HomeCore's tiles (60 tall, the chip 40, 12 between), everything inside nesting in the card's corners
    const title = c.title ? '<div class="hcCardTitle hcSecTitle">' + esc(c.title) + '</div>' : '';
    const row = (id, extra = '', meta = stateText(id)) => {
      const tog = TOGGLES.includes(id.split('.')[0]);
      return '<div class="activityRow hcSecRow' + (isOn(id) ? ' on' : '') + (extra ? ' hcSecRowEnd' : '') + '"' + (id.startsWith('light.') ? ' data-tone="light"' : '') + '>' +
        (tog ? '<button class="tfIcon hcSecIconBtn" type="button" data-sec-toggle="' + esc(id) + '" aria-label="Toggle ' + esc(nameOf(id)) + '"' + slot(id) + '></button>' : '<span class="tfIcon"' + slot(id) + '></span>') +
        '<button class="tfName" type="button" data-sec-more="' + esc(id) + '"><span class="activityRowName">' + esc(nameOf(id)) + '</span>' + (meta ? '<span class="activityRowMeta">' + esc(meta) + '</span>' : '') + '</button>' + extra + '</div>';
    };
    if (t === 'button') {
      if (!st(c.entity)) return missing(c);
      return '<button class="card hcSecButton' + (isOn(c.entity) ? ' on' : '') + '" type="button" data-sec-toggle="' + esc(c.entity) + '"' + (c.entity.startsWith('light.') ? ' data-tone="light"' : '') + '>' +
        (c.show_icon !== false ? '<span class="tfIcon"' + slot(c.entity, c.icon) + '></span>' : '') + (c.show_name !== false ? '<span class="activityRowName">' + esc(c.name || nameOf(c.entity)) + '</span>' : '') + '</button>';
    }
    if (t === 'entities') {
      return '<div class="card hcSecList">' + title + '<div class="hcSecRows">' + (c.entities || []).filter(st).map((id) => row(id,
        TOGGLES.includes(id.split('.')[0]) ? '<button class="switch' + (isOn(id) ? ' on' : '') + '" type="button" role="switch" aria-checked="' + isOn(id) + '" aria-label="' + esc(nameOf(id)) + '" data-sec-toggle="' + esc(id) + '"></button>' : '')).join('') + '</div></div>';
    }
    if (t === 'glance') {
      return '<div class="card hcSecGlance">' + title + '<div class="hcSecGlanceRow">' +
        (c.entities || []).filter(st).map((id) => '<button class="hcSecGlanceItem' + (isOn(id) ? ' on' : '') + '" type="button" data-sec-more="' + esc(id) + '"' + (id.startsWith('light.') ? ' data-tone="light"' : '') + '><span class="tfIcon"' + slot(id) + '></span>' +
          (c.show_name !== false ? '<span class="activityRowName">' + esc(nameOf(id)) + '</span>' : '') + (c.show_state !== false ? '<span class="activityRowMeta">' + esc(stateText(id)) + '</span>' : '') + '</button>').join('') + '</div></div>';
    }
    if (t === 'history-graph') {
      const ids = (c.entities || []).filter(st);
      return '<div class="card hcSecHistory">' + title + '<div class="hcSecHistoryBody">' +
        (ids.length ? '<div class="hcSecLegend">' + ids.map((id, i) => '<span><i style="background:' + LINE[i % LINE.length] + '"></i>' + esc(nameOf(id)) + '</span>').join('') + '</div>' + graph(ids, c.hours_to_show || 24) : '<div class="hcSecEmpty">Add entities to see their history</div>') + '</div></div>';
    }
    if (t === 'sensor') {
      if (!st(c.entity)) return missing(c);
      const [v, ...u] = stateText(c.entity).split(' ');
      return '<div class="card hcSecSensor">' + '<div class="activityRow hcSecRow"><span class="tfIcon"' + slot(c.entity, c.icon) + '></span><button class="tfName" type="button" data-sec-more="' + esc(c.entity) + '"><span class="activityRowName">' + esc(c.name || nameOf(c.entity)) + '</span></button></div>' +
        '<div class="hcSecBig"><span>' + esc(v) + '</span>' + (u.length ? '<small>' + esc(u.join(' ')) + '</small>' : '') + '</div>' + (c.graph === 'line' ? graph([c.entity], c.hours_to_show || 24, 60) : '') + '</div>';
    }
    if (t === 'area') {
      // the official area card, the one Home and the Areas card use (Matt, 26 Nov: "it should be that area card"): wide
      // with its devices as heads, narrow with them as icons, as tall as its rows
      if (!rooms().some((x) => x.id === c.area)) return '<div class="card hcSecList"><div class="hcSecEmpty">Pick an area</div></div>';
      const z = sizeOf(c);
      return homecore.areaCard?.(c.area, z.columns >= 6 ? 2 : 1, z.rows === 'auto' ? 2 : z.rows, areaGiven(c)) || '';
    }
    return '';
  }
  const missing = (c) => '<div class="card hcSecList"><div class="hcSecEmpty">' + esc(CARD[c.type]?.name || 'Card') + ': pick an entity</div></div>';
  const LINE = ['#03a9f4', '#ff9800', '#4caf50', '#e91e63', '#9c27b0'];

  // a graph's history, fetched once a minute at most, then drawn as Home Assistant's lines
  function drawGraphs(scope) {
    scope.querySelectorAll('svg.hcSecGraph').forEach((svg) => {
      const ids = svg.dataset.graph.split(',').filter(Boolean), hours = Number(svg.dataset.hours) || 24, from = Date.now() - hours * HOUR;
      Promise.all(ids.map((id) => {
        const key = id + '|' + hours, had = histories.get(key);
        if (had && Date.now() - had.at < 60e3) return had.p;
        const p = Promise.resolve(hass().callWS({ type: 'history/history_during_period', start_time: new Date(from).toISOString(), entity_ids: [id], minimal_response: true, no_attributes: true }))
          .then((res) => (res?.[id] || []).map((x) => [Number(x.lu ?? x.lc) * 1000, Number(x.s)]).filter(([, v]) => Number.isFinite(v))).catch(() => []);
        histories.set(key, { at: Date.now(), p });
        return p;
      })).then((series) => {
        const [, , W, H] = svg.getAttribute('viewBox').split(' ').map(Number), all = series.flat().map(([, v]) => v);
        if (!all.length) { svg.innerHTML = ''; return; }
        const lo = Math.min(...all), hi = Math.max(...all), span = hi - lo || 1;
        const x = (t) => ((t - from) / (hours * HOUR)) * W, y = (v) => H - 6 - ((v - lo) / span) * (H - 12);
        svg.innerHTML = series.map((pts, i) => pts.length ? '<path d="' + pts.map(([t, v], k) => (k ? 'L' : 'M') + x(Math.max(from, t)).toFixed(1) + ' ' + y(v).toFixed(1)).join('') + 'L' + W + ' ' + y(pts[pts.length - 1][1]).toFixed(1) + '" fill="none" stroke="' + LINE[i % LINE.length] + '" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>' : '').join('');
      });
    });
  }

  /* the weather widgets: each drawn into its place once the page or a preview has it, kept across redraws (so its sky keeps
     moving), the ones no longer shown let go */
  const wxMounts = new Map();
  const weatherId = () => Object.keys(hass()?.states || {}).find((id) => id === 'weather.forecast_home') || Object.keys(hass()?.states || {}).find((id) => id.startsWith('weather.'));
  function mountWx(scope, prefix) {
    const used = new Set(), wid = weatherId();
    scope.querySelectorAll('[data-wx]').forEach((slot, i) => {
      const key = prefix + ':' + (slot.closest('[data-slot]')?.dataset.slot || i) + ':' + slot.dataset.wxK;
      used.add(key);
      let m = wxMounts.get(key);
      if (!m || !wid) {
        if (!wid) { slot.innerHTML = '<div class="hcSecEmpty">No weather to show</div>'; return; }
        const el = slot.cloneNode(false);
        m = { el, bento: mountWeatherBento(el, { getHass: hass, entityId: wid, style: 'bitmap', cards: [slot.dataset.wx], onOpen: undefined /* (no Weather page in this version) */ }) };
        wxMounts.set(key, m);
      }
      m.el.dataset.rows = slot.dataset.rows;
      slot.replaceWith(m.el);
    });
    wxMounts.forEach((m, key) => { if (key.startsWith(prefix + ':') && !used.has(key)) { m.bento?.destroy?.(); wxMounts.delete(key); } });
  }
  /* ---- the page ---- */
  const PEN = icon('mdi:pencil'), PLUS = icon('mdi:plus'), CLOSE = icon('mdi:close'), DOTS = icon('mdi:dots-vertical'), GRIP = '<span class="hcSecGrip" aria-hidden="true">' + icon('mdi:drag') + '</span>';
  function draw() {
    const secs = dash.sections;
    page.closest('#app')?.classList.toggle('hcSecEditing', editing || Boolean(dialog));
    page.innerHTML = '<div class="hcSecPage' + (editing ? ' editing' : '') + '">' +
      (editing
        ? '<div class="settingsHeader hcTitle hcSecEditBar"><button class="back" type="button" data-sec-done aria-label="Exit edit mode">' + CLOSE + '</button><h1 class="settingsTitle">Edit dashboard</h1>' +
          '<button class="hcSecUndo" type="button" data-sec-undo' + (history.length ? '' : ' disabled') + '>' + icon('mdi:undo') + 'Undo</button>' +
          '<span class="hcSecBarMenu"><button class="back" type="button" data-sec-bar-menu aria-label="More" aria-haspopup="menu">' + DOTS + '</button><div class="card hcInfoMenu hcSecMenu" role="menu" hidden><button class="hcInfoMenuItem hcSecDanger" type="button" data-sec-clear>Clear dashboard</button></div></span>' +
          '<button class="primary" type="button" data-sec-done>Done</button></div>'
        : head('My Cool Dashboard', '<div class="hcHeadActions"><button class="navBtn" type="button" data-sec-edit aria-label="Edit dashboard" title="Edit dashboard">' + PEN + '</button></div>')) +
      (dash.note && !editing ? '<div class="hcSecNote" role="note">' + icon('mdi:information-outline') + '<div><strong>This is your custom dashboard</strong><p>Build it the way Home Assistant does: sections, each with its own cards. Press the pencil to edit, add a section and add cards to it.</p></div>' +
        '<button class="back" type="button" data-sec-note aria-label="Dismiss">' + CLOSE + '</button></div>' : '') +
      '<div class="hcSecGrid">' + secs.map((s, si) => '<section class="hcSec' + (s.column_span === 2 ? ' hcSecDouble' : '') + '" data-sec="' + si + '">' +
        '<div class="hcSecHead"><h2 class="hcSecHeading">' + esc(s.title || '') + '</h2>' + (editing ? '<button class="back" type="button" data-sec-rename="' + si + '" aria-label="Edit section">' + PEN + '</button><button class="back" type="button" data-sec-remove="' + si + '" aria-label="Delete section">' + icon('mdi:delete-outline') + '</button>' : '') + '</div>' +
        '<div class="hcSecCards">' + s.cards.map((c, ci) => (shown(c) || editing ? '<div class="hcSecSlot' + (sizeOf(c).rows === 'auto' ? '' : ' hcRows') + (shown(c) ? '' : ' hcSecHidden') + (flash && flash.si === si && flash.ci === ci ? ' hcSecFlash' : '') + '" style="' + slotStyle(c) + '" data-slot="' + si + ':' + ci + '">' + cardHtml(c) +
          (editing ? '<div class="hcSecCardTools"><button type="button" data-sec-card-edit="' + si + ':' + ci + '" aria-label="Edit">' + PEN + '</button><button type="button" data-sec-card-menu="' + si + ':' + ci + '" aria-label="More">' + DOTS + '</button>' +
            '<div class="card hcInfoMenu hcSecMenu" role="menu" hidden><button class="hcInfoMenuItem" type="button" data-sec-dupe="' + si + ':' + ci + '">Duplicate</button><button class="hcInfoMenuItem hcSecDanger" type="button" data-sec-del="' + si + ':' + ci + '">Delete</button></div></div>' : '') + '</div>' : '')).join('') +
          (editing || !s.cards.length ? '<button class="hcSecAdd" type="button" data-sec-add="' + si + '">' + PLUS + '<span>Add card</span></button>' : '') + '</div></section>').join('') +
        (editing ? '<button class="hcSecCreate" type="button" data-sec-create>' + PLUS + '<span>Create section</span></button>' : '') + '</div></div>';
    paint(page);
    drawGraphs(page);
    mountWx(page.querySelector('.hcSecGrid') || page, 'grid');
  }

  /* ---- Add to dashboard, and a card's editor ---- */
  const field = (label, input) => '<label class="hcInfoField"><span class="hcInfoFieldLabel">' + esc(label) + '</span><span class="hcInfoFieldBox">' + input + '</span></label>';
  const pick = (label, key, now, ids, blank) => field(label, '<select class="hcInfoInput" data-cfg="' + key + '">' + (blank ? '<option value="">' + esc(blank) + '</option>' : '') + ids.map((id) => '<option value="' + esc(id) + '"' + (id === now ? ' selected' : '') + '>' + esc(nameOf(id)) + '</option>').join('') + '</select>');
  const text = (label, key, now, ph = '') => field(label, '<input class="hcInfoInput" type="text" data-cfg="' + key + '" value="' + esc(now || '') + '" placeholder="' + esc(ph) + '">');
  const toggle = (label, key, on) => '<div class="toggleRow hcInfoToggle"><div><strong>' + esc(label) + '</strong></div><button class="switch' + (on ? ' on' : '') + '" type="button" role="switch" aria-checked="' + on + '" data-cfg-switch="' + key + '" aria-label="' + esc(label) + '"></button></div>';
  const list = (label, ids, pool) => '<div class="hcSecField"><span class="hcInfoFieldLabel">' + esc(label) + '</span><div class="hcSecEntityList">' +
    ids.map((id, i) => '<div class="hcSecEntityRow">' + chip(id) + '<span class="hcSecName">' + esc(nameOf(id)) + '</span><button class="back" type="button" data-cfg-drop="' + i + '" aria-label="Remove ' + esc(nameOf(id)) + '">' + CLOSE + '</button></div>').join('') + '</div>' +
    field('Add entity', '<select class="hcInfoInput" data-cfg-add><option value="">Choose an entity</option>' + pool.filter((id) => !ids.includes(id)).map((id) => '<option value="' + esc(id) + '">' + esc(nameOf(id)) + '</option>').join('') + '</select>') + '</div>';
  const iconField = (c) => text('Icon', 'icon', c.icon, attr(c.entity).icon || 'mdi:');
  // each card's settings: Home Assistant's, fewer of them
  function form(c) {
    const all = entities(), toggles = entities((id) => TOGGLES.includes(id.split('.')[0]) || /^(lock|cover|scene|script)\./.test(id));
    if (c.type === 'tile') {
      // its features (a light's): those added, each with its remove, then Add feature with what this entity can have
      const have = (c.features || []).map((f) => f.type), can = Object.keys(FEATURES).filter((f) => canFeature(c.entity, f) && !have.includes(f));
      const feats = c.entity?.startsWith('light.') ? '<div class="hcSecField"><span class="hcInfoFieldLabel">Features</span><div class="hcSecEntityList">' +
        have.map((f, i) => '<div class="hcSecEntityRow"><span class="hcSecName">' + esc(FEATURES[f]) + '</span><button class="back" type="button" data-cfg-feat-drop="' + i + '" aria-label="Remove ' + esc(FEATURES[f]) + '">' + CLOSE + '</button></div>').join('') + '</div>' +
        (can.length ? field('Add feature', '<select class="hcInfoInput" data-cfg-feat-add><option value="">Choose a feature</option>' + can.map((f) => '<option value="' + f + '">' + esc(FEATURES[f]) + '</option>').join('') + '</select>') : '') + '</div>' : '';
      return pick('Entity', 'entity', c.entity, all) + text('Name', 'name', c.name, nameOf(c.entity)) + iconField(c) + toggle('Vertical', 'vertical', !!c.vertical) + toggle('Hide state', 'hide_state', !!c.hide_state) + feats;
    }
    if (c.type === 'button') return pick('Entity', 'entity', c.entity, toggles) + text('Name', 'name', c.name, nameOf(c.entity)) + iconField(c) + toggle('Show name', 'show_name', c.show_name !== false) + toggle('Show icon', 'show_icon', c.show_icon !== false);
    if (c.type === 'entities') return text('Title', 'title', c.title, 'Optional') + list('Entities', c.entities || [], all);
    if (c.type === 'glance') return text('Title', 'title', c.title, 'Optional') + list('Entities', c.entities || [], all) + toggle('Show name', 'show_name', c.show_name !== false) + toggle('Show state', 'show_state', c.show_state !== false);
    if (c.type === 'history-graph') return text('Title', 'title', c.title, 'Optional') + list('Entities', c.entities || [], entities(numeric)) +
      field('Hours to show', '<input class="hcInfoInput" type="number" min="1" max="168" data-cfg="hours_to_show" data-num value="' + (c.hours_to_show || 24) + '">');
    if (c.type === 'sensor') return pick('Entity', 'entity', c.entity, entities(numeric)) + text('Name', 'name', c.name, nameOf(c.entity)) + iconField(c) +
      field('Graph type', '<select class="hcInfoInput" data-cfg="graph"><option value="line"' + (c.graph === 'line' ? ' selected' : '') + '>Line</option><option value="none"' + (c.graph !== 'line' ? ' selected' : '') + '>None</option></select>') +
      field('Hours to show', '<input class="hcInfoInput" type="number" min="1" max="168" data-cfg="hours_to_show" data-num value="' + (c.hours_to_show || 24) + '">');
    if (c.type === 'area') {
      // its area; its main reading; its four spaces as a stack, like a tile's features: each dragged into order, removed,
      // or added from what the area has
      const a = homecore.areaSlots?.(c.area), s = slotsOf(c), name = (it) => a?.label(it) || it;
      const opts = (now, blank) => (blank ? '<option value="">' + esc(blank) + '</option>' : '') + (a?.groups || []).map((g) => '<optgroup label="' + esc(g.name) + '">' + g.items.map((it) => '<option value="' + esc(it) + '"' + (it === now ? ' selected' : '') + '>' + esc(name(it)) + '</option>').join('') + '</optgroup>').join('');
      return field('Area', '<select class="hcInfoInput" data-cfg="area">' + rooms().map((r) => '<option value="' + esc(r.id) + '"' + (r.id === c.area ? ' selected' : '') + '>' + esc(r.name) + '</option>').join('') + '</select>') +
        band('Main') + field('', '<select class="hcInfoInput" data-sec-main>' + opts(c.main, 'Default (' + (a?.main ? name(a.main) : 'None') + ')') + '</select>') +
        band('Slots', 'Up to four, in the order they show') + '<div class="hcSecEntityList">' + s.slots.map((it, i) => '<div class="hcSecEntityRow hcSecSortRow" draggable="true" data-sort="slots" data-sort-i="' + i + '">' + GRIP + '<span class="hcSecName">' + esc(name(it)) + '</span><button class="back" type="button" data-sec-slot-drop="' + i + '" aria-label="Remove ' + esc(name(it)) + '">' + CLOSE + '</button></div>').join('') + '</div>' +
        (s.slots.length < 4 ? field('', '<select class="hcInfoInput" data-sec-slot-add>' + opts('', 'Add entity') + '</select>') : '');
    }
    // a section: its title and its width, Single or Double (Home Assistant's column span: Matt, 26 Nov: "width, just do single,
    // double at the moment")
    if (c.type === 'hc-weather') return field('Widget', '<select class="hcInfoInput" data-cfg="widget">' + WIDGETS.map(([k, , name]) => '<option value="' + k + '"' + (k === c.widget ? ' selected' : '') + '>' + esc(name) + '</option>').join('') + '</select>') +
      '<div class="hcSecNoteText">From the Weather page, for the forecast this home uses</div>';
    if (c.type === 'heading') return text('Title', 'title', c.title, 'New section') +
      '<span class="hcInfoFieldLabel">Width</span><div class="hcSecSeg hcSecSeg2" role="radiogroup">' + [[1, 'Single'], [2, 'Double']].map(([v, l]) => '<button type="button" role="radio" aria-checked="' + ((c.column_span || 1) === v) + '" data-sec-span="' + v + '">' + l + '</button>').join('') + '</div>' +
      '<div class="hcSecNoteText">Double takes two columns of the dashboard, its cards keeping their size</div>';
    return '';
  }

  const layer = (html, cls) => {
    closeDialog();
    page.insertAdjacentHTML('beforeend', '<div class="hcLeBack hcSecBack" data-sec-scrim><div class="hcLe hcSecDialog ' + cls + '" role="dialog" aria-modal="true">' + html + '</div></div>');
    dialog = page.querySelector('.hcSecBack');
    mountWx(dialog, 'dlg');
    page.closest('#app')?.classList.add('hcSecEditing');
    paint(dialog);
    drawGraphs(dialog);
    dialog.querySelector('input,select,button:not([data-sec-close])')?.focus({ preventScroll: true });
  };
  const closeDialog = () => { if (!holdRun) confirming = null; dialog?.remove(); dialog = null; wxMounts.forEach((m, key) => { if (key.startsWith('dlg:')) { m.bento?.destroy?.(); wxMounts.delete(key); } }); page.closest('#app')?.classList.toggle('hcSecEditing', editing); };
  const dhead = (title) => '<div class="hcLeHead hcSecHeadBorder"><button class="tfBack" type="button" data-sec-close aria-label="Close">' + CLOSE + '</button><div class="activityTitle">' + esc(title) + '</div></div>';

  /* Add to dashboard, as Home Assistant has it now: By entity first (an entity picked from your home, by area, and the
     cards it suggests for it, or Browse all cards), then By card (every card on offer, drawn with your entities). A card
     picked opens in the same dialog: its settings and its preview, Back or Add card */
  let adding = null; // { si, tab, q, eq, entity, open: Set of areas unfolded }
  function openAdd(si) {
    adding = { si, tab: 'entity', q: '', eq: '', entity: null, open: new Set() };
    drawAdd();
  }
  const areaOf = (id) => homecore.model?.areaOf?.(id) || '';
  // what Home Assistant suggests for an entity, of the cards on offer: its tile, and a reading's history
  const suggestions = (id) => [{ type: 'tile', entity: id },
    // a light's tile with each of its features, as Home Assistant offers them (Matt, 26 Nov: "for the lights, we need the features too")
    ...(id.startsWith('light.') ? ['light-brightness', 'toggle', 'light-color', 'light-color-temp'].filter((f) => canFeature(id, f)).map((f) => ({ type: 'tile', entity: id, features: [{ type: f }] })) : []),
    ...(numeric(id) ? [{ type: 'history-graph', entities: [id], hours_to_show: 24 }] : [])];
  const suggestName = (c) => (c.features?.length ? c.features.map((f) => FEATURES[f.type]).join(', ') : CARD[c.type].name);
  const CHEV = '<svg class="hcSecChev" viewBox="0 0 24 24" aria-hidden="true"><path d="M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z"/></svg>';
  function treeHtml() {
    const { eq, open, entity } = adding;
    const row = (id) => '<button class="hcSecTreeEnt' + (id === entity ? ' active' : '') + '" type="button" data-sec-choose="' + esc(id) + '">' + chip(id) + '<span class="hcSecName">' + esc(nameOf(id)) + '</span></button>';
    if (eq) {
      const hits = entities((id) => (nameOf(id) + ' ' + id).toLowerCase().includes(eq.toLowerCase())).slice(0, 60);
      return hits.length ? hits.map(row).join('') : '<div class="hcSecEmpty"><strong>No entity matches your search</strong><br>Try a different keyword.</div>';
    }
    const all = entities(), placed = new Set();
    const groups = rooms().map((r) => { const ids = all.filter((id) => areaOf(id) === r.id); ids.forEach((id) => placed.add(id)); return { id: r.id, name: r.name, icon: r.icon, ids }; }).filter((g) => g.ids.length);
    const rest = all.filter((id) => !placed.has(id));
    const group = (g) => '<button class="hcSecTreeArea" type="button" aria-expanded="' + open.has(g.id) + '" data-sec-fold="' + esc(g.id) + '">' + CHEV +
      areaIcon({ id: g.id, icon: g.icon, name: g.name }) + '<span class="hcSecName">' + esc(g.name) + '</span><span class="hcSecCount">' + g.ids.length + '</span></button>' +
      (open.has(g.id) ? '<div class="hcSecTreeKids">' + g.ids.map(row).join('') + '</div>' : '');
    return '<div class="hcSecTreeTitle">Home</div>' + groups.map(group).join('') +
      (rest.length ? '<div class="hcSecTreeTitle">Unassigned</div>' + group({ id: '__rest', name: 'Entities', icon: 'mdi:shape', ids: rest }) : '');
  }
  function mainHtml() {
    const id = adding.entity, browse = '<button class="hcSecBrowse" type="button" data-sec-browse>Browse all cards</button>';
    if (!id || !st(id)) return '<div class="hcSecEmptyState"><h2>Pick an entity to see suggestions</h2><p>Or browse all card types.</p>' + browse + '</div>';
    // the entity picked shows as picked in the list beside, so the suggestions start straight away (Matt, 26 Nov: "i have
    // the entity selected already")
    return '<div class="hcSecTreeTitle">Suggestions</div><div class="hcSecPicker">' + suggestions(id).map((c, i) => '<div class="hcSecPick" role="button" tabindex="0" data-sec-suggest="' + i + '"><span class="hcSecPickName">' + esc(suggestName(c)) + '</span><span class="hcSecPickPreview" inert>' + cardHtml(c) + '</span></div>').join('') + '</div>' +
      '<div class="hcSecFind"><p>Can’t find the card you want?</p>' + browse + '</div>';
  }
  function drawAdd() {
    const { tab, q } = adding;
    const tabs = '<div class="hcSecTabs" role="tablist"><button class="hcSecTab' + (tab === 'entity' ? ' active' : '') + '" type="button" role="tab" aria-selected="' + (tab === 'entity') + '" data-sec-tab="entity">By entity</button><button class="hcSecTab' + (tab === 'card' ? ' active' : '') + '" type="button" role="tab" aria-selected="' + (tab === 'card') + '" data-sec-tab="card">By card</button></div>';
    let body;
    if (tab === 'card') {
      const shown = CARDS.filter((c) => !q || (c.name + ' ' + c.about).toLowerCase().includes(q.toLowerCase()));
      const nice = WIDGETS.filter(([, , name]) => !q || (name + ' weather').toLowerCase().includes(q.toLowerCase()));
      body = '<div class="hcSecSearch">' + field('', '<input class="hcInfoInput" type="search" data-sec-search placeholder="Search cards" value="' + esc(q) + '">') + '</div>' +
        '<div class="hcSecDialogBody"><div class="hcSecPicker">' + shown.map((c) => '<div class="hcSecPick" role="button" tabindex="0" data-sec-pick="' + c.type + '"><span class="hcSecPickName">' + esc(c.name) + '</span><span class="hcSecPickPreview" inert>' + cardHtml(fresh(c.type)) + '</span></div>').join('') + (shown.length ? '' : '<div class="hcSecEmpty">No cards match</div>') + '</div>' +
        (nice.length ? '<div class="hcSecTreeTitle hcSecNice">Nice to have edition</div><div class="hcSecPicker">' + nice.map(([k, , name]) => '<div class="hcSecPick" role="button" tabindex="0" data-sec-pick-wx="' + k + '"><span class="hcSecPickName">' + esc(name) + '</span><span class="hcSecPickPreview" inert><span class="hcSecSlot" data-slot="pick-' + k + '">' + cardHtml({ type: 'hc-weather', widget: k }) + '</span></span></div>').join('') + '</div>' : '') + '</div>';
    } else {
      body = '<div class="hcSecSplit"><div class="hcSecTree"><div class="hcSecSearch">' + field('', '<input class="hcInfoInput" type="search" data-sec-esearch placeholder="Search entities" value="' + esc(adding.eq) + '">') + '</div><div class="hcSecTreeList">' + treeHtml() + '</div></div>' +
        '<div class="hcSecMain">' + mainHtml() + '</div></div>';
    }
    layer('<div class="hcLeHead hcSecHeadBorder"><button class="tfBack" type="button" data-sec-close aria-label="Close">' + CLOSE + '</button><div class="activityTitle">Add to dashboard</div></div>' + tabs + body +
      '<div class="hcLeFoot"><button class="hcLeCancel" type="button" data-sec-close>Cancel</button></div>', 'hcSecAddDialog');
    const s = dialog.querySelector(tab === 'card' ? '[data-sec-search]' : '[data-sec-esearch]'), v = tab === 'card' ? q : adding.eq;
    if (v) { s.focus(); s.setSelectionRange(v.length, v.length); }
  }

  // a card's editor: its settings and its preview side by side, Cancel and Save
  let edit = null; // { si, ci (null: new), c, from }
  function openEditor(si, ci, c, from) {
    edit = { si, ci, c: JSON.parse(JSON.stringify(c)), from };
    drawEditor();
  }
  // the preview: the card at the size it will be in its section (a section's 12 columns, its rows a tile tall)
  const previewSlot = (c) => c.type === 'heading' ? '<div class="hcSecSlot" style="--cols:12"><h2 class="hcSecHeading">' + esc(c.title || 'New section') + '</h2></div>'
    : '<div class="hcSecSlot' + (sizeOf(c).rows === 'auto' ? '' : ' hcRows') + '" style="' + slotStyle(c) + '">' + cardHtml(c) + '</div>';
  /* Layout: Full width only, on or off (Matt, 26 Nov: "we just want to have full width, toggle on or off. That's it");
     otherwise the card keeps its own size */
  function layoutForm(c) {
    const z = sizeOf(c);
    // an area card: its size, as Home's (Small, Medium, Large, XL), then Full width
    const sizes = c.type === 'area' ? '<span class="hcInfoFieldLabel">Size</span><div class="hcSecSeg" role="radiogroup">' + AREA_SIZES.map(([rows, label]) => '<button type="button" role="radio" aria-checked="' + (z.rows === rows) + '" data-sec-rows="' + rows + '"' + (rows < 3 && slotCount(c) > 2 ? ' disabled title="Small holds two slots"' : '') + '>' + label + '</button>').join('') + '</div>' +
      (slotCount(c) > 2 ? '<div class="hcSecNoteText">Small holds two slots, so with ' + slotCount(c) + ' it\u2019s Medium or larger</div>' : '') : '';
    return sizes + '<div class="toggleRow hcInfoToggle"><div><strong>Full width</strong><div class="status">Take up the full width of the section whatever its size</div></div><button class="switch' + (z.full ? ' on' : '') + '" type="button" role="switch" aria-checked="' + z.full + '" data-sec-full-w aria-label="Full width"></button></div>';
  }
  const setGrid = (patch) => { const g = { ...(edit.c.grid_options || {}), ...patch }; Object.keys(g).forEach((k) => g[k] == null && delete g[k]); if (Object.keys(g).length) edit.c.grid_options = g; else delete edit.c.grid_options; };
  /* Visibility: whether the card shows now, Home Assistant's explanation, each condition (Entity state, Entity numeric
     state, Screen, User) with its remove, and Add condition */
  function visibilityForm(c) {
    const ks = c.visibility || [], ok = ks.every(passes);
    const status = '<div class="hcSecVisStatus' + (ok ? '' : ' off') + '">' + icon(ok ? 'mdi:eye' : 'mdi:eye-off') + '<div><strong>Current visibility: ' + (ok ? 'Visible' : 'Hidden') + '</strong><span>' + (ks.length ? ok ? 'All visibility conditions are met' : 'Not all visibility conditions are met' : 'No visibility conditions are set') + '</span></div></div>';
    const all = entities();
    const cond = (k, i) => {
      const headK = '<div class="hcSecCondHead"><strong>' + esc(CONDITIONS[k.condition]) + '</strong><button class="back" type="button" data-sec-cond-drop="' + i + '" aria-label="Remove condition">' + CLOSE + '</button></div>';
      const sel = (key, now, opts, blank) => '<select class="hcInfoInput" data-sec-cond="' + i + ':' + key + '">' + (blank ? '<option value="">' + esc(blank) + '</option>' : '') + opts.map(([v, txt]) => '<option value="' + esc(v) + '"' + (String(v) === String(now ?? '') ? ' selected' : '') + '>' + esc(txt) + '</option>').join('') + '</select>';
      const inp = (key, now, ph) => '<input class="hcInfoInput" type="number" data-sec-cond="' + i + ':' + key + '" value="' + esc(now ?? '') + '" placeholder="' + esc(ph) + '">';
      let body = '';
      if (k.condition === 'state') {
        const states = [...new Set([st(k.entity)?.state, 'on', 'off', 'open', 'closed', 'locked', 'unlocked', 'home', 'not_home'].filter(Boolean))];
        body = field('Entity', sel('entity', k.entity, all.map((id) => [id, nameOf(id)]), 'Choose an entity')) +
          field('', sel('not', k.not ? '1' : '', [['', 'State is equal to'], ['1', 'State is not equal to']])) + field('State', sel('state', k.state, states.map((s) => [s, cap(s)]), 'Choose a state'));
      } else if (k.condition === 'numeric_state') {
        body = field('Entity', sel('entity', k.entity, entities(numeric).map((id) => [id, nameOf(id)]), 'Choose an entity')) + '<div class="hcSecPair">' + field('Above', inp('above', k.above, 'Optional')) + field('Below', inp('below', k.below, 'Optional')) + '</div>';
      } else if (k.condition === 'screen') {
        body = '<span class="hcInfoFieldLabel">Screen sizes</span><div class="hcSecChecks">' + SCREENS.map(([v, label]) => '<button class="hcSecCheckRow" type="button" role="checkbox" aria-checked="' + (k.screens || []).includes(v) + '" data-sec-cond-tick="' + i + ':screens:' + v + '"><span class="hcSecCheck">' + ((k.screens || []).includes(v) ? icon('mdi:check') : '') + '</span>' + label + '</button>').join('') + '</div>';
      } else if (k.condition === 'user') {
        body = '<span class="hcInfoFieldLabel">Users</span><div class="hcSecChecks">' + USERS.map(([v, label]) => '<button class="hcSecCheckRow" type="button" role="checkbox" aria-checked="' + (k.users || []).includes(v) + '" data-sec-cond-tick="' + i + ':users:' + v + '"><span class="hcSecCheck">' + ((k.users || []).includes(v) ? icon('mdi:check') : '') + '</span>' + label + '</button>').join('') + '</div>';
      }
      return '<div class="hcSecCond' + (passes(k) ? '' : ' off') + '">' + headK + body + '</div>';
    };
    return status + '<p class="hcSecNoteText">The card will be shown when ALL conditions below are fulfilled. If no conditions are set, the card will always be shown.</p>' +
      ks.map(cond).join('') + field('Add condition', '<select class="hcInfoInput" data-sec-cond-add><option value="">Choose a condition</option>' + Object.entries(CONDITIONS).map(([v, label]) => '<option value="' + v + '">' + esc(label) + '</option>').join('') + '</select>');
  }
  /* the tile's editor, Concept A */
  const band = (label, hint) => '<div class="hcSecBand"><span>' + esc(label) + '</span>' + (hint ? '<small>' + esc(hint) + '</small>' : '') + '</div>';
  const boxes = (key, now, opts) => '<div class="hcSecBoxes" role="radiogroup">' + opts.map(([v, title, sub]) => '<button class="hcSecBox' + (v === now ? ' on' : '') + '" type="button" role="radio" aria-checked="' + (v === now) + '" data-sec-box="' + key + ':' + v + '"><span class="hcSecBoxRadio"></span><span><strong>' + esc(title) + '</strong><small>' + esc(sub) + '</small></span></button>').join('') + '</div>';
  function nameField(c) {
    const parts = nameParts(c);
    return '<div class="hcSecChips" data-sec-chips>' + parts.map((p, i) => '<span class="hcSecChip' + (p.type === 'text' ? ' text' : '') + '" draggable="true" data-chip="' + i + '">' +
      (p.type === 'text' ? '<input class="hcSecChipText" data-chip-text="' + i + '" value="' + esc(p.text || '') + '" placeholder="Type a name" size="' + Math.max(6, (p.text || '').length + 1) + '">'
        : '<span class="hcSecChipKind">' + esc(NAME_PARTS[p.type]) + '</span><span class="hcSecChipVal">' + esc(partName(c.entity, p) || '—') + '</span>') +
      '<button type="button" data-chip-drop="' + i + '" aria-label="Remove">' + CLOSE + '</button></span>').join('') +
      '<button class="hcSecChipAdd" type="button" data-chip-custom>' + PEN + 'Custom</button>' +
      '<label class="hcSecChipAdd hcSecChipPick">' + PLUS + '<span>Add</span><select data-chip-add aria-label="Add a part"><option value=""></option>' + Object.entries(NAME_PARTS).map(([v, l]) => '<option value="' + v + '">' + l + '</option>').join('') + '</select></label></div>' +
      (c.name_parts || c.name ? '' : '<div class="hcSecNoteText">Shows the entity\u2019s own name until you change it</div>');
  }
  function tileForm(c, tab) {
    const id = c.entity;
    if (tab === 'essentials') {
      const have = (c.features || []).map((f) => f.type), can = Object.keys(FEATURES).filter((f) => canFeature(id, f) && !have.includes(f));
      const dflt = STATE_DEFAULT[id?.split('.')[0]], opts = stateOptions(id);
      return pick('Entity', 'entity', id, entities()) +
        band('Name') + nameField(c) +
        band('State') + (c.hide_state ? '<div class="hcSecNoteText">The state is hidden (Appearance)</div>' : field('', '<select class="hcInfoInput" data-cfg="state_content"><option value="">Default (' + esc(opts.find((o) => o[0] === dflt)?.[1] || 'State') + ')</option>' + opts.map(([v, l]) => '<option value="' + v + '"' + (v === c.state_content ? ' selected' : '') + '>' + esc(l) + '</option>').join('') + '</select>')) +
        band('Features') + (id?.startsWith('light.') ? '<div class="hcSecEntityList">' + have.map((f, i) => '<div class="hcSecEntityRow hcSecSortRow" draggable="true" data-sort="features" data-sort-i="' + i + '">' + GRIP + '<span class="hcSecName">' + esc(FEATURES[f]) + '</span><button class="back" type="button" data-cfg-feat-drop="' + i + '" aria-label="Remove ' + esc(FEATURES[f]) + '">' + CLOSE + '</button></div>').join('') + '</div>' +
          (can.length ? field('', '<select class="hcInfoInput" data-cfg-feat-add><option value="">Add feature</option>' + can.map((f) => '<option value="' + f + '">' + esc(FEATURES[f]) + '</option>').join('') + '</select>') : '') : '<div class="hcSecNoteText">No features for this entity</div>');
    }
    if (tab === 'appearance') {
      return band('Icon & colour') + '<div class="hcSecPair">' + iconField(c) + field('Colour', '<select class="hcInfoInput" data-cfg="color">' + COLOURS.map(([v, l]) => '<option value="' + v + '"' + (v === (c.color || '') ? ' selected' : '') + '>' + esc(l) + '</option>').join('') + '</select>') + '</div>' +
        band('Structure') + '<span class="hcInfoFieldLabel">Content layout</span>' + boxes('vertical', c.vertical ? 'vertical' : 'horizontal', [['horizontal', 'Horizontal', 'Features stacked below'], ['vertical', 'Vertical', 'Features alongside']]) +
        '<span class="hcInfoFieldLabel">Features position</span>' + boxes('features_position', c.features_position || 'bottom', [['bottom', 'Bottom', 'Displays all features stacked'], ['inline', 'Inline', 'Displays only the first feature']]) +
        band('Extras') + toggle('Show entity picture', 'show_entity_picture', !!c.show_entity_picture) + toggle('Hide state', 'hide_state', !!c.hide_state);
    }
    if (tab === 'layout') return layoutForm(c);
    const actSel = (key, now, dflt) => field(key === 'tap_action' ? 'Tap behaviour' : 'Icon tap', '<select class="hcInfoInput" data-sec-act="' + key + '"><option value="">Default (' + ACTIONS.find((a) => a[0] === dflt)[1] + ')</option>' + ACTIONS.map(([v, l]) => '<option value="' + v + '"' + (v === now ? ' selected' : '') + '>' + l + '</option>').join('') + '</select>');
    return '<div class="hcSecInfoBand">Options below vary by entity and feature setup</div>' + band('Interactions') + actSel('tap_action', c.tap_action?.action, 'more-info') + actSel('icon_tap_action', c.icon_tap_action?.action, 'toggle') +
      band('Visibility') + visibilityForm(c);
  }
  function drawEditor(keep) {
    const { c } = edit, name = c.type === 'heading' ? 'Section' : CARD[c.type].name + ' card', adds = edit.from === 'add', tab = edit.tab || (c.type === 'tile' ? 'essentials' : 'config');
    const html = (adds ? '<div class="hcLeHead hcSecHeadBorder"><button class="tfBack" type="button" data-sec-back aria-label="Add to dashboard">' + icon('mdi:arrow-left') + '</button>' +
        '<nav class="hcSecCrumbs"><button type="button" data-sec-back>Add to dashboard</button><span>/</span><span class="activityTitle">Card configuration</span></nav></div>' : dhead(name + ' configuration')) +
      (c.type === 'heading' ? '' : '<div class="hcSecTabs hcSecEditTabs" role="tablist">' + (c.type === 'tile' ? TILE_TABS : CARD_TABS).map(([k, label]) => '<button class="hcSecTab' + (tab === k ? ' active' : '') + '" type="button" role="tab" aria-selected="' + (tab === k) + '" data-sec-etab="' + k + '">' + label + '</button>').join('') + '</div>') +
      '<div class="hcLeBody hcSecEditBody"><div class="hcLeSide hcSecForm">' + (c.type === 'tile' ? tileForm(c, tab) : tab === 'visibility' ? visibilityForm(c) : tab === 'layout' ? layoutForm(c) : form(c)) + '</div><div class="hcLePreviewWrap"><div class="hcLePreviewLabel">Preview</div><div class="hcSecPreview"><div class="hcSecCards">' + previewSlot(c) + '</div></div></div></div>' +
      (adds ? '<div class="hcLeFoot"><button class="hcLeCancel" type="button" data-sec-back>Back</button><button class="primary" type="button" data-sec-save>Add card</button></div>'
        : '<div class="hcLeFoot"><button class="hcLeCancel" type="button" data-sec-close>Cancel</button><button class="primary" type="button" data-sec-save>Save</button></div>');
    if (keep && dialog) {
      // only the preview again, so a field being typed in keeps its place
      const pv = dialog.querySelector('.hcSecPreview .hcSecCards');
      pv.innerHTML = previewSlot(c);
      paint(pv); drawGraphs(pv);
      return;
    }
    layer(html, 'hcSecEditDialog');
  }
  // a new card: "Card added", ringed in blue as it lands; a change: "Saved" (Matt, 26 Nov)
  function saveEdit() {
    const { si, ci, c } = edit;
    remember();
    if (c.type === 'heading') { dash.sections[si].title = c.title || 'New section'; if (c.column_span === 2) dash.sections[si].column_span = 2; else delete dash.sections[si].column_span; }
    else if (ci == null) { dash.sections[si].cards.push(c); flash = { si, ci: dash.sections[si].cards.length - 1 }; } else dash.sections[si].cards[ci] = c;
    save(); closeDialog(); edit = null; draw();
    told(ci == null && c.type !== 'heading' ? 'Card added' : 'Saved', true);
    if (flash) { const was = flash; setTimeout(() => { if (flash === was) flash = null; }, 2000); }
  }
  /* are you sure? A removal asks first, and is held to go ahead (Matt, 26 Nov: "it has that long press that you have to hold
     down"); once done it says so, with Undo */
  let confirming = null;
  function confirmHold(title, message, label, go) {
    page.querySelectorAll('.hcSecMenu:not([hidden])').forEach((m) => { m.hidden = true; });
    layer('<div class="hcSecConfirmBody"><div class="activityTitle">' + esc(title) + '</div><p>' + esc(message) + '</p></div>' +
      '<div class="hcLeFoot"><button class="hcLeCancel" type="button" data-sec-close>Cancel</button><button class="hcSecHold" type="button" data-sec-hold><span class="hcSecHoldFill"></span><span class="hcSecHoldLabel">' + esc(label) + '</span></button></div>', 'hcSecConfirm');
    confirming = go; // (after the dialog opens: opening one closes any other, which drops what it was asking)
  }

  /* ---- what you do ---- */
  const at = (v) => v.split(':').map(Number);
  function onClick(ev) {
    const t = ev.target.closest('button,[data-sec-pick],[data-sec-pick-wx],[data-sec-suggest],[data-sec-more],[data-sec-area],[data-sec-scrim]');
    if (!t) return;
    if (t.hasAttribute('data-sec-scrim')) { if (ev.target === t) closeDialog(); return; }
    // edit mode: the cards don't act
    if (editing && t.closest('.hcSecGrid') && t.closest('.hcSecSlot') && !t.closest('.hcSecCardTools')) return;
    const d = t.dataset;
    if (!t.closest('.hcSecCardTools,.hcSecBarMenu')) page.querySelectorAll('.hcSecMenu:not([hidden])').forEach((m) => { m.hidden = true; });
    if (d.secEdit != null) { editing = true; draw(); }
    else if (d.secDone != null) { editing = false; draw(); }
    else if (d.secNote != null) { dash.note = false; save(); draw(); }
    else if (d.secUndo != null) undo();
    else if (d.secBarMenu != null) { const m = t.nextElementSibling; m.hidden = !m.hidden; }
    else if (d.secClear != null) confirmHold('Clear dashboard?', 'Are you sure you want to remove every section and card?', 'Hold to clear', () => { remember(); dash.sections = [{ title: 'New section', cards: [] }]; save(); draw(); told('Dashboard cleared', true); });
    else if (d.secCreate != null) { remember(); dash.sections.push({ title: 'New section', cards: [] }); save(); draw(); }
    else if (d.secRemove != null) { const si = Number(d.secRemove); confirmHold('Remove section?', 'Are you sure you want to remove this section and its cards?', 'Hold to remove', () => { remember(); dash.sections.splice(si, 1); if (!dash.sections.length) dash.sections.push({ title: 'New section', cards: [] }); save(); draw(); told('Section removed', true); }); }
    else if (d.secRename != null) { const s = dash.sections[Number(d.secRename)]; openEditor(Number(d.secRename), null, { type: 'heading', title: s.title, ...(s.column_span === 2 ? { column_span: 2 } : {}) }); }
    else if (d.secAdd != null) { if (!editing) { editing = true; draw(); } openAdd(Number(d.secAdd)); }
    else if (d.secCardEdit) { const [si, ci] = at(d.secCardEdit); openEditor(si, ci, dash.sections[si].cards[ci]); }
    else if (d.secCardMenu) { const m = t.nextElementSibling; m.hidden = !m.hidden; }
    else if (d.secDupe) { const [si, ci] = at(d.secDupe); remember(); dash.sections[si].cards.splice(ci + 1, 0, JSON.parse(JSON.stringify(dash.sections[si].cards[ci]))); flash = { si, ci: ci + 1 }; save(); draw(); told('Card duplicated', true); }
    else if (d.secDel) { const [si, ci] = at(d.secDel); confirmHold('Remove card?', 'Are you sure you want to remove the card?', 'Hold to remove', () => { remember(); dash.sections[si].cards.splice(ci, 1); save(); draw(); told('Card removed', true); }); }
    else if (d.secClose != null) { closeDialog(); edit = null; adding = null; }
    else if (d.secBack != null) { edit = null; drawAdd(); }
    else if (d.secTab) { adding.tab = d.secTab; drawAdd(); }
    else if (d.secBrowse != null) { adding.tab = 'card'; drawAdd(); }
    else if (d.secFold) { const o = adding.open; if (o.has(d.secFold)) o.delete(d.secFold); else o.add(d.secFold); dialog.querySelector('.hcSecTreeList').innerHTML = treeHtml(); paint(dialog.querySelector('.hcSecTreeList')); }
    else if (d.secChoose) { adding.entity = d.secChoose; drawAdd(); }
    else if (d.secPick) openEditor(adding.si, null, fresh(d.secPick), 'add');
    else if (d.secPickWx) openEditor(adding.si, null, { type: 'hc-weather', widget: d.secPickWx }, 'add');
    else if (d.secSuggest != null) openEditor(adding.si, null, suggestions(adding.entity)[Number(d.secSuggest)], 'add');
    else if (d.secSave != null) saveEdit();
    else if (d.cfgSwitch) { edit.c[d.cfgSwitch] = !t.classList.contains('on'); t.classList.toggle('on'); t.setAttribute('aria-checked', String(t.classList.contains('on'))); drawEditor(true); }
    else if (d.cfgDrop != null) { edit.c.entities.splice(Number(d.cfgDrop), 1); drawEditor(); }
    else if (d.secEtab) { edit.tab = d.secEtab; drawEditor(); }
    else if (d.secSpan) { if (d.secSpan === '2') edit.c.column_span = 2; else delete edit.c.column_span; drawEditor(); }
    else if (d.secRows) { setGrid({ rows: Number(d.secRows) === GRID.area.rows ? null : Number(d.secRows) }); drawEditor(); }
    else if (d.secSlotDrop != null) { const s = slotsOf(edit.c).slots.slice(); s.splice(Number(d.secSlotDrop), 1); edit.c.slots = s; drawEditor(); }
    else if (d.secBox) { const [k, v] = d.secBox.split(':'); if (k === 'vertical') { if (v === 'vertical') edit.c.vertical = true; else delete edit.c.vertical; } else if (v === 'bottom') delete edit.c[k]; else edit.c[k] = v; drawEditor(); }
    else if (d.chipCustom != null) { edit.c.name_parts = [...nameParts(edit.c), { type: 'text', text: '' }]; delete edit.c.name; drawEditor(); dialog.querySelector('[data-chip-text]:last-of-type')?.focus(); const ins = dialog.querySelectorAll('[data-chip-text]'); ins[ins.length - 1]?.focus(); }
    else if (d.chipDrop != null) { const parts = nameParts(edit.c).filter((_, i) => i !== Number(d.chipDrop)); delete edit.c.name; if (parts.length) edit.c.name_parts = parts; else delete edit.c.name_parts; drawEditor(); }
    else if (d.secFullW != null) { const z = sizeOf(edit.c); setGrid({ columns: z.full ? null : 'full' }); drawEditor(); }
    else if (d.secCondDrop != null) { edit.c.visibility.splice(Number(d.secCondDrop), 1); if (!edit.c.visibility.length) delete edit.c.visibility; drawEditor(); }
    else if (d.secCondTick) { const [i, key, v] = d.secCondTick.split(':'), k = edit.c.visibility[Number(i)], list = new Set(k[key] || []); if (list.has(v)) list.delete(v); else list.add(v); k[key] = [...list]; drawEditor(); }
    else if (d.cfgFeatDrop != null) { edit.c.features.splice(Number(d.cfgFeatDrop), 1); if (!edit.c.features.length) delete edit.c.features; drawEditor(); }
    else if (d.secSet) { const [id, to] = d.secSet.split('|'); hass().callService(id.split('.')[0], to === 'on' ? 'turn_on' : 'turn_off', { entity_id: id }); }
    else if (d.secToggle) { const id = d.secToggle; ev.stopPropagation(); hass().callService(id.split('.')[0], id.startsWith('lock.') ? (st(id).state === 'locked' ? 'unlock' : 'lock') : id.startsWith('cover.') ? 'toggle' : id.startsWith('scene.') || id.startsWith('script.') ? 'turn_on' : 'toggle', { entity_id: id }); }
    else if (d.secLights) { const ids = d.secLights.split(','); hass().callService('light', d.on === '1' ? 'turn_off' : 'turn_on', { entity_id: ids }); }
    else if (d.secMore) homecore.more?.(d.secMore, t);
    else if (d.secArea) homecore.openArea?.('room:' + d.secArea);
  }
  function onInput(ev) {
    const t = ev.target;
    if (t.matches('[data-sec-search]')) { adding.q = t.value; drawAdd(); return; }
    if (t.matches('[data-sec-esearch]')) { adding.eq = t.value; const l = dialog.querySelector('.hcSecTreeList'); l.innerHTML = treeHtml(); paint(l); return; }
    if (!edit) return;
    if (t.matches('[data-cfg]')) {
      const k = t.dataset.cfg, v = t.hasAttribute('data-num') ? Math.max(1, Number(t.value) || 24) : t.value;
      if (v === '' && k !== 'entity' && k !== 'area') delete edit.c[k]; else edit.c[k] = v;
      drawEditor(t.tagName === 'INPUT');
    }
    if (t.matches('[data-cfg-add]') && t.value) { edit.c.entities = [...(edit.c.entities || []), t.value]; drawEditor(); }
    if (t.matches('[data-sec-main]')) { if (t.value) edit.c.main = t.value; else delete edit.c.main; drawEditor(); return; }
    if (t.matches('[data-sec-slot-add]') && t.value) { edit.c.slots = [...slotsOf(edit.c).slots, t.value].slice(0, 4); drawEditor(); return; }
    if (t.matches('[data-cfg="area"]') && edit) { delete edit.c.main; delete edit.c.slots; drawEditor(); return; } // another area: its own main and spaces
    if (t.matches('[data-chip-add]') && t.value) { edit.c.name_parts = [...nameParts(edit.c), { type: t.value }]; delete edit.c.name; drawEditor(); return; }
    if (t.matches('[data-chip-text]')) { const parts = nameParts(edit.c).map((p) => ({ ...p })); parts[Number(t.dataset.chipText)].text = t.value; edit.c.name_parts = parts; delete edit.c.name; t.size = Math.max(6, t.value.length + 1); drawEditor(true); return; }
    if (t.matches('[data-sec-act]')) { if (t.value) edit.c[t.dataset.secAct] = { action: t.value }; else delete edit.c[t.dataset.secAct]; drawEditor(); return; }
    if (t.matches('[data-sec-cond-add]') && t.value) { edit.c.visibility = [...(edit.c.visibility || []), t.value === 'user' ? { condition: 'user', users: [ME] } : t.value === 'screen' ? { condition: 'screen', screens: [] } : { condition: t.value }]; drawEditor(); return; }
    if (t.matches('[data-sec-cond]')) { const [i, key] = t.dataset.secCond.split(':'), k = edit.c.visibility[Number(i)]; if (key === 'not') k.not = t.value === '1'; else if (t.value === '') delete k[key]; else k[key] = t.value; drawEditor(t.tagName === 'INPUT'); return; }
    if (t.matches('[data-cfg-feat-add]') && t.value) { edit.c.features = [...(edit.c.features || []), { type: t.value }]; drawEditor(); }
    // another entity: features it can't have go
    if (t.matches('[data-cfg="entity"]') && edit.c.features) { edit.c.features = edit.c.features.filter((f) => canFeature(edit.c.entity, f.type)); if (!edit.c.features.length) delete edit.c.features; drawEditor(); }
  }
  function onKey(ev) {
    // a card in Add to dashboard is picked with Return or Space too
    if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches?.('[data-sec-pick],[data-sec-pick-wx],[data-sec-suggest]')) { ev.preventDefault(); ev.target.click(); return; }
    if (ev.key !== 'Escape') return;
    if (dialog) { ev.preventDefault(); ev.stopPropagation(); closeDialog(); edit = null; adding = null; }
    else if (editing) { editing = false; draw(); }
  }
  // a feature slider: pressed and dragged (or a tap), the bar following the finger; set once it's let go. Arrows step 10
  page.addEventListener('pointerdown', (ev) => {
    const bar = ev.target.closest('[data-sec-slide]');
    if (!bar || bar.closest('[inert]') || (editing && bar.closest('.hcSecGrid'))) return;
    ev.preventDefault();
    const [id, type] = bar.dataset.secSlide.split('|'), box = bar.getBoundingClientRect();
    const at = (x) => Math.max(0, Math.min(100, ((x - box.left) / box.width) * 100));
    const show = (v) => { held = { id, type, v }; const i = bar.querySelector('i'); if (i) i.style.width = v + '%'; else { let b = bar.querySelector('b'); if (!b) { b = document.createElement('b'); bar.appendChild(b); } b.style.left = v + '%'; } bar.setAttribute('aria-valuenow', String(Math.round(v))); };
    show(at(ev.clientX));
    bar.setPointerCapture(ev.pointerId);
    const move = (e) => show(at(e.clientX));
    const up = () => { bar.removeEventListener('pointermove', move); bar.removeEventListener('pointerup', up); bar.removeEventListener('pointercancel', up); const v = held?.v; held = null; if (v != null) setFeature(id, type, v); };
    bar.addEventListener('pointermove', move); bar.addEventListener('pointerup', up); bar.addEventListener('pointercancel', up);
  });
  page.addEventListener('keydown', (ev) => {
    const bar = ev.target.closest?.('[data-sec-slide]');
    if (!bar || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(ev.key)) return;
    ev.preventDefault();
    const [id, type] = bar.dataset.secSlide.split('|'), v = Math.max(0, Math.min(100, Number(bar.getAttribute('aria-valuenow')) + (ev.key === 'ArrowLeft' || ev.key === 'ArrowDown' ? -10 : 10)));
    bar.setAttribute('aria-valuenow', String(v)); setFeature(id, type, v);
  });
  // a stack's rows (a tile's features, an area card's slots) drag into the order they show in (Matt, 26 Nov: "I should be
  // able to reorder it")
  let dragRow = null;
  page.addEventListener('dragstart', (ev) => { const row = ev.target.closest?.('[data-sort-i]'); if (!row) return; dragRow = { list: row.dataset.sort, i: Number(row.dataset.sortI) }; ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', row.dataset.sortI); row.classList.add('dragging'); });
  page.addEventListener('dragover', (ev) => { const row = ev.target.closest?.('[data-sort-i]'); if (dragRow && row && row.dataset.sort === dragRow.list) { ev.preventDefault(); page.querySelectorAll('.hcSecSortRow.over').forEach((x) => x.classList.toggle('over', x === row)); row.classList.add('over'); } });
  page.addEventListener('drop', (ev) => {
    const row = ev.target.closest?.('[data-sort-i]'); if (!dragRow || !row || row.dataset.sort !== dragRow.list || !edit) return;
    ev.preventDefault();
    const list = dragRow.list === 'slots' ? slotsOf(edit.c).slots.slice() : (edit.c.features || []).slice(), [moved] = list.splice(dragRow.i, 1);
    list.splice(Number(row.dataset.sortI), 0, moved);
    if (dragRow.list === 'slots') edit.c.slots = list; else edit.c.features = list;
    dragRow = null; drawEditor();
  });
  page.addEventListener('dragend', () => { dragRow = null; page.querySelectorAll('.hcSecSortRow.dragging,.hcSecSortRow.over').forEach((x) => x.classList.remove('dragging', 'over')); });
  // a name's chips drag into the order the name reads in
  let dragChip = null;
  page.addEventListener('dragstart', (ev) => { const ch = ev.target.closest?.('[data-chip]'); if (!ch) return; dragChip = Number(ch.dataset.chip); ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', String(dragChip)); ch.classList.add('dragging'); });
  page.addEventListener('dragover', (ev) => { if (dragChip != null && ev.target.closest?.('[data-chip]')) ev.preventDefault(); });
  page.addEventListener('drop', (ev) => {
    const ch = ev.target.closest?.('[data-chip]'); if (dragChip == null || !ch || !edit) return;
    ev.preventDefault();
    const parts = nameParts(edit.c).slice(), [moved] = parts.splice(dragChip, 1); parts.splice(Number(ch.dataset.chip), 0, moved);
    edit.c.name_parts = parts; delete edit.c.name; dragChip = null; drawEditor();
  });
  page.addEventListener('dragend', () => { dragChip = null; });
  // the official area card's own controls (its lights, devices, opening the room) work as they do on Home
  homecore.bind?.(page);
  const HOLD = 1200;
  let holdRun = null;
  function holdStart(btn) {
    if (holdRun || !confirming) return;
    const fill = btn.querySelector('.hcSecHoldFill'), t0 = performance.now();
    btn.classList.add('holding');
    // a timer finishes it (frames only draw the fill, and a hidden page gets none)
    const done = setTimeout(() => { const go = confirming; cancelAnimationFrame(holdRun?.frame); holdRun = null; confirming = null; fill.style.width = '100%'; closeDialog(); go?.(); }, HOLD);
    const step = (now) => { if (!holdRun) return; fill.style.width = Math.min(1, (now - t0) / HOLD) * 100 + '%'; holdRun.frame = requestAnimationFrame(step); };
    holdRun = { btn, done, frame: requestAnimationFrame(step) };
  }
  function holdStop() {
    if (!holdRun) return;
    clearTimeout(holdRun.done); cancelAnimationFrame(holdRun.frame);
    const { btn } = holdRun; holdRun = null;
    btn.classList.remove('holding');
    btn.querySelector('.hcSecHoldFill').style.width = '0%';
  }
  page.addEventListener('pointerdown', (ev) => { const b = ev.target.closest('[data-sec-hold]'); if (b && ev.button === 0) { ev.preventDefault(); try { b.setPointerCapture(ev.pointerId); } catch (_e) { /* (a pen or a test) */ } holdStart(b); } });
  page.addEventListener('pointerup', holdStop);
  page.addEventListener('pointercancel', holdStop);
  page.addEventListener('keydown', (ev) => { const b = ev.target.closest?.('[data-sec-hold]'); if (b && (ev.key === 'Enter' || ev.key === ' ') && !ev.repeat) { ev.preventDefault(); holdStart(b); } });
  page.addEventListener('keyup', (ev) => { if (ev.target.closest?.('[data-sec-hold]') && (ev.key === 'Enter' || ev.key === ' ')) holdStop(); });
  page.addEventListener('click', onClick);
  page.addEventListener('input', onInput);
  page.addEventListener('change', (ev) => { if (ev.target.tagName === 'SELECT') onInput(ev); });
  page.addEventListener('keydown', onKey);

  // the states change: the cards show it (a dialog's preview too), without losing a field being typed in
  const tick = setInterval(() => {
    const s = hass()?.states;
    if (!s || s === lastStates || held) return;
    lastStates = s;
    if (dialog) { if (edit) drawEditor(true); return; }
    draw();
  }, 1000);
  lastStates = hass()?.states;
  draw();
  // a first visit is met with what this is (Matt, 26 Nov), once; in the are-you-sure popup's pattern
  const WELCOME_KEY = 'homecore-demo-dashboard-welcome';
  let welcomed = false;
  try { welcomed = localStorage.getItem(WELCOME_KEY) === '1'; } catch (_e) { /* show it */ }
  if (!welcomed) {
    layer('<div class="hcSecConfirmBody"><div class="activityTitle">Welcome to My Cool Dashboard</div><p>This is an example of a custom dashboard. There is some limited functionality for editing, but the basics like adding some cards and removing them are all here.</p><p>Have fun!</p></div>' +
      '<div class="hcLeFoot hcSecOne"><button class="primary" type="button" data-sec-close data-sec-welcome>Got it</button></div>', 'hcSecConfirm hcSecWelcome');
    try { localStorage.setItem(WELCOME_KEY, '1'); } catch (_e) { /* this visit only */ }
  }
  return () => { clearInterval(tick); closeDialog(); page.closest('#app')?.classList.remove('hcSecEditing'); };
}
