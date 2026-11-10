// What a first visit sees (Matt, 10 Nov: the dashboard as he had it, from his screenshot), until the visitor changes
// something; then their own choices are kept in their browser as before. Nine columns:
//   rows 0–3  Weather (2 wide), the Areas (6 wide), the Doozer speaker over the Rain radar
//   rows 4–7  Favourites, Activity and Energy today (2 wide each), Air quality, Pollen (the radar carries on beside)
//   rows 8–9  eight tiles: Office Ceiling, Small sphere chappy, Paper sphere, the Thermostat, Green wavy light,
//             Living room, Office and Fire place lamp
// Compared to average waits in the edit tray. On a narrower screen the cards keep this order, top row first.
const TILES = ['media_player.doozer_speaker', 'light.office_ceiling', 'light.small_sphere_chappy', 'light.big_bedroom', 'climate.made_up_living_room',
  'light.green_wavy_light', 'light.living_room', 'light.office_2', 'light.fire_place_lamp'];
const at = (col, row) => ({ col, row });

export const USER_DATA = {
  move_assistant_house: {
    favourites: ['climate.made_up_living_room', 'cover.made_up_living_room_curtains', 'valve.made_up_balcony_watering', 'lock.openable_lock',
      'light.green_wavy_light', 'light.fire_place_lamp', 'light.living_room', 'light.office_2'],
    favSeeded: true,
    dash: {
      pegs: 9,
      cells: {
        wx: at(0, 0), areas: at(2, 0), 'media_player.doozer_speaker': at(8, 0), radar: at(8, 2),
        favs: at(0, 4), act: at(2, 4), energy: at(4, 4), aq: at(6, 4), pollen: at(7, 4),
        ...Object.fromEntries(TILES.slice(1).map((id, i) => [id, at(i, 8)])),
      },
      spans: { wx: 2, areas: 6 },
      opts: { wx: { h: 4 }, areas: { h: 4 }, favs: { h: 4 }, act: { h: 4 } },
      tiles: TILES,
      hidden: ['avg'],
      known: ['aq', 'pollen', 'radar'],
    },
  },
};
