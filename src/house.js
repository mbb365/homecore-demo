// The house on the Test focus layout: Matt's own rooms (Home Assistant areas) with his real lights, media, plugs,
// locks and power, plus made-up devices for what the house doesn't have yet (thermostat, covers, humidifier, robot
// vacuum, balcony solar and watering, alarm, doors and windows, plants, room temperature and humidity). Made-up devices
// live here and answer their own service calls, so they work the same in the dev preview and on a real Home Assistant.

// Areas that aren't rooms in Matt's house (a sensor that moves around, a test bench)
const SKIP_AREAS = new Set(['roaming', 'test_area']);

// What each room gets when it has none of its own. A cover is [name, device class, % open, slats' tilt]: one of each
// kind the covers design draws (curtains, a roller blind, venetian blinds)
const MADE_UP = {
  living_room: { climate: true, cover: ['Curtains', 'curtain', 62], temperature: 20.5, humidity: 44, motion: 'Living room motion', plant: ['Monstera', 32, 4200, 21.4, 580] },
  kitchen: { temperature: 21.2, humidity: 48, door: 'Back door', plant: ['Basil', 55, 900, 22.1, 910] },
  balcony: { solar: true, door: 'Balcony door', doorOpen: true, valve: 'Watering', plant: ['Tomatoes', 61, 18500, 14.2, 1240] },
  bedroom: { cover: ['Roller blind', 'shade', 0], humidifier: true, temperature: 18.9, humidity: 38, window: 'Bedroom window' },
  office: { cover: ['Blinds', 'blind', 60, 45], vacuum: true, temperature: 21.8, humidity: 41, plant: ['Pothos', 47, 2600, 21.6, 640] },
  bathroom: { temperature: 22.4, humidity: 62 },
};
// What a plant wants (as Home Assistant's plant integration checks it)
const PLANT_RANGE = { moisture: [40, 70], light: [1500, 60000], temperature: [10, 32], fertility: [350, 2000] };
const PREFIX = 'made_up_';
export const isMadeUp = (id) => String(id).split('.')[1]?.startsWith(PREFIX);
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_');

// Balcony panels: nothing at night, about 2.4 kW at 13:30
function solarAt(date) {
  const h = date.getHours() + date.getMinutes() / 60;
  const k = Math.max(0, Math.sin(((h - 7) / 13) * Math.PI));
  return 2.4 * k * k;
}
function solarToday(now) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let kwh = 0;
  for (let t = +start; t < +now; t += 10 * 60 * 1000) kwh += solarAt(new Date(t)) / 6;
  return kwh;
}
export function solarHistory(now = new Date()) {
  const pts = [];
  for (let i = 0; i <= 96; i++) { const t = +now - (96 - i) * 15 * 60 * 1000; pts.push([t, solarAt(new Date(t))]); }
  return pts;
}

export function createHouse({ onChange }) {
  const fake = {};
  const area = {}; // made-up entity id → area id
  const add = (id, areaId, state, attributes) => { fake[id] = { entity_id: id, state, attributes, last_changed: new Date(Date.now() - 5 * 3600 * 1000).toISOString() }; area[id] = areaId; };
  // a made-up device's next state; last_changed moves only when the state does, as in Home Assistant
  const put = (id, state, attrs) => {
    const old = fake[id], next = state ?? old.state;
    fake[id] = { ...old, state: next, attributes: { ...old.attributes, ...attrs }, last_changed: next === old.state ? old.last_changed : new Date().toISOString() };
  };
  const opening = (a, name, cls, open) => add('binary_sensor.' + PREFIX + (a ? a + '_' : '') + slug(name), a, open ? 'on' : 'off', { friendly_name: name, device_class: cls });

  Object.entries(MADE_UP).forEach(([a, m]) => {
    if (m.temperature != null) add('sensor.' + PREFIX + a + '_temperature', a, String(m.temperature), { friendly_name: 'Temperature', device_class: 'temperature', state_class: 'measurement', unit_of_measurement: '°C' });
    if (m.humidity != null) add('sensor.' + PREFIX + a + '_humidity', a, String(m.humidity), { friendly_name: 'Humidity', device_class: 'humidity', state_class: 'measurement', unit_of_measurement: '%' });
    if (m.vacuum) add('vacuum.' + PREFIX + 'robot', a, 'docked', { friendly_name: 'Robot vacuum', battery_level: 100, fan_speed: 'standard', rooms: [] });
    if (m.climate) add('climate.' + PREFIX + a, a, 'heat', { friendly_name: 'Thermostat', hvac_modes: ['off', 'heat', 'cool', 'auto'], hvac_action: 'heating', current_temperature: m.temperature, temperature: 21, min_temp: 7, max_temp: 30, target_temp_step: 0.5 });
    if (m.cover) {
      const [name, cls, position, tilt] = m.cover;
      add('cover.' + PREFIX + a + '_' + slug(name), a, position ? 'open' : 'closed', { friendly_name: name, device_class: cls, current_position: position, ...(tilt != null ? { current_tilt_position: tilt } : {}) });
    }
    if (m.humidifier) add('humidifier.' + PREFIX + a, a, 'on', { friendly_name: 'Humidifier', device_class: 'humidifier', humidity: 45, current_humidity: m.humidity, action: 'humidifying', mode: 'normal', available_modes: ['normal', 'eco', 'sleep', 'boost'], min_humidity: 30, max_humidity: 70 });
    if (m.solar) {
      add('sensor.' + PREFIX + a + '_solar_power', a, '0', { friendly_name: 'Solar now', device_class: 'power', state_class: 'measurement', unit_of_measurement: 'kW' });
      add('sensor.' + PREFIX + a + '_solar_today', a, '0', { friendly_name: 'Solar today', device_class: 'energy', state_class: 'total_increasing', unit_of_measurement: 'kWh' });
    }
    if (m.valve) add('valve.' + PREFIX + a + '_' + slug(m.valve), a, 'closed', { friendly_name: m.valve, device_class: 'water' });
    if (m.door) opening(a, m.door, 'door', m.doorOpen);
    if (m.window) opening(a, m.window, 'window', false);
    if (m.motion) opening(a, m.motion, 'motion', false);
    if (m.plant) {
      const [name, moisture, light, temperature, fertility] = m.plant, p = PREFIX + slug(name);
      const reading = (key, label, value, unit, cls) => add('sensor.' + p + '_' + key, a, String(value), { friendly_name: label, device_class: cls, state_class: 'measurement', unit_of_measurement: unit, plant_low: value < PLANT_RANGE[key][0], plant_high: value > PLANT_RANGE[key][1], icon: { moisture: 'mdi:water', light: 'mdi:white-balance-sunny', temperature: 'mdi:thermometer', fertility: 'mdi:emoticon-poop' }[key] });
      reading('moisture', 'Moisture', moisture, '%', 'moisture');
      reading('light', 'Light', light, 'lx', 'illuminance');
      reading('temperature', 'Temperature', temperature, '°C', 'temperature');
      reading('fertility', 'Fertility', fertility, 'µS/cm', 'conductivity');
      const problems = Object.entries({ moisture, light, temperature, fertility }).filter(([k, v]) => v < PLANT_RANGE[k][0] || v > PLANT_RANGE[k][1]).map(([k, v]) => k + (v < PLANT_RANGE[k][0] ? ' low' : ' high'));
      add('plant.' + p, a, problems.length ? 'problem' : 'ok', { friendly_name: name, moisture, brightness: light, temperature, conductivity: fertility, problem: problems.join(', ') || 'none' });
    }
  });
  // the whole house
  add('alarm_control_panel.' + PREFIX + 'house', null, 'disarmed', { friendly_name: 'Alarm', supported_features: 1 | 2 | 4, code_format: null, changed_by: 'Matt' });
  opening(null, 'Front door', 'door', false);
  opening(null, 'Smoke alarm', 'smoke', false);
  add('sensor.' + PREFIX + 'doorbell', null, '', { friendly_name: 'Doorbell', device_class: 'timestamp', rang: Date.now() - 47 * 60 * 1000 });

  const target = {}; // cover id → position it's moving to
  const tiltTarget = {}; // venetian blinds: the slats' tilt they're turning to
  let arming = null; // { mode, at }
  function solarNow() {
    const now = new Date();
    Object.keys(fake).forEach((id) => {
      if (id.endsWith('_solar_power')) fake[id] = { ...fake[id], state: solarAt(now).toFixed(2) };
      if (id.endsWith('_solar_today')) fake[id] = { ...fake[id], state: solarToday(now).toFixed(1) };
    });
  }
  solarNow();

  // one clock: covers move 10% a second and slats turn 25%; rooms warm up and get damper every 10 seconds; the vacuum
  // cleans and comes home; the alarm takes 5 seconds to arm
  let ticks = 0;
  function tick() {
    let changed = false;
    const slow = ++ticks % 10 === 0;
    const set = (id, state, attrs) => { put(id, state, attrs); changed = true; };
    Object.entries(target).forEach(([id, to]) => {
      const at = fake[id].attributes.current_position;
      const next = at < to ? Math.min(to, at + 10) : Math.max(to, at - 10);
      if (next === to) delete target[id];
      set(id, next === to ? (next === 0 ? 'closed' : 'open') : (to > at ? 'opening' : 'closing'), { current_position: next });
    });
    Object.entries(tiltTarget).forEach(([id, to]) => {
      const at = fake[id].attributes.current_tilt_position;
      const next = at < to ? Math.min(to, at + 25) : Math.max(to, at - 25);
      if (next === to) delete tiltTarget[id];
      set(id, null, { current_tilt_position: next });
    });
    Object.keys(fake).filter((id) => id.startsWith('climate.')).forEach((id) => {
      const s = fake[id], a = s.attributes, cur = a.current_temperature;
      const heat = (s.state === 'heat' || s.state === 'auto') && cur < a.temperature - 0.05;
      const cool = (s.state === 'cool' || s.state === 'auto') && cur > a.temperature + 0.05;
      const action = s.state === 'off' ? 'off' : heat ? 'heating' : cool ? 'cooling' : 'idle';
      const next = slow ? Math.round((cur + (heat ? 0.1 : cool ? -0.1 : 0)) * 10) / 10 : cur;
      if (next !== cur || action !== a.hvac_action) set(id, null, { current_temperature: next, hvac_action: action });
    });
    Object.keys(fake).filter((id) => id.startsWith('humidifier.')).forEach((id) => {
      const s = fake[id], a = s.attributes, cur = a.current_humidity;
      const up = s.state === 'on' && cur < a.humidity;
      const next = up && slow ? cur + 1 : cur;
      const action = s.state !== 'on' ? 'off' : up ? 'humidifying' : 'idle';
      if (next !== cur || action !== a.action) {
        set(id, null, { current_humidity: next, action });
        const room = 'sensor.' + PREFIX + area[id] + '_humidity';
        if (fake[room]) set(room, String(next));
      }
    });
    const v = fake['vacuum.' + PREFIX + 'robot'], va = v.attributes;
    if (v.state === 'cleaning' && slow) set(v.entity_id, null, { battery_level: Math.max(5, va.battery_level - 1) });
    if (v.state === 'returning') set(v.entity_id, 'docked', {});
    if (v.state === 'docked' && va.battery_level < 100) set(v.entity_id, null, { battery_level: Math.min(100, va.battery_level + 2) });
    if (arming && Date.now() - arming.at > 5000) { set('alarm_control_panel.' + PREFIX + 'house', 'armed_' + arming.mode, {}); arming = null; }
    if (changed) onChange();
  }
  const clock = setInterval(tick, 1000);
  const sun = setInterval(() => { solarNow(); onChange(); }, 60 * 1000);

  // made-up devices answer here; anything else goes to Home Assistant
  function call(domain, service, data) {
    const id = data?.entity_id;
    if (!fake[id]) return false;
    const s = fake[id], a = s.attributes;
    const set = (state, attrs) => put(id, state, attrs);
    if (domain === 'climate') {
      if (service === 'set_temperature') set(null, { temperature: Math.max(a.min_temp, Math.min(a.max_temp, data.temperature)) });
      if (service === 'set_hvac_mode') set(data.hvac_mode, data.hvac_mode === 'off' ? { hvac_action: 'off' } : {});
      if (service === 'toggle') set(s.state === 'off' ? 'heat' : 'off', s.state === 'off' ? {} : { hvac_action: 'off' });
    }
    if (domain === 'cover') {
      const to = service === 'open_cover' ? 100 : service === 'close_cover' ? 0 : service === 'set_cover_position' ? data.position : service === 'toggle' ? (a.current_position > 0 ? 0 : 100) : null;
      if (service === 'stop_cover') { delete target[id]; delete tiltTarget[id]; set(a.current_position === 0 ? 'closed' : 'open'); }
      if (to != null && to !== a.current_position) { target[id] = to; set(to > a.current_position ? 'opening' : 'closing'); }
      const tilt = service === 'open_cover_tilt' ? 100 : service === 'close_cover_tilt' ? 0 : service === 'set_cover_tilt_position' ? data.tilt_position : null;
      if (service === 'stop_cover_tilt') delete tiltTarget[id];
      if (tilt != null && a.current_tilt_position != null && tilt !== a.current_tilt_position) tiltTarget[id] = tilt;
    }
    if (domain === 'humidifier') {
      if (service === 'set_humidity') set(null, { humidity: Math.max(a.min_humidity, Math.min(a.max_humidity, data.humidity)) });
      if (service === 'set_mode') set(null, { mode: data.mode });
      if (service === 'turn_on' || service === 'turn_off' || service === 'toggle') {
        const on = service === 'turn_on' || (service === 'toggle' && s.state !== 'on');
        set(on ? 'on' : 'off', { action: on ? 'idle' : 'off' });
      }
    }
    if (domain === 'vacuum') {
      if (service === 'start') set('cleaning', { rooms: data.rooms || a.rooms });
      if (service === 'pause') set('paused');
      if (service === 'return_to_base') set('returning', { rooms: [] });
      if (service === 'locate') set(null, { located: Date.now() });
      if (service === 'set_rooms') set(null, { rooms: data.rooms });
    }
    if (domain === 'valve') {
      const open = service === 'open_valve' || (service === 'toggle' && s.state !== 'open');
      if (['open_valve', 'close_valve', 'toggle'].includes(service)) set(open ? 'open' : 'closed');
    }
    if (domain === 'alarm_control_panel') {
      if (service === 'alarm_disarm') { arming = null; set('disarmed', { changed_by: 'Matt' }); }
      const mode = { alarm_arm_home: 'home', alarm_arm_away: 'away', alarm_arm_night: 'night' }[service];
      if (mode) { arming = { mode, at: Date.now() }; set('arming', { changed_by: 'Matt' }); }
    }
    onChange();
    return true;
  }

  // Rooms from Home Assistant areas, with made-up devices added where a room has none of that kind
  function model(hass) {
    const real = hass?.states || {};
    const ents = hass?.entities || {}, devs = hass?.devices || {};
    const areaOf = (id) => { const e = ents[id]; return (e && (e.area_id || (e.device_id && devs[e.device_id]?.area_id))) || null; };
    const usable = (id) => { const e = ents[id]; return real[id] && real[id].state !== 'unavailable' && !e?.hidden && !e?.entity_category; };
    const byArea = {};
    Object.keys(real).forEach((id) => { const a = areaOf(id); if (a && usable(id)) (byArea[a] ||= []).push(id); });
    const states = { ...real, ...fake };
    const dc = (id) => states[id]?.attributes?.device_class;
    const OPENINGS = ['door', 'window', 'garage_door', 'opening', 'motion', 'occupancy', 'smoke', 'gas'];
    // a vacuum belongs to its room (the made-up one to the office, when the house has no vacuum of its own)
    const realVacuums = Object.keys(real).filter((id) => id.startsWith('vacuum.') && usable(id));
    const rooms = Object.values(hass?.areas || {}).filter((ar) => !SKIP_AREAS.has(ar.area_id)).map((ar) => {
      const a = ar.area_id, ids = byArea[a] || [];
      const of = (domain) => ids.filter((id) => id.startsWith(domain + '.'));
      const sensors = (cls) => of('sensor').filter((id) => dc(id) === cls);
      const mine = (pred) => Object.keys(fake).filter((id) => area[id] === a && pred(id));
      const pick = (realIds, made) => (realIds.length ? realIds : mine(made));
      const temp = pick(sensors('temperature'), (id) => id.endsWith(a + '_temperature'));
      const hum = pick(sensors('humidity'), (id) => id.endsWith(a + '_humidity'));
      const power = sensors('power').filter((id) => /^(W|kW)$/.test(states[id].attributes.unit_of_measurement || ''));
      const leaks = of('binary_sensor').filter((id) => dc(id) === 'moisture');
      const plants = pick(of('plant'), (id) => id.startsWith('plant.')).map((id) => ({ id, readings: mine((x) => x.startsWith('sensor.' + id.split('.')[1] + '_')) }));
      const openings = [...of('binary_sensor').filter((id) => OPENINGS.includes(dc(id))), ...mine((id) => id.startsWith('binary_sensor.'))];
      return {
        id: a, name: ar.name, icon: ar.icon,
        readings: [...temp.slice(0, 1), ...hum.slice(0, 1), ...leaks],
        power: power.length ? power.reduce((sum, id) => sum + Number(states[id].state) * (states[id].attributes.unit_of_measurement === 'kW' ? 1000 : 1), 0) : null,
        plugs: of('switch'),
        lights: of('light'),
        actions: [...of('light'), ...pick(of('climate'), (id) => id.startsWith('climate.')), ...pick(of('cover'), (id) => id.startsWith('cover.')), ...pick(of('humidifier'), (id) => id.startsWith('humidifier.')), ...pick(of('valve'), (id) => id.startsWith('valve.')), ...of('media_player'), ...of('vacuum'), ...(realVacuums.length ? [] : mine((id) => id.startsWith('vacuum.')))],
        solar: mine((id) => id.includes('_solar_')),
        plants,
        openings,
        alerts: [...leaks, ...openings].filter((id) => states[id]?.state === 'on'),
      };
    }).filter((r) => r.readings.length || r.plugs.length || r.actions.length || r.solar.length || r.plants.length);
    const grid = Object.keys(real).find((id) => /^sensor\..*(p1_meter_power|grid_power)$/.test(id) && real[id].state !== 'unavailable') || null;
    const all = (domain) => Object.keys(real).filter((id) => id.startsWith(domain + '.') && usable(id));
    const alarms = all('alarm_control_panel'), vacuums = realVacuums.length ? realVacuums : ['vacuum.' + PREFIX + 'robot'];
    return {
      states, rooms, grid,
      // any device's room, hidden ones too (Maintenance's batteries are mostly diagnostic)
      areaOf: (id) => (fake[id] ? area[id] : areaOf(id)),
      vacuums,
      homeVacuums: vacuums.filter((id) => !rooms.some((r) => r.actions.includes(id))),
      security: {
        alarms: alarms.length ? alarms : ['alarm_control_panel.' + PREFIX + 'house'],
        locks: all('lock'),
        openings: [...Object.keys(fake).filter((id) => id.startsWith('binary_sensor.')), 'sensor.' + PREFIX + 'doorbell'],
      },
    };
  }

  return { model, call, stop() { clearInterval(clock); clearInterval(sun); } };
}
