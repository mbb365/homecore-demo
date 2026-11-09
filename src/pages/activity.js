// Activity: Home Assistant's logbook (Matt, 9 Nov: "more like the proper HA one with the filtering"), in HomeCore's parts.
// A period (Today, Yesterday, Last 7 days), an area and a search narrow it; every change shows, newest first, in a card
// for each day: the time, the device's chip, its name, what happened and who or what did it. A row opens the device's
// details in Home Assistant, which isn't designed here (the Oops popup).
const PERIODS = [['today', 'Today'], ['yesterday', 'Yesterday'], ['week', 'Last 7 days']];
const DAY = 864e5;

// what happened, in Home Assistant's words
function said(id, state, attrs) {
  const d = id.split('.')[0], dc = attrs?.device_class;
  if (d === 'lock') return { locked: 'Locked', unlocked: 'Unlocked', jammed: 'Jammed', open: 'Opened' }[state] || state;
  if (d === 'media_player') return { playing: 'Started playing', paused: 'Paused', idle: 'Stopped', on: 'Turned on', off: 'Turned off' }[state] || state;
  if (d === 'binary_sensor') {
    if (dc === 'moisture') return state === 'on' ? 'Detected water' : 'Dry again';
    if (['door', 'window', 'opening', 'garage_door'].includes(dc)) return state === 'on' ? 'Opened' : 'Closed';
    if (dc === 'motion' || dc === 'occupancy') return state === 'on' ? 'Detected motion' : 'Cleared';
    return state === 'on' ? 'Turned on' : 'Turned off';
  }
  if (d === 'cover') return { open: 'Opened', closed: 'Closed', opening: 'Opening', closing: 'Closing' }[state] || state;
  if (d === 'climate') return 'Changed to ' + state;
  return { on: 'Turned on', off: 'Turned off', unavailable: 'Became unavailable' }[state] || 'Changed to ' + state;
}

export function renderActivity(page, { getHass, esc, device, paint, head, icon }) {
  const hass = getHass();
  const KEY = 'homecore-demo-activity';
  let prefs = { period: 'today', area: '' };
  try { prefs = { ...prefs, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch (_e) { /* the defaults */ }
  let q = '', events = [];
  // the rooms (not the areas that aren't rooms, which HomeCore leaves out too)
  const areas = Object.entries(hass.areas || {}).map(([id, a]) => ({ id: a.area_id || id, name: a.name })).filter((a) => !['roaming', 'test_area'].includes(a.id)).sort((a, b) => a.name.localeCompare(b.name));
  const areaOf = (id) => hass.entities?.[id]?.area_id || '';
  const nameOf = (id) => hass.states[id]?.attributes?.friendly_name || id;
  const who = (e) => {
    if (e.context_user_id) {
      const person = Object.values(hass.states).find((s) => s.entity_id.startsWith('person.') && s.attributes.user_id === e.context_user_id);
      if (person) return 'by ' + person.attributes.friendly_name;
    }
    if (e.context_name) return 'triggered by ' + e.context_name;
    return '';
  };

  page.innerHTML = head('Activity') +
    '<div class="hcToolbar hcActivityBar">' +
      '<div class="tfSeg hcPeriod" role="group" aria-label="When">' + PERIODS.map(([k, t]) => '<button type="button" data-period="' + k + '">' + t + '</button>').join('') + '</div>' +
      '<select class="settingsSelect" data-area aria-label="Area"><option value="">All areas</option>' + areas.map((a) => '<option value="' + esc(a.id) + '">' + esc(a.name) + '</option>').join('') + '</select>' +
      '<label class="hcSearch">' + icon('mdi:magnify') + '<input class="addInput" type="search" placeholder="Search activity" aria-label="Search activity"></label>' +
    '</div>' +
    '<div class="hcActivityDays"></div>';
  const box = page.querySelector('.hcActivityDays');
  page.querySelector('[data-area]').value = prefs.area;

  const span = () => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (prefs.period === 'yesterday') return [+today - DAY, +today];
    if (prefs.period === 'week') return [+today - 6 * DAY, Date.now()];
    return [+today, Date.now()];
  };
  async function load() {
    const [from, to] = span();
    try {
      const res = await hass.callWS({ type: 'logbook/get_events', start_time: new Date(from).toISOString(), end_time: new Date(to).toISOString() });
      events = (Array.isArray(res) ? res : []).filter((e) => e.entity_id && e.state != null && e.when * 1000 >= from && e.when * 1000 <= to && hass.states[e.entity_id]);
    } catch (_e) { events = []; }
    draw();
  }
  function draw() {
    page.querySelectorAll('[data-period]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.period === prefs.period)));
    const words = q.trim().toLowerCase();
    const shown = events.filter((e) => (!prefs.area || areaOf(e.entity_id) === prefs.area))
      .map((e) => ({ ...e, name: nameOf(e.entity_id), what: said(e.entity_id, e.state, hass.states[e.entity_id]?.attributes), by: who(e) }))
      .filter((e) => !words || (e.name + ' ' + e.what + ' ' + e.by).toLowerCase().includes(words))
      .sort((a, b) => b.when - a.when);
    if (!shown.length) {
      box.innerHTML = '<section class="card hcFields hcSoon"><p>' + (words || prefs.area ? 'Nothing matches.' : prefs.period === 'yesterday' ? 'Nothing happened yesterday.' : 'Nothing has happened yet.') + '</p></section>';
      return;
    }
    const days = new Map();
    shown.forEach((e) => {
      const d = new Date(e.when * 1000), key = d.toDateString();
      if (!days.has(key)) days.set(key, { d, rows: [] });
      days.get(key).rows.push(e);
    });
    const today = new Date().toDateString(), yesterday = new Date(Date.now() - DAY).toDateString();
    const dayName = (d) => (d.toDateString() === today ? 'Today' : d.toDateString() === yesterday ? 'Yesterday' : d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }));
    box.innerHTML = [...days.values()].map(({ d, rows }) => '<section class="card hcActivityCard"><div class="hcCardTitle">' + esc(dayName(d)) + '</div>' +
      rows.map((e) => '<button class="hcRow hcActivityRow" type="button" data-oops>' +
        '<span class="hcActivityTime">' + new Date(e.when * 1000).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) + '</span>' +
        device(e.entity_id) + '<span class="hcRowText"><span class="hcRowName">' + esc(e.name) + '</span><span class="hcRowSub">' + esc(e.what + (e.by ? ' ' + e.by : '')) + '</span></span></button>').join('') +
      '</section>').join('');
    paint(box);
  }

  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (_e) { /* this visit only */ } };
  page.querySelector('.hcPeriod').addEventListener('click', (ev) => { const b = ev.target.closest('[data-period]'); if (!b) return; prefs.period = b.dataset.period; save(); load(); });
  page.querySelector('[data-area]').addEventListener('change', (ev) => { prefs.area = ev.target.value; save(); draw(); });
  page.querySelector('.hcSearch input').addEventListener('input', (ev) => { q = ev.target.value; draw(); });
  load();
}
