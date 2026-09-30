// ==================== Character header loader ====================
// Reusable loader for the flexible animation header on character pages
// (characters/<slug>/index.html) and, later, the Narrator Engine.
//
// Drop a container in the page:
//   <div class="character-header" data-header-path="header/header.json"></div>
// (data-header-path is optional; defaults to "header/header.json" relative
// to the current document.)
//
// It fetches that JSON file -- { "type": "html" | "image" | "video", "src": "<filename>" }
// -- and renders the file (found alongside the JSON, in the same folder)
// as a sandboxed iframe, an <img>, or a <video>. If the file is missing,
// unreadable, or malformed, it shows a "NO ANIMATION ASSIGNED" placeholder.
(function () {
  function dirOf(path) {
    var idx = path.lastIndexOf('/');
    return idx === -1 ? '' : path.slice(0, idx + 1);
  }

  function renderPlaceholder(container) {
    container.innerHTML = '';
    var div = document.createElement('div');
    div.className = 'ch-placeholder';
    div.textContent = 'NO ANIMATION ASSIGNED';
    container.appendChild(div);
  }

  function renderHeader(container, headerPath, data) {
    var fileUrl = dirOf(headerPath) + data.src;
    container.innerHTML = '';

    if (data.type === 'html') {
      var iframe = document.createElement('iframe');
      iframe.className = 'ch-frame';
      iframe.src = fileUrl;
      iframe.loading = 'lazy';
      iframe.title = 'Character header animation';
      iframe.setAttribute('sandbox', 'allow-scripts');
      container.appendChild(iframe);
    } else if (data.type === 'image') {
      var img = document.createElement('img');
      img.className = 'ch-media';
      img.src = fileUrl;
      img.alt = 'Character header animation';
      container.appendChild(img);
    } else if (data.type === 'video') {
      var video = document.createElement('video');
      video.className = 'ch-media';
      video.src = fileUrl;
      video.autoplay = true;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      container.appendChild(video);
    } else {
      renderPlaceholder(container);
    }
  }

  function init(container) {
    var headerPath = container.getAttribute('data-header-path') || 'header/header.json';

    fetch(headerPath, { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('no header.json');
        return res.json();
      })
      .then(function (data) {
        if (!data || !data.type || !data.src) throw new Error('malformed header.json');
        renderHeader(container, headerPath, data);
      })
      .catch(function () {
        renderPlaceholder(container);
      });
  }

  function initAll() {
    document.querySelectorAll('.character-header').forEach(init);
  }

  document.addEventListener('DOMContentLoaded', initAll);

  window.CharacterHeader = { init: init, initAll: initAll };
})();
