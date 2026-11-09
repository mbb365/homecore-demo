// Search: Matt's "Search or ask the home" box (Claude Design file) in HomeCore's popup. As Home Assistant's search
// does today, typing lists what matches: rooms, devices, people and zones. A room opens its page, a device the Devices
// page searched for it, a person or zone the map. The microphone and asking the home do nothing in the demo.
import { deviceList } from './devices.js';
import { PEOPLE, ZONES, WHERE } from './map-data.js';

const MOST = 6;

export function openSearch({ root, getHass, homecore, esc, icon, go }) {
  const app = root.getElementById('app');
  app.querySelector('.hcSearchPop')?.remove();
  app.insertAdjacentHTML('beforeend',
    '<div class="tfMoreBackdrop hcSearchPop"><div class="tfMore hcSearchBox" role="dialog" aria-label="Search">' +
      '<label class="hcSearch hcAsk">' + icon('mdi:magnify') + '<input class="addInput" type="search" placeholder="Search or ask the home" aria-label="Search or ask the home" autocomplete="off">' +
        '<button class="hcMic" type="button" title="Ask with your voice" aria-label="Ask with your voice">' + icon('mdi:microphone') + '</button></label>' +
      '<p class="hcAskHint">Search areas, devices, automations, people and zones, or just ask the home to do something.</p>' +
      '<div class="tfMoreList hcResults"></div>' +
    '</div></div>');
  const pop = app.querySelector('.hcSearchPop'), input = pop.querySelector('input'), box = pop.querySelector('.hcResults'), hint = pop.querySelector('.hcAskHint');
  const hass = getHass(), model = homecore.model;
  const avatar = (src) => '<img src="' + new URL(src, document.baseURI).href + '" alt="">';
  const items = [
    ...model.rooms.map((r) => ({ group: 'Areas', name: r.name, sub: 'Area', chip: '<ha-icon data-icon="' + esc(r.icon || 'mdi:home') + '"></ha-icon>', act: () => go('home', () => homecore.openArea('room:' + r.id)) })),
    ...deviceList(hass, model).map((x) => ({ group: 'Devices', name: x.name, sub: [x.area, x.stateText].filter(Boolean).join(' · '), chip: '<ha-state-icon data-eid="' + esc(x.id) + '"></ha-state-icon>', st: x.st, act: () => go('devices', null, { q: x.name }) })),
    ...PEOPLE.map((p) => ({ group: 'People', name: p.name, sub: WHERE, chip: avatar(p.photo), act: () => go('map', null, { pick: 'person:' + p.id }) })),
    ...ZONES.map((z) => ({ group: 'Zones', name: z.name, sub: z.sub, chip: icon(z.icon), colour: z.colour, act: () => go('map', null, { pick: 'zone:' + z.id }) })),
  ];
  let shown = [];

  function draw() {
    const words = input.value.trim().toLowerCase();
    hint.hidden = Boolean(words);
    if (!words) { box.innerHTML = ''; shown = []; return; }
    shown = items.filter((x) => (x.name + ' ' + x.sub).toLowerCase().includes(words));
    const groups = ['Areas', 'Devices', 'People', 'Zones'].map((g) => [g, shown.filter((x) => x.group === g).slice(0, MOST)]).filter(([, xs]) => xs.length);
    shown = groups.flatMap(([, xs]) => xs);
    box.innerHTML = !shown.length ? '<p class="hcAskHint">Nothing matches “' + esc(input.value.trim()) + '”.</p>'
      : groups.map(([g, xs]) => '<div><div class="tfMoreGroupName">' + g + '</div>' + xs.map((x) => '<button class="hcRow" type="button" data-i="' + shown.indexOf(x) + '">' +
        '<span class="hcChip' + (x.colour ? ' hcTint' : '') + '"' + (x.colour ? ' style="--tint:' + x.colour + '"' : '') + '>' + x.chip + '</span>' +
        '<span class="hcRowText"><span class="hcRowName">' + esc(x.name) + '</span><span class="hcRowSub">' + esc(x.sub) + '</span></span></button>').join('') + '</div>').join('');
    box.querySelectorAll('ha-icon[data-icon]').forEach((el) => { el.icon = el.dataset.icon; });
    box.querySelectorAll('ha-state-icon[data-eid]').forEach((el) => { el.hass = getHass(); el.stateObj = shown.find((x) => x.st?.entity_id === el.dataset.eid)?.st; });
  }
  const close = () => { pop.remove(); root.removeEventListener('keydown', onKey, true); };
  const onKey = (ev) => {
    if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); close(); }
    if (ev.key === 'Enter' && shown.length && ev.target === input) { ev.preventDefault(); const x = shown[0]; close(); x.act(); }
  };
  input.addEventListener('input', draw);
  root.addEventListener('keydown', onKey, true);
  pop.addEventListener('click', (ev) => {
    if (ev.target === pop) { close(); return; }
    const row = ev.target.closest('.hcRow');
    if (row) { const x = shown[Number(row.dataset.i)]; close(); x.act(); }
  });
  requestAnimationFrame(() => input.focus());
}
