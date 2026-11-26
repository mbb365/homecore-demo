// A picture of a room for its area card (Matt, 25 Nov: "a faded gradient image that would replace this icon to convey or
// show part of the area"): a small drawn corner of the room, soft and warm, that the card fades out to its left and foot.
// Drawn here rather than photos so it stays in the demo's own hand (its cover and weather art are drawn too) and works
// light or dark. 240 × 120, the room's corner on the right, where the card shows it. Every room in the demo has one (Matt,
// 25 Nov: a switch between all icons and all pictures); a room without one keeps its icon.
const svg = (inner) => '<svg viewBox="0 0 240 120" preserveAspectRatio="xMaxYMid slice" aria-hidden="true" focusable="false">' + inner + '</svg>';
const glow = (id, cx, cy, r, c) => '<radialGradient id="' + id + '"><stop offset="0" stop-color="' + c + '" stop-opacity=".75"/><stop offset="1" stop-color="' + c + '" stop-opacity="0"/></radialGradient><circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="url(#' + id + ')"/>';

export const ROOM_ART = {
  // a sage sofa under a picture, a lamp on in the corner, the window's daylight and a plant
  living_room: svg(
    '<rect width="240" height="120" fill="#ebe1d4"/>' +
    '<rect x="160" y="12" width="56" height="62" rx="4" fill="#d3e4ee"/><path d="M188 12v62M160 42h56" stroke="#f7f3ee" stroke-width="3"/><rect x="160" y="12" width="56" height="62" rx="4" fill="none" stroke="#f7f3ee" stroke-width="4"/>' +
    '<rect y="98" width="240" height="22" fill="#d6c1a8"/><ellipse cx="128" cy="108" rx="78" ry="7" fill="#c39f80" opacity=".55"/>' +
    '<rect x="92" y="20" width="40" height="26" rx="2" fill="#f5efe7" stroke="#b9a48c" stroke-width="2"/><path d="M98 40l9-9 7 6 6-5 8 8z" fill="#9fb59a"/>' +
    '<rect x="60" y="52" width="122" height="26" rx="11" fill="#8fa08a"/><rect x="52" y="66" width="138" height="30" rx="10" fill="#7f9179"/>' +
    '<rect x="48" y="60" width="18" height="36" rx="8" fill="#8a9b84"/><rect x="176" y="60" width="18" height="36" rx="8" fill="#8a9b84"/>' +
    '<rect x="70" y="64" width="48" height="14" rx="6" fill="#9aab94"/><rect x="122" y="64" width="50" height="14" rx="6" fill="#9aab94"/>' +
    '<rect x="62" y="95" width="4" height="6" fill="#6b5847"/><rect x="176" y="95" width="4" height="6" fill="#6b5847"/>' +
    glow('lrLamp', 222, 34, 34, '#ffd79a') + '<path d="M222 40v58" stroke="#6b5847" stroke-width="3"/><path d="M211 40h22l-5-16h-12z" fill="#f4d7a1"/><rect x="214" y="96" width="16" height="4" rx="2" fill="#6b5847"/>' +
    '<rect x="22" y="82" width="16" height="16" rx="2" fill="#b67a54"/><ellipse cx="25" cy="70" rx="5" ry="13" fill="#7fa47a" transform="rotate(-18 25 70)"/><ellipse cx="35" cy="68" rx="5" ry="14" fill="#6f9a6b" transform="rotate(16 35 68)"/><ellipse cx="30" cy="64" rx="4" ry="15" fill="#86ad80"/>'),
  // the counter under the window: cupboards, a kettle and a bowl of lemons, a hanging light on
  kitchen: svg(
    '<rect width="240" height="120" fill="#e9e5dd"/>' +
    '<rect x="150" y="10" width="52" height="46" rx="3" fill="#d3e4ee"/><rect x="150" y="10" width="52" height="46" rx="3" fill="none" stroke="#f7f3ee" stroke-width="4"/><path d="M176 10v46" stroke="#f7f3ee" stroke-width="3"/>' +
    '<rect x="40" y="8" width="96" height="34" rx="3" fill="#a9bdb2"/><path d="M88 8v34" stroke="#93a99d" stroke-width="2"/><rect x="80" y="28" width="2" height="9" rx="1" fill="#6f8378"/><rect x="94" y="28" width="2" height="9" rx="1" fill="#6f8378"/>' +
    '<rect x="212" y="10" width="28" height="46" rx="3" fill="#a9bdb2"/>' +
    '<path d="M40 46h200M40 54h200M40 62h200" stroke="#dcd6cc" stroke-width="1"/>' +
    '<rect x="30" y="68" width="210" height="7" rx="2" fill="#d8ccbb"/><rect x="34" y="75" width="206" height="38" fill="#93a99d"/>' +
    '<path d="M86 75v38M138 75v38M190 75v38" stroke="#83998d" stroke-width="2"/><rect x="74" y="80" width="2" height="10" rx="1" fill="#6f8378"/><rect x="98" y="80" width="2" height="10" rx="1" fill="#6f8378"/><rect x="178" y="80" width="2" height="10" rx="1" fill="#6f8378"/><rect x="202" y="80" width="2" height="10" rx="1" fill="#6f8378"/>' +
    '<rect y="113" width="240" height="7" fill="#cdb79c"/>' +
    '<path d="M104 68c0-12 4-16 11-16s11 4 11 16z" fill="#e7e2da"/><path d="M126 58l6-3" stroke="#e7e2da" stroke-width="3" stroke-linecap="round"/><rect x="111" y="48" width="8" height="4" rx="2" fill="#5d5a55"/>' +
    '<path d="M150 68c0-8 6-10 16-10s16 2 16 10z" fill="#f2efe9"/><circle cx="160" cy="58" r="4" fill="#f2cc5b"/><circle cx="169" cy="57" r="4" fill="#ecc24a"/>' +
    '<rect x="214" y="58" width="12" height="10" rx="2" fill="#b67a54"/><ellipse cx="217" cy="52" rx="3" ry="8" fill="#7fa47a"/><ellipse cx="223" cy="51" rx="3" ry="9" fill="#6f9a6b"/>' +
    glow('kLamp', 62, 52, 30, '#ffd79a') + '<path d="M62 0v44" stroke="#5d5a55" stroke-width="2"/><path d="M52 52a10 9 0 0 1 20 0z" fill="#3f4a45"/>'),
  // the bed made up under a picture, a lamp on the bedside table, the curtain at the side
  bedroom: svg(
    '<rect width="240" height="120" fill="#e7e3ea"/>' +
    '<rect x="206" y="0" width="34" height="100" fill="#c9bfd6"/><path d="M214 0v100M224 0v100M233 0v100" stroke="#bcb1cb" stroke-width="2"/>' +
    '<rect y="100" width="240" height="20" fill="#d4c2ad"/>' +
    '<rect x="112" y="12" width="60" height="22" rx="2" fill="#f6f2ec" stroke="#b5a7c3" stroke-width="2"/><circle cx="130" cy="23" r="5" fill="#e9b4a0"/><path d="M146 30l8-9 10 9z" fill="#a8b8d0"/>' +
    '<rect x="78" y="40" width="128" height="44" rx="12" fill="#a99bbd"/>' +
    '<rect x="70" y="74" width="144" height="26" rx="8" fill="#f3f0ea"/>' +
    '<rect x="94" y="60" width="44" height="18" rx="8" fill="#ffffff"/><rect x="146" y="60" width="44" height="18" rx="8" fill="#ffffff"/>' +
    '<path d="M70 82h144v14a8 8 0 0 1-8 8H78a8 8 0 0 1-8-8z" fill="#bccbe0"/><path d="M70 82h144" stroke="#d5deec" stroke-width="3"/>' +
    '<rect x="28" y="78" width="32" height="24" rx="3" fill="#b38f70"/><rect x="31" y="86" width="26" height="2" fill="#9d7a5d"/>' +
    glow('bLamp', 44, 60, 32, '#ffd79a') + '<rect x="42" y="64" width="4" height="14" fill="#6b5847"/><path d="M34 64h20l-4-14h-12z" fill="#f4d7a1"/>'),
  // the bath under a round mirror, tiles behind, a towel on its rail
  bathroom: svg(
    '<rect width="240" height="120" fill="#e2eaec"/><path d="M40 0v104M70 0v104M100 0v104M130 0v104M160 0v104M190 0v104M220 0v104M0 26h240M0 52h240M0 78h240" stroke="#d3dee1" stroke-width="1.5"/>' +
    '<rect y="104" width="240" height="16" fill="#c9d3d6"/>' +
    '<circle cx="168" cy="30" r="18" fill="#eef5f7" stroke="#b9c6ca" stroke-width="3"/>' +
    '<rect x="112" y="74" width="122" height="30" rx="14" fill="#fbfbfa"/><rect x="112" y="70" width="122" height="10" rx="5" fill="#f2f3f2"/><rect x="122" y="104" width="6" height="8" fill="#b9c6ca"/><rect x="218" y="104" width="6" height="8" fill="#b9c6ca"/>' +
    '<path d="M216 70V56a6 6 0 0 1 12 0" fill="none" stroke="#9fb0b5" stroke-width="3"/>' +
    '<path d="M60 40h34" stroke="#9fb0b5" stroke-width="3" stroke-linecap="round"/><rect x="64" y="40" width="26" height="34" rx="3" fill="#e6b8a2"/><path d="M64 66h26" stroke="#d9a690" stroke-width="2"/>' +
    '<rect x="30" y="88" width="14" height="16" rx="2" fill="#f2f3f2"/><ellipse cx="34" cy="78" rx="4" ry="11" fill="#7fa47a"/><ellipse cx="41" cy="80" rx="4" ry="10" fill="#6f9a6b"/>'),
  // the balcony rail against the sky, pots and a chair, the solar panel catching the sun
  balcony: svg(
    '<rect width="240" height="120" fill="#dbe8f1"/>' + glow('balSun', 214, 18, 40, '#ffe2a8') +
    '<path d="M150 22l70-6 6 30-70 6z" fill="#46607a"/><path d="M162 21l6 30M176 20l6 30M190 19l6 30M204 18l6 30M153 34l70-6" stroke="#6f8aa3" stroke-width="1.5"/><path d="M190 52v22" stroke="#8a8f94" stroke-width="3"/>' +
    '<rect y="98" width="240" height="22" fill="#cdbba6"/>' +
    '<rect x="0" y="62" width="240" height="4" fill="#8a8f94"/>' + Array.from({ length: 16 }, (_, i) => '<rect x="' + (6 + i * 15) + '" y="66" width="3" height="32" fill="#9aa0a5"/>').join('') +
    '<path d="M96 70h34v6h-30z" fill="#c98f5c"/><path d="M100 76l-4 24M128 76l4 24M98 70l-4-16h4l4 16" stroke="#a8743f" stroke-width="3" fill="none"/>' +
    '<rect x="40" y="84" width="20" height="16" rx="2" fill="#b67a54"/><ellipse cx="44" cy="72" rx="6" ry="14" fill="#7fa47a"/><ellipse cx="55" cy="70" rx="6" ry="15" fill="#6f9a6b"/>' +
    '<rect x="150" y="86" width="16" height="14" rx="2" fill="#c48a63"/><circle cx="154" cy="80" r="6" fill="#e48a8a"/><circle cx="162" cy="78" r="6" fill="#f0a3a3"/><ellipse cx="158" cy="84" rx="9" ry="4" fill="#7fa47a"/>'),
  // the desk under a shelf of books, the screen on, a lamp lit beside it
  office: svg(
    '<rect width="240" height="120" fill="#e9e4dc"/>' +
    '<rect x="120" y="18" width="100" height="5" rx="2" fill="#b38f70"/>' + [['#c98f5c', 8], ['#8fa08a', 7], ['#a99bbd', 9], ['#d9b26a', 6], ['#7f9db8', 8]].map(([c, w], i, a) => '<rect x="' + (128 + a.slice(0, i).reduce((n, x) => n + x[1] + 2, 0)) + '" y="' + (18 - 16 - (i % 2) * 2) + '" width="' + w + '" height="' + (16 + (i % 2) * 2) + '" fill="' + c + '"/>').join('') +
    '<rect y="104" width="240" height="16" fill="#d2bfa7"/>' +
    '<rect x="90" y="66" width="146" height="6" rx="2" fill="#b38f70"/><rect x="98" y="72" width="5" height="32" fill="#9d7a5d"/><rect x="222" y="72" width="5" height="32" fill="#9d7a5d"/><rect x="190" y="72" width="32" height="22" fill="#c4a283"/>' +
    '<rect x="132" y="32" width="56" height="34" rx="3" fill="#3f4a52"/><rect x="136" y="36" width="48" height="26" rx="1" fill="#9cc3dc"/><path d="M140 54l10-8 8 6 8-10 14 12" stroke="#d7ecf7" stroke-width="2" fill="none"/><rect x="156" y="66" width="8" height="2" fill="#3f4a52"/>' +
    glow('offLamp', 108, 44, 30, '#ffd79a') + '<path d="M100 66l8-20 8-4" stroke="#5d5a55" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M110 40l12-6 2 8z" fill="#5d5a55"/>' +
    '<path d="M150 104l6-24h22l6 24" fill="none" stroke="#5d5a55" stroke-width="3"/><rect x="150" y="76" width="34" height="8" rx="3" fill="#7f8f9a"/>'),
  // a made-up single bed by the window, a rug on the floor
  spare_room: svg(
    '<rect width="240" height="120" fill="#ede7e1"/>' +
    '<rect x="70" y="14" width="44" height="50" rx="3" fill="#d6e5ec"/><rect x="70" y="14" width="44" height="50" rx="3" fill="none" stroke="#f7f3ee" stroke-width="4"/><path d="M92 14v50" stroke="#f7f3ee" stroke-width="3"/>' +
    '<rect y="102" width="240" height="18" fill="#d8c6b1"/><ellipse cx="110" cy="110" rx="56" ry="6" fill="#b7c7a9" opacity=".7"/>' +
    '<rect x="130" y="50" width="104" height="30" rx="8" fill="#c7b39c"/><rect x="132" y="72" width="104" height="26" rx="6" fill="#f3f0ea"/><rect x="200" y="62" width="30" height="14" rx="6" fill="#ffffff"/><path d="M132 80h76a6 6 0 0 1 6 6v8a6 6 0 0 1-6 6h-76z" fill="#e8c9a6"/>' +
    '<rect x="138" y="98" width="5" height="6" fill="#9d7a5d"/><rect x="226" y="98" width="5" height="6" fill="#9d7a5d"/>' +
    '<rect x="30" y="64" width="22" height="38" rx="2" fill="#c4a283"/><rect x="33" y="70" width="16" height="10" rx="1" fill="#b38f70"/><rect x="33" y="84" width="16" height="10" rx="1" fill="#b38f70"/>'),
  // shelves of boxes and tubs, a step ladder against them
  storage: svg(
    '<rect width="240" height="120" fill="#e6e2db"/><rect y="104" width="240" height="16" fill="#cbbba7"/>' +
    '<path d="M110 10v94M232 10v94" stroke="#8f8a82" stroke-width="4"/><path d="M108 38h126M108 70h126M108 100h126" stroke="#8f8a82" stroke-width="4"/>' +
    '<rect x="116" y="18" width="34" height="20" rx="2" fill="#c9a37c"/><path d="M116 26h34" stroke="#b38f70" stroke-width="2"/><rect x="156" y="22" width="30" height="16" rx="2" fill="#d4b48f"/><rect x="192" y="14" width="36" height="24" rx="3" fill="#9fb4c7"/>' +
    '<rect x="116" y="48" width="44" height="22" rx="3" fill="#a9bdb2"/><rect x="166" y="52" width="28" height="18" rx="2" fill="#c9a37c"/><rect x="200" y="46" width="28" height="24" rx="2" fill="#d4b48f"/><path d="M200 56h28" stroke="#c09f7b" stroke-width="2"/>' +
    '<rect x="118" y="80" width="40" height="20" rx="2" fill="#d4b48f"/><rect x="164" y="84" width="30" height="16" rx="3" fill="#e6c9a9"/><rect x="200" y="78" width="28" height="22" rx="3" fill="#9fb4c7"/>' +
    '<path d="M60 104l22-82M96 104l-14-82" stroke="#b9b3a9" stroke-width="4" stroke-linecap="round"/><path d="M68 80h24M74 58h16M78 40h8" stroke="#b9b3a9" stroke-width="3"/>'),
  // the front door, coats on the rack beside it, a runner on the floor
  hallway: svg(
    '<rect width="240" height="120" fill="#ebe3d8"/><rect y="104" width="240" height="16" fill="#cdb79c"/><rect x="60" y="106" width="150" height="8" rx="2" fill="#b56f5a" opacity=".8"/>' +
    '<rect x="168" y="12" width="56" height="92" rx="3" fill="#6f8a8a"/><rect x="176" y="20" width="40" height="30" rx="2" fill="#7f9a9a"/><rect x="176" y="58" width="40" height="38" rx="2" fill="#7f9a9a"/><circle cx="210" cy="60" r="3" fill="#e0c27a"/><rect x="190" y="26" width="12" height="18" rx="6" fill="#d6e5ec"/>' +
    '<path d="M120 104V20" stroke="#6b5847" stroke-width="4"/><path d="M106 24h28M110 104h20" stroke="#6b5847" stroke-width="4" stroke-linecap="round"/>' +
    '<path d="M110 26c-8 6-10 26-8 40h16c2-14 0-34-8-40z" fill="#c98f5c"/><path d="M130 26c8 8 10 22 8 34h-14c-2-12 0-26 6-34z" fill="#8fa08a"/><circle cx="120" cy="18" r="6" fill="#a99bbd"/>' +
    '<rect x="36" y="22" width="34" height="44" rx="17" fill="#eef1f2" stroke="#b9a48c" stroke-width="3"/>' +
    '<rect x="140" y="96" width="10" height="8" rx="3" fill="#5d5a55"/><rect x="152" y="96" width="10" height="8" rx="3" fill="#5d5a55"/>'),
  // the table laid under a lit pendant, chairs drawn up, a vase of flowers
  dining_room: svg(
    '<rect width="240" height="120" fill="#ede3d6"/><rect y="104" width="240" height="16" fill="#cfb89c"/>' +
    '<rect x="196" y="12" width="40" height="56" rx="3" fill="#d6e5ec"/><rect x="196" y="12" width="40" height="56" rx="3" fill="none" stroke="#f7f3ee" stroke-width="4"/>' +
    glow('dinLamp', 140, 40, 40, '#ffd79a') + '<path d="M140 0v28" stroke="#5d5a55" stroke-width="2"/><path d="M126 38a14 12 0 0 1 28 0z" fill="#c98f5c"/>' +
    '<rect x="86" y="70" width="110" height="6" rx="2" fill="#a8743f"/><rect x="94" y="76" width="5" height="28" fill="#8d5f32"/><rect x="183" y="76" width="5" height="28" fill="#8d5f32"/>' +
    '<path d="M78 104V58M78 84h18v20" stroke="#b38f70" stroke-width="4" fill="none"/><path d="M204 104V58M204 84h-18v20" stroke="#b38f70" stroke-width="4" fill="none"/>' +
    '<path d="M134 70l2-12h8l2 12z" fill="#a9c1cf"/><circle cx="136" cy="54" r="4" fill="#f0a3a3"/><circle cx="144" cy="52" r="4" fill="#f2cc5b"/><circle cx="140" cy="48" r="4" fill="#e48a8a"/>' +
    '<circle cx="110" cy="68" r="5" fill="#f4efe8"/><circle cx="170" cy="68" r="5" fill="#f4efe8"/>'),
  // the bench under a pegboard of tools, the sectional garage door to one side
  workshop: svg(
    '<rect width="240" height="120" fill="#e2ddd5"/><rect y="104" width="240" height="16" fill="#b9b1a5"/>' +
    '<rect x="178" y="8" width="60" height="96" fill="#d4d0c8"/>' + [0, 1, 2, 3, 4].map((i) => '<rect x="180" y="' + (10 + i * 19) + '" width="56" height="17" rx="1" fill="#e6e2db"/>').join('') + '<rect x="200" y="98" width="16" height="3" rx="1" fill="#8f8a82"/>' +
    '<rect x="60" y="14" width="100" height="44" rx="2" fill="#d9c3a0"/>' + Array.from({ length: 30 }, (_, i) => '<circle cx="' + (66 + (i % 10) * 10) + '" cy="' + (20 + Math.floor(i / 10) * 14) + '" r="1.2" fill="#b89f7a"/>').join('') +
    '<path d="M78 22v24M74 22h8" stroke="#5d5a55" stroke-width="3" stroke-linecap="round"/><path d="M98 22l6 22M104 22l-6 22" stroke="#c0392b" stroke-width="3" stroke-linecap="round"/><circle cx="128" cy="34" r="9" fill="none" stroke="#5d5a55" stroke-width="3"/><path d="M146 20v26" stroke="#d9b26a" stroke-width="5" stroke-linecap="round"/>' +
    '<rect x="50" y="66" width="122" height="7" rx="2" fill="#a8743f"/><rect x="58" y="73" width="5" height="31" fill="#8d5f32"/><rect x="160" y="73" width="5" height="31" fill="#8d5f32"/><rect x="66" y="84" width="90" height="4" fill="#8d5f32"/>' +
    '<rect x="80" y="56" width="22" height="10" rx="2" fill="#c0392b"/><rect x="120" y="58" width="26" height="8" rx="2" fill="#7f8f9a"/>'),
  // the washer and the dryer side by side, a basket of laundry, a shelf above
  laundry: svg(
    '<rect width="240" height="120" fill="#e4e9eb"/><rect y="104" width="240" height="16" fill="#c9d1d3"/>' +
    '<rect x="110" y="20" width="120" height="5" rx="2" fill="#b38f70"/><rect x="120" y="8" width="14" height="12" rx="2" fill="#7f9db8"/><rect x="138" y="10" width="12" height="10" rx="2" fill="#e8c9a6"/><rect x="200" y="6" width="16" height="14" rx="3" fill="#a9bdb2"/>' +
    '<rect x="110" y="40" width="58" height="64" rx="5" fill="#f6f7f7"/><rect x="110" y="40" width="58" height="12" rx="5" fill="#eceeef"/><circle cx="139" cy="78" r="17" fill="#cfd8dc"/><circle cx="139" cy="78" r="12" fill="#9cc3dc"/><circle cx="158" cy="46" r="2.5" fill="#9fb0b5"/>' +
    '<rect x="172" y="40" width="58" height="64" rx="5" fill="#f6f7f7"/><rect x="172" y="40" width="58" height="12" rx="5" fill="#eceeef"/><circle cx="201" cy="78" r="17" fill="#cfd8dc"/><circle cx="201" cy="78" r="12" fill="#e3e8ea"/><circle cx="220" cy="46" r="2.5" fill="#9fb0b5"/>' +
    '<path d="M52 82h44l-5 22H57z" fill="#d2b48c"/><path d="M54 90h40M56 98h36" stroke="#b89a72" stroke-width="2"/><ellipse cx="66" cy="80" rx="10" ry="6" fill="#a8b8d0"/><ellipse cx="82" cy="79" rx="10" ry="6" fill="#f0a3a3"/>'),
};
