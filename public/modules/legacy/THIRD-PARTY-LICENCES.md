# Third-party licences

Everything in this repo that was not written for it, with its licence.
Rule for new additions: MIT, BSD or Apache-2.0 code only, with its notice
kept here; no GPL; code with no licence is never used.

Checked September 2026 against each package's published licence. This
is a record, not legal advice.

## ⚠ Needs a decision: the phonemizer inside kokoro-js

kokoro-js depends on the npm package **`phonemizer`** (1.2.1). The package
ships an Apache-2.0 licence file, but it describes itself as "a simple
text to phones converter using eSpeak NG" — it is **eSpeak NG compiled for
the browser**, and **eSpeak NG is licensed GPL-3.0-or-later**. That
conflicts with the "no GPL" rule above. It's loaded at run time from
jsDelivr by kokoro-js (it isn't copied into this repo), but it is part of
what the Narrator and the Living Script run. Worth checking with someone
qualified before a commercial launch, and considering a phonemizer with a
permissive licence.

## Loaded at run time (from cdn.jsdelivr.net / huggingface.co)

| What | Version | Licence | Used by |
|---|---|---|---|
| [kokoro-js](https://www.npmjs.com/package/kokoro-js) | 1.2.1 | Apache-2.0 | Narrator, Living Script (v2, v3): text-to-speech |
| [@huggingface/transformers](https://www.npmjs.com/package/@huggingface/transformers) (dependency of kokoro-js) | 3.x | Apache-2.0 | as above |
| [onnxruntime-web](https://www.npmjs.com/package/onnxruntime-web) (dependency of transformers) | — | MIT | as above |
| [phonemizer](https://www.npmjs.com/package/phonemizer) (dependency of kokoro-js) | 1.2.1 | Apache-2.0 as packaged; built from eSpeak NG, GPL-3.0-or-later (see above) | as above |
| Kokoro-82M voice model ([onnx-community/Kokoro-82M-v1.0-ONNX](https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX)) and its voices | v1.0 | Apache-2.0 | as above |
| [three.js](https://www.npmjs.com/package/three) (with its GLTFLoader and DecalGeometry examples) | 0.160.0 | MIT | Print Preview |

## Fonts

| Font | Licence | How |
|---|---|---|
| Cinzel, Cardo, Silkscreen | SIL Open Font License 1.1 | Google Fonts (Storybook mood, Living Script) |
| Press Start 2P, VT323 | SIL Open Font License 1.1 | Self-hosted in `backups/moods-retired/forge/fonts/` and `backups/narrator-pre-storybook/fonts/` (the retired Forge look) |

## Written fresh, not borrowed

- **The Gambler's Gambit** (`living-script-v3/engine/dice.js`,
  `engine/modules/gamblers-gambit.js`, `js/dice-view.js`): written from the
  public-domain rules of craps. No code, images or styles are taken from
  any other dice game (including the unlicensed GitHub craps game).
- **Jukebox tracks**: your own Suno tracks, played only when made on a paid
  plan (see `living-script-v3/jukebox/README.md`). None are in the repo yet.
