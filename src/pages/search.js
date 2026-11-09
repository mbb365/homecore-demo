// Search: Matt's popup (Figma "Popup · Search", 9 Nov): a greeting, a line, an illustration and a closing line. Search
// itself isn't designed yet, so there's no box or results; clicking outside it or Escape closes it.
const ART = 'art/search-cave.png';

export function openSearch({ root }) {
  const app = root.getElementById('app');
  app.querySelector('.hcSearchPop')?.remove();
  app.insertAdjacentHTML('beforeend',
    '<div class="tfMoreBackdrop hcSearchPop"><div class="tfMore hcSearchBox hcArtPop" role="dialog" aria-modal="true" aria-labelledby="hcSearchTitle" tabindex="-1">' +
      '<div class="hcArtTitle" id="hcSearchTitle">Hey there, explorer</div>' +
      '<p class="hcArtHint">Looks like you’re searching for something.</p>' +
      '<div class="hcArt hcArtSearch"><img alt="" src="' + new URL(ART, document.baseURI).href + '"></div>' +
      '<p class="hcArtHint">How about some nice illustration around the place?</p>' +
    '</div></div>');
  const pop = app.querySelector('.hcSearchPop'), was = root.activeElement;
  const close = () => { pop.remove(); root.removeEventListener('keydown', onKey, true); was?.focus?.(); };
  const onKey = (ev) => { if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); close(); } };
  root.addEventListener('keydown', onKey, true);
  pop.addEventListener('click', (ev) => { if (ev.target === pop) close(); });
  requestAnimationFrame(() => pop.querySelector('.hcSearchBox').focus());
}
