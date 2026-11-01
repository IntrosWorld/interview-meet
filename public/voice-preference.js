// Shared by cloud rooms and the local desktop/lab controllers.
export function initVoiceStyle() {
  const select = document.getElementById('voice-style');
  try { select.value = localStorage.getItem('interview-voice-style') === 'female' ? 'female' : 'male'; }
  catch { select.value = 'male'; }
  select.addEventListener('change', () => {
    try { localStorage.setItem('interview-voice-style', select.value); } catch {}
  });
  return select;
}

// Browser SpeechSynthesisVoice has no gender field. Prefer Windows metadata,
// falling back only to known installed Windows voice names.
export function localVoiceGender(voice, timedVoices = []) {
  const match = timedVoices.find(v => v.name === voice.name);
  const gender = (voice.gender || match?.gender || '').toLowerCase();
  if (gender === 'male' || gender === 'female') return gender;
  if (/\b(david|mark|george|ravi|james|richard|sean)\b/i.test(voice.name)) return 'male';
  if (/\b(zira|hazel|heera|susan|catherine|linda|sara)\b/i.test(voice.name)) return 'female';
  return 'unknown';
}
