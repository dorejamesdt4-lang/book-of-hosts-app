# Virtual Manor — handover

Updated: 1 October 2026 (Europe/London). Owner: James Dore.

## Current phase
Design and source inspection. Show James a visual BEFORE implementing the 3D world. A concept image is a design target, not evidence of a working renderer or phone performance.

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

Nightmare source packs include damaged plaster, plastered wall, rock wall, terracotta tiles, metal and concrete. These ZIPs are Git LFS pointers in the git tree: damaged_plaster master alone is 77,255,657 bytes. Actual binary packs and mesh contents have not been downloaded or visually inspected. Material maps still need retrieval, verification and conversion to smaller runtime assets. Arbitrary OBJ REVIEW pack remains unverified. ASSET-LICENSES.md and source texture README inspected. Existing three-runtime.js contains malformed movement/initial-exit code and mobile third-person follow behaviour; do not import it wholesale. Existing source handover includes superseded sections: inspect actual code rather than trusting old completion claims.

The Nightmare project's procedural horror, twisting corridors and horror entities are not requirements for Book of Hosts. James's fixed original mansion and first-person camera requirements take precedence. Use reviewed assets and suitable concepts, keep game rules separate. Do not copy source dev consoles, admin pages, time-machine/wing bundles into public gameplay.

## Visual review and planned implementation
- Preview requested now: original Victorian mystery mansion, tactile walnut/aged brass/plaster/marble, readable warm lamps and cool garden light; parchment/gold/emerald HUD.
- Concept visual is generated design direction, not a render from source textures. Do not promise it is achievable at that fidelity on every phone.
- Source layout preserved; Bar/Games Room and Theatre are proposed later extensions and must be called proposals if shown, not claimed as verified original rooms.
- First playable milestone after visual review: Entrance Hall with the beginning of Long Gallery; first-person controls on both desktop and phone. No scope expansion until measured usability and material quality are accepted.
- Future reusable room definitions, material registry, collision, interactions, camera/input, quality profiles and game adapters each get separate modules.
- A folder alone is not crash isolation: use a separately navigated runtime with no eager dashboard imports, handle failed imports/assets/WebGL loss locally, stop animation/audio and dispose textures/geometries/listeners on exit. Maintain a non-WebGL recovery screen. Avoid a global service worker changing app caches.
- Next session must show/read the visual and James's feedback before beginning the full build. This turn creates handover/design files only; no working 3D engine is claimed.

