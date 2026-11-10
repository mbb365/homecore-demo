// My account and My profile, from Matt's Claude Design file, in HomeCore's parts: the list in groups (Settings rows in
// cards, each with its icon chip), and the profile as cards of fields with their labels above. Wide: the list beside the
// page; narrow: the list, then the page with a back arrow. Appearance opens HomeCore's Settings; the other rows open
// a page that says it isn't designed yet. What's typed is kept in this browser only.
import { IMG } from '../images.js';
const GROUPS = [
  [['profile', 'My profile', 'mdi:account-circle-outline', '#2a5fc1']],
  [['location', 'Location', 'mdi:map-marker', '#3e7b4f'], ['health', 'Health', 'mdi:heart-pulse', '#b33a2c'], ['calendar', 'Calendar', 'mdi:calendar', '#b07a2c'], ['voice', 'Voice', 'mdi:microphone', '']],
  [['security', 'Security', 'mdi:shield-account', '#3c7f84']],
  [['appearance', 'Appearance', 'mdi:palette', '#6b4aa7'], ['accessibility', 'Accessibility', 'mdi:human', '#424f9a'], ['notifications', 'Notifications', 'mdi:bell', '#9b3e6c']],
];
const KEY = 'homecore-demo-profile';
const FIELDS = { name: 'Wembely', nickname: '', pronouns: '', mail: '', phone: '', about: '' };
const local = {
  get() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (_e) { return {}; } },
  set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (_e) { /* not remembered */ } },
};

export function renderAccount(page, { esc, icon, go, root, glyph, paint, head }) {
  const me = { ...FIELDS, ...local.get() };
  const photo = IMG.people.wembely;
  let showing = null; // narrow only: the profile instead of the list
  const row = ([k, name, ic, colour]) => '<button class="hcRow' + (k === 'profile' ? ' active' : '') + '" type="button" data-acc="' + k + '">' +
    glyph(ic, colour) +
    '<span class="hcRowText"><span class="hcRowName">' + name + '</span></span></button>';
  const field = (k, label, ph, type = 'text', note = '') => '<label class="hcField"><span class="hcFieldName">' + label + '</span>' +
    (type === 'area' ? '<textarea class="hcInput" rows="4" data-f="' + k + '" placeholder="' + esc(ph) + '">' + esc(me[k]) + '</textarea>'
      : '<input class="hcInput" type="' + type + '" data-f="' + k + '" placeholder="' + esc(ph) + '" value="' + esc(me[k]) + '">') +
    (note ? '<span class="hcFieldNote">' + note + '</span>' : '') + '</label>';

  const BACK = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18L9 12L15 6"/></svg>';
  const panelHead = (title) => '<div class="settingsHeader tfAreaHead hcPanelHead"><button class="back" type="button" data-acc-back aria-label="Back to My account">' + BACK + '</button><div class="settingsTitle">' + esc(title) + '</div></div>';
  // the rows other than My profile open a page the same way (Matt, 9 Nov); none is designed yet, so each says so
  const others = GROUPS.flat().filter(([k]) => k !== 'profile' && k !== 'appearance');
  page.innerHTML =
    '<div class="hcAccount">' +
      head('My account') +
      '<div class="hcAccList">' + GROUPS.map((g) => '<section class="card hcRowsCard">' + g.map(row).join('') + '</section>').join('') + '</div>' +
      '<div class="hcPanel" data-panel="profile">' + panelHead('My profile') +
        // the photo from the top left, level with the first row (Matt, 9 Nov)
        '<div class="hcPhoto"><img src="' + photo + '" alt="Your photo"><div class="hcPhotoActions"><button class="hcBtn" type="button" data-oops>Change photo</button><button class="pill" type="button" data-oops>Remove</button></div></div>' +
        '<section class="card hcFields">' + field('name', 'Name', 'Your name') + field('nickname', 'Nickname', 'Add a nickname') +
          field('pronouns', 'Pronouns', 'Ex. they/them/theirs', 'text', 'Let people know which pronouns you use.') + '</section>' +
        // each section's title inside its card (Matt, 9 Nov)
        '<section class="card hcFields"><div class="hcCardTitle">Contact information</div>' +
          field('mail', 'Mail address', 'name@example.com', 'email') + field('phone', 'Phone number', '+31 6 1234 5678', 'tel') + '</section>' +
        '<section class="card hcFields"><div class="hcCardTitle">About me</div>' + field('about', 'About', 'Say a little about yourself', 'area') +
          '<div class="hcField"><span class="hcFieldName">Home Assistant user since</span><span class="hcSince">14 March 2023</span></div></section>' +
      '</div>' +
      others.map(([k, name]) => '<div class="hcPanel" data-panel="' + k + '" hidden>' + panelHead(name) +
        '<section class="card hcFields hcSoon"><div class="hcCardTitle">' + esc(name) + '</div><p>Oops! We haven\'t designed this yet. Let\'s add it to the list :)</p>' +
        // the Oops popup's picture, wherever an Oops shows (Matt, 10 Nov)
        '<div class="hcArt hcArtOops"><img alt="" src="' + IMG.oopsTrees + '"></div></section></div>').join('') +
    '</div>';
  const wrap = page.querySelector('.hcAccount');
  paint(page);
  // which page shows beside the list (wide) or instead of it (narrow, after a tap)
  const open = (k, narrowToo) => {
    page.querySelectorAll('.hcPanel').forEach((p) => { p.hidden = p.dataset.panel !== k; });
    page.querySelectorAll('[data-acc]').forEach((b) => b.classList.toggle('active', b.dataset.acc === k));
    showing = narrowToo ? k : null;
    wrap.classList.toggle('hcShowPanel', Boolean(narrowToo));
    window.scrollTo(0, 0);
  };
  page.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-acc],[data-acc-back]');
    if (!b) return;
    if (b.hasAttribute('data-acc-back')) { wrap.classList.remove('hcShowPanel'); showing = null; return; }
    if (b.dataset.acc === 'appearance') { go('settings'); return; }
    open(b.dataset.acc, true);
  });
  page.addEventListener('input', (ev) => {
    const k = ev.target.dataset.f;
    if (!k) return;
    me[k] = ev.target.value;
    local.set(me);
    if (k === 'name') root.querySelectorAll('[data-hc-account] .hcMeName').forEach((el) => { el.textContent = me.name || 'Me'; });
  });
  return () => { showing = null; };
}
