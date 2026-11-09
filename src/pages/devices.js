// Devices: Home Assistant's device list (Settings → Devices) from Matt's Claude Design file, in HomeCore's parts.
// A table (HomeCore's settings table) or cards (tiles on their own), with search, group by and sort. Filters, the gear,
// Select and Add device are there as in Home Assistant but do nothing in the demo. Under 720 wide the table becomes
// tiles in a card, as Settings → Lights does.

// Home Assistant's names for each kind. Readings (sensor.*) are a device's entities, not devices, so they're left out
const TYPES = {
  light: 'Light', switch: 'Switch', fan: 'Fan', media_player: 'Media player', lock: 'Lock', climate: 'Climate', cover: 'Cover',
  vacuum: 'Vacuum', valve: 'Valve', humidifier: 'Humidifier', alarm_control_panel: 'Alarm', plant: 'Plant',
  binary_sensor: 'Sensor',
};
// The made-up house has no integrations or makers, so each kind gets a likely one (Philips Hue / Signify as in Matt's file)
const MAKER = {
  light: ['Philips Hue', 'Signify'], switch: ['Shelly', 'Shelly'], fan: ['SwitchBot', 'SwitchBot'], media_player: ['Sonos', 'Sonos'],
  lock: ['Nuki', 'Nuki'], climate: ['tado°', 'tado'], cover: ['IKEA DIRIGERA', 'IKEA of Sweden'], vacuum: ['Roborock', 'Roborock'],
  valve: ['Zigbee Home Automation', 'Sonoff'], humidifier: ['SwitchBot', 'SwitchBot'], alarm_control_panel: ['Ring', 'Ring'],
  plant: ['Xiaomi Miio', 'Xiaomi'], binary_sensor: ['Zigbee Home Automation', 'Aqara'],
};
const STATE = {
  on: 'On', off: 'Off', playing: 'Playing', paused: 'Paused', idle: 'Idle', standby: 'Standby', locked: 'Locked', unlocked: 'Unlocked',
  heat: 'Heat', cool: 'Cool', auto: 'Auto', docked: 'Docked', cleaning: 'Cleaning', returning: 'Returning', open: 'Open', closed: 'Closed',
  opening: 'Opening', closing: 'Closing', disarmed: 'Disarmed', armed_home: 'Armed home', armed_away: 'Armed away', ok: 'OK', problem: 'Problem',
  unavailable: 'Unavailable',
};
const ON = new Set(['on', 'playing', 'unlocked', 'open', 'opening', 'heat', 'cool', 'auto', 'cleaning', 'problem']);
const KEY = 'homecore-demo-devices';
const local = {
  get() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (_e) { return {}; } },
  set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (_e) { /* not remembered */ } },
};
const hash = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };

function deviceList(hass, model) {
  const states = model?.states || hass.states;
  return Object.values(states).filter((st) => {
    const d = st.entity_id.split('.')[0], e = hass.entities?.[st.entity_id];
    return TYPES[d] && !e?.hidden && !e?.entity_category;
  }).map((st) => {
    const id = st.entity_id, d = id.split('.')[0], a = st.attributes || {};
    const [integration, maker] = MAKER[d];
    const areaId = model?.areaOf?.(id) ?? hass.entities?.[id]?.area_id;
    const battery = a.battery_level != null ? a.battery_level + '%'
      : ['binary_sensor', 'lock'].includes(d) ? 40 + (hash(id) % 61) + '%' : '';
    const stateText = STATE[st.state] || st.state.charAt(0).toUpperCase() + st.state.slice(1);
    return { id, st, d, name: a.friendly_name || id, type: TYPES[d], area: hass.areas?.[areaId]?.name || '', integration, maker, battery, stateText, on: ON.has(st.state) };
  });
}

export function renderDevices(page, { getHass, homecore, esc, icon }) {
  const prefs = { group: 'type', sort: 'name', view: 'list', ...local.get() };
  let q = '';
  const hass = getHass();
  const all = deviceList(hass, homecore.model);

  page.innerHTML =
    '<div class="hcHead"><h1 class="settingsTitle">Devices</h1>' +
      '<div class="hcHeadActions"><button class="pill" type="button">Select</button><button class="primary hcAdd" type="button">' + icon('mdi:plus') + 'Add device</button></div></div>' +
    '<div class="hcToolbar">' +
      '<button class="hcBtn" type="button">' + icon('mdi:filter-variant') + 'Filters</button>' +
      '<label class="hcSearch">' + icon('mdi:magnify') + '<input class="addInput" type="search" placeholder="Search ' + all.length + ' devices" aria-label="Search devices"></label>' +
      '<select class="settingsSelect" data-group aria-label="Group by">' +
        [['type', 'Group by type'], ['area', 'Group by area'], ['integration', 'Group by integration'], ['none', 'No grouping']].map(([v, t]) => '<option value="' + v + '">' + t + '</option>').join('') + '</select>' +
      '<select class="settingsSelect" data-sort aria-label="Sort by">' +
        [['name', 'Sort by name'], ['area', 'Sort by area']].map(([v, t]) => '<option value="' + v + '">' + t + '</option>').join('') + '</select>' +
      '<button class="navBtn" type="button" title="Columns" aria-label="Columns">' + icon('mdi:cog-outline') + '</button>' +
      '<div class="tfSeg hcViewSeg" role="group" aria-label="Show as">' +
        '<button type="button" data-view="list" title="Table" aria-label="Table">' + icon('mdi:format-list-bulleted') + '</button>' +
        '<button type="button" data-view="cards" title="Cards" aria-label="Cards">' + icon('mdi:view-grid-outline') + '</button></div>' +
    '</div>' +
    '<div class="hcGroups"></div>';
  const box = page.querySelector('.hcGroups');
  page.querySelector('[data-group]').value = prefs.group;
  page.querySelector('[data-sort]').value = prefs.sort;

  const iconCell = (x) => '<span class="tfIcon"><ha-state-icon data-eid="' + esc(x.id) + '"></ha-state-icon></span>';
  const pills = (x) => '<div class="hcPills"><span class="hcPill">' + esc(x.type) + '</span><span class="hcPill' + (x.on ? ' on' : '') + '">' + esc(x.stateText) + '</span></div>';
  const table = (xs) => '<section class="card hcTableCard"><div class="metaTableWrap"><table class="metaTable hcDevTable">' +
      '<thead><tr><th>Name</th><th>Area</th><th>Integration</th><th>Manufacturer</th><th>Battery</th></tr></thead><tbody>' +
      xs.map((x) => '<tr><td><span class="hcNameCell">' + iconCell(x) + '<strong>' + esc(x.name) + '</strong></span></td><td>' + esc(x.area || '—') + '</td><td>' + esc(x.integration) + '</td><td>' + esc(x.maker) + '</td><td>' + esc(x.battery || '—') + '</td></tr>').join('') +
      '</tbody></table></div>' +
      // narrow: a tile for each device, in the same card
      '<div class="activityRows hcDevRows">' + xs.map((x) => '<div class="activityRow">' + iconCell(x) +
        '<div class="tfName"><span class="activityRowName">' + esc(x.name) + '</span><span class="activityRowMeta">' + esc([x.area, x.stateText].filter(Boolean).join(' · ')) + '</span></div></div>').join('') + '</div>' +
    '</section>';
  const cards = (xs) => '<div class="hcDevCards">' + xs.map((x) => '<div class="tfAction hcDevTile">' +
      '<div class="tfActionHead">' + iconCell(x) + '<div class="tfName"><span class="activityRowName">' + esc(x.name) + '</span><span class="activityRowMeta">' + esc(x.area || '—') + '</span></div></div>' +
      pills(x) + '</div>').join('') + '</div>';

  function draw() {
    const words = q.trim().toLowerCase();
    const xs = all.filter((x) => !words || [x.name, x.area, x.type, x.integration, x.maker].join(' ').toLowerCase().includes(words))
      .sort((a, b) => (prefs.sort === 'area' ? (a.area || '~').localeCompare(b.area || '~') : 0) || a.name.localeCompare(b.name));
    const groups = new Map();
    xs.forEach((x) => {
      const g = prefs.group === 'none' ? '' : prefs.group === 'area' ? x.area || 'No area' : x[prefs.group];
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(x);
    });
    const order = [...groups.keys()].sort((a, b) => a.localeCompare(b));
    box.innerHTML = !xs.length ? '<p class="note hcEmpty">No devices match “' + esc(q.trim()) + '”.</p>'
      : order.map((g) => '<section class="hcGroup">' + (g ? '<div class="sectionLabel">' + esc(g) + ' <span class="hcCount">' + groups.get(g).length + '</span></div>' : '') +
        (prefs.view === 'cards' ? cards(groups.get(g)) : table(groups.get(g))) + '</section>').join('');
    const h = getHass();
    box.querySelectorAll('ha-state-icon[data-eid]').forEach((el) => { el.hass = h; el.stateObj = all.find((x) => x.id === el.dataset.eid)?.st; });
    page.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === prefs.view)));
  }

  page.querySelector('.hcSearch input').addEventListener('input', (ev) => { q = ev.target.value; draw(); });
  page.querySelector('[data-group]').addEventListener('change', (ev) => { prefs.group = ev.target.value; local.set(prefs); draw(); });
  page.querySelector('[data-sort]').addEventListener('change', (ev) => { prefs.sort = ev.target.value; local.set(prefs); draw(); });
  page.querySelector('.hcViewSeg').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-view]');
    if (!b) return;
    prefs.view = b.dataset.view; local.set(prefs); draw();
  });
  draw();
}
