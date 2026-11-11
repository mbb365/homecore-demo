// What a first visit sees (Matt, 11 Nov: the dashboard as in his reference, with the Areas beside the weather), until the
// visitor changes something; then their own choices are kept in their browser as before. Seven columns:
//   rows 0–3   Weather (2 wide, L), the Areas (L, as wide as the rest of the row)
//   rows 4–7   Favourites and Activity (2 wide, M), Air quality, Pollen and Sun (L; Matt, 11 Nov: Sun beside Pollen)
//   rows 7–10  under them: Energy today (3 wide, L); Green wavy light over Living room (S); the Thermostat and Blinds (M)
// That needs seven columns. Six (most laptops) have the same layout less Sun's place, so Sun takes the first free space
// below (byPegs). The Weather page's other widgets wait in the edit tray. On other widths the cards keep this order,
// top row first. Once a visitor moves something, their own layout is used at every width.
const TILES = ['light.green_wavy_light', 'light.living_room', 'climate.made_up_living_room', 'cover.made_up_office_blinds'];
const at = (col, row) => ({ col, row });
const CELLS = {
  wx: at(0, 0), areas: at(2, 0),
  favs: at(0, 4), act: at(2, 4), aq: at(4, 4), pollen: at(5, 4),
  energy: at(0, 7), 'light.green_wavy_light': at(3, 7), 'light.living_room': at(3, 9),
  'climate.made_up_living_room': at(4, 8), 'cover.made_up_office_blinds': at(5, 8),
};

export const USER_DATA = {
  move_assistant_house: {
    favourites: ['climate.made_up_living_room', 'cover.made_up_living_room_curtains', 'valve.made_up_balcony_watering', 'lock.openable_lock',
      'light.green_wavy_light', 'light.fire_place_lamp', 'light.living_room', 'light.office_2'],
    favSeeded: true,
    dash: {
      pegs: 7,
      cells: { ...CELLS, sun: at(6, 4) },
      spans: { wx: 2, energy: 3 },
      byPegs: { 6: { cells: CELLS, spans: { wx: 2, energy: 3 } } },
      opts: {
        wx: { h: 4 }, areas: { h: 4 }, favs: { h: 3 }, act: { h: 3 }, aq: { h: 4 }, pollen: { h: 4 }, sun: { h: 4 }, energy: { h: 4 },
        'light.green_wavy_light': { h: 2 }, 'light.living_room': { h: 2 }, 'climate.made_up_living_room': { h: 3 }, 'cover.made_up_office_blinds': { h: 3 },
      },
      tiles: TILES,
      hidden: ['avg', 'radar', 'hourly', 'moon', 'uv', 'humidity', 'pressure', 'wind', 'visibility'],
      known: ['aq', 'pollen', 'radar', 'hourly', 'sun', 'moon', 'uv', 'humidity', 'pressure', 'wind', 'visibility'],
    },
  },
};
