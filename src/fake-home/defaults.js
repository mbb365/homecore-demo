// What a first visit sees on Dashboards (Matt, 12 Nov: "use this for the custom dashboard", his screenshot), until the
// visitor changes something; then their own choices are kept in their browser as before. Eight columns:
//   rows 0–3   Weather (2 wide, L), the Areas (L, to the edge, Bedroom open)
//   rows 4–7   Fire place lamp over the Thermostat (S), Living room's light (L, its brightness, warmth and colour), Pollen,
//              Sun, UV index, Rain radar and Air quality (L), the Robot vacuum over the Blinds (S)
//   rows 8–11  Energy today (3 wide, L), Activity (2 wide, L), the Openable lock over Kitchen spots and the Floor lamp over
//              the Doozer speaker (S), the Moon (L)
// The summaries add Covers and People. Favourites and the Weather page's other widgets wait in the edit tray. On narrower
// screens the cards keep this order, top row first. Home (the overview) has its own layout.
const TILES = ['light.fire_place_lamp', 'climate.made_up_living_room', 'light.living_room', 'vacuum.made_up_robot', 'cover.made_up_office_blinds',
  'lock.openable_lock', 'light.kitchen_spots', 'light.floor_lamp', 'media_player.doozer_speaker'];
const at = (col, row) => ({ col, row });
const CELLS = {
  wx: at(0, 0), areas: at(2, 0),
  'light.fire_place_lamp': at(0, 4), 'climate.made_up_living_room': at(0, 6), 'light.living_room': at(1, 4),
  pollen: at(2, 4), sun: at(3, 4), uv: at(4, 4), radar: at(5, 4), aq: at(6, 4),
  'vacuum.made_up_robot': at(7, 4), 'cover.made_up_office_blinds': at(7, 6),
  energy: at(0, 8), act: at(3, 8),
  'lock.openable_lock': at(5, 8), 'light.kitchen_spots': at(5, 10), 'light.floor_lamp': at(6, 8), 'media_player.doozer_speaker': at(6, 10),
  moon: at(7, 8),
};
const S = { h: 2 }, L = { h: 4 };

export const USER_DATA = {
  move_assistant_house: {
    // six to start with, in Matt's order (26 Nov: openable lock, alarm, curtains, thermostat, glass sphere, watering), and
    // no suggestions after them
    favourites: ['lock.openable_lock', 'alarm_control_panel.made_up_house', 'cover.made_up_living_room_curtains', 'climate.made_up_living_room', 'light.big_sphere', 'valve.made_up_balcony_watering'],
    favSeed: 2,
    suggest: false,
    shownSums: ['covers', 'people'],
    // Home's first look (Matt, 17 Nov, his screenshots: "by default for the overview page, i want these settings"): the
    // welcome, Schedule (no Weather or Energy today), the cards stacked; the areas not by floor, in Bento with mixed sizes,
    // Small (a phone shows them Large whatever's picked, 17 Nov), fitted together; Favourites as its card; the summaries fitted to their tiles, the first six on
    home: { welcome: true, schedule: true, weather: false, energy: false, cardsAs: 'stacked', byFloor: false, areaLayout: 'bento', bentoBoxes: false, bentoMixed: true,
      // (26 Nov) the summaries Lights, Climate, Security, Media players, Energy and Leaks as a strip across the top, and
      // Favourites as its card
      fitTogether: true, favs: true, favsAs: 'card', sums: true, sumsWidth: 'match', hiddenSums: ['maintenance'], shownSums: ['leaks'] },
    dash: {
      pegs: 8,
      cells: CELLS,
      spans: { wx: 2, energy: 3, act: 2 },
      openArea: 'bedroom',
      opts: {
        wx: L, areas: L, pollen: L, sun: L, uv: L, radar: L, aq: L, moon: L, energy: L, act: L,
        'light.living_room': L, ...Object.fromEntries(TILES.filter((id) => id !== 'light.living_room').map((id) => [id, S])),
      },
      tiles: TILES,
      hidden: ['favs', 'avg', 'hourly', 'humidity', 'pressure', 'wind', 'visibility'],
      known: ['aq', 'pollen', 'radar', 'hourly', 'sun', 'moon', 'uv', 'humidity', 'pressure', 'wind', 'visibility'],
    },
  },
};
