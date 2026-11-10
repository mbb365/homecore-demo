// The demo's pictures, as part of the build (Matt, 10 Nov: they went missing again). Vite gives each a URL relative to
// this module, not to the page's address, so they load however the page is opened (with or without its last slash,
// in the phone's frame, from the built site).
import oopsTrees from './img/oops-trees.jpg';
import searchCave from './img/search-cave.webp';
import wembely from './img/wembely.png';
import red from './img/red.png';
import gobo from './img/gobo.png';

export const IMG = { oopsTrees, searchCave, people: { wembely, red, gobo } };
