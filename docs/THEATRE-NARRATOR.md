# Theatre narrator player

The Magician is the male narrator and the Jester is the female narrator. Current portraits are original animated SVG prototypes in the Storybook palette. The approved detailed painterly mockup is not yet layered animation artwork; do not describe these prototypes as that final art.

Users see Narrator Script and Narrator Package. Upload a ZIP with manifest.json or showbox/manifest.json and audio clips referenced relative to that manifest. An original Ruby game file is also accepted behind the scenes. Use in Theatre sends a generated mystery to the player through same-tab session storage; account-based transfer is deferred.

Audio can be included in the package or added as separate clips. Missing clip filenames are displayed. Embedded audio data URLs are accepted for older script bundles. Remote audio URLs are not fetched. Load and decode progress is shown before playback; there is no Kokoro model load in the theatre player. The existing Narrator tool is linked for creating recorded audio. Its generated clips still need to be saved and uploaded manually.

Play starts a line or resumes paused audio. Pause preserves the offset. Stop resets the current line. Consecutive voiced lines continue automatically; clues, pauses, mini-games and music cues wait for the host. Next advances one scene; Start again returns to scene one. The portrait mouth follows a real audio analyser and closes when audio stops. Captions mode does not pretend to generate speech. Mini-game and music scenes are host-managed intervals, not newly implemented engines.

Test with Try sample script, then supply narration clips named for its scene IDs. Validate pause/resume, stop, investigation cues, missing audio and replacement uploads. Current automated tests cover parsing and package paths; live audio/browser behavior needs verification across desktop and mobile.
