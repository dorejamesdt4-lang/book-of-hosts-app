// ====================================================================
// DEBUG TIMING -- load-time and playback timing for diagnosing gaps.
// Always logs to the console (prefixed "[Forge timing]"); with ?debug=1
// in the URL it also shows a small overlay listing the same events.
// Every event is kept on window.__forgeTiming for inspection.
//
//   voice     each voice file: download ms, size, cache vs network
//   model     model load: device, dtype, ms
//   device    background switch to / decision about WebGPU
//   sentence  each sentence: generation ms vs its audio length (RTF)
//   gap       silence between one line ending and the next starting
//   swap      sprite swap on a speaker change: preloaded (instant) or
//             how long until the sprite had loaded
//   take      Play pressed -> first audio
// ====================================================================

const PREFIX = '[Forge timing]';
const MAX_OVERLAY_LINES = 60;

function fmtMs(ms) {
  return ms >= 1000 ? (ms / 1000).toFixed(2) + ' s' : Math.round(ms) + ' ms';
}

export function createTimingLog() {
  const events = [];
  window.__forgeTiming = events;
  const showOverlay = new URLSearchParams(location.search).get('debug') === '1';
  let list = null;

  if (showOverlay) {
    const panel = document.createElement('aside');
    panel.className = 'forge-debug';
    panel.setAttribute('aria-label', 'Timing debug');
    panel.innerHTML = '<div class="forge-debug-head">TIMING <button type="button" class="forge-debug-clear">CLEAR</button></div><ol class="forge-debug-list"></ol>';
    document.body.appendChild(panel);
    list = panel.querySelector('.forge-debug-list');
    panel.querySelector('.forge-debug-clear').addEventListener('click', () => { list.innerHTML = ''; });
  }

  function emit(event, text, data) {
    const entry = { t: Math.round(performance.now()), event, ...data };
    events.push(entry);
    console.info(PREFIX, text);
    if (list) {
      const li = document.createElement('li');
      li.className = 'is-' + event;
      li.textContent = text;
      list.appendChild(li);
      while (list.children.length > MAX_OVERLAY_LINES) list.firstChild.remove();
      list.scrollTop = list.scrollHeight;
    }
  }

  return {
    voice({ voice, ms, bytes, source, reason }) {
      emit('voice', `voice ${voice}: ${fmtMs(ms)} (${Math.round(bytes / 1024)} KB, ${source}${reason ? ', ' + reason : ''})`,
        { voice, ms, bytes, source, reason });
    },
    model({ device, dtype, ms }) {
      emit('model', `model ready on ${device}/${dtype} in ${fmtMs(ms)}`, { device, dtype, ms });
    },
    device({ device, dtype, reason, rtf, previousRtf, webgpuRtf }) {
      const why = {
        faster: `WebGPU RTF ${rtf && rtf.toFixed(2)} beat wasm ${previousRtf && previousRtf.toFixed(2)}`,
        'webgpu-slower': `WebGPU RTF ${webgpuRtf && webgpuRtf.toFixed(2)} was not faster than wasm ${rtf && rtf.toFixed(2)}`,
        'no-webgpu': 'no WebGPU adapter',
        'webgpu-failed': 'WebGPU model failed to load'
      }[reason] || reason;
      emit('device', `device now ${device}/${dtype} (${why})`, { device, dtype, reason, rtf, previousRtf, webgpuRtf });
    },
    sentence({ index, speakerId, genMs, audioSeconds }) {
      const rtf = audioSeconds ? genMs / 1000 / audioSeconds : 0;
      emit('sentence', `#${index + 1} ${speakerId}: generated in ${fmtMs(genMs)} for ${audioSeconds.toFixed(2)} s audio (RTF ${rtf.toFixed(2)}${rtf > 1 ? ', slower than real time' : ''})`,
        { index, speakerId, genMs, audioSeconds, rtf });
    },
    gap({ index, speakerId, prevSpeakerId, gapMs }) {
      const change = prevSpeakerId && prevSpeakerId !== speakerId ? ` [${prevSpeakerId} -> ${speakerId}]` : '';
      emit('gap', `gap before #${index + 1}${change}: ${fmtMs(gapMs)}`, { index, speakerId, prevSpeakerId, gapMs, speakerChange: !!change });
    },
    swap({ from, to, ms, preloaded }) {
      emit('swap', `sprite ${from || '-'} -> ${to}: ${preloaded ? 'instant (preloaded)' : fmtMs(ms) + ' (had to load)'}`, { from, to, ms, preloaded });
    },
    take({ firstAudioMs, bufferedSentences }) {
      emit('take', `Play -> first audio: ${fmtMs(firstAudioMs)}${bufferedSentences != null ? ` (${bufferedSentences} sentence(s) buffered)` : ''}`,
        { firstAudioMs, bufferedSentences });
    }
  };
}
