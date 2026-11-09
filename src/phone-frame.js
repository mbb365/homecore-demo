// The phone beside the desktop site (Matt, 9 Nov: "Floating frame"): bottom right, a phone running the same site at
// phone width (its own copy, so you can use both), a QR code to open it on your own phone, and Hide. Only on a screen
// wide enough to have room; on a real phone, and inside the frame itself, the site is just the site, full screen.
import qrcode from 'qrcode-generator';

const KEY = 'homecore-demo-phone';
const PHONE = { w: 390, h: 844 }; // an iPhone's screen, in points
const BAR = 50; // its status bar, round the camera: pages start under it, as on a real phone
const ROOM = 900; // narrower than this, there's no room beside the site
const inFrame = window.top !== window || new URLSearchParams(location.search).has('embed');

const local = {
  get() { try { return localStorage.getItem(KEY); } catch (_e) { return null; } },
  set(v) { try { localStorage.setItem(KEY, v); } catch (_e) { /* not remembered */ } },
};

const CSS = `
:host{all:initial;position:fixed;z-index:2147483000;right:22px;bottom:22px;font-family:Geist,Inter,system-ui,sans-serif;color:#d9d9d9;--line:rgba(255,255,255,.14)}
:host([hidden]),.panel[hidden],.chip[hidden]{display:none}
.panel{box-sizing:border-box;width:calc(${PHONE.w}px * var(--s) + 44px);display:flex;flex-direction:column;align-items:center;gap:14px;padding:14px;border-radius:28px;background:#222;box-shadow:inset 0 0 0 .4px var(--line),0 18px 50px rgba(0,0,0,.45)}
.top{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%}
.name{font:500 18px/1.2 Geist,Inter,system-ui,sans-serif;letter-spacing:-.01em;padding-left:4px}
button{font:600 14px/20px Geist,Inter,system-ui,sans-serif;color:#d9d9d9;cursor:pointer}
.hide{height:34px;padding:0 12px;border:0;border-radius:12px;background:transparent;text-decoration:underline;text-underline-offset:3px}
.hide:hover{color:#fff}
.device{position:relative;flex:none;border-radius:calc(48px * var(--s) + 8px);background:#0b0b0b;padding:8px;box-shadow:inset 0 0 0 1px #3a3a3a,0 0 0 1px #000}
.screen{position:relative;overflow:hidden;width:calc(${PHONE.w}px * var(--s));height:calc(${PHONE.h}px * var(--s));border-radius:calc(48px * var(--s));background:#090909}
iframe{position:absolute;top:calc(${BAR}px * var(--s));left:0;width:${PHONE.w}px;height:${PHONE.h - BAR}px;border:0;transform:scale(var(--s));transform-origin:0 0;background:#090909}
.island{position:absolute;z-index:2;top:calc(11px * var(--s));left:50%;width:calc(120px * var(--s));height:calc(34px * var(--s));margin-left:calc(-60px * var(--s));border-radius:99px;background:#000;pointer-events:none}
.qr{display:flex;align-items:center;gap:12px;width:100%}
.code{flex:none;padding:6px;border-radius:12px;background:#fff;line-height:0}
.code svg{display:block;width:72px;height:72px}
.say{display:grid;gap:2px;font:400 14px/1.3 Inter,system-ui,sans-serif;color:#969696}
.say strong{font:600 14px/20px Geist,Inter,system-ui,sans-serif;color:#d9d9d9}
.chip{display:flex;align-items:center;gap:8px;height:46px;padding:0 16px 0 12px;border:0;border-radius:16px;background:#222;box-shadow:inset 0 0 0 .4px var(--line),0 10px 30px rgba(0,0,0,.4)}
.chip svg{width:22px;height:22px;fill:currentColor}
`;
const PHONE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17,19H7V5H17M17,1H7C5.89,1 5,1.89 5,3V21A2,2 0 0,0 7,23H17A2,2 0 0,0 19,21V3C19,1.89 18.1,1 17,1Z"/></svg>';

function qrSvg(text) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  return qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
}

export function mountPhoneFrame() {
  if (inFrame) return;
  const host = document.createElement('homecore-phone');
  const root = host.attachShadow({ mode: 'open' });
  // the site's own address (no page, no settings), so the phone and the QR open it from the start
  const site = location.origin + location.pathname;
  const frameSrc = site + '?embed=1';
  root.innerHTML = '<style>' + CSS + '</style>' +
    '<div class="panel" part="panel" role="complementary" aria-label="On your phone">' +
      '<div class="top"><span class="name">On your phone</span><button class="hide" type="button">Hide</button></div>' +
      '<div class="device"><div class="screen"><span class="island"></span><iframe title="HomeCore on a phone" loading="lazy"></iframe></div></div>' +
      '<div class="qr"><span class="code" role="img" aria-label="QR code for this site">' + qrSvg(site) + '</span>' +
        '<span class="say"><strong>Scan to open it</strong>Full screen on your phone.</span></div>' +
    '</div>' +
    '<button class="chip" type="button" hidden>' + PHONE_ICON + 'Show phone</button>';
  document.body.appendChild(host);
  const panel = root.querySelector('.panel'), chip = root.querySelector('.chip'), frame = root.querySelector('iframe');

  // as big as the window allows: never past 62%, small enough to leave the panel's QR and title room
  const fit = () => {
    const s = Math.max(0.36, Math.min(0.62, (innerHeight - 44 - 28 - 48 - 104 - 16) / PHONE.h));
    host.style.setProperty('--s', s.toFixed(3));
  };
  const wide = matchMedia('(min-width: ' + ROOM + 'px)'); // follows the screen's width however it changes
  let open = local.get() !== 'hidden';
  let editing = false;
  const show = () => {
    const room = wide.matches;
    host.hidden = !room || editing;
    panel.hidden = !open;
    chip.hidden = open;
    if (open && room && !frame.src) frame.src = frameSrc; // the phone's copy starts only once it shows
    fit();
  };
  root.querySelector('.hide').addEventListener('click', () => { open = false; local.set('hidden'); show(); });
  chip.addEventListener('click', () => { open = true; local.set('open'); show(); });
  addEventListener('resize', show);
  wide.addEventListener('change', show);
  // out of the way while the dashboard is being edited (its tray sits on the right)
  const app = () => document.querySelector('homecore-app')?.shadowRoot?.getElementById('app');
  const watch = () => {
    const a = app();
    if (!a) { setTimeout(watch, 300); return; }
    new MutationObserver(() => { const e = a.classList.contains('tfEditing'); if (e !== editing) { editing = e; show(); } }).observe(a, { attributes: true, attributeFilter: ['class'] });
  };
  watch();
  show();
}
