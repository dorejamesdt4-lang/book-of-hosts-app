# Virtual Manor — handover

Updated: 2 October 2026 (Europe/London). Owner: James Dore.

## Immediate next task — James's screenshot snag review

Recorded: 1 October 2026, 12:49 Europe/London. James is restarting his PC and will upload a repository folder named `SREENSHOTS FOR AI REVEIEW` (retain his spelling). It will contain screenshots of problems and a README explaining what needs fixing. This snag review takes priority over the general art backlog below.

Status: uploaded folder `screenshots for ai reveiew` and its `readme.txt` reviewed on 1 October 2026. Both images inspected. See the screenshot snag update below; code changes await rendered visual confirmation.

Resume procedure:
1. Fetch the latest `main` from `dorejamesdt4-lang/book-of-hosts-app`. Locate the uploaded folder; if its final name differs, find the matching screenshot-review folder without renaming James's files.
2. Read James's README FIRST and use it to interpret each screenshot. Inspect the actual images and any accompanying notes before editing.
3. Record a numbered snag list linking each report to its screenshot, affected room/page and relevant source files. Preserve James's priorities; distinguish confirmed defects from issues needing reproduction.
4. Reproduce and fix the reported problems, preserving the approved Storybook × Arcane Oracle mansion direction, fixed room layout and existing dashboard/Ruby/narrator features. Use a focused branch for code changes.
5. Verify each fix in the running scene, capture real before/after evidence where useful, and run checks appropriate to the changed behaviour. Keep hardware/phone performance claims separate from SwiftShader rendering checks.
6. Update this handover with each snag's status, changes, test evidence, unresolved items and commit/PR links. Do not mark an item complete solely because code was edited.

Current baseline: graphics PR #1 merged into `main`, merge commit `75eefcc8a878b71851a92353f2d4c89c876e3459`. The texture pass has 29 passing tests and a successful static build, but those checks do not establish that James's newly reported problems are resolved. Actual captures are in `docs/visuals/`; details and limitations remain recorded below.

Do not create an empty review folder or substitute placeholder screenshots. Wait for James's actual README and evidence if they are not present when work resumes.

## Current phase
James approved building from the visual on 1 October 2026 and explicitly requires honesty and a close visual match. The first playable isolated foundation is implemented. The concept image remains a target: the current scene does not yet match it exactly. Do not claim perfection, completed art or tested phone GPU performance.

## Locked requirements
- Build in dorejamesdt4-lang/book-of-hosts-app.
- Source textures and useful assets from James's repository described as "project nighmare engine"; resolve exact repository URL before importing assets. Do not claim asset reuse until files are inspected.
- Similar layout to the original Dore Trading mansion. Remove the time machine and twisting/shifting corridors; stable rooms and doors.
- Major graphics upgrade: tactile, detailed mystery interiors inspired by the material quality and atmosphere of The Room, with original designs and first-person movement/camera.
- Playable on phones. Landscape touch controls: left movement stick, right drag-to-look, context interaction, pause. Desktop keyboard/mouse equivalent. Camera sensitivity and reduced motion options.
- Storybook + Arcane Oracle brand: warm parchment, restrained gold, emerald accents around a readable 3D mystery world.
- Keep world in its own folder. Proposed boundary: public/modules/virtual-manor/; renderer, assets, rooms, controls and adapters belong there.
- Independent page/runtime; main dashboard must not import/start the renderer. Renderer/asset failures must leave normal app routes usable, with a Back to Dashboard action in the manor.
- Reusable template for future games: room data, assets and interactions separated from engine and game rules; explicit module interface to existing theatre/narrator and mystery functions.

## Existing app baseline
Narrator Package generation and playback are implemented: Magician bm_fable, female Jester bf_emma; script and clips in one ZIP; progress/cancel/checkpoint reuse. 24 tests passed on the previous implementation. Live server hosting is still deferred. Preserve these features.

## Resume steps
1. Inspect exact Nightmare Engine repository and asset licence/provenance, original Dore Trading room graph, source branch and commit IDs.
2. Produce visual preview for review; document which original rooms and links were actually verified versus proposed.
3. Once James chooses the design, build one detailed playable room plus adjoining passage first, validate real phones, then expand the fixed mansion graph.
4. Measure load time, GPU/frame time, memory and touch usability on named test devices. Initial goal 30fps on a representative midrange phone; not a guarantee.
5. Use compressed textures, baked lighting, limited dynamic lights, room-based loading/visibility and device quality tiers. Set budgets from measurements, not concept-art appearance.
6. Verify collision, doors, resize/orientation, pause, context loss, missing assets, recovery and independence of the rest of the app before release.

## Open items
Resolved by James: source archive repo https://github.com/doretradinguk-cyber/book-of-hosts-web-app at 87a064f53468523ece53de89452201fe88ba5975; asset/engine repo https://github.com/doretradinguk-cyber/project-nightmare-game-engine at c9de735b655c53ab8509e6ffd713e44115dab44b.

Original layout verified inside dore-trading-main.zip → manor-lab/manor-engine.js, not the separate Panda3D horror layout. Extracted seven actual rooms to public/modules/virtual-manor/design/original-room-bounds.json. Entrance Hall, Long Gallery, Drawing Room, Library, Dining Room, Conservatory, Garden. Doorway graph/colliders still require extraction. Archive SHA-256 is recorded in that JSON.

Nightmare source packs include damaged plaster, plastered wall, rock wall, terracotta tiles, metal and concrete. These ZIPs are Git LFS pointers in the git tree: damaged_plaster master alone is 77,255,657 bytes. Plaster and terracotta binary source packs have now been downloaded through Git LFS; runtime diffuse and bump textures derived and provenance recorded in assets/catalog.json. Source masters remain intact. 16-bit displacement was converted to linear 8-bit rather than clipped. The OBJ REVIEW pack was unpacked and inspected (chairs, desks, sofas, bookcases), but not shipped because its exact pack identity/provenance is still unverified. ASSET-LICENSES.md and source texture README inspected. Existing three-runtime.js contains malformed movement/initial-exit code and mobile third-person follow behaviour; do not import it wholesale. Existing source handover includes superseded sections: inspect actual code rather than trusting old completion claims.

The Nightmare project's procedural horror, twisting corridors and horror entities are not requirements for Book of Hosts. James's fixed original mansion and first-person camera requirements take precedence. Use reviewed assets and suitable concepts, keep game rules separate. Do not copy source dev consoles, admin pages, time-machine/wing bundles into public gameplay.

## Visual review and planned implementation
- Preview requested now: original Victorian mystery mansion, tactile walnut/aged brass/plaster/marble, readable warm lamps and cool garden light; parchment/gold/emerald HUD.
- Concept visual is generated design direction, not a render from source textures. Do not promise it is achievable at that fidelity on every phone.
- Source layout preserved; Bar/Games Room and Theatre are proposed later extensions and must be called proposals if shown, not claimed as verified original rooms.
- First playable milestone after visual review: Entrance Hall with the beginning of Long Gallery; first-person controls on both desktop and phone. No scope expansion until measured usability and material quality are accepted.
- Future reusable room definitions, material registry, collision, interactions, camera/input, quality profiles and game adapters each get separate modules.
- A folder alone is not crash isolation: use a separately navigated runtime with no eager dashboard imports, handle failed imports/assets/WebGL loss locally, stop animation/audio and dispose textures/geometries/listeners on exit. Maintain a non-WebGL recovery screen. Avoid a global service worker changing app caches.
- James has approved building. Continue from the current engine; do not restart or replace the approved visual target with an unrelated style.

## Current build milestone — 1 October 2026
- Entry public/modules/virtual-manor/index.html; first-person ground-floor exploration of seven rooms.
- Self-hosted Three.js 0.180.0/MIT, authored batched architecture, source-derived plaster/tile maps and original portrait. No CDN import at runtime.
- 24 merged material meshes, within the 120k triangle test budget; furniture and wall colliders; a furnished-room reachability test prevents blocked portals.
- Desktop mouse/WASD and separate multi-pointer touch movement/look; camera settings, pause, restart and blur/visibility handling.
- Three inspection anchors; existing Theatre is linked, not rendered within this world. No mystery multiplayer/avatar system is claimed.
- Runtime provides injectable world factory/spawn/room resolver, interaction replacement and room callback for future game adapters.
- Load/import/context-loss errors are contained within the separate page; no shared service worker or eager dashboard renderer import.
- The test cloud browser reports GL_VENDOR=Disabled and cannot create WebGL2. Therefore GPU lighting/shadow rendering and physical phone performance remain UNVERIFIED.
- Added explicitly labelled software geometry preview of the same meshes; it lacks GPU lighting/shadows and is not the intended phone renderer.
- Automated checks: 29 passing after collision/furniture audit. Keep FIRST-TEST checks in the module README.

## Work still needed for the approved visual
Detailed furniture/landscape art, more varied portraits, decorative modelling, proper UVs on larger architectural surfaces, realistic material calibration, baked lighting/ambient occlusion, conservatory/garden polish and actual GPU screenshot comparison. The current simple authored props are foundation placeholders, not a pixel-identical delivery of the concept.

## General continuation (after the screenshot snags)
The immediate screenshot-review task above takes priority. Read module README and this handover; check deployed main and renderer mode. Continue checking actual rendered scene, fix any control/lifecycle issues, test actual WebGL2 desktop and physical phones, then improve the visual against the approved board. Do not replace a real scene screenshot with the concept image as proof. Keep updates concrete and preserve existing Ruby/narrator/live features.

Browser UI checks in software preview: load reaches 100%, enter/pause/resume work, on-screen controls can be enabled and camera drag changes the actual mesh view. Initial check found reversed look/strafe directions; corrected and a camera-vector test added. Software preview is slow on the cloud browser and must not be advertised as phone playback performance. Final GPU visual comparison remains blocked by that browser's disabled WebGL.

## Continuation after James said “go”
Cabinet top/base/drawer bevels and turned lamp profiles added; original landscape art replaces several repeated portraits. GPU renderer now captures a low-resolution hall cubemap at load for brass/marble reflections and uses reduced ambient intensity. GPU appearance remains unverified. Software preview uses a per-pixel depth buffer and perspective-correct UVs; a regression test checks surface visibility after object transforms and reversed mesh insertion order. This refinement does not close the exact concept-match or physical-phone testing requirements.

Further corridor pass: the tiled placeholder carpet is replaced with a continuous original Persian runner texture; brass hanging lanterns are real merged geometry; the conservatory has a fixed iron fan arch visible down the gallery. The diagnostic software preview can now show the far conservatory geometry. `assets/runner.webp` is an original built-in generated textile scan, resized to 512×1536 WebP; full prompt/hash in the asset catalogue. All 29 tests pass; exact reference fidelity and physical-phone GPU verification are still open.


## Texture and entrance pass — 1 October 2026

Continued from 20d833f following James's request to replace placeholder-looking surfaces and approach the approved mockup.

- Added original 1024px walnut, emerald/gold damask and ivory marble WebP textures. Exact prompts, byte counts and hashes are in the asset catalogue. Retained the reviewed source plaster and terracotta maps.
- Walnut relief/roughness are modest luminance-derived artistic approximations; these are not scanned PBR maps. Wall UVs now use metre-based scale; horizontal wood members turn the grain. Secondary-room floorboards use the new walnut texture.
- Pale marble floor with dark corner insets replaces the hall checkerboard; gallery shares the stone border around its runner. The hall runner is removed to match the entrance composition.
- Substantial layered walnut portal, emerald inset strips, deeper picture frames, coffer rails and turned console legs. Furniture and starting viewpoint moved nearer the gallery to frame the entrance. Seven original room bounds/portals remain intact.
- Recalibrated daylight, exposure and reflection intensity after inspecting actual WebGL output. Balanced/high add four bounded, non-shadowed fixed gallery lights; low omits these. Soft contact decals beneath plants/chairs/consoles are stylised contact shading, not baked AO.
- WebGL2 successfully rendered in local headless Chromium using ANGLE SwiftShader. This exercises the WebGL shader pipeline with CPU software execution; it is NOT hardware GPU or phone performance verification. Actual capture: docs/visuals/manor-texture-pass-desktop.png. Mobile-size capture uses low graphics and touch controls; it is not a physical-phone test.
- Scene measurement: 27 draw calls, 104,858 triangles. Increased material-mesh cap from 25 to 27 for stone, parquet and contact shading; retained the existing 120k triangle limit. All 29 regression tests and static build pass.
- Remaining gap: props/foliage are still simplified, repeated art is visible, no true baked AO/indirect lighting, and conservatory/garden detail still needs development. Do not call this a pixel-identical or finished reproduction of the concept. Next art pass should target furniture silhouettes/carving, varied foliage, and a richer glazed garden vista.


## Screenshot snag update — 1 October 2026

Branch: `fix/manor-screenshot-snags`.

1. `screenshots for ai reveiew/Screenshot (1379).png`: Long Gallery picture overlaps doorway/trim. `engine/world.js` previously placed pictures at z=20.2 and 30.6, overlapping gallery portals at 18–20.4 and 29–31.4. Pictures now occupy z=15,22,25.4,33 on both walls, preserving the original lamp/plant locations and doorway graph. Full frame width including bevel clears the portal's outer trim. Code corrected; rendered verification pending.
2. `screenshots for ai reveiew/Screenshot (1380).png`: floor pattern/black diamond issue beside the gallery runner; James also reports hall symmetry. `engine/materials.js` added the diamond pattern in canvas code. Removed the generated diamonds and grout grid; hall and gallery now use the existing plain marble map. This is an interim treatment, NOT the final seamless texture selected by James. He will create an asset repository on the same account and upload a replacement. Do not invent its URL or import an alternative texture without his selection.

Module cache versions advanced to manor-8. All 29 existing tests pass and the static build succeeds. Browser installation returned an invalid/truncated download, so no updated render or physical-device verification is claimed. Keep this change as a draft until visual review.

Asset direction: keep texture sources outside the app repository. Once James supplies the new repository, inspect its files and arrange stable browser-readable, versioned asset URLs (including cross-origin texture access), or fetch pinned assets during deployment. Merely moving files into another repository does not establish runtime hosting. Final seamless marble integration is pending.


## Selected tile integration — 2 October 2026

Branch: `fix/manor-screenshot-snags` (PR #2).

- Integrated James's selected `floor_tiles_06` from `dorejamesdt4-lang/asset-libary` commit `151bba6`. Original Blender/4K maps stay in that repository. Only 1024px colour and roughness runtime derivatives are bundled here (about 196 KiB total) so Pages serves them on the same origin without cross-origin failures or a moving asset URL. Source entries, hashes and sizes are recorded in `assets/catalog.json`. The archive's licence status remains recorded as not supplied.
- Hall and Long Gallery share world-coordinate UVs: 3 metres per complete texture repeat (four tile columns), with the grid centred on the hallway axis. The gallery no longer restarts or stretches the pattern at the doorway. Removed procedural black corner diamonds remain removed; the selected map contains alternating stone tiles. The runner stays in place.
- Preserved all eight relocated gallery pictures and added a geometry regression verifying their bevelled backings clear the outer doorway moulding. A second regression verifies every hall/gallery floor vertex uses the common texture grid.
- Module cache version advanced to manor-9. All 31 checks pass, the static build succeeds, and diff whitespace checks pass. Seven furnished rooms remain reachable and the existing geometry budget passes.
- Rendered visual confirmation is still pending: no local Chromium executable is available in this workspace. Do not present these automated geometry/material checks as a real GPU screenshot or physical-phone performance test. Keep PR #2 available for review; no merge or live deployment is claimed.

Next: render the branch on a WebGL-capable browser, inspect both gallery doorways and the hall/gallery seam, then review PR #2 for merge. Exact concept-art fidelity and physical-phone testing remain separate unfinished work.
