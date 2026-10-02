# Virtual Manor — standalone foundation

Entry: `public/modules/virtual-manor/index.html`. Run `npm start` from the repo and open `/modules/virtual-manor/`. The dashboard only navigates to this page; it does not import the engine. All renderer dependencies and runtime images are local. No service worker, account service or external graphics API is required.

## Honest status

The fixed seven-room ground floor is implemented as real 3D meshes. It has first-person movement, architectural/furniture collision, desktop and multi-pointer touch input, inspection anchors, camera settings, pause/restart and cleanup. The preferred renderer is WebGL2/Three.js. Browsers without WebGL2 get an explicitly labelled software geometry preview. That preview uses a depth buffer and perspective-correct texture sampling but lacks GPU lighting and shadows; it is not a performance fallback for normal phones.

This build does **not** yet match the approved concept image exactly. Decorative props are simple authored geometry, two original paintings are reused, the garden/secondary rooms are less detailed, and no baked lighting or room-streaming pipeline exists yet. Phone GPU performance and real-device multi-touch still need validation. Mystery sessions, multiplayer avatars and in-world narrator playback are not implemented. Existing Theatre is reachable through an inspection anchor, not embedded playback.

## Module boundaries

- `engine/layout.js`: verified original room bounds, explicitly new fixed portal positions.
- `engine/geometry.js`: merge static geometry by material; own resource lifecycle.
- `engine/world.js`, `props.js`: mansion-specific authored structures and interaction data.
- `engine/materials.js`: original procedural materials and local source-derived maps.
- `engine/collision.js`: substepped circle/AABB movement; no traversal through walls.
- `engine/input.js`: movement/look, pointer capture, cancellation, blur/visibility pause.
- `engine/runtime.js`: scene/camera, WebGL renderer, bounded lights, quality tiers and teardown.
- `engine/compatibility.js`: honest no-WebGL geometry preview.
- `main.js`: UI adapter. Game rules belong in a separate adapter, not the renderer.
- `assets/catalog.json`: source hashes and runtime modifications.
- `design/`: visual brief and original room extraction provenance.

`createManor(canvas, ui, callbacks, options)` returns `start`, `pause`, `restart`, `settings`, `inspect`, `setInteractions`, `diagnostics`, and `dispose`. Interaction data provides `id`, world `position`, `kind`, `title`, `text`, and optional relative `href`. A future game adapter should replace/set interaction data and observe room/scene events. Do not let client-side visible props contain private mystery solutions.

## First test

1. Enter on a WebGL2 desktop browser: walk, look, Shift, inspect hall letter, pause, settings, restart.
2. Walk every portal both ways; pass around tables/fountain and try moving against walls/furniture.
3. Inspect library desk and the dining table's Theatre link; return to Dashboard.
4. On a physical phone, test simultaneous joystick + look, button taps, orientation changes, safe areas, notifications/backgrounding, touch cancel and resume. Record model/browser and real FPS.
5. Disconnect a material file in a local test build: recovery must offer Reload and Dashboard. Simulate WebGL context loss on a local debug harness; it must pause and recover through reload.
6. Check device quality changes and saved camera settings. Validate smoothness, memory and thermal behaviour during a 10-minute walk. No phone performance claim before this check.

Use `?debug` for read-only `window.manorDiagnostics()` in your own test environment. It reports only camera location and renderer metrics. Automated Node checks validate fixed-room connectivity and collision; they do not certify GPU rendering or phone controls.

## Sources and licences

Three.js 0.180.0, MIT; vendor licence retained. Plaster and terracotta maps are derived from the actual Poly Haven source masters in James's Nightmare Engine repo, CC0; exact source paths/commit/hash/modifications in the catalogue. Originals are left intact. The OBJ review pack was inspected but excluded because its pack identity/provenance was not established.

`assets/portrait.webp`: original generated fictional Victorian portrait, 1 October 2026. Built-in image generation; prompt: original Victorian oil painting, fictional adult woman in black/emerald high-neck dress, warm dark umber backdrop, head/shoulders/hands, aged canvas, full bleed with no frame/text or famous likeness. Source saved in the session's generated-images output; runtime copy resized to 683×1024 WebP. Other material maps are deterministic original canvas textures, not copied game assets.

The concept board remains a visual target. Its pixel appearance is not presented as a screenshot of this implementation.

World injection: options.buildWorld(materials), options.spawn, options.roomAt(x,z). Room changes call callbacks.room({id,name}); setInteractions validates unique IDs and finite 3D anchors before replacement.

Visual refinement (1 October): bevelled cabinet tops/drawers and turned brass lamp profiles; original landscape oil painting in hall/dining frames; one low-resolution hall reflection capture for GPU material response. Reflection capture and lighting calibration remain unverified on GPU. The software preview now depth-tests surfaces and samples textures in perspective; it remains a diagnostic preview. Generated landscape asset: `assets/landscape.webp`, 1024×683 WebP; built-in image generation. Prompt: fictional English manor beyond a stone bridge and river, oaks and misty dusk; aged traditional oil paint in umber/forest green/ivory; full-bleed horizontal artwork, no frame/text/signature. Full asset provenance and prompts are in `assets/catalog.json`.

Further corridor pass: the tiled placeholder carpet is replaced with a continuous original Persian runner texture; brass hanging lanterns are real merged geometry; the conservatory has a fixed iron fan arch visible down the gallery. The diagnostic software preview can now show the far conservatory geometry. `assets/runner.webp` is an original built-in generated textile scan, resized to 512×1536 WebP; full prompt/hash in the asset catalogue. All 29 tests pass; exact reference fidelity and physical-phone GPU verification are still open.


## Texture and entrance pass — 1 October 2026

Continued from 20d833f following James's request to replace placeholder-looking surfaces and approach the approved mockup.

- Added original 1024px walnut, emerald/gold damask and ivory marble WebP textures. Exact prompts, byte counts and hashes are in the asset catalogue. Retained the reviewed source plaster and terracotta maps.
- Walnut relief/roughness are modest luminance-derived artistic approximations; these are not scanned PBR maps. Wall UVs now use metre-based scale; horizontal wood members turn the grain. Secondary-room floorboards use the new walnut texture.
- Pale marble floor with dark corner insets replaces the hall checkerboard; gallery shares the stone border around its runner. The hall runner is removed to match the entrance composition.
- Substantial layered walnut portal, emerald inset strips, deeper picture frames, coffer rails and turned console legs. Furniture and starting viewpoint moved nearer the gallery to frame the entrance. Seven original room bounds/portals remain intact.
- Recalibrated daylight, exposure and reflection intensity after inspecting actual WebGL output. Balanced/high add four bounded, non-shadowed fixed gallery lights; low omits these. Soft contact decals beneath plants/chairs/consoles are stylised contact shading, not baked AO.
- WebGL2 successfully rendered in local headless Chromium using ANGLE SwiftShader. This exercises the WebGL shader pipeline with CPU software execution; it is NOT hardware GPU or phone performance verification. Actual capture is recorded in the repository handover. Mobile-size capture uses low graphics and touch controls; it is not a physical-phone test.
- Scene measurement: 27 draw calls, 104,858 triangles. Increased material-mesh cap from 25 to 27 for stone, parquet and contact shading; retained the existing 120k triangle limit. All 29 regression tests and static build pass.
- Remaining gap: props/foliage are still simplified, repeated art is visible, no true baked AO/indirect lighting, and conservatory/garden detail still needs development. Do not call this a pixel-identical or finished reproduction of the concept. Next art pass should target furniture silhouettes/carving, varied foliage, and a richer glazed garden vista.


## Astra finishing pass — 2 October 2026

Shield-back upholstered chairs, rolled-arm sofa cushions, folded broadleaf/fern foliage, dining place settings and conservatory iron braces/potting bench refine the existing scene. Chair parts and footprints rotate together. The selected floor, seven-room layout and gallery clearances are preserved. Full geometry measures 113,508 triangles across 27 merged material meshes; the 120k/27 limits remain unchanged.

Five labelled software diagnostics are recorded in `docs/visuals/astra-polish-*.jpg`; reproduce with `node scripts/manor-software-review.mjs --polish` with `sharp` installed (or set `CODEX_PRIMARY_RUNTIME_NODE_MODULES`). These are mesh/texture evidence, not WebGL lighting or phone-performance acceptance. Contact gradients and stroked parquet seams are omitted. Cache version: `manor-11`; 31 tests and static build pass. The exact concept match and physical-device checks remain open.
