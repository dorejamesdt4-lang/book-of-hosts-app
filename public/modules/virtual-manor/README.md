# Virtual Manor — standalone foundation

Entry: `public/modules/virtual-manor/index.html`. Run `npm start` from the repo and open `/modules/virtual-manor/`. The dashboard only navigates to this page; it does not import the engine. All renderer dependencies and runtime images are local. No service worker, account service or external graphics API is required.

## Honest status

The fixed seven-room ground floor is implemented as real 3D meshes. It has first-person movement, architectural/furniture collision, desktop and multi-pointer touch input, inspection anchors, camera settings, pause/restart and cleanup. The preferred renderer is WebGL2/Three.js. Browsers without WebGL2 get an explicitly labelled software geometry preview. That preview lacks the GPU lighting, shadows and perspective-correct textured rasterisation; it is not a performance fallback for normal phones.

This build does **not** yet match the approved concept image exactly. Decorative props are simple authored geometry, one generated portrait is reused, the garden/secondary rooms are less detailed, and no baked lighting or room-streaming pipeline exists yet. Phone GPU performance and real-device multi-touch still need validation. Mystery sessions, multiplayer avatars and in-world narrator playback are not implemented. Existing Theatre is reachable through an inspection anchor, not embedded playback.

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
