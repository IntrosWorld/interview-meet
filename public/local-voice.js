// Start speaking a short meaningful phrase instead of waiting for the whole reply.
export function createVoiceQueue(synthesis, getVoice, onStart, onState = () => {}) {
  let buffer = '', first = true, started = false, outstanding = 0;
  const live = new Set();
  function queue(text) {
    const voice = getVoice();
    if (!voice || !text.trim()) return;
    const utterance = new SpeechSynthesisUtterance(text.trim());
    utterance.voice = voice; utterance.rate = 1.08;
    live.add(utterance); outstanding++; onState(true);
    utterance.onstart = () => { if (!started) { started = true; onStart(); } };
    const finish = () => { if (!live.delete(utterance)) return; outstanding--; onState(outstanding > 0); };
    utterance.onend = finish; utterance.onerror = finish;
    synthesis?.speak(utterance);
  }
  return {
    push(chunk, flush = false) {
      buffer += chunk;
      while (buffer.trim()) {
        let match = buffer.match(/^([\s\S]*?[.!?])(?:\s|$)/);
        // A 4-word first phrase reduces time-to-voice for single-sentence questions.
        if (!match && first) match = buffer.match(/^((?:\s*\S+\s+){4})/);
        if (!match) break;
        queue(match[1]); buffer = buffer.slice(match[0].length); first = false;
      }
      if (flush && buffer.trim()) { queue(buffer); buffer = ''; }
    },
    cancel() { synthesis?.cancel(); buffer = ''; first = true; started = false; outstanding = 0; live.clear(); onState(false); }
  };
}
