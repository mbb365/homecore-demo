// The map's people, devices and zones, from Matt's Figma frame 981:9937 (names, photos, lines and the activity as drawn).
// Places are in Amsterdam: home in the Jordaan, AH a short walk away.
import { IMG } from '../images.js';
const HOME = [52.37395, 4.88342];
export const ZONES = [
  { id: 'home', name: 'Fraggle rock', icon: 'mdi:home', colour: '#ff7043', at: HOME, radius: 90, sub: '3 fraggles' },
  { id: 'ah', name: 'AH', icon: 'mdi:cart', colour: '#1e63d6', at: [52.37096, 4.88003], radius: 45, sub: 'No one here.' },
];
const near = ([lat, lng], dLat, dLng) => [lat + dLat, lng + dLng];
export const PEOPLE = [
  { id: 'wembely', name: 'Wembely', photo: IMG.people.wembely, at: near(HOME, 0.00012, -0.00025) },
  { id: 'red', name: 'Red', photo: IMG.people.red, at: near(HOME, -0.0001, 0.0002) },
  { id: 'gobo', name: 'Gobo', photo: IMG.people.gobo, at: near(HOME, 0.00025, 0.00018) },
];
export const TRACKERS = [
  { id: 'big_mac', name: 'Big Mac', icon: 'mdi:television', at: HOME },
  { id: 'demo_tracker', name: 'Demo tracker', icon: 'mdi:television', at: HOME },
  { id: 'macs_book', name: 'Macs book', icon: 'mdi:television', at: HOME },
  { id: 'olaf', name: 'Olaf the Emfore', icon: 'mdi:television', at: HOME },
];
// everyone's last hour, as drawn for Wembely: where they were and how many minutes ago
export const TRAIL = [['home', 8], ['away', 12], ['ah', 16], ['away', 20], ['home', 28]];
export const WHERE = 'Home · 8 min ago';
