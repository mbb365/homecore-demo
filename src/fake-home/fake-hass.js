// A fake Home Assistant, so HomeCore runs with no instance: a made-up house (house-data.js), its history, weather and
// activity. Changes are kept in this browser's localStorage.
import "../homecore-app.js";
import { HOUSE, houseService } from "./house-data.js";
import { ICONS } from "./icons.js";
import { DEMO_ICONS } from "../demo-icons.js";
// the demo pages' icons too, for any the house's own list doesn't have
for (const [k, v] of Object.entries(DEMO_ICONS)) if (!ICONS[k]) ICONS[k] = v;
// Home Assistant's ha-icon and ha-state-icon, stood in for the preview: the icon at --mdc-icon-size (the page's
// glyph-size, 34 in a 40 room, as the guide draws it), from the icon's name or, for a device, its kind and state
const svgFor = (name) => '<svg viewBox="0 0 24 24" aria-hidden="true" style="display:block;width:var(--mdc-icon-size,24px);height:var(--mdc-icon-size,24px)"><path fill="currentColor" d="' + (ICONS[name] || ICONS["mdi:circle-medium"]) + '"/></svg>';
function stateIconName(st) {
  if (!st) return "mdi:circle-medium";
  if (st.attributes?.icon) return st.attributes.icon;
  const d = st.entity_id.split(".")[0], s = st.state, dc = st.attributes?.device_class, on = s === "on";
  const byClass = { temperature: "mdi:thermometer", humidity: "mdi:water-percent", power: "mdi:flash", energy: "mdi:lightning-bolt", battery: "mdi:battery", moisture: on ? "mdi:water" : "mdi:water-off",
    door: on ? "mdi:door-open" : "mdi:door-closed", window: on ? "mdi:window-open" : "mdi:window-closed", motion: on ? "mdi:motion-sensor" : "mdi:motion-sensor-off", smoke: on ? "mdi:smoke-detector-variant-alert" : "mdi:smoke-detector",
    illuminance: "mdi:brightness-5", outlet: on ? "mdi:power-plug" : "mdi:power-plug-off", tv: s === "off" ? "mdi:television-off" : "mdi:television", speaker: s === "off" ? "mdi:speaker-off" : "mdi:speaker" };
  if (byClass[dc]) return byClass[dc];
  if (d === 'cover') { // as Home Assistant: the kind of cover, open or closed
    const shut = s === 'closed';
    return ({ curtain: shut ? 'mdi:curtains-closed' : 'mdi:curtains', blind: shut ? 'mdi:blinds-horizontal-closed' : 'mdi:blinds-horizontal', shade: shut ? 'mdi:roller-shade-closed' : 'mdi:roller-shade' })[dc] || (shut ? 'mdi:window-shutter' : 'mdi:window-shutter-open');
  }
  return ({ light: on ? "mdi:lightbulb" : "mdi:lightbulb-off", switch: on ? "mdi:toggle-switch-variant" : "mdi:toggle-switch-variant-off", media_player: s === "off" ? "mdi:cast-off" : "mdi:cast",
    lock: s === "locked" ? "mdi:lock" : s === "jammed" ? "mdi:lock-alert" : "mdi:lock-open-variant", climate: "mdi:thermostat", vacuum: "mdi:robot-vacuum", humidifier: on ? "mdi:air-humidifier" : "mdi:air-humidifier-off",
    alarm_control_panel: s === "disarmed" ? "mdi:shield-off" : s === "triggered" ? "mdi:shield-alert" : "mdi:shield-home", valve: "mdi:valve", plant: "mdi:flower", person: "mdi:account", weather: "mdi:weather-partly-cloudy",
    sensor: "mdi:gauge", binary_sensor: on ? "mdi:alert-circle" : "mdi:home" })[d] || "mdi:circle-medium";
}
customElements.define("ha-icon", class extends HTMLElement {
  set icon(v) { this._icon = v; this.innerHTML = svgFor(v); }
  get icon() { return this._icon; }
});
customElements.define("ha-state-icon", class extends HTMLElement {
  set stateObj(st) { this._st = st; this.innerHTML = svgFor(stateIconName(st)); }
  get stateObj() { return this._st; }
  set hass(_h) { /* not needed here */ }
});

const listeners = [];
// each saved key in its own localStorage slot
const slot = (key) => "homecore:" + (key || "move_assistant");
const read = (key) => { try { return JSON.parse(localStorage.getItem(slot(key))); } catch { return null; } };
const states = {
  "sensor.living_room_temperature": { entity_id: "sensor.living_room_temperature", state: "21.4", attributes: { friendly_name: "Living room temperature", unit_of_measurement: "°C" } },
  "weather.forecast_home": { entity_id: "weather.forecast_home", state: "sunny", attributes: { friendly_name: "Forecast Fraggle rock", temperature: 26, temperature_unit: "°C" } },
};
// The house page with ten made-up entities (lights you can press and drag, readings with 24 hours of history)
const TEST_ENTITIES = {
  "light.floor_lamp": { state: "on", attributes: { friendly_name: "Floor lamp", brightness: 179, supported_color_modes: ["color_temp", "xy"], color_mode: "color_temp", color_temp_kelvin: 2400 } },
  "light.ceiling": { state: "off", attributes: { friendly_name: "Ceiling", supported_color_modes: ["brightness"] } },
  "light.kitchen_spots": { state: "on", attributes: { friendly_name: "Kitchen spots", brightness: 255, supported_color_modes: ["brightness"] } },
  "sensor.house_power": { state: "2410", attributes: { friendly_name: "House power", unit_of_measurement: "W", device_class: "power", state_class: "measurement" } },
  "sensor.energy_today": { state: "11.2", attributes: { friendly_name: "Energy today", unit_of_measurement: "kWh", device_class: "energy", state_class: "total_increasing" } },
  "sensor.solar_power": { state: "1.6", attributes: { friendly_name: "Solar", unit_of_measurement: "kW", device_class: "power", state_class: "measurement" } },
  "sensor.grid_import": { state: "0.8", attributes: { friendly_name: "From the grid", unit_of_measurement: "kW", device_class: "power", state_class: "measurement" } },
  "sensor.living_room_humidity": { state: "46", attributes: { friendly_name: "Living room humidity", unit_of_measurement: "%", device_class: "humidity", state_class: "measurement" } },
  "sensor.internet_usage": { state: "38.4", attributes: { friendly_name: "Internet today", unit_of_measurement: "GB", state_class: "total_increasing" } },
};
// A week of fake daily forecast, starting today
const fakeForecast = () => {
  const now = new Date();
  const days = [["sunny", 26, 15], ["cloudy", 22, 10], ["rainy", 19, 8], ["partlycloudy", 20, 13], ["sunny", 21, 17], ["partlycloudy", 21, 16], ["snowy", 3, -2]];
  return days.map(([condition, temperature, templow], i) => ({ datetime: new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, 12).toISOString(), condition, temperature, templow }));
};
// Six days of fake hourly forecast from this hour, for the 12-hour sky and the bigger view
const fakeHourly = () => {
  const now = new Date(), start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
  const days = fakeForecast();
  const nights = ["clear-night", "cloudy", "rainy", "clear-night", "partlycloudy", "rainy", "snowy"];
  return [...Array(144)].map((_, i) => {
    const t = new Date(+start + i * 3600e3), h = t.getHours();
    const di = Math.round((new Date(t.getFullYear(), t.getMonth(), t.getDate()) - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 864e5);
    const day = days[Math.min(di, days.length - 1)], night = h < 6 || h >= 18;
    let condition = night ? nights[Math.min(h < 6 ? Math.max(0, di - 1) : di, nights.length - 1)] : day.condition;
    if (di === 3 && h >= 14 && h <= 16) condition = "rainy"; // an afternoon shower
    const temperature = Math.round((day.templow + (day.temperature - day.templow) * (0.5 - 0.5 * Math.cos(Math.PI * Math.max(0, Math.min(1, (h - 5) / 10))) * (h > 15 ? Math.max(0, 1 - (h - 15) / 14) : 1))) * 10) / 10;
    return { datetime: t.toISOString(), condition, temperature };
  });
};
{
  Object.entries(TEST_ENTITIES).forEach(([id, st]) => { states[id] = { entity_id: id, ...st }; });
  states["sensor.living_room_temperature"].attributes.device_class = "temperature";
  states["sensor.living_room_temperature"].attributes.state_class = "measurement";
  Object.assign(states, HOUSE.states);
  states["person.wembely"] = { entity_id: "person.wembely", state: "home", attributes: { friendly_name: "Wembely", user_id: "dev-wembely" } };
  states["person.red"] = { entity_id: "person.red", state: "home", attributes: { friendly_name: "Red", user_id: "dev-red" } };
  states["person.gobo"] = { entity_id: "person.gobo", state: "home", attributes: { friendly_name: "Gobo", user_id: "dev-gobo" } };
  // a leak earlier today, dry again (its changes are in devLog), for Activity's red row
  const dry = new Date(Date.now() - 20 * 60000).toISOString();
  states["binary_sensor.kitchen_leak"] = { entity_id: "binary_sensor.kitchen_leak", state: "off", last_changed: dry, last_updated: dry, attributes: { friendly_name: "Kitchen leak sensor", device_class: "moisture" } };
}
// the dashboard's activity: a few changes over the last two hours, by Wembely (person.wembely) or an automation
const devLog = () => {
  const at = (min) => (Date.now() - min * 60000) / 1000;
  return [
  { when: at(4), entity_id: "lock.openable_lock", state: "unlocked", context_user_id: "dev-wembely" },
  { when: at(20), entity_id: "binary_sensor.kitchen_leak", state: "off" },
  { when: at(40), entity_id: "binary_sensor.kitchen_leak", state: "on" },
  { when: at(23), entity_id: "light.kitchen", state: "on", context_domain: "automation", context_event_type: "automation_triggered", context_name: "Morning lights" },
  { when: at(51), entity_id: "media_player.telly", state: "off", context_user_id: "dev-wembely" },
  { when: at(96), entity_id: "light.office_ceiling", state: "off" },
  { when: at(131), entity_id: "switch.clothes_washer", state: "on", context_user_id: "dev-wembely" },
  { when: at(164), entity_id: "light.small_sphere_chappy", state: "on", context_domain: "automation", context_event_type: "automation_triggered", context_name: "Office at dusk" },
  { when: at(205), entity_id: "media_player.doozer_speaker", state: "playing", context_user_id: "dev-wembely" },
  { when: at(248), entity_id: "lock.basic_lock", state: "locked", context_user_id: "dev-wembely" },
  { when: at(296), entity_id: "switch.dish_washer", state: "on" },
  { when: at(340), entity_id: "light.big_sphere", state: "off", context_user_id: "dev-wembely" },
  { when: at(395), entity_id: "switch.tv_stuff", state: "off" },
  // the rest of Fraggle rock's day, for the Activity page (Matt, 9 Nov)
  { when: at(12), entity_id: "lock.another_openable_lock", state: "unlocked", context_user_id: "dev-red" },
  { when: at(35), entity_id: "light.green_wavy_light", state: "on", context_user_id: "dev-wembely" },
  { when: at(70), entity_id: "light.fire_place_lamp", state: "on", context_domain: "automation", context_event_type: "automation_triggered", context_name: "Evening lights" },
  { when: at(71), entity_id: "light.living_room", state: "on", context_domain: "automation", context_event_type: "automation_triggered", context_name: "Evening lights" },
  { when: at(150), entity_id: "light.big_bedroom", state: "on", context_user_id: "dev-red" },
  { when: at(210), entity_id: "light.office_2", state: "on", context_user_id: "dev-gobo" },
  { when: at(300), entity_id: "switch.wiz_socket_a82510", state: "off", context_user_id: "dev-gobo" },
  { when: at(420), entity_id: "lock.another_basic_lock", state: "locked", context_domain: "automation", context_event_type: "automation_triggered", context_name: "Lock up" },
  ];
};
// a device that's on or off: its changes from the log, and the other way round before them
const FLIP = { on: "off", off: "on", locked: "unlocked", unlocked: "locked", playing: "paused", paused: "playing" };
const POLLEN_LEVELS = ["none", "very_low", "low", "moderate", "high", "very_high"];
const fakeHistory = (id, from) => {
  const st = states[id]; const now = Date.now(); const v = Number(st.state); const growing = st.attributes.state_class === "total_increasing";
  const span = Math.max(864e5, now - (from || now - 864e5)), n = span > 2 * 864e5 ? Math.round(span / (3 * 3600 * 1000)) : 48;
  // pollen: a level that moves from day to day round today's, for the Pollen card's graph
  if (id.includes("pollen")) {
    const today = Math.max(0, POLLEN_LEVELS.indexOf(st.state));
    return [...Array(n + 1)].map((_, i) => { const t = now - span + (i / n) * span, d = new Date(t);
      const lvl = Math.min(5, Math.max(0, Math.round(today + 1.4 * Math.sin(d.getDate() * 1.3) + 0.6 * Math.sin(d.getHours() / 4) - 1.4 * Math.sin(new Date(now).getDate() * 1.3))));
      return { s: i === n ? st.state : POLLEN_LEVELS[lvl], lu: t / 1000 }; });
  }
  if (!Number.isFinite(v)) {
    const ev = devLog().filter((e) => e.entity_id === id).sort((a, b) => a.when - b.when);
    return [{ s: FLIP[(ev[0] || st).state] || st.state, lu: (now - 864e5) / 1000 }, ...ev.map((e) => ({ s: e.state, lu: e.when }))];
  }
  return [...Array(n)].map((_, i) => { const t = now - span + ((i + 1) / n) * span; const k = i / (n - 1);
    const val = growing ? v * k : v * (0.7 + 0.3 * Math.sin(i / 5) + 0.12 * Math.sin(i * 1.7));
    return { s: String(Math.round(val * 100) / 100), lu: t / 1000 }; });
};
const hass = {
  states,
  config: HOUSE.config,
  areas: HOUSE.areas,
  entities: HOUSE.entities,
  devices: {},
  callWS: async (msg) => {
    if (msg.type === "frontend/get_user_data") return { value: read(msg.key) };
    if (msg.type === "frontend/set_user_data") {
      localStorage.setItem(slot(msg.key), JSON.stringify(msg.value));
      return null;
    }
    // Home Assistant's home view settings (favourites, summary order): none set, as on a new install
    if (msg.type === "frontend/get_system_data") return { value: null };
    if (msg.type === "fire_event") { console.log("event", msg.event_data); return null; }
    // the forecast's readings over the time asked for (hourly over two days or less, else every 3 hours), for the bento's
    // Compared to average, pressure and the graphs behind its cards (Matt, 9 Nov): each moves through the day and from
    // day to day, and ends at what the forecast says now
    if (msg.type === "history/history_during_period" && msg.entity_ids[0].startsWith("weather.")) {
      const out = [], now = Date.now(), start = Date.parse(msg.start_time), step = (now - start <= 2 * 864e5 ? 1 : 3) * 3600 * 1000;
      const a = states[msg.entity_ids[0]].attributes;
      const wave = (t, days, phase = 0) => Math.sin((t / (days * 864e5)) * 2 * Math.PI + phase) - Math.sin((now / (days * 864e5)) * 2 * Math.PI + phase);
      for (let t = start; t <= now; t += step) {
        const d = new Date(t), hour = d.getHours() + d.getMinutes() / 60, sunUp = Math.max(0, Math.sin(((hour - 6) / 14) * Math.PI));
        out.push({ s: "cloudy", lu: t / 1000, lc: t / 1000, a: {
          temperature: Math.round((17 + 5 * Math.sin(((d.getHours() - 9) / 24) * 2 * Math.PI) + (d.getDate() % 4)) * 10) / 10,
          humidity: Math.round(a.humidity + 12 * wave(t, 1, 2) + 6 * wave(t, 5)),
          pressure: Math.round((a.pressure + 6 * wave(t, 4) + 1.5 * wave(t, 1)) * 10) / 10,
          wind_speed: Math.max(0, Math.round((a.wind_speed + 7 * wave(t, 3, 1) + 3 * wave(t, 1, 4)) * 10) / 10),
          uv_index: Math.round(sunUp * (5 + 2 * Math.sin(d.getDate())) * 10) / 10,
          visibility: Math.max(1, Math.round((a.visibility + 5 * wave(t, 2.5, 3)) * 10) / 10),
        } });
      }
      return { [msg.entity_ids[0]]: out };
    }
    if (msg.type === "history/history_during_period") return { [msg.entity_ids[0]]: fakeHistory(msg.entity_ids[0], Date.parse(msg.start_time)) };
    if (msg.type === "logbook/get_events") return devLog().filter((e) => !msg.entity_ids || msg.entity_ids.includes(e.entity_id));
    if (msg.type === "call_service" && (msg.domain === "switch" || msg.domain === "media_player" || msg.domain === "lock")) {
      const next = houseService(hass.states, msg);
      if (next) setTimeout(() => { hass.states = { ...hass.states, [next.entity_id]: next }; card.hass = { ...hass }; }, 120);
      return null;
    }
    if (msg.type === "call_service" && msg.domain === "light") {
      const id = msg.service_data.entity_id, old = hass.states[id];
      const on = msg.service === "turn_on" || (msg.service === "toggle" && old.state !== "on");
      const attrs = { ...old.attributes };
      if (on && msg.service_data.brightness_pct != null) attrs.brightness = Math.round(msg.service_data.brightness_pct * 2.55);
      if (on && msg.service_data.brightness != null) attrs.brightness = Math.round(msg.service_data.brightness);
      if (on && attrs.brightness == null) attrs.brightness = 255;
      if (on && msg.service_data.color_temp_kelvin != null) Object.assign(attrs, { color_mode: "color_temp", color_temp_kelvin: msg.service_data.color_temp_kelvin });
      if (on && msg.service_data.hs_color) Object.assign(attrs, { color_mode: "hs", hs_color: msg.service_data.hs_color });
      if (on && !attrs.color_mode && (attrs.supported_color_modes || []).includes("color_temp")) Object.assign(attrs, { color_mode: "color_temp", color_temp_kelvin: 2700 });
      if (!on) { delete attrs.brightness; delete attrs.color_mode; }
      setTimeout(() => { hass.states = { ...hass.states, [id]: { ...old, state: on ? "on" : "off", attributes: attrs } }; card.hass = { ...hass }; }, 120);
      return null;
    }
    if (msg.type === "call_service") return null; // scenes and the rest: nothing to fake
    throw new Error("unknown " + msg.type);
  },
  // the Dual Axis Controller calls services this way
  callService: (domain, service, data) => hass.callWS({ type: "call_service", domain, service, service_data: data }),
  services: {},
  callApi: async (method, path, data) => { console.log("api", method, path, data); window.__api = { method, path, data }; return {}; },
  connection: {
    subscribeMessage: async (cb, msg) => {
      if (msg?.type === "weather/subscribe_forecast") {
        if (msg.forecast_type === "hourly") { setTimeout(() => cb({ type: "hourly", forecast: fakeHourly() }), 250); return () => {}; }
        if (msg.forecast_type !== "daily") throw new Error("forecast type not supported");
        setTimeout(() => cb({ type: "daily", forecast: fakeForecast() }), 150); return () => {};
      }
      listeners.push(cb); return () => {};
    },
  },
};
const card = document.querySelector("homecore-app");
card.setConfig({ layout: "test-focus", test_focus: [
      { title: "Status", entities: ["sensor.house_power", "sensor.energy_today", "sensor.solar_power", "sensor.grid_import", "sensor.living_room_temperature", "sensor.living_room_humidity", "sensor.internet_usage"] },
      { type: "lights", entities: ["light.floor_lamp", "light.ceiling", "light.kitchen_spots", "light.ceiling"] },
    ] });
card.hass = hass;
window.__fakeHass = hass;
