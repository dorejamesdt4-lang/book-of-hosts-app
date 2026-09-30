// ==================== Matrix rain background ====================
// A mix of Ogham (druid), Egyptian hieroglyphs, cuneiform (Sumerian)
// and geometric Aztec-style glyphs, falling behind the whole page.
(function () {
  var GLYPHS = [
    // Ogham
    'ᚁ','ᚂ','ᚃ','ᚄ','ᚅ','ᚆ','ᚇ','ᚈ','ᚉ','ᚊ','ᚋ','ᚌ','ᚍ','ᚎ','ᚏ',
    'ᚐ','ᚑ','ᚒ','ᚓ','ᚔ','ᚕ','ᚖ','ᚗ','ᚘ','ᚙ','ᚚ','᚛','᚜',
    // Egyptian hieroglyphs
    '𓀀','𓁐','𓂀','𓆑','𓆓','𓇳','𓊪','𓋴','𓏏','𓅓','𓊃','𓋹','𓁹','𓆗',
    // Cuneiform (Sumerian)
    '𒀭','𒁍','𒂗','𒃵','𒄿','𒅆','𒆠','𒇷','𒈗','𒉺','𒊑','𒋼','𒀸','𒌷',
    // Aztec-style geometric glyphs
    '✺','❖','◆','▲','⟁','✦','☉','◈','⬡','✷','◭','◬'
  ];

  var COLORS = ['rgba(0,255,102,0.22)', 'rgba(0,255,102,0.16)', 'rgba(255,0,127,0.14)'];

  var COLUMN_COUNT = 22;
  var LINES_PER_COLUMN = 90;

  function randomGlyphString(lines) {
    var out = [];
    for (var i = 0; i < lines; i++) {
      out.push(GLYPHS[Math.floor(Math.random() * GLYPHS.length)]);
    }
    return out.join('\n');
  }

  function buildRain() {
    var container = document.getElementById('matrixRain');
    if (!container) return;

    for (var i = 0; i < COLUMN_COUNT; i++) {
      var col = document.createElement('div');
      col.className = 'rain-col';
      col.style.left = (2 + i * (96 / (COLUMN_COUNT - 1))).toFixed(1) + '%';
      col.style.color = COLORS[i % COLORS.length];
      col.style.animationDuration = (7 + (i % 6) * 1.6).toFixed(1) + 's';
      col.textContent = randomGlyphString(LINES_PER_COLUMN);
      container.appendChild(col);
    }
  }

  document.addEventListener('DOMContentLoaded', buildRain);
})();

// ==================== Home hero: one-shot spirit-orb burst ====================
// Superseded by the spirit-ball animation embedded in the hero (see
// index.html's .spirit-ball-embed iframe). Left in place, disabled via
// the flag below, so the site can switch back by flipping it to true.
(function () {
  var ENABLE_ORB_BURST = false;
  var sun = document.querySelector('.glowing-sun');
  if (!sun || !ENABLE_ORB_BURST) return;

  function playOrbBurst() {
    sun.classList.remove('orb-burst');
    void sun.offsetWidth; // force reflow so re-adding the class restarts the CSS animation
    sun.classList.add('orb-burst');
  }

  document.addEventListener('DOMContentLoaded', playOrbBurst);
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) playOrbBurst();
  });
})();

// ==================== Nav active state ====================
document.querySelectorAll('.tab-btn[href^="#"]').forEach(function (link) {
  link.addEventListener('click', function () {
    document.querySelectorAll('.tab-btn').forEach(function (t) { t.classList.remove('active'); });
    link.classList.add('active');
  });
});

// ==================== Print preview monitor ====================
var uploadInput = document.getElementById('imageUploadInput');
var uploadBtn = document.getElementById('uploadBtn');
var mockupBtn = document.getElementById('mockupBtn'); // now "Pin Image"
var previewViewport = document.getElementById('previewViewport');
var previewText = document.getElementById('previewText');
var monitorStatus = document.getElementById('monitorStatus');
var PINNED_IMAGE_KEY = 'seumasPinnedImage';

function showImageInViewport(dataUrl, fileName) {
  previewViewport.querySelectorAll('.retro-sun-mini, .retro-grid-mini, #previewText, img').forEach(function (el) {
    el.remove();
  });
  var img = document.createElement('img');
  img.src = dataUrl;
  img.className = 'preview-image-tag';
  img.alt = 'Uploaded artwork preview';
  if (fileName) img.dataset.fileName = fileName;
  previewViewport.appendChild(img);
}

function setMonitorStatus(text) {
  if (monitorStatus) monitorStatus.textContent = text;
}

if (uploadBtn && uploadInput) {
  uploadBtn.addEventListener('click', function () {
    uploadInput.click();
  });

  uploadInput.addEventListener('change', function (event) {
    var file = event.target.files && event.target.files[0];
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function (e) {
      showImageInViewport(e.target.result, file.name);
      setMonitorStatus('> IMAGE LOADED — NOT YET PINNED');
    };
    reader.readAsDataURL(file);
  });
}

// "Pin Image" -- saves the currently previewed image to localStorage so
// it stays on the render monitor across page reloads/visits, and shows
// it there immediately if one was already pinned earlier.
if (mockupBtn) {
  mockupBtn.addEventListener('click', function () {
    var img = previewViewport.querySelector('img');
    if (!img) {
      setMonitorStatus('> NO IMAGE TO PIN');
      return;
    }

    var record = {
      dataUrl: img.src,
      fileName: img.dataset.fileName || 'pinned-image',
      pinnedAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem(PINNED_IMAGE_KEY, JSON.stringify(record));
      setMonitorStatus('> IMAGE PINNED TO MONITOR');
    } catch (e) {
      setMonitorStatus('> COULD NOT PIN — STORAGE FULL');
    }
  });
}

// On load, if an image was pinned in an earlier visit, show it straight away.
(function restorePinnedImage() {
  if (!previewViewport) return;
  try {
    var raw = localStorage.getItem(PINNED_IMAGE_KEY);
    if (!raw) return;
    var record = JSON.parse(raw);
    if (record && record.dataUrl) {
      showImageInViewport(record.dataUrl, record.fileName);
      setMonitorStatus('> IMAGE PINNED TO MONITOR');
    }
  } catch (e) {
    // ignore corrupt/missing pinned image data
  }
})();


// ==================== Seumas Engine: dials (visual only for now) ====================
// Single-select among the three dials. No logic wired to them yet --
// swap this for the real swear-meter / mode behaviour later.
var dials = document.querySelectorAll('.dial');
if (dials.length) {
  dials.forEach(function (dial) {
    dial.addEventListener('click', function () {
      dials.forEach(function (d) { d.classList.remove('active'); });
      dial.classList.add('active');
    });
  });
}

// ==================== Database upload console ====================
// Training file storage for the DATABASE // TRAINING UPLOAD panel.
// Tries the real Cloudflare KV-backed API first (GET/POST/DELETE
// /api/training-*, see functions/api/) and transparently falls back
// to localStorage (same seumasDatabase-style single-JSON-array
// pattern as the Card Archive's seumasCompiledGamesArchive key) when
// that API isn't reachable -- e.g. on a plain static host like GitHub
// Pages, which can't run Cloudflare Pages Functions at all. Once this
// site is actually served from a Cloudflare Pages project with a
// TRAINING_DB KV binding, the panel picks up real persistence
// automatically, with no code change needed.
//
// Only plain text files (txt/md/json) are accepted, matching the
// console-style "training data" intent of this panel -- a file is
// staged after Upload File, then written to storage only once Save to
// Database is clicked. This validation is identical regardless of
// which storage backend ends up serving the request.
(function () {
  var DB_KEY = 'seumasDatabase';
  var MAX_STORED_CONTENT_BYTES = 300000; // ~300KB per file
  var ACCEPTED_EXTENSIONS = /\.(txt|md|json)$/i;
  var CATEGORY_LABELS = {
    game_modes: 'Game Modes',
    historical_events: 'Historical Events',
    words: 'Words',
    swear_words: 'Swear Words',
    inspiring_events: 'Inspiring Events',
    inspiration: 'Inspiration',
    image_recipes: 'Image Recipes',
  };

  var dbFileInput = document.getElementById('dbFileInput');
  var dbUploadBtn = document.getElementById('dbUploadBtn');
  var dbSaveBtn = document.getElementById('dbSaveBtn');
  var dbStagedName = document.getElementById('dbStagedName');
  var dbCategoryRow = document.getElementById('dbCategoryRow');
  var dbCategory = document.getElementById('dbCategory');
  var dbFileList = document.getElementById('dbFileList');
  var dbReadout = document.getElementById('dbReadout');
  var dbBlocksIndexed = document.getElementById('dbBlocksIndexed');

  if (!dbFileInput || !dbUploadBtn || !dbFileList || !dbReadout) return;

  var stagedFile = null;
  var apiAvailable = null; // null = not probed yet, true/false once known

  // ---- localStorage backend (fallback) ----
  function loadLocalEntries() {
    try {
      var raw = localStorage.getItem(DB_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveLocalEntries(entries) {
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(entries));
      return true;
    } catch (e) {
      return false;
    }
  }

  // ---- API backend (Cloudflare Pages Functions + KV) ----
  function fetchJson(url, options) {
    return fetch(url, options).then(function (res) {
      if (!res.ok) return null;
      return res.json();
    }).catch(function () {
      return null;
    });
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  // Resolves to the current entry list, trying the API (when not yet
  // known to be unavailable) before falling back to localStorage.
  function loadEntries() {
    if (apiAvailable === false) {
      return Promise.resolve(loadLocalEntries());
    }
    return fetchJson('/api/training-list').then(function (data) {
      if (data && Array.isArray(data.files)) {
        apiAvailable = true;
        return data.files;
      }
      apiAvailable = false;
      return loadLocalEntries();
    });
  }

  // Saves one new entry via whichever backend is active. Resolves to
  // the saved entry (with a server `key` when the API is active) on
  // success, or null on failure.
  function saveEntry(entry) {
    if (apiAvailable !== false) {
      return fetchJson('/api/training-upload', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ filename: entry.name, content: entry.content, type: entry.type, category: entry.category }),
      }).then(function (result) {
        if (result && result.ok) {
          apiAvailable = true;
          return result;
        }
        apiAvailable = false;
        return saveEntryLocal(entry);
      });
    }
    return Promise.resolve(saveEntryLocal(entry));
  }

  function saveEntryLocal(entry) {
    var entries = loadLocalEntries();
    entries.push(entry);
    return saveLocalEntries(entries) ? entry : null;
  }

  // Deletes one entry (by server key when the API is active, by index
  // in the localStorage array otherwise). Resolves to true/false.
  function deleteEntry(entry, index) {
    if (apiAvailable && entry.key) {
      return fetchJson('/api/training-upload/' + encodeURIComponent(entry.key), { method: 'DELETE' }).then(function (result) {
        if (result && result.ok) return true;
        apiAvailable = false;
        return deleteEntryLocal(index);
      });
    }
    return Promise.resolve(deleteEntryLocal(index));
  }

  function deleteEntryLocal(index) {
    var entries = loadLocalEntries();
    entries.splice(index, 1);
    return saveLocalEntries(entries);
  }

  // ---- Rendering ----
  // The KV-backed API's list() call can lag noticeably (observed up to
  // ~30s in testing) behind a fresh put()/delete() -- a well-documented
  // eventual-consistency characteristic of Cloudflare KV's list index,
  // separate from (and slower than) reading a single key directly. So
  // saves/deletes update this cached array and re-render from it
  // immediately, rather than re-fetching the list right away and
  // risking the file we just saved appearing to vanish. A later full
  // page load still calls refresh() and picks up the real list once KV
  // has caught up.
  var currentEntries = [];

  function renderList(entries) {
    currentEntries = entries;
    dbFileList.innerHTML = '';

    entries.forEach(function (entry, index) {
      var item = document.createElement('div');
      item.className = 'file-item';

      var row = document.createElement('div');
      row.className = 'file-entry';

      var name = document.createElement('span');
      name.className = 'file-name';
      name.textContent = entry.name;

      var meta = document.createElement('span');
      meta.className = 'file-meta';
      meta.textContent = formatSize(entry.size);

      var categoryTag = document.createElement('span');
      categoryTag.className = 'file-category-tag' + (entry.category ? '' : ' file-category-none');
      categoryTag.textContent = CATEGORY_LABELS[entry.category] || 'uncategorized';

      var actions = document.createElement('span');
      actions.className = 'file-actions';

      var preview = document.createElement('pre');
      preview.className = 'file-content-preview';
      preview.hidden = true;
      preview.textContent = entry.content != null ? entry.content : '(no content stored)';

      var view = document.createElement('button');
      view.className = 'file-view';
      view.type = 'button';
      view.textContent = '[view]';
      view.addEventListener('click', function () {
        preview.hidden = !preview.hidden;
        view.textContent = preview.hidden ? '[view]' : '[hide]';
      });

      var remove = document.createElement('button');
      remove.className = 'file-remove';
      remove.type = 'button';
      remove.textContent = '[x]';
      remove.addEventListener('click', function () {
        deleteEntry(entry, index).then(function (ok) {
          if (!ok) return;
          renderList(currentEntries.filter(function (e) { return e !== entry; }));
          updateCounts(currentEntries.length);
        });
      });

      actions.appendChild(view);
      actions.appendChild(remove);
      row.appendChild(name);
      row.appendChild(meta);
      row.appendChild(categoryTag);
      row.appendChild(actions);
      item.appendChild(row);
      item.appendChild(preview);
      dbFileList.appendChild(item);
    });
  }

  function updateCounts(count) {
    var label = count === 0
      ? 'UPLOAD TO DATABASE'
      : count + (count === 1 ? '_FILE_STORED' : '_FILES_STORED');
    dbReadout.innerHTML = label + '<span class="cursor">_</span>';

    if (dbBlocksIndexed) dbBlocksIndexed.textContent = count.toLocaleString();
  }

  function refresh() {
    return loadEntries().then(function (entries) {
      renderList(entries);
      updateCounts(entries.length);
    });
  }

  function clearStagedFile() {
    stagedFile = null;
    dbFileInput.value = '';
    dbStagedName.textContent = '';
    dbSaveBtn.hidden = true;
    if (dbCategoryRow) dbCategoryRow.hidden = true;
    if (dbCategory) dbCategory.value = '';
  }

  dbUploadBtn.addEventListener('click', function () {
    dbFileInput.click();
  });

  dbFileInput.addEventListener('change', function (event) {
    var file = event.target.files && event.target.files[0];
    if (!file) return;

    if (!ACCEPTED_EXTENSIONS.test(file.name)) {
      dbStagedName.textContent = file.name + ' — only .txt, .md, and .json files are supported';
      dbSaveBtn.hidden = true;
      if (dbCategoryRow) dbCategoryRow.hidden = true;
      stagedFile = null;
      dbFileInput.value = '';
      return;
    }

    if (file.size > MAX_STORED_CONTENT_BYTES) {
      dbStagedName.textContent = file.name + ' — too large (' + formatSize(file.size) + ', max ' + formatSize(MAX_STORED_CONTENT_BYTES) + ')';
      dbSaveBtn.hidden = true;
      if (dbCategoryRow) dbCategoryRow.hidden = true;
      stagedFile = null;
      dbFileInput.value = '';
      return;
    }

    stagedFile = file;
    dbStagedName.textContent = 'Staged: ' + file.name + ' (' + formatSize(file.size) + ')';
    dbSaveBtn.hidden = false;
    if (dbCategoryRow) dbCategoryRow.hidden = false;
    if (dbCategory) dbCategory.value = '';
  });

  if (dbSaveBtn) {
    dbSaveBtn.addEventListener('click', function () {
      if (!stagedFile) return;
      if (dbCategory && !dbCategory.value) {
        dbStagedName.textContent = 'Choose a category before saving.';
        return;
      }
      var file = stagedFile;
      var category = dbCategory ? dbCategory.value : '';

      var reader = new FileReader();
      reader.onload = function (e) {
        var entry = {
          name: file.name,
          size: file.size,
          type: file.type || 'unknown',
          category: category,
          uploadedAt: new Date().toISOString(),
          content: e.target.result,
        };
        saveEntry(entry).then(function (saved) {
          clearStagedFile();
          if (!saved) {
            dbStagedName.textContent = 'Could not save — storage is full or unreachable';
            return;
          }
          renderList(currentEntries.concat([saved]));
          updateCounts(currentEntries.length);
        });
      };
      reader.readAsText(file);
    });
  }

  refresh();
})();

// ==================== Homepage intro audio toggle ====================
// Only present on index.html -- guarded so this is a silent no-op on
// every other page that also loads this shared script.js.
(function () {
  var introAudio = document.getElementById('introAudio');
  var introBtn = document.getElementById('introAudioBtn');
  var introIcon = document.getElementById('introAudioIcon');
  var introLabel = document.getElementById('introAudioLabel');

  if (!introAudio || !introBtn || !introIcon || !introLabel) return;

  function setPlayingState(isPlaying) {
    introBtn.classList.toggle('playing', isPlaying);
    introIcon.textContent = isPlaying ? '■' : '▶';
    introLabel.textContent = isPlaying ? 'STOP' : 'PLAY';
    introBtn.setAttribute('aria-label', isPlaying ? 'Stop intro audio' : 'Play intro audio');
  }

  introBtn.addEventListener('click', function () {
    if (introAudio.paused) {
      var playPromise = introAudio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(function (err) {
          console.error('Could not play intro audio', err);
          setPlayingState(false);
        });
      }
      setPlayingState(true);
    } else {
      // "Stop" resets to the start rather than just pausing, per the brief --
      // clicking Play again always starts the track over from the top.
      introAudio.pause();
      introAudio.currentTime = 0;
      setPlayingState(false);
    }
  });

  introAudio.addEventListener('ended', function () {
    introAudio.currentTime = 0;
    setPlayingState(false);
  });
})();
