// ====================================================================
// THE LIVING SCRIPT v3 TAB BAR — one bar across the host's pages, so
// everything is one tap away: Host / Stage (the Lobby), Library, Games,
// the Jester's Catalogue, the Manor Lab, and back to the Dashboard. A plain script
// (not a module), placed first in <body>, so the bar is there before a
// scaled board (fitBoard) measures the room it has.
// Not on the TV screens, the guests' phones or the print pages.
//   <script src="js/tabbar.js"></script>                  links open here
//   <script src="js/tabbar.js" data-newtab></script>      links open a new tab
//                                                         (the Host Console,
//                                                         so a show isn't left)
// ====================================================================

(function () {
  var TABS = [
    { href: 'lobby.html', label: 'HOST / STAGE', pages: ['lobby.html', 'console.html', ''] },
    { href: 'library.html', label: 'LIBRARY', pages: ['library.html'] },
    { href: 'games.html', label: 'GAMES', pages: ['games.html', 'dice.html', 'twenty-one.html', 'lanterns.html', 'vault.html'] },
    { href: 'games.html#catalogueSection', label: "JESTER'S CATALOGUE", pages: [], hash: '#catalogueSection' },
    { href: '../manor-lab/', label: 'MANOR', pages: [] },
    { href: '../index.html#dashboard', label: 'DASHBOARD', pages: [] }
  ];
  var script = document.currentScript;
  var newTab = script && script.hasAttribute('data-newtab');
  var page = location.pathname.split('/').pop();
  var onCatalogue = location.hash === '#catalogueSection';
  var nav = document.createElement('nav');
  nav.className = 'ls-tabbar';
  nav.setAttribute('aria-label', 'The Living Script');
  var brand = document.createElement('span');
  brand.className = 'ls-tabbar-brand';
  brand.textContent = 'LIVING SCRIPT v3';
  nav.appendChild(brand);
  TABS.forEach(function (t) {
    var a = document.createElement('a');
    a.href = t.href;
    a.textContent = t.label;
    var here = t.hash ? (page === 'games.html' && onCatalogue) : (t.pages.indexOf(page) !== -1 && !(page === 'games.html' && onCatalogue));
    if (here) a.setAttribute('aria-current', 'page');
    if (newTab) { a.target = '_blank'; a.rel = 'noopener'; }
    nav.appendChild(a);
  });
  document.body.insertBefore(nav, document.body.firstChild);
  window.dispatchEvent(new Event('resize'));
})();
