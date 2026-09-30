// ==================== T-shirt 3D preview (print-preview.html) ====================
// Renders the real shirt_baked.glb model with the uploaded design projected onto
// its front panel as a decal, so the tee mockup shows actual fabric folds and
// lighting instead of a flat placeholder shape. Mug and A4 modes are untouched —
// this only activates while .pp-tshirt-mode is the active product.
//
// NOTE FOR JAMES: the decal POSITION/SIZE constants below were calculated from
// the model's real vertex bounding box (not eyeballed), but this file could not
// be rendered/screenshotted before handing it over — there was no way to load
// Three.js in the sandbox this was built in. If the print sits a little too high/
// low/wide on the shirt once you see it live, nudge DECAL_POSITION / DECAL_SIZE
// below (each value is in the model's own units — small changes, e.g. 0.02-0.05,
// go a long way) and ask Claude Code to re-save. Everything else in this file
// should not need touching.

import * as THREE from 'three';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
import { DecalGeometry } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/geometries/DecalGeometry.js';

// Where on the shirt the design sits, and how big it is, in the model's own
// local units (measured from shirt_baked.glb's vertex bounds: roughly
// x -0.28..0.27, y -0.35..0.26, z -0.12..0.14 — z+ is the front of the shirt).
//
// Sized to A3 paper (297mm x 420mm, ratio 1:1.4142) since that's what gets
// printed and heat-pressed on — width kept at the previously-tested 0.34,
// height recalculated to true A3 ratio (was a slightly-off placeholder
// ratio before). This size/position lines up with the "oversize full-front"
// placement convention real transfer shops use: roughly 11-12in wide by
// 14-16in tall, starting about 3in below the collar — A3 (11.7in x 16.5in)
// sits right in that range.
const DECAL_POSITION = new THREE.Vector3(0, -0.03, 0.08);
const DECAL_SIZE = new THREE.Vector3(0.34, 0.34 * (420 / 297), 0.3);
const MODEL_URL = 'mockups/shirt_baked.glb';

function init() {
  const canvas = document.getElementById('pp-tshirt-canvas');
  const shell = document.getElementById('pp-mockup-shell');
  const previewImg = document.getElementById('pp-preview-img');
  const loadingEl = document.getElementById('pp-tshirt-loading');
  if (!canvas || !shell || !previewImg) return; // not on this page

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(25, 1, 0.1, 10);
  camera.position.set(0, -0.02, 2);

  scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  const key = new THREE.DirectionalLight(0xffffff, 0.9);
  key.position.set(1, 1.2, 2);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.35);
  fill.position.set(-1.2, 0.4, 1);
  scene.add(fill);

  let shirtMesh = null;
  let decalMesh = null;
  let lastTextureSrc = null;

  // Artwork fit/size, kept in sync with the FIT/SIZE controls in
  // print-preview.js (those apply directly to the mug/A4 <img>; this
  // module gets the same values via a custom event since the decal
  // texture has to be redrawn on a canvas instead). Starts on 'contain'
  // to match the tee's default (FIT_WHOLE_IMAGE) — the print-preview.js
  // reset event normally arrives first and overrides this anyway.
  let artworkFit = 'contain';
  let artworkScale = 1;
  document.addEventListener('pp-artwork-adjust', (e) => {
    artworkFit = e.detail.fit;
    artworkScale = e.detail.scale;
    if (shirtMesh && previewImg.complete && previewImg.naturalWidth > 0) {
      applyDecal(previewImg);
    }
  });

  function sizeToShell() {
    const rect = shell.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  sizeToShell();
  if (window.ResizeObserver) {
    new ResizeObserver(sizeToShell).observe(shell);
  } else {
    window.addEventListener('resize', sizeToShell);
  }

  // Fit the uploaded image onto a transparent canvas matching the decal's own
  // aspect ratio ("contain" behaviour) so it isn't stretched or cropped oddly
  // when projected onto the shirt.
  function buildDecalTexture(imgEl) {
    const targetW = 512;
    const targetH = Math.round(targetW * (DECAL_SIZE.y / DECAL_SIZE.x));
    const c = document.createElement('canvas');
    c.width = targetW;
    c.height = targetH;
    const ctx = c.getContext('2d');
    // FILL_PRINT_AREA (cover) crops the design to fill the print area edge
    // to edge; FIT_WHOLE_IMAGE (contain) shows the whole thing centred —
    // what a small logo PNG needs so it isn't stretched or cropped. The
    // user's manual zoom (artworkScale) multiplies on top of either.
    // drawImage beyond the canvas is clipped automatically, so zooming in
    // under "cover" just crops further — no extra bounds-checking needed.
    const baseScale = artworkFit === 'contain'
      ? Math.min(targetW / imgEl.naturalWidth, targetH / imgEl.naturalHeight)
      : Math.max(targetW / imgEl.naturalWidth, targetH / imgEl.naturalHeight);
    const scale = baseScale * artworkScale;
    const w = imgEl.naturalWidth * scale;
    const h = imgEl.naturalHeight * scale;
    ctx.clearRect(0, 0, targetW, targetH);
    // White fill behind the artwork — we only stock white tees, so any
    // area the design doesn't cover (shrunk via SIZE, or FIT_WHOLE_IMAGE
    // with a non-matching aspect) should read as white fabric, not show
    // through to whatever's rendered behind the canvas.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.drawImage(imgEl, (targetW - w) / 2, (targetH - h) / 2, w, h);
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }

  function applyDecal(imgEl) {
    if (!shirtMesh) return;
    if (decalMesh) {
      scene.remove(decalMesh);
      decalMesh.geometry.dispose();
      decalMesh.material.map && decalMesh.material.map.dispose();
      decalMesh.material.dispose();
      decalMesh = null;
    }

    const texture = buildDecalTexture(imgEl);
    const geometry = new DecalGeometry(shirtMesh, DECAL_POSITION, new THREE.Euler(0, 0, 0), DECAL_SIZE);
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      roughness: 1,
    });
    decalMesh = new THREE.Mesh(geometry, material);
    scene.add(decalMesh);
    lastTextureSrc = imgEl.src;
  }

  function syncDecal() {
    if (!previewImg.src || previewImg.src === lastTextureSrc) return;
    if (!previewImg.complete || previewImg.naturalWidth === 0) {
      previewImg.addEventListener('load', syncDecal, { once: true });
      return;
    }
    applyDecal(previewImg);
  }

  new MutationObserver(syncDecal).observe(previewImg, { attributes: true, attributeFilter: ['src'] });

  new GLTFLoader().load(
    MODEL_URL,
    (gltf) => {
      const root = gltf.scene;
      root.traverse((child) => {
        if (child.isMesh && !shirtMesh) {
          shirtMesh = child;
          shirtMesh.material = shirtMesh.material.clone();
          shirtMesh.material.color = new THREE.Color('#ffffff');
          shirtMesh.material.roughness = 1;
        }
      });
      scene.add(root);
      if (loadingEl) loadingEl.style.display = 'none';
      syncDecal();
    },
    undefined,
    (err) => {
      if (loadingEl) loadingEl.textContent = 'MODEL_LOAD_FAILED';
      console.error('Shirt model failed to load:', err);
    }
  );

  (function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  })();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
