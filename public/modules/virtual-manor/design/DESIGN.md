# Virtual Manor visual brief

Phase: visual review before implementation.

## Direction
An original Victorian detective mansion with crafted walnut joinery, aged brass, worn plaster, patterned rugs, veined marble and believable scale. Warm practical lamps make clues readable; moonlight marks the conservatory and garden. Restrained magic belongs in small glyphs and the Storybook/Arcane Oracle interface. No monochrome darkness or exaggerated bloom that hides detail.

## Preview composition
A wide concept board: a large eye-level first-person Entrance Hall view looking along the Long Gallery; smaller Library and Conservatory material studies; a landscape phone inset showing left movement stick, right look area, contextual Inspect and Pause. Original designs only. Caption the board "VIRTUAL MANOR · DESIGN PREVIEW". This is concept art, not an engine screenshot. The rendered materials are illustrative; source texture packs are not yet converted or integrated.

## Phone plan to validate
Landscape first; touch-safe controls clear of interaction targets and system safe areas. Independent multi-touch movement/look, touchcancel cleanup, pause on visibility loss, no mandatory device tilt. Mouse look/pointer lock with Esc release on desktop. Fixed first-person view on phone and desktop. Settable sensitivity, FOV and reduced motion. Close inspection temporarily locks walking and presents a clear return action.

Use baked lighting and authored details, local/compressed texture sets, instanced repeating trim/books/foliage, bounded dynamic lights and room visibility. Provide quality tiers without changing collision or game logic. Target 30fps on representative midrange phones; validate on actual devices before claiming support. Asset loading must expose progress/retry and permit return to dashboard.

## Template boundary
Engine and input are reusable; world layout/materials/props are data; mystery/theatre/minigame behaviour uses explicit adapters. Load one world on entry, dispose on exit. Begin with one finished Entrance Hall and short gallery, then expand verified source rooms.
