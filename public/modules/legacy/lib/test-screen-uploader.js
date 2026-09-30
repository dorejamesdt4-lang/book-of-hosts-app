// ==================== Test Screen Uploader ====================
// Self-contained uploader + PLAY/PAUSE controller + PowerShell command
// generator for the TEST SCREENS grid on seumas-engine.html. Reusable
// elsewhere (e.g. the Narrator Engine) by calling
// TestScreenUploader.init(el) on any ".test-screen" element.
//
// Each screen shows nothing but the animation itself -- no scanlines,
// tint or readout on top of it, and the animation files are never
// modified. Only one screen plays at a time (a single "tsPlay" radio
// group): selecting a screen mounts its iframe/image/video fresh,
// deselecting it removes that element from the DOM entirely so it is
// truly stopped, not just hidden.
//
// Uploads are local preview only (object URLs / blob data): nothing is
// saved or sent anywhere by this script. GET COMMANDS only prints
// PowerShell one-liners for the user to copy and run themselves -- it
// never executes anything.
(function () {
  var REPO_PATH = 'C:\\Users\\doret\\Documents\\dore-trading';
  var LIBRARY_PATH = 'C:\\Users\\doret\\Documents\\dore-animation-library';
  var DEFAULT_SOURCE_FOLDER = LIBRARY_PATH + '\\_inbox';
  var STORAGE_KEY = 'dt_test_screen_source_folder';

  var screens = []; // { radio, mount, unmount }

  function detectType(filename) {
    var ext = (filename.split('.').pop() || '').toLowerCase();
    if (ext === 'html' || ext === 'htm') return 'html';
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].indexOf(ext) !== -1) return 'image';
    if (ext === 'mp4' || ext === 'webm') return 'video';
    return null;
  }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function formatTimestamp(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      '_' + pad(d.getHours()) + '-' + pad(d.getMinutes()) + '-' + pad(d.getSeconds());
  }

  // talk-bridge.js is an ES module; this file is loaded as a plain
  // classic script, so it's dynamic-import()'d lazily on first use
  // rather than statically imported. (Dynamic import() works from a
  // classic script -- only a top-level static `import` requires
  // type="module".)
  var talkBridgePromise = null;
  function loadTalkBridge() {
    if (!talkBridgePromise) talkBridgePromise = import('./talk-bridge.js');
    return talkBridgePromise;
  }

  function loadSourceFolder() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }
  function saveSourceFolder(value) {
    try { localStorage.setItem(STORAGE_KEY, value); } catch (e) { /* ignore */ }
  }

  function copyText(text, statusEl) {
    function done(ok) {
      statusEl.textContent = ok ? 'COPIED' : 'COPY FAILED';
      setTimeout(function () { statusEl.textContent = ''; }, 2000);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
      return;
    }
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      done(ok);
    } catch (e) {
      done(false);
    }
  }

  function buildCommands(slug, name, srcField, type, sourceFolder, timestamp) {
    var srcPosix = srcField.replace(/\\/g, '/');
    return [
      'cd ' + REPO_PATH,
      'if (Test-Path "characters\\' + slug + '\\header") { Rename-Item -Path "characters\\' + slug + '\\header" -NewName "header-backup-' + timestamp + '" }',
      'New-Item -ItemType Directory -Path "characters\\' + slug + '\\header" -Force | Out-Null',
      'Copy-Item -Path "' + sourceFolder + '\\' + name + '" -Destination "characters\\' + slug + '\\header" -Recurse -Force',
      '$v=1; while (Test-Path "' + LIBRARY_PATH + '\\characters\\' + slug + '\\v$v") { $v++ }; Copy-Item -Path "' + sourceFolder + '\\' + name + '" -Destination "' + LIBRARY_PATH + '\\characters\\' + slug + '\\v$v" -Recurse -Force',
      'Set-Content -Path "characters\\' + slug + '\\header\\header.json" -Value \'{"type":"' + type + '","src":"' + srcPosix + '"}\' -Encoding utf8',
      'git add characters/' + slug,
      'git commit -m "Set ' + slug + ' header animation: ' + name + '"',
      'git push'
    ];
  }

  function openCommandsModal(commands) {
    var modal = document.getElementById('tsCommandsModal');
    var list = document.getElementById('tsCommandsList');
    if (!modal || !list) return;

    list.innerHTML = '';
    commands.forEach(function (cmd, i) {
      var box = document.createElement('div');
      box.className = 'ts-command-box';

      var label = document.createElement('div');
      label.className = 'ts-command-label';
      label.textContent = (i + 1) + '.';

      var code = document.createElement('code');
      code.className = 'ts-command-code';
      code.textContent = cmd;

      var row = document.createElement('div');
      var copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'ts-command-copy';
      copyBtn.textContent = 'COPY';

      var status = document.createElement('span');
      status.className = 'ts-command-status';

      copyBtn.addEventListener('click', function () { copyText(cmd, status); });

      row.appendChild(copyBtn);
      row.appendChild(status);
      box.appendChild(label);
      box.appendChild(code);
      box.appendChild(row);
      list.appendChild(box);
    });

    modal.hidden = false;
  }

  function initModalClose() {
    var closeBtn = document.getElementById('tsCommandsClose');
    var modal = document.getElementById('tsCommandsModal');
    if (!closeBtn || !modal) return;
    closeBtn.addEventListener('click', function () { modal.hidden = true; });
    modal.addEventListener('click', function (e) {
      if (e.target === modal) modal.hidden = true;
    });
  }

  function initSourceFolder() {
    var input = document.getElementById('tsSourceFolder');
    if (!input) return;
    var saved = loadSourceFolder();
    if (saved) input.value = saved;
    input.addEventListener('change', function () { saveSourceFolder(input.value); });
  }

  function getSourceFolder() {
    var input = document.getElementById('tsSourceFolder');
    var value = input && input.value.trim();
    return value || DEFAULT_SOURCE_FOLDER;
  }

  // Only one screen ever plays at a time: mount the one whose radio was
  // just checked, unmount every other registered screen.
  function handlePlayChange(e) {
    if (!e.target.classList || !e.target.classList.contains('ts-play-radio')) return;
    screens.forEach(function (s) {
      if (s.radio === e.target) s.mount();
      else s.unmount();
    });
  }

  function init(el) {
    var viewport = el.querySelector('.test-screen-viewport');
    var radio = el.querySelector('.ts-play-radio');
    var playLabel = el.querySelector('.test-screen-play-label');
    var viewFullBtn = el.querySelector('.ts-view-full-btn');
    var fileInput = el.querySelector('.ts-file-input');
    var folderInput = el.querySelector('.ts-folder-input');
    var uploadFileBtn = el.querySelector('.ts-upload-file-btn');
    var uploadFolderBtn = el.querySelector('.ts-upload-folder-btn');
    var resetBtn = el.querySelector('.ts-reset-btn');
    var sendToSelect = el.querySelector('.ts-send-to');
    var getCommandsBtn = el.querySelector('.ts-get-commands-btn');
    var versionRadios = el.querySelectorAll('.ts-version-radio');
    var testTalkBtn = el.querySelector('.ts-test-talk-btn');
    if (!viewport || !radio) return;

    var originalFile = el.getAttribute('data-file') || null;
    var currentVersion = 'v1';
    var mountedIframe = null; // the live <iframe> DOM node, when the resolved content is html

    // Any non-v1 version radio value maps to a data-file-<version>
    // attribute (dots become hyphens, so version "v2.1" reads
    // data-file-v2-1). Supports an arbitrary number of talking-enabled
    // builds per screen, not just a single "v2".
    function fileForVersion(version) {
      if (version === 'v1') return originalFile;
      return el.getAttribute('data-file-' + version.replace(/\./g, '-')) || null;
    }

    // upload.* tracks a real uploaded file/folder -- when present it
    // overrides the version toggle entirely. Kept separate from the
    // resolved render URL/type (see resolveContent()) because
    // GET COMMANDS needs the real uploaded name, not a blob URL.
    var upload = { name: null, kind: null, mainFile: null, url: null, type: null, objectUrls: [] };

    function resolveContent() {
      if (upload.url) return { url: upload.url, type: upload.type };
      var vFile = fileForVersion(currentVersion);
      return { url: vFile, type: vFile ? 'html' : null };
    }

    function setPlayable(playable) {
      radio.disabled = !playable;
      if (playLabel) playLabel.classList.toggle('ts-play-disabled', !playable);
    }

    function updateTestTalkEnabled() {
      if (!testTalkBtn) return;
      var active = !!(radio.checked && !upload.url && currentVersion !== 'v1' && mountedIframe);
      testTalkBtn.disabled = !active;
    }

    function mount() {
      viewport.innerHTML = '';
      mountedIframe = null;
      var resolved = resolveContent();

      if (!resolved.url) {
        var none = document.createElement('div');
        none.className = 'test-screen-paused';
        none.textContent = 'NO ANIMATION FILE';
        viewport.appendChild(none);
        updateTestTalkEnabled();
        return;
      }

      if (resolved.type === 'html') {
        var wrap = document.createElement('div');
        wrap.className = 'test-screen-iframe-wrap';
        var iframe = document.createElement('iframe');
        iframe.src = resolved.url;
        iframe.title = 'Test screen animation';
        iframe.setAttribute('sandbox', 'allow-scripts');
        wrap.appendChild(iframe);
        viewport.appendChild(wrap);
        mountedIframe = iframe;
      } else {
        var fill = document.createElement('div');
        fill.className = 'test-screen-media-fill';
        var node;
        if (resolved.type === 'image') {
          node = document.createElement('img');
          node.src = resolved.url;
          node.alt = 'Uploaded preview';
        } else {
          node = document.createElement('video');
          node.src = resolved.url;
          node.autoplay = true;
          node.muted = true;
          node.loop = true;
          node.playsInline = true;
        }
        fill.appendChild(node);
        viewport.appendChild(fill);
      }
      updateTestTalkEnabled();
    }

    function unmount() {
      viewport.innerHTML = '';
      mountedIframe = null;
      var paused = document.createElement('div');
      paused.className = 'test-screen-paused';
      paused.textContent = 'PAUSED';
      viewport.appendChild(paused);
      updateTestTalkEnabled();
    }

    function revokeUploadedUrls() {
      upload.objectUrls.forEach(function (u) { URL.revokeObjectURL(u); });
      upload.objectUrls = [];
    }

    screens.push({ radio: radio, mount: mount, unmount: unmount });
    setPlayable(!!resolveContent().url);
    if (viewFullBtn) viewFullBtn.disabled = !resolveContent().url;

    versionRadios.forEach(function (r) {
      if (r.value === currentVersion) r.checked = true;
      r.addEventListener('change', function () {
        if (!r.checked) return;
        currentVersion = r.value;
        if (radio.checked) mount();
        updateTestTalkEnabled();
      });
    });

    if (uploadFileBtn && fileInput) {
      uploadFileBtn.addEventListener('click', function () { fileInput.click(); });
      fileInput.addEventListener('change', function () {
        var file = fileInput.files[0];
        fileInput.value = '';
        if (!file) return;

        var type = detectType(file.name);
        if (!type) return;

        revokeUploadedUrls();
        var url = URL.createObjectURL(file);
        upload.objectUrls.push(url);
        upload.url = url;
        upload.type = type;
        upload.name = file.name;
        upload.kind = 'file';
        upload.mainFile = file.name;

        setPlayable(true);
        if (viewFullBtn) viewFullBtn.disabled = false;
        if (radio.checked) mount();
      });
    }

    if (uploadFolderBtn && folderInput) {
      uploadFolderBtn.addEventListener('click', function () { folderInput.click(); });
      folderInput.addEventListener('change', function () {
        var files = Array.prototype.slice.call(folderInput.files);
        folderInput.value = '';
        if (!files.length) return;

        var htmlFiles = files.filter(function (f) { return /\.html?$/i.test(f.name); });
        if (!htmlFiles.length) return;

        var mainFile = htmlFiles.find(function (f) { return f.name.toLowerCase() === 'index.html'; }) || htmlFiles[0];
        var topFolder = files[0].webkitRelativePath.split('/')[0];

        revokeUploadedUrls();
        var pathMap = {};
        files.forEach(function (f) {
          var rel = f.webkitRelativePath.split('/').slice(1).join('/');
          var url = URL.createObjectURL(f);
          upload.objectUrls.push(url);
          pathMap[rel] = url;
        });

        var mainRel = mainFile.webkitRelativePath.split('/').slice(1).join('/');

        var reader = new FileReader();
        reader.onload = function () {
          var html = reader.result;
          Object.keys(pathMap).forEach(function (rel) {
            if (rel === mainRel) return;
            var escaped = rel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            var re = new RegExp('(["\'])' + escaped + '\\1', 'g');
            html = html.replace(re, '$1' + pathMap[rel] + '$1');
          });

          var blob = new Blob([html], { type: 'text/html' });
          var blobUrl = URL.createObjectURL(blob);
          upload.objectUrls.push(blobUrl);
          upload.url = blobUrl;
          upload.type = 'html';

          setPlayable(true);
          if (viewFullBtn) viewFullBtn.disabled = false;
          if (radio.checked) mount();
        };
        reader.readAsText(mainFile);

        upload.name = topFolder;
        upload.kind = 'folder';
        upload.mainFile = mainRel;
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        revokeUploadedUrls();
        upload.url = null;
        upload.type = null;
        upload.name = null;
        upload.kind = null;
        upload.mainFile = null;

        var resolved = resolveContent();
        setPlayable(!!resolved.url);
        if (viewFullBtn) viewFullBtn.disabled = !resolved.url;

        if (radio.checked) {
          if (resolved.url) mount();
          else { radio.checked = false; unmount(); }
        }
      });
    }

    if (viewFullBtn) {
      viewFullBtn.addEventListener('click', function () {
        var resolved = resolveContent();
        if (resolved.url) window.open(resolved.url, '_blank');
      });
    }

    if (testTalkBtn) {
      testTalkBtn.addEventListener('click', function () {
        if (testTalkBtn.disabled || !mountedIframe) return;
        loadTalkBridge().then(function (mod) { mod.testTalk(mountedIframe, 6000); });
      });
    }

    if (getCommandsBtn) {
      getCommandsBtn.addEventListener('click', function () {
        if (!upload.name) {
          alert('Upload a file or folder to this screen first.');
          return;
        }

        var slug = sendToSelect ? sendToSelect.value : '';
        if (!slug) {
          alert('Choose a SEND TO target first.');
          return;
        }

        var srcField = upload.kind === 'folder' ? (upload.name + '/' + upload.mainFile) : upload.name;
        var type = detectType(upload.kind === 'folder' ? upload.mainFile : upload.name) || 'html';
        var sourceFolder = getSourceFolder();
        var timestamp = formatTimestamp(new Date());

        var commands = buildCommands(slug, upload.name, srcField, type, sourceFolder, timestamp);
        openCommandsModal(commands);
      });
    }
  }

  function initAll() {
    initSourceFolder();
    initModalClose();
    document.querySelectorAll('.test-screen').forEach(init);
    document.addEventListener('change', handlePlayChange);
  }

  document.addEventListener('DOMContentLoaded', initAll);

  window.TestScreenUploader = { init: init, initAll: initAll };
})();
