// The load-in (Matt, 17 Nov: "lets try something quite silly… a fade in load"), from his Figma frames 1158:22778:
// the page opens on the blue sky ("Start on this", 1158:22498), and after 0.4 s it fades into the page's own light
// background ("fade to this BG", 1158:22518) while the words spin in letter by letter: the greeting first, then the
// house's name, then the cards fade up in turn (Matt, 17 Nov), their names rising in with them. About 3.2 s in all, at his values. Once per load; with Reduce motion on it doesn't run. Its timings are INTRO's.
import { reduced } from './motion.js';

export const EASES = { soft: 'cubic-bezier(.4,0,.2,1)', standard: 'cubic-bezier(.2,0,0,1)', land: 'cubic-bezier(.34,1.46,.64,1)', spring: 'cubic-bezier(.2,1.2,.4,1)', linear: 'linear' };
export const INTRO_DEFAULTS = Object.freeze({ // Matt's values from the tweaker (17 Nov)
  skyHold: 950, skyFade: 1500, skyEase: 'soft', // the blue, then its fade
  greetStart: 60, greetStagger: 21, nameGap: 470, nameStagger: 47, // the greeting's letters, then the house's name's
  cardsAfter: 210, cardStagger: 139, cardSpread: 300, cardDur: 1500, cardRise: 31, cardScale: 110, cardEase: 'soft', // the cards, once the name has begun
  letterAfter: 490, letterStagger: 12, letterSpread: 150, letterDur: 1090, letterTurn: 0, letterAxis: 'X', letterRise: 20, letterEase: 'soft', // every word's letters
  words: 'names', // 'names': titles and names spin; 'all': every word in the cards spins too
});
export const INTRO = { ...INTRO_DEFAULTS };
// when the parts begin and the whole ends, from INTRO
export function introTimes(c = INTRO, greetLen = 23, nameLen = 12) {
  const greetEnd = c.greetStart + Math.max(0, greetLen - 1) * c.greetStagger;
  const nameStart = greetEnd + c.nameGap, nameEnd = nameStart + Math.max(0, nameLen - 1) * c.nameStagger;
  const cardStart = nameStart + c.cardsAfter, lastCard = cardStart + c.cardSpread;
  const end = Math.max(c.skyHold + c.skyFade, nameEnd + c.letterDur, lastCard + c.cardDur, lastCard + c.letterAfter + c.letterSpread + c.letterDur);
  return { greetEnd, nameStart, nameEnd, cardStart, lastCard, end };
}

const NAMES = '.tfDashTitle, .activityTitle, .activityRowName, .hcCardTitle';
const ALL = NAMES + ', .activityRowMeta, .tfRoomBig, .tfRoomSub, .tfName, .tfSumState';
const CARDS = '#homeView .tfBoardItem:not(.tfDashTitle)';

let stop = null; // the run in progress, so a replay can end it
export function playIntro(root, app, c = INTRO) {
  if (reduced()) return;
  stop?.();
  const shell = root.querySelector('.shell');
  if (!shell) return;
  const v = {
    '--intro-sky-hold': c.skyHold + 'ms', '--intro-sky-fade': c.skyFade + 'ms', '--intro-sky-ease': EASES[c.skyEase],
    '--intro-card-dur': c.cardDur + 'ms', '--intro-rise': c.cardRise + 'px', '--intro-scale': c.cardScale / 100, '--intro-card-ease': EASES[c.cardEase],
    '--intro-letter-dur': c.letterDur + 'ms', '--intro-letter-ease': EASES[c.letterEase], '--intro-lrise': c.letterRise / 100 + 'em',
    '--intro-rx': c.letterAxis === 'X' ? c.letterTurn + 'deg' : '0deg', '--intro-ry': c.letterAxis === 'Y' ? c.letterTurn + 'deg' : '0deg',
  };
  Object.entries(v).forEach(([k, x]) => app.style.setProperty(k, x));
  app.classList.remove('hcIntroGo');
  app.classList.add('hcIntro'); // the cards wait unseen, the sky shows
  if (!shell.querySelector(':scope>.hcIntroSky')) shell.insertAdjacentHTML('afterbegin', '<div class="hcIntroSky" aria-hidden="true"></div>');
  let started = false, timers = [], cards = [], undo = [];
  const end = () => {
    timers.forEach(clearTimeout);
    undo.forEach((f) => f());
    app.classList.remove('hcIntro', 'hcIntroGo');
    cards.forEach((el) => el.style.removeProperty('--intro-d'));
    shell.querySelector(':scope>.hcIntroSky')?.remove();
    stop = null;
  };
  const start = () => {
    if (started) return;
    started = true;
    const inView = (el) => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && r.width > 0; };
    // a text's letters spin in from `from`, `step` apart, all begun within `spread`
    const textsOf = (el, skip) => { const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), out = []; for (let n = w.nextNode(); n; n = w.nextNode()) if (n.nodeValue.trim() && !(skip && skip.contains(n))) out.push(n); return out; };
    const jobs = [], queued = new Set();
    const spin = (nodes, from, step, spread = Infinity) => {
      let k = 0;
      nodes.forEach((n) => { if (queued.has(n)) return; queued.add(n); jobs.push({ n, delays: [...n.nodeValue].map(() => Math.round(from + Math.min(k++ * step, spread))) }); });
    };
    /* the letters are split out only once everything is chosen, in four passes so the page is measured once each way:
       where each letter sits in the kerned text; the split; each split letter's own width; then each letter is nudged
       so it sits exactly where it was. Split letters lose their kerning (the title grew 4.7 px), so without the nudge
       they jumped back when they turned into plain text again (Matt, 17 Nov: "a little jump at the end") */
    const lay = () => {
      const rng = document.createRange();
      jobs.forEach((j) => {
        const len = j.n.nodeValue.length;
        j.at = [];
        for (let i = 0; i <= len; i++) {
          if (i < len) { rng.setStart(j.n, i); rng.setEnd(j.n, i + 1); const b = rng.getBoundingClientRect(); j.at.push({ x: b.left, y: b.top }); }
          else { rng.setStart(j.n, len - 1); rng.setEnd(j.n, len); const b = rng.getBoundingClientRect(); j.at.push({ x: b.right, y: b.top }); }
        }
      });
      jobs.forEach((j) => {
        j.wrap = document.createElement('span');
        j.wrap.className = 'hcIntroWord';
        j.letters = [...j.n.nodeValue].map((ch) => { const l = document.createElement('span'); l.className = 'hcIntroSplit'; l.textContent = ch; j.wrap.appendChild(l); return l; });
        j.n.replaceWith(j.wrap);
        const { n, wrap } = j;
        undo.push(() => { if (wrap.isConnected) wrap.replaceWith(document.createTextNode(n.nodeValue)); });
      });
      jobs.forEach((j) => { j.w = j.letters.map((l) => l.getBoundingClientRect().width); });
      jobs.forEach((j) => j.letters.forEach((l, i) => {
        const a = j.at[i], b = j.at[i + 1];
        if (Math.abs(b.y - a.y) < 2) l.style.marginRight = (b.x - a.x - j.w[i]).toFixed(2) + 'px'; // not across a line break
        l.className = 'hcIntroLetter';
        l.style.animationDelay = j.delays[i] + 'ms';
      }));
    };
    // first the greeting, then the house's name (Matt, 17 Nov)
    const title = [...root.querySelectorAll('#homeView .tfDashTitle')].find(inView), greet = title?.querySelector('.tfGreeting');
    const greetNodes = greet ? textsOf(greet) : [], nameNodes = title ? textsOf(title, greet) : [];
    const t = introTimes(c, greetNodes.reduce((n, x) => n + x.nodeValue.length, 0), nameNodes.reduce((n, x) => n + x.nodeValue.length, 0));
    spin(greetNodes, c.greetStart, c.greetStagger);
    spin(nameNodes, t.nameStart, c.nameStagger);
    // then the cards fade up one after another, top to bottom, left to right
    const at = (el) => el.getBoundingClientRect();
    cards = [...root.querySelectorAll(CARDS)].filter(inView).sort((a, b) => at(a).top - at(b).top || at(a).left - at(b).left);
    cards.forEach((el, i) => el.style.setProperty('--intro-d', Math.round(t.cardStart + Math.min(i * c.cardStagger, c.cardSpread)) + 'ms'));
    // Home's weather icon fades in with the summaries' icons, not with the title (Matt, 26 Nov: "the same time as the other icons")
    const sums = cards.find((el) => el.matches('[data-k="sums"]'));
    if (title && sums) title.style.setProperty('--intro-icons-d', sums.style.getPropertyValue('--intro-d'));
    // each card's words spin in with it
    root.querySelectorAll(c.words === 'all' ? ALL : NAMES).forEach((el) => {
      const card = el.closest(CARDS);
      if (card?.matches('[data-k="sums"],[data-k="favs"]')) return; // the summaries' and Favourites' words don't spin: they only fade in
      if (!card || !inView(el) || el.closest('.hcIntroWord') || el.querySelector('.hcIntroWord')) return;
      spin(textsOf(el), (parseInt(card.style.getPropertyValue('--intro-d'), 10) || t.cardStart) + c.letterAfter, c.letterStagger, c.letterSpread);
    });
    lay();
    void app.offsetWidth; // a replay starts its animations again
    app.classList.add('hcIntroGo');
    // done: the words back to plain text, the sky gone
    timers.push(setTimeout(end, t.end + 100));
  };
  stop = end;
  // once the page has placed its cards, so they're where they'll stay (Home and the custom dashboard both give each
  // card its top); checked about every frame (by a timer, which a page in the background still gets)
  const placed = () => [...root.querySelectorAll(CARDS)].some((el) => el.style.top);
  const wait = () => { if (started) return; if (placed()) start(); else timers.push(setTimeout(wait, 16)); };
  // and once Geist has loaded, so the letters are measured in it
  (document.fonts?.ready || Promise.resolve()).then(wait);
  timers.push(setTimeout(start, 1200)); // whatever happens, it doesn't stay hidden
}
export const mountIntro = (root, app) => playIntro(root, app);
