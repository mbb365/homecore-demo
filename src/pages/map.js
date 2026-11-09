// Map: Matt's Figma frame 981:9937 ("the vibe is right", its padding and corners brought to HomeCore's): the map fills the
// page, one HomeCore card floats on it. People, Devices and Zones in the segmented control, each a tile in the card;
// a person or device opens their own view (back, their name, Activity, More info). As Home Assistant's map, people show
// as photo pins and zones as circles. Map: OpenFreeMap (free, no key), Liberty when light and Dark when dark, credited
// in the corner.
import maplibregl from 'maplibre-gl';
import mapCss from 'maplibre-gl/dist/maplibre-gl.css?inline';
import { PEOPLE, TRACKERS, ZONES, TRAIL, WHERE } from './map-data.js';

const STYLE = { light: 'https://tiles.openfreemap.org/styles/liberty', dark: 'https://tiles.openfreemap.org/styles/dark' };
const BACK = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18L9 12L15 6"/></svg>';
const ll = ([lat, lng]) => [lng, lat];
// a zone's circle as a shape on the map (metres round its middle)
function ring([lat, lng], metres) {
  const pts = [];
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * 2 * Math.PI;
    pts.push([lng + (metres / (111320 * Math.cos((lat * Math.PI) / 180))) * Math.cos(a), lat + (metres / 110540) * Math.sin(a)]);
  }
  return pts;
}

export function renderMap(page, { esc, icon, root, opts, glyph, photo, paint }) {
  const app = root.getElementById('app');
  const url = (src) => new URL(src, document.baseURI).href;
  const zone = (id) => ZONES.find((z) => z.id === id);
  let tab = 'people', pick = null;
  if (opts?.pick) { const [kind, id] = opts.pick.split(':'); tab = kind === 'zone' ? 'zones' : 'people'; if (kind === 'person') pick = PEOPLE.find((p) => p.id === id); }

  page.innerHTML = '<style>' + mapCss + '</style><div class="hcMap"><div class="hcMapCanvas"></div><section class="card hcMapCard" aria-label="Map"></section></div>';
  const card = page.querySelector('.hcMapCard');
  const themeOf = () => (app.classList.contains('light') ? 'light' : 'dark');
  let theme = themeOf();
  const start = opts?.pick?.startsWith('zone:') ? zone(opts.pick.slice(5)).at : pick ? pick.at : ZONES[0].at;
  const map = new maplibregl.Map({ container: page.querySelector('.hcMapCanvas'), style: STYLE[theme], center: ll(start), zoom: pick ? 17.5 : 16, attributionControl: { compact: true } });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
  const fly = (at, zoom) => map.flyTo({ center: ll(at), zoom, essential: true });

  // the zones, drawn again whenever the style changes (light and dark)
  const zonesData = { type: 'FeatureCollection', features: ZONES.map((z) => ({ type: 'Feature', properties: { id: z.id, colour: z.colour }, geometry: { type: 'Polygon', coordinates: [ring(z.at, z.radius)] } })) };
  map.on('style.load', () => {
    map.addSource('zones', { type: 'geojson', data: zonesData });
    map.addLayer({ id: 'zones-fill', type: 'fill', source: 'zones', paint: { 'fill-color': ['get', 'colour'], 'fill-opacity': 0.16 } });
    map.addLayer({ id: 'zones-line', type: 'line', source: 'zones', paint: { 'line-color': ['get', 'colour'], 'line-width': 1.5 } });
  });
  map.on('click', 'zones-fill', (ev) => { const z = zone(ev.features[0].properties.id); tab = 'zones'; pick = null; draw(); fly(z.at, 17); });
  map.on('mouseenter', 'zones-fill', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'zones-fill', () => { map.getCanvas().style.cursor = ''; });
  const watch = new MutationObserver(() => { if (themeOf() !== theme) { theme = themeOf(); map.setStyle(STYLE[theme]); } });
  watch.observe(app, { attributes: true, attributeFilter: ['class'] });
  // people: their photos as pins
  PEOPLE.forEach((p) => {
    const el = Object.assign(document.createElement('button'), { className: 'hcPin', type: 'button', title: p.name, innerHTML: '<img src="' + url(p.photo) + '" alt="">' });
    el.setAttribute('aria-label', p.name);
    el.addEventListener('click', (ev) => { ev.stopPropagation(); tab = 'people'; pick = p; draw(); });
    new maplibregl.Marker({ element: el }).setLngLat(ll(p.at)).addTo(map);
  });

  const head = (c, name, sub) => c +
    '<span class="hcRowText"><span class="hcRowName">' + esc(name) + '</span><span class="hcRowSub">' + esc(sub) + '</span></span>';
  const rows = () => {
    if (tab === 'people') return PEOPLE.map((p) => '<button class="hcRow" type="button" data-person="' + p.id + '">' + head(photo(p.photo), p.name, WHERE) + '</button>').join('');
    if (tab === 'devices') return TRACKERS.map((t) => '<button class="hcRow" type="button" data-tracker="' + t.id + '">' + head(glyph(t.icon), t.name, WHERE) + '</button>').join('');
    return ZONES.map((z) => '<button class="hcRow" type="button" data-zone="' + z.id + '">' + head(glyph(z.icon, z.colour), z.name, z.sub) + '</button>').join('');
  };
  // a person's or device's own view: back, their name, the last hour, and More info
  const detail = (x) => '<div class="hcMapDetailHead"><button class="tfBack" type="button" data-map-back aria-label="Back">' + BACK + '</button>' +
      '<span class="hcRowText"><span class="hcRowName">' + esc(x.name) + '</span><span class="hcRowSub">' + WHERE + '</span></span></div>' +
    '<div class="tfOpen hcTrail"><div class="tfOpenHead">' + glyph('mdi:update', '#03a9f4') + '<span class="hcRowName hcTrailTitle">Activity</span></div>' +
      TRAIL.map(([where, ago]) => {
        const z = zone(where);
        return z ? '<div class="hcRow hcStatic">' + head(glyph(z.icon, z.colour), z.id === 'home' ? 'Home' : z.name, ago + ' min ago') + '</div>'
          : '<div class="hcRow hcStatic hcAway"><span class="hcChip hcLine" aria-hidden="true"></span><span class="hcRowText"><span class="hcRowName">Away</span><span class="hcRowSub">' + ago + ' min ago</span></span></div>';
      }).join('') + '</div>' +
    '<button class="primary hcMoreInfo" type="button">More info</button>';

  function draw() {
    card.innerHTML = pick ? detail(pick)
      : '<div class="tfSeg" role="group" aria-label="Show">' + [['people', 'People'], ['devices', 'Devices'], ['zones', 'Zones']].map(([k, t]) => '<button type="button" data-tab="' + k + '" aria-pressed="' + (k === tab) + '">' + t + '</button>').join('') + '</div>' +
        '<div class="hcMapRows">' + rows() + '</div>';
    paint(card);
  }
  card.addEventListener('click', (ev) => {
    const t = ev.target.closest('[data-tab],[data-person],[data-tracker],[data-zone],[data-map-back]');
    if (!t) return;
    if (t.dataset.tab) { tab = t.dataset.tab; draw(); return; }
    if (t.hasAttribute('data-map-back')) { pick = null; draw(); return; }
    if (t.dataset.person) { pick = PEOPLE.find((p) => p.id === t.dataset.person); fly(pick.at, 17.5); draw(); return; }
    if (t.dataset.tracker) { pick = TRACKERS.find((x) => x.id === t.dataset.tracker); fly(pick.at, 17.5); draw(); return; }
    if (t.dataset.zone) fly(zone(t.dataset.zone).at, 17);
  });
  draw();
  // the map was made while its page was still hidden: measure again once it shows
  requestAnimationFrame(() => map.resize());
  const sizes = new ResizeObserver(() => map.resize());
  sizes.observe(page.querySelector('.hcMap'));
  return () => { watch.disconnect(); sizes.disconnect(); map.remove(); };
}
