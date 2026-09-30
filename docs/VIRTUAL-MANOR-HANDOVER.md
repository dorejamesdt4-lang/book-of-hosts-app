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
Exact "project nighmare engine" URL unresolved at handover creation. Public repository-name searches for nightmare and project returned no matches; private/installed repositories must also be checked. Original candidate found: dorejamesdt4-lang/louis-dore-trading-3d-horror (Python project with game/layout.py, game/rooms_data.py, game/world.py, materials.py and procedural assets_gen.py). Do not assume native Python graphics can be copied directly into browser code.
