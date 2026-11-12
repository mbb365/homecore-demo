// The made-up house, Fraggle rock (Matt, 9 Nov: Fraggle Rock names throughout). Copied from Matt's Home Assistant on 26 Oct 2026, renamed (areas, lights and what
// they support, media players, plugs and power). The card adds its made-up devices on top, as it does on HA.
// [id, name, floor, icon]: the Balcony and Test Area have no icon, as an area can have none
const AREAS = [
  ["living_room", "Living Room", "alcove", "mdi:sofa"], ["kitchen", "Kitchen", "back_bit", "mdi:countertop"], ["balcony", "Balcony", "back_bit"],
  ["bedroom", "Bedroom", "half_1", "mdi:bed"], ["office", "Office", "half_1", "mdi:desk"], ["bathroom", "Bathroom", "half_1", "mdi:shower"],
  ["roaming", "Roaming", null], ["test_area", "Test Area", "test"],
  // made up (Matt, 12 Nov: "see this layout with multiple floors and levels"), two more floors and an area or two more on his
  ["spare_room", "Spare room", "loft", "mdi:bed-empty"], ["storage", "Storage", "loft", "mdi:package-variant-closed"],
  ["hallway", "Hallway", "alcove", "mdi:coat-rack"], ["dining_room", "Dining room", "back_bit", "mdi:table-chair"],
  ["workshop", "Workshop", "docs_workshop", "mdi:hammer-wrench"], ["laundry", "Laundry", "docs_workshop", "mdi:washing-machine"],
];
// [id, name, level, icon], top floor first: the three floors of Matt's house named, and two made up (the loft, the basement)
const FLOORS = [
  ["loft", "The Loft", 3, "mdi:home-roof"], ["half_1", "Half Landing", 2, "mdi:home-floor-2"], ["alcove", "The Alcove", 1, "mdi:home-floor-1"],
  ["back_bit", "The Back Bit", 0, "mdi:home-floor-0"], ["docs_workshop", "Doc's Workshop", -1, "mdi:home-floor-negative-1"], ["test", "Test bench", null, null],
];
const light = (name, state, modes, extra = {}) => ({ state, attributes: { friendly_name: name, supported_color_modes: modes, ...(state === "on" ? { color_mode: "color_temp", brightness: 189, color_temp_kelvin: 2538, hs_color: [28.8, 71.2] } : {}), min_color_temp_kelvin: 2000, max_color_temp_kelvin: 6535, ...extra } });
const ENTITIES = {
  living_room: {
    "light.green_wavy_light": light("Green wavy light", "on", ["color_temp", "xy"]),
    "light.fire_place_lamp": light("Fire place lamp", "on", ["color_temp", "xy"], { min_color_temp_kelvin: 1000, max_color_temp_kelvin: 20000 }),
    "light.living_room": light("Living room", "on", ["color_temp", "xy"], { is_hue_group: true }),
    "light.hanging_one_one": { state: "unavailable", attributes: { friendly_name: "Hanging one one" } },
    "media_player.doozer_speaker": { state: "playing", attributes: { friendly_name: "Doozer speaker", supported_features: 450487, media_title: "Fraggle Rock", media_artist: "The Fraggles" } },
    "media_player.telly": { state: "on", attributes: { friendly_name: "Telly", device_class: "tv", supported_features: 24381, volume_level: 0.16 } },
    "switch.tv_stuff": { state: "on", attributes: { friendly_name: "TV stuff" } },
    "sensor.tv_stuff_power": { state: "88.6", attributes: { friendly_name: "TV stuff Power", device_class: "power", unit_of_measurement: "W", state_class: "measurement" } },
    "sensor.green_wavy_light_power": { state: "2.04", attributes: { friendly_name: "Green wavy light Power", device_class: "power", unit_of_measurement: "W", state_class: "measurement" } },
  },
  kitchen: {
    "light.kitchen": light("Kitchen", "on", ["color_temp", "xy"], { is_hue_group: true, brightness: 255, color_temp_kelvin: 2724 }),
    "light.hue_color_candle_1": { state: "unavailable", attributes: { friendly_name: "Pendant" } },
    "switch.wiz_socket_a82510": { state: "off", attributes: { friendly_name: "Sparkles" } },
    "switch.fridge": { state: "on", attributes: { friendly_name: "Fridge" } },
    "switch.dish_washer": { state: "unavailable", attributes: { friendly_name: "Dish washer" } },
    "sensor.fridge_power": { state: "93.0", attributes: { friendly_name: "Fridge Power", device_class: "power", unit_of_measurement: "W", state_class: "measurement" } },
    "binary_sensor.ikea_of_sweden_badring_water_leakage_sensor": { state: "off", attributes: { friendly_name: "Water leak", device_class: "moisture" } },
  },
  bedroom: {
    "light.big_sphere": light("Glass sphere", "off", ["color_temp", "xy"], { min_color_temp_kelvin: 1000, max_color_temp_kelvin: 20000 }),
    "light.big_bedroom": light("Paper sphere", "on", ["color_temp"], { brightness: 212, color_temp_kelvin: 2375, min_color_temp_kelvin: 2202 }),
  },
  office: {
    "light.office_ceiling": light("Office Ceiling", "on", ["color_temp", "hs"], { brightness: 148, color_temp_kelvin: 2363, max_color_temp_kelvin: 6500 }),
    "light.small_sphere_chappy": light("Small sphere chappy", "on", ["color_temp", "xy"], { brightness: 148, color_temp_kelvin: 2364 }),
    "light.office_2": light("Office", "on", ["color_temp", "xy"], { is_hue_group: true, brightness: 148, color_temp_kelvin: 2364 }),
    "switch.energy_socket": { state: "unavailable", attributes: { friendly_name: "Desk setup", device_class: "outlet" } },
    "sensor.energy_socket_power": { state: "16.375", attributes: { friendly_name: "Desk setup Power", device_class: "power", unit_of_measurement: "W", state_class: "measurement" } },
  },
  bathroom: {
    "light.hue_xamento_ceiling_1": light("Big bathroom light", "off", ["color_temp", "xy"]),
    "light.bathroom": light("Bathroom", "off", ["color_temp", "xy"], { is_hue_group: true }),
    "switch.clothes_washer": { state: "unavailable", attributes: { friendly_name: "Clothes washer" } },
    "sensor.big_bathroom_light_power": { state: "0.58", attributes: { friendly_name: "Big bathroom light Power", device_class: "power", unit_of_measurement: "W", state_class: "measurement" } },
  },
  // the made-up areas' lights and plugs
  spare_room: { "light.gobos_lamp": light("Gobo's lamp", "on", ["color_temp"], { brightness: 120, color_temp_kelvin: 2400 }) },
  storage: { "light.storage": light("Storage light", "off", ["color_temp"]) },
  hallway: {
    "light.hallway": light("Hallway", "on", ["color_temp", "xy"], { brightness: 160, color_temp_kelvin: 2700 }),
    "switch.hallway_heater": { state: "off", attributes: { friendly_name: "Towel warmer" } },
  },
  dining_room: {
    "light.radish_pendant": light("Radish pendant", "on", ["color_temp", "xy"], { brightness: 200, color_temp_kelvin: 2600 }),
    "light.dining_candles": light("Candles", "off", ["color_temp"]),
  },
  workshop: {
    "light.docs_bench": light("Doc's bench light", "on", ["color_temp"], { brightness: 255, color_temp_kelvin: 4000 }),
    "switch.doozer_saw": { state: "off", attributes: { friendly_name: "Doozer saw" } },
  },
  laundry: {
    "light.laundry": light("Laundry", "off", ["color_temp"]),
    "switch.dryer": { state: "on", attributes: { friendly_name: "Dryer" } },
  },
  "": {
    "sensor.p1_meter_power": { state: "243.0", attributes: { friendly_name: "P1 Meter Power", device_class: "power", unit_of_measurement: "W", state_class: "measurement" } },
    // what met.no and the sun give the weather bento on HA
    "weather.forecast_home": { state: "sunny", attributes: { friendly_name: "Forecast Fraggle rock", temperature: 26, temperature_unit: "°C", humidity: 58, dew_point: 17.1, pressure: 1016.4, pressure_unit: "hPa", wind_speed: 18.7, wind_gust_speed: 34.2, wind_bearing: 236, wind_speed_unit: "km/h", uv_index: 4, visibility: 14, visibility_unit: "km", precipitation_unit: "mm", supported_features: 3 } },
    // no rising or setting times, so the card works them out from the home's location (fixed times here put tomorrow's
    // sunrise before today's)
    "sun.sun": { state: new Date().getHours() >= 7 && new Date().getHours() < 18 ? "above_horizon" : "below_horizon", attributes: { friendly_name: "Sun" } },
    // made-up air quality and pollen readings, for the new Air quality and Pollen cards
    "sensor.home_air_quality_index": { state: "32", attributes: { friendly_name: "Air quality index", device_class: "aqi" } },
    "sensor.home_pm25": { state: "8.4", attributes: { friendly_name: "Fine particles", device_class: "pm25", unit_of_measurement: "µg/m³" } },
    "sensor.home_pm10": { state: "14", attributes: { friendly_name: "Coarse particles", device_class: "pm10", unit_of_measurement: "µg/m³" } },
    "sensor.home_grass_pollen": { state: "moderate", attributes: { friendly_name: "Grass pollen" } },
    "sensor.home_tree_pollen": { state: "low", attributes: { friendly_name: "Tree pollen" } },
    "sensor.home_weed_pollen": { state: "none", attributes: { friendly_name: "Weed pollen" } },
    "lock.openable_lock": { state: "locked", attributes: { friendly_name: "Openable lock", supported_features: 1 } },
    "lock.another_openable_lock": { state: "unlocked", attributes: { friendly_name: "Another openable lock", supported_features: 1 } },
    "lock.basic_lock": { state: "locked", attributes: { friendly_name: "Basic lock", supported_features: 0 } },
    "lock.another_basic_lock": { state: "locked", attributes: { friendly_name: "Another basic lock", supported_features: 0 } },
  },
};

export const HOUSE = {
  config: { latitude: 52.3676, longitude: 4.9041, location_name: "Fraggle rock", time_zone: "Europe/Amsterdam", unit_system: { temperature: "°C", length: "km" } },
  areas: Object.fromEntries(AREAS.map(([area_id, name, floor_id, icon]) => [area_id, { area_id, name, floor_id, ...(icon ? { icon } : {}) }])),
  floors: Object.fromEntries(FLOORS.map(([floor_id, name, level, icon]) => [floor_id, { floor_id, name, level, icon, aliases: [] }])),
  entities: {},
  states: {},
};
Object.entries(ENTITIES).forEach(([area, list]) => Object.entries(list).forEach(([id, st]) => {
  HOUSE.entities[id] = { entity_id: id, area_id: area || null };
  HOUSE.states[id] = { entity_id: id, ...st };
}));

// Plugs, locks and media answer like Home Assistant would (lights are handled in index.html)
export function houseService(states, msg) {
  const id = msg.service_data?.entity_id, old = states[id];
  if (!old) return null;
  const attrs = { ...old.attributes };
  if (msg.domain === "lock") return { ...old, state: { lock: "locked", unlock: "unlocked", open: "open" }[msg.service] || old.state };
  if (msg.domain === "switch") return { ...old, state: msg.service === "turn_on" || (msg.service === "toggle" && old.state !== "on") ? "on" : "off" };
  if (msg.domain === "media_player") {
    if (msg.service === "media_play_pause") return { ...old, state: old.state === "playing" ? "paused" : "playing" };
    if (msg.service === "volume_set") return { ...old, attributes: { ...attrs, volume_level: msg.service_data.volume_level } };
    if (msg.service === "toggle" || msg.service === "turn_on" || msg.service === "turn_off") return { ...old, state: old.state === "off" ? "on" : "off" };
    return old;
  }
  return null;
}
