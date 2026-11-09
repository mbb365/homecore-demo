// Home Assistant's Settings (Matt, 9 Nov): its main page as it is today (home-assistant-frontend, config-sections.ts and
// en.json: the same rows, names, lines, icons and icon colours, in its three cards), in HomeCore's parts. None of the
// pages behind the rows is designed for the demo, so they open the Oops popup; About is built properly, as an example
// (ha-config-info.ts): the logo, the versions, the Open Home Foundation, and the links out to home-assistant.io.
import OHF_SVG from '../ohf.svg?raw';
import { HA_LOGO } from '../demo-icons.js';

// [key, name, line, icon, icon colour], by card
const CARDS = [
  [
    ['cloud', 'Home Assistant Cloud', 'Control home when away and integrate with Alexa and Google Assistant', 'mdi:cloud-lock', '#3B808E'],
    ['devices', 'Devices & services', 'Integrations, devices, entities, and helpers', 'mdi:devices', '#0D47A1'],
    ['automations', 'Automations & scenes', 'Automations, scenes, scripts, and blueprints', 'mdi:robot', '#518C43'],
    ['areas', 'Areas, labels & zones', 'Manage locations in and around your house', 'mdi:sofa', '#E48629'],
    ['apps', 'Apps', 'Run extra applications next to Home Assistant', 'mdi:puzzle', '#F1C447'],
    ['dashboards', 'Dashboards', 'Organize how you interact with your home', 'mdi:view-dashboard', '#B1345C'],
  ],
  [
    ['connectivity', 'Connectivity', 'Communication protocols and radios for your devices', 'mdi:access-point-network', '#00838F'],
    ['voice', 'Voice assistants', 'Manage your voice assistants', 'mdi:microphone', '#3263C3'],
  ],
  [
    ['people', 'People', 'Manage who can access your home', 'mdi:account', '#5A87FA'],
    ['system', 'System', 'Create backups, check logs, or reboot your system', 'mdi:cog', '#301ABE'],
    ['tools', 'Tools', 'Inspect and debug your system', 'mdi:hammer', '#7A5AA6'],
    ['about', 'About', 'Version information, credit, and more', 'mdi:information-outline', '#4A5963'],
  ],
];

// About's links, as Home Assistant has them (Shortcuts opens a dialog there, so the Oops popup here)
// the logo's own colour-scheme style would reach the whole page here, so it goes; the page's text colour does its job
const OHF = OHF_SVG.replace(/<defs>[\s\S]*?<\/defs>/, '');
const DOCS = 'https://www.home-assistant.io';
const LINKS = [
  ['Changelog', '/latest-release-notes/', 'mdi:newspaper-variant', '#4A5963'],
  ['Thanks to', '/developers/credits/', 'mdi:hands-pray', '#3B808E'],
  ['Merchandise', '/merch', 'mdi:tshirt-crew', '#C65326'],
  ['Feature requests', '/feature-requests', 'mdi:home-assistant', '#0D47A1'],
  ['Bug reports', '/issues', 'mdi:bug', '#F1C447'],
  ['Help', '/community', 'mdi:help', '#B1345C'],
  ['License', '/developers/license/', 'mdi:file-document', '#518C43'],
];
// the demo's versions: the frontend these pages were read from (20260930.0) and the Core release it shipped with
const VERSIONS = [['Installation method', 'Home Assistant Container'], ['Core', '2026.10.0'], ['Frontend', '20260930.0']];

export function renderConfig(page, { esc, icon, glyph, paint, head, go }) {
  const row = ([k, name, line, ic, colour]) => '<button class="hcRow hcConfigRow" type="button"' + (k === 'about' ? ' data-config-about' : ' data-oops') + '>' +
    glyph(ic, colour) + '<span class="hcRowText"><span class="hcRowName">' + esc(name) + '</span><span class="hcRowSub hcRowMuted">' + esc(line) + '</span></span>' +
    '<span class="hcRowEnd">' + icon('mdi:chevron-right') + '</span></button>';
  page.innerHTML = '<div class="hcConfig">' + head('Settings') +
    CARDS.map((rows) => '<section class="card hcRowsCard">' + rows.map(row).join('') + '</section>').join('') + '</div>';
  paint(page);
  page.querySelector('[data-config-about]').addEventListener('click', () => go('about'));
}

export function renderAbout(page, { esc, icon, glyph, paint, head }) {
  page.innerHTML = '<div class="hcConfig hcAbout">' + head('About') +
    '<section class="card hcAboutHead">' +
      '<a class="hcAboutLogo" href="' + DOCS + '" target="_blank" rel="noreferrer" aria-label="Home Assistant logo">' + HA_LOGO + '</a>' +
      '<p class="hcAboutName">Home Assistant</p>' +
      '<ul class="hcVersions">' + VERSIONS.map(([k, v]) => '<li><span>' + esc(k) + '</span><span class="hcVersion">' + esc(v) + '</span></li>').join('') + '</ul>' +
    '</section>' +
    '<section class="card hcAboutOhf"><p>Proud part of</p><a href="https://www.openhomefoundation.org" target="_blank" rel="noreferrer" aria-label="Open Home Foundation">' + OHF + '</a></section>' +
    '<section class="card hcRowsCard">' +
      '<button class="hcRow hcConfigRow" type="button" data-oops>' + glyph('mdi:keyboard', '') + '<span class="hcRowText"><span class="hcRowName">Shortcuts</span></span></button>' +
      LINKS.map(([name, path, ic, colour]) => '<a class="hcRow hcConfigRow" href="' + DOCS + path + '" target="_blank" rel="noopener noreferrer">' + glyph(ic, colour) +
        '<span class="hcRowText"><span class="hcRowName">' + esc(name) + '</span></span><span class="hcRowEnd">' + icon('mdi:open-in-new') + '</span></a>').join('') +
    '</section></div>';
  paint(page);
}
