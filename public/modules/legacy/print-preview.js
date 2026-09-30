// ==================== Print Preview Studio (print-preview.html) ====================
// 4-step flow: upload artwork + pick product -> crop to the real print
// template -> live mockup preview -> order summary.
// Deliberately self-contained (pp- prefixed ids) so it can't collide with the
// print preview monitor logic already wired up in script.js on index.html.
document.addEventListener('DOMContentLoaded', function () {
  var steps = {
    1: document.getElementById('pp-step-1'),
    crop: document.getElementById('pp-step-crop'),
    2: document.getElementById('pp-step-2'),
    3: document.getElementById('pp-step-3')
  };
  if (!steps[1]) return; // not on this page

  var imageInput = document.getElementById('pp-image-input');
  var statusLight = document.getElementById('pp-status-light');
  var statusText = document.getElementById('pp-status-text');
  var fileNameDisplay = document.getElementById('pp-file-name');
  var disclaimerCheckbox = document.getElementById('pp-disclaimer');

  var btnStep1Next = document.getElementById('pp-step1-next');
  var btnCropBack = document.getElementById('pp-crop-back');
  var btnCropNext = document.getElementById('pp-crop-next');
  var btnStep2Back = document.getElementById('pp-step2-back');
  var btnStep2Next = document.getElementById('pp-step2-next');
  var btnStep3Back = document.getElementById('pp-step3-back');

  var mockupShell = document.getElementById('pp-mockup-shell');
  var mockupImg = document.getElementById('pp-preview-img');
  var variantLabel = document.getElementById('pp-variant-label');
  var summaryProduct = document.getElementById('pp-summary-product');
  var totalValue = document.querySelector('.pp-total-value');

  var fitCoverBtn = document.getElementById('pp-fit-cover');
  var fitContainBtn = document.getElementById('pp-fit-contain');
  var scaleSlider = document.getElementById('pp-scale-slider');
  var scaleValueLabel = document.getElementById('pp-scale-value');

  var cropFrame = document.getElementById('pp-crop-frame');
  var cropImg = document.getElementById('pp-crop-img');
  var cropGuides = document.getElementById('pp-crop-guides');
  var cropDimsLabel = document.getElementById('pp-crop-dims');
  var cropScaleSlider = document.getElementById('pp-crop-scale-slider');
  var cropScaleValueLabel = document.getElementById('pp-crop-scale-value');

  // Shared artwork-adjust state, applied to the mug/A4 <img> directly here
  // and broadcast so the 3D tee decal (a separate module) can match it.
  var artworkFit = 'cover';
  var artworkScale = 100;

  function applyArtworkAdjust() {
    mockupImg.style.transform = 'scale(' + (artworkScale / 100) + ')';
    mockupImg.classList.toggle('pp-fit-contain', artworkFit === 'contain');
    document.dispatchEvent(new CustomEvent('pp-artwork-adjust', {
      detail: { scale: artworkScale / 100, fit: artworkFit }
    }));
  }

  function resetArtworkAdjust(defaultFit) {
    artworkFit = defaultFit || 'cover';
    artworkScale = 100;
    scaleSlider.value = 100;
    scaleValueLabel.textContent = '100%';
    fitCoverBtn.classList.toggle('active', artworkFit === 'cover');
    fitContainBtn.classList.toggle('active', artworkFit === 'contain');
    applyArtworkAdjust();
  }

  scaleSlider.addEventListener('input', function () {
    artworkScale = +scaleSlider.value;
    scaleValueLabel.textContent = artworkScale + '%';
    applyArtworkAdjust();
  });

  fitCoverBtn.addEventListener('click', function () {
    artworkFit = 'cover';
    fitCoverBtn.classList.add('active');
    fitContainBtn.classList.remove('active');
    applyArtworkAdjust();
  });

  fitContainBtn.addEventListener('click', function () {
    artworkFit = 'contain';
    fitContainBtn.classList.add('active');
    fitCoverBtn.classList.remove('active');
    applyArtworkAdjust();
  });

  // Swap/extend this once real mockup artwork + real pricing exist.
  // defaultFit: mug wraps the whole print band by default (FILL_PRINT_AREA);
  // A4 and the tee are both printed to a fixed sheet size (A4 paper / A3
  // transfer paper) first, so showing the whole uploaded image by default
  // (FIT_WHOLE_IMAGE) matches how those actually get produced — the user
  // can still switch to FILL or zoom with the SIZE slider either way.
  //
  // cropPixels: the REAL pixel dimensions of the print-ready file for this
  // product, taken from the actual supplier templates:
  //  - mug: Mugsie's 11oz full-wrap template, 2330x1025px exactly. The
  //    printable sheet wraps the full 360 degrees of the mug — the front-
  //    facing view only shows the centre slice of it.
  //  - a4 / tshirt (A3 transfer paper): standard 300dpi print resolution
  //    for the paper size (A4 210x297mm, A3 297x420mm).
  // cropGuide: 'mug' shows the handle-zone guide lines from that template;
  // 'plain' is just a plain bordered frame.
  var PRODUCTS = {
    mug:    { label: 'NEON MUG',        summary: 'RETROWAVE MUG x1',   price: '£14.99', mode: 'pp-mug-mode',    defaultFit: 'cover',   cropPixels: { w: 2330, h: 1025 }, cropGuide: 'mug' },
    tshirt: { label: 'CYBER TEE',       summary: 'CYBER TEE x1',       price: '£19.99', mode: 'pp-tshirt-mode', defaultFit: 'contain', cropPixels: { w: 3508, h: 4961 }, cropGuide: 'plain' },
    a4:     { label: 'A4 MATRIX PRINT', summary: 'A4 MATRIX PRINT x1', price: '£9.99',  mode: 'pp-a4-mode',     defaultFit: 'contain', cropPixels: { w: 2480, h: 3508 }, cropGuide: 'plain' }
  };

  var rawImageDataUrl = null;      // original upload, unmodified
  var croppedImageDataUrl = null;  // after CONFIRM_CROP, at the real print pixel size
  var currentProduct = null;

  function goToStep(id) {
    Object.keys(steps).forEach(function (key) {
      steps[key].classList.remove('active');
    });
    steps[id].classList.add('active');
    window.scrollTo(0, 0);
  }

  function validateStepOne() {
    var ready = rawImageDataUrl !== null && disclaimerCheckbox.checked;
    if (ready) {
      btnStep1Next.removeAttribute('disabled');
    } else {
      btnStep1Next.setAttribute('disabled', 'true');
    }
  }

  imageInput.addEventListener('change', function (e) {
    var file = e.target.files && e.target.files[0];
    if (!file) {
      rawImageDataUrl = null;
      fileNameDisplay.textContent = 'NO_FILE_LOADED';
      statusLight.classList.remove('pp-status-green');
      statusText.textContent = 'READY_FOR_INPUT';
      validateStepOne();
      return;
    }

    fileNameDisplay.textContent = file.name.toUpperCase();

    var reader = new FileReader();
    reader.onload = function (event) {
      rawImageDataUrl = event.target.result;
      statusLight.classList.add('pp-status-green');
      statusText.textContent = 'DATA_LOADED_OK';
      validateStepOne();
    };
    reader.readAsDataURL(file);
  });

  disclaimerCheckbox.addEventListener('change', validateStepOne);

  // ==================== CROP-TO-TEMPLATE (step 2) ====================
  // Lets the user pan (drag) and zoom (slider) the raw upload within a
  // frame locked to the exact aspect ratio of the real print template,
  // then bakes that into a new image at the real print pixel dimensions.
  var cropScalePct = 100;   // 100 = image just covers the frame, no gaps
  var cropOffsetX = 0;      // pan offset in CSS px, relative to centred
  var cropOffsetY = 0;
  var cropImgNaturalW = 0;
  var cropImgNaturalH = 0;
  var cropBaseScale = 1;    // px-per-source-px at cropScalePct = 100

  function cropFrameSize() {
    var rect = cropFrame.getBoundingClientRect();
    return { w: rect.width, h: rect.height };
  }

  function clampCropOffsets() {
    var frame = cropFrameSize();
    var scale = cropBaseScale * (cropScalePct / 100);
    var dispW = cropImgNaturalW * scale;
    var dispH = cropImgNaturalH * scale;
    var maxX = Math.max(0, (dispW - frame.w) / 2);
    var maxY = Math.max(0, (dispH - frame.h) / 2);
    cropOffsetX = Math.min(maxX, Math.max(-maxX, cropOffsetX));
    cropOffsetY = Math.min(maxY, Math.max(-maxY, cropOffsetY));
  }

  function applyCropTransform() {
    var scale = cropBaseScale * (cropScalePct / 100);
    var dispW = cropImgNaturalW * scale;
    var dispH = cropImgNaturalH * scale;
    cropImg.style.width = dispW + 'px';
    cropImg.style.height = dispH + 'px';
    cropImg.style.transform =
      'translate(calc(-50% + ' + cropOffsetX + 'px), calc(-50% + ' + cropOffsetY + 'px))';
  }

  function buildCropGuides(product) {
    cropGuides.innerHTML = '';
    if (product.cropGuide !== 'mug') return;

    // Traced from Mugsie's real 11oz full-wrap template: the handle sits
    // across the far left/right edges once wrapped (they meet at the back
    // of the mug), so those zones are shaded out and the front-facing
    // centre is marked — same guide the supplier's own template shows.
    var leftPct = 15.84;
    var rightPct = 84.29;

    var leftZone = document.createElement('div');
    leftZone.className = 'pp-crop-guide-zone';
    leftZone.style.left = '0';
    leftZone.style.width = leftPct + '%';
    cropGuides.appendChild(leftZone);

    var rightZone = document.createElement('div');
    rightZone.className = 'pp-crop-guide-zone';
    rightZone.style.left = rightPct + '%';
    rightZone.style.right = '0';
    cropGuides.appendChild(rightZone);

    [leftPct, 50, rightPct].forEach(function (pct) {
      var line = document.createElement('div');
      line.className = 'pp-crop-guide-line';
      line.style.left = pct + '%';
      cropGuides.appendChild(line);
    });

    var label = document.createElement('div');
    label.className = 'pp-crop-guide-label';
    label.textContent = 'CENTRE = FRONT OF MUG · SHADED = BEHIND HANDLE';
    cropGuides.appendChild(label);
  }

  function setupCropStep(product) {
    cropFrame.style.aspectRatio = product.cropPixels.w + ' / ' + product.cropPixels.h;
    cropDimsLabel.textContent = 'PRINT_SIZE: ' + product.cropPixels.w + ' x ' + product.cropPixels.h + 'px';
    buildCropGuides(product);

    cropScalePct = 100;
    cropOffsetX = 0;
    cropOffsetY = 0;
    cropScaleSlider.value = 100;
    cropScaleValueLabel.textContent = '100%';

    cropImg.src = rawImageDataUrl;
    var ready = function () {
      cropImgNaturalW = cropImg.naturalWidth;
      cropImgNaturalH = cropImg.naturalHeight;
      var frame = cropFrameSize();
      cropBaseScale = Math.max(frame.w / cropImgNaturalW, frame.h / cropImgNaturalH);
      clampCropOffsets();
      applyCropTransform();
    };
    if (cropImg.complete && cropImg.naturalWidth > 0) {
      ready();
    } else {
      cropImg.addEventListener('load', ready, { once: true });
    }
  }

  cropScaleSlider.addEventListener('input', function () {
    cropScalePct = +cropScaleSlider.value;
    cropScaleValueLabel.textContent = cropScalePct + '%';
    clampCropOffsets();
    applyCropTransform();
  });

  // Drag-to-reposition, pointer events cover mouse + touch + pen in one.
  var dragging = false;
  var dragStartX = 0;
  var dragStartY = 0;
  var dragStartOffsetX = 0;
  var dragStartOffsetY = 0;

  cropFrame.addEventListener('pointerdown', function (e) {
    dragging = true;
    cropFrame.classList.add('pp-crop-dragging');
    cropFrame.setPointerCapture(e.pointerId);
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragStartOffsetX = cropOffsetX;
    dragStartOffsetY = cropOffsetY;
  });

  cropFrame.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    cropOffsetX = dragStartOffsetX + (e.clientX - dragStartX);
    cropOffsetY = dragStartOffsetY + (e.clientY - dragStartY);
    clampCropOffsets();
    applyCropTransform();
  });

  function endDrag() {
    dragging = false;
    cropFrame.classList.remove('pp-crop-dragging');
  }
  cropFrame.addEventListener('pointerup', endDrag);
  cropFrame.addEventListener('pointercancel', endDrag);

  // Bakes the current pan/zoom into a real image at the product's actual
  // print pixel dimensions — this is the file that would go to the printer.
  function renderCroppedImage(product) {
    var targetW = product.cropPixels.w;
    var targetH = product.cropPixels.h;
    var frame = cropFrameSize();
    var exportScale = targetW / frame.w; // uniform since aspect ratios match

    var scale = cropBaseScale * (cropScalePct / 100);
    var dispW = cropImgNaturalW * scale;
    var dispH = cropImgNaturalH * scale;

    var drawW = dispW * exportScale;
    var drawH = dispH * exportScale;
    var drawX = targetW / 2 - drawW / 2 + cropOffsetX * exportScale;
    var drawY = targetH / 2 - drawH / 2 + cropOffsetY * exportScale;

    var canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    var ctx = canvas.getContext('2d');
    ctx.drawImage(cropImg, drawX, drawY, drawW, drawH);
    return canvas.toDataURL('image/jpeg', 0.92);
  }

  btnStep1Next.addEventListener('click', function () {
    if (!rawImageDataUrl) return;

    var choice = document.querySelector('input[name="pp-product"]:checked').value;
    currentProduct = PRODUCTS[choice];

    setupCropStep(currentProduct);
    goToStep('crop');
  });

  btnCropBack.addEventListener('click', function () { goToStep(1); });

  btnCropNext.addEventListener('click', function () {
    croppedImageDataUrl = renderCroppedImage(currentProduct);
    mockupImg.src = croppedImageDataUrl;

    mockupShell.className = 'pp-mockup-canvas ' + currentProduct.mode;
    variantLabel.textContent = 'TARGET: ' + currentProduct.label;
    summaryProduct.textContent = currentProduct.summary;
    totalValue.textContent = currentProduct.price;
    resetArtworkAdjust(currentProduct.defaultFit);

    goToStep(2);
  });

  btnStep2Back.addEventListener('click', function () { goToStep('crop'); });
  btnStep2Next.addEventListener('click', function () {
    registerPrintJob();
    goToStep(3);
  });
  btnStep3Back.addEventListener('click', function () { goToStep(2); });

  // ==================== Motion tracker (order summary) ====================
  // Aliens-style motion-tracker widget: each confirmed order this session
  // counts as a "job". 1-3 jobs get their own dot; anything past that just
  // shows a busy swarm rather than literally one dot per job. Dots fade in
  // and out and reappear at a new random spot each cycle, like a radar blip.
  var TRACKER_STORAGE_KEY = 'ppPrintJobCount';
  var trackerDotsEl = document.getElementById('pp-tracker-dots');
  var trackerCountEl = document.getElementById('pp-tracker-count');
  var trackerStatusEl = document.getElementById('pp-tracker-status');
  var trackerRepositionTimers = [];

  function getJobCount() {
    var raw = window.localStorage ? localStorage.getItem(TRACKER_STORAGE_KEY) : null;
    var n = parseInt(raw, 10);
    return isNaN(n) ? 0 : n;
  }

  function setJobCount(n) {
    if (window.localStorage) {
      try { localStorage.setItem(TRACKER_STORAGE_KEY, String(n)); } catch (e) { /* ignore quota errors */ }
    }
  }

  function randomBlipPosition() {
    // Constrained to roughly the visible radar sector so blips don't sit
    // right in the corners the semicircle clip already hides.
    var left = 12 + Math.random() * 76;  // 12% - 88%
    var top = 20 + Math.random() * 72;   // 20% - 92%
    return { left: left, top: top };
  }

  function renderTracker() {
    trackerRepositionTimers.forEach(function (t) { clearInterval(t); });
    trackerRepositionTimers = [];
    trackerDotsEl.innerHTML = '';

    var count = getJobCount();
    trackerCountEl.textContent = (count < 10 ? '0' : '') + count;
    trackerStatusEl.textContent = count > 0
      ? 'YOUR PRINT JOBS ARE MOVING ALL OVER THE PLACE'
      : 'NO_ACTIVE_JOBS';

    if (count <= 0) return;

    // 1-3 jobs = that many dots; anything above just reads as "a lot".
    var dotCount = count <= 3 ? count : 8;

    for (var i = 0; i < dotCount; i++) {
      (function () {
        var dot = document.createElement('div');
        dot.className = 'pp-tracker-dot';
        var pos = randomBlipPosition();
        dot.style.left = pos.left + '%';
        dot.style.top = pos.top + '%';
        dot.style.animationDelay = (Math.random() * 2.5) + 's';
        trackerDotsEl.appendChild(dot);

        // Every few seconds, jump this dot to a new random spot — the
        // "fade and reappear elsewhere" behaviour.
        var timer = setInterval(function () {
          var next = randomBlipPosition();
          dot.style.left = next.left + '%';
          dot.style.top = next.top + '%';
        }, 2800 + Math.random() * 1400);
        trackerRepositionTimers.push(timer);
      })();
    }
  }

  function registerPrintJob() {
    setJobCount(getJobCount() + 1);
    renderTracker();
  }

  renderTracker();
});
