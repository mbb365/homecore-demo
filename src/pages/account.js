// My account and My profile, from Matt's Claude Design file, in HomeCore's parts: the list in groups (Settings rows in
// cards, each with its icon chip), and the profile as cards of fields with their labels above. Wide: the list beside the
// page; narrow: the list, then the profile with a back arrow. Appearance opens HomeCore's Settings; the other rows are
// there as in the design but open nothing yet. What's typed is kept in this browser only.
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
  const photo = new URL('people/wembely.png', document.baseURI).href;
  let showing = null; // narrow only: the profile instead of the list
  const row = ([k, name, ic, colour]) => '<button class="hcRow' + (k === 'profile' ? ' active' : '') + '" type="button" data-acc="' + k + '">' +
    glyph(ic, colour) +
    '<span class="hcRowText"><span class="hcRowName">' + name + '</span></span></button>';
  const field = (k, label, ph, type = 'text', note = '') => '<label class="hcField"><span class="hcFieldName">' + label + '</span>' +
    (type === 'area' ? '<textarea class="hcInput" rows="4" data-f="' + k + '" placeholder="' + esc(ph) + '">' + esc(me[k]) + '</textarea>'
      : '<input class="hcInput" type="' + type + '" data-f="' + k + '" placeholder="' + esc(ph) + '" value="' + esc(me[k]) + '">') +
    (note ? '<span class="hcFieldNote">' + note + '</span>' : '') + '</label>';

  page.innerHTML =
    '<div class="hcAccount">' +
      '<div class="hcAccList">' + head('My account') + GROUPS.map((g) => '<section class="card hcRowsCard">' + g.map(row).join('') + '</section>').join('') + '</div>' +
      '<div class="hcProfile">' +
        '<div class="settingsHeader tfAreaHead hcProfileHead"><button class="back" type="button" data-acc-back aria-label="Back to My account"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18L9 12L15 6"/></svg></button><div class="settingsTitle">My profile</div></div>' +
        '<div class="hcPhoto"><img src="' + photo + '" alt="Your photo"><button class="hcBtn" type="button">Change photo</button><button class="pill" type="button">Remove</button></div>' +
        '<section class="card hcFields">' + field('name', 'Name', 'Your name') + field('nickname', 'Nickname', 'Add a nickname') +
          field('pronouns', 'Pronouns', 'Ex. they/them/theirs', 'text', 'Let people know which pronouns you use.') + '</section>' +
        '<div class="hcGroup"><div class="sectionLabel">Contact information</div><section class="card hcFields">' +
          field('mail', 'Mail address', 'name@example.com', 'email') + field('phone', 'Phone number', '+31 6 1234 5678', 'tel') + '</section></div>' +
        '<div class="hcGroup"><div class="sectionLabel">About me</div><section class="card hcFields">' + field('about', 'About', 'Say a little about yourself', 'area') +
          '<div class="hcField"><span class="hcFieldName">Home Assistant user since</span><span class="hcSince">14 March 2023</span></div></section></div>' +
      '</div>' +
    '</div>';
  const wrap = page.querySelector('.hcAccount');
  paint(page);
  const setShowing = (v) => { showing = v; wrap.classList.toggle('hcShowProfile', v === 'profile'); window.scrollTo(0, 0); };

  page.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-acc],[data-acc-back]');
    if (!b) return;
    if (b.hasAttribute('data-acc-back')) { setShowing(null); return; }
    if (b.dataset.acc === 'profile') setShowing('profile');
    if (b.dataset.acc === 'appearance') go('settings');
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
