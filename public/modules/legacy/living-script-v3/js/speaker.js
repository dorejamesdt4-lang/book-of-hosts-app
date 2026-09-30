// ====================================================================
// SPEAKER — voices one line on a Stage: fetch its audio from the voice
// bank (voicing it now if it wasn't prepared), duck the music, play it
// through the theme's FX, and report the dry speech level (for a
// talking mouth). Page code shared by stage.js and theatre-stage.js.
// ====================================================================

const UNDUCK_AFTER_MS = 500;

export function createSpeaker({ bank, speech, music }) {
  let unduck = null;
  let chain = Promise.resolve();
  let last = null; // { clip, rate, onLevel } for Repeat Line

  return {
    // item: { text, voice, speed }; rate: pitch playback rate.
    // onStart() once the clip is ready; onLevel(level) ~30x a second.
    async say({ item, rate = 1, onStart, onLevel, isPaused = () => false }) {
      const clip = (await bank.get(item)) || (await bank.generate(item));
      if (!clip) return { stopped: true };
      last = { clip, rate, onLevel };
      if (onStart) onStart();
      clearTimeout(unduck);
      if (music) music.duck(true);
      let t = null;
      if (onLevel) t = setInterval(() => onLevel(isPaused() ? 0 : speech.level()), 33);
      const r = await speech.play({ audio: clip.audio, sampleRate: clip.sampleRate, rate });
      clearInterval(t);
      if (onLevel) onLevel(0);
      unduck = setTimeout(() => { if (music) music.duck(false); }, UNDUCK_AFTER_MS);
      return r;
    },

    get canRepeat() { return !!last; },

    // Plays the last line again (Repeat Line).
    repeat() {
      if (!last) return chain;
      const { clip, rate, onLevel } = last;
      chain = chain.then(async () => {
        if (music) music.duck(true);
        let t = null;
        if (onLevel) t = setInterval(() => onLevel(speech.level()), 33);
        await speech.play({ audio: clip.audio, sampleRate: clip.sampleRate, rate });
        clearInterval(t);
        if (onLevel) onLevel(0);
        setTimeout(() => { if (music) music.duck(false); }, UNDUCK_AFTER_MS);
      }).catch(() => {});
      return chain;
    }
  };
}
