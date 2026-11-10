// The Fraggle rock house for Home Assistant's own demo (Matt, 10 Nov: "how it's changed", HomeCore beside the real
// frontend). Writes every entity the HomeCore demo has (the house's own and the made-up ones, with their rooms) and the
// rooms, as JSON, for the "fraggle" config in the frontend copy at ~/Desktop/ha-today.
//   node scripts/export-ha-house.mjs [out file]
import { writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { HOUSE } from '../src/fake-home/house-data.js';
import { createHouse } from '../src/house.js';

const out = process.argv[2] || homedir() + '/Desktop/ha-today/demo/src/configs/fraggle/house.json';
const house = createHouse({ onChange() {} });
const m = house.model({ states: HOUSE.states, entities: HOUSE.entities, areas: HOUSE.areas });
house.stop();

const entities = Object.entries(m.states).map(([entity_id, s]) => ({
  entity_id, state: s.state, attributes: s.attributes, ...(m.areaOf(entity_id) ? { area_id: m.areaOf(entity_id) } : {}),
}));
// each room's temperature and humidity, as Home Assistant's area settings name them
const areas = Object.values(HOUSE.areas).map((a) => {
  const r = m.rooms.find((x) => x.id === a.area_id);
  const of = (cls) => r?.readings.find((id) => m.states[id]?.attributes?.device_class === cls);
  return { ...a, ...(of('temperature') ? { temperature_entity_id: of('temperature') } : {}), ...(of('humidity') ? { humidity_entity_id: of('humidity') } : {}) };
});
writeFileSync(out, JSON.stringify({ config: HOUSE.config, areas, entities }, null, 1));
console.log('wrote', entities.length, 'entities and', areas.length, 'areas to', out);
