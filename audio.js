// WebAudio one-shots plus a quiet procedural dungeon drone whose intensity follows nearby threats.
export function createAudioPlayer(isEnabled = () => true) {
  let audioContext = null;
  let masterVolume = 0.65;
  let droneA = null, droneB = null, droneGain = null, threat = 0;

  function getContext() {
    if (!isEnabled()) return null;
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audioContext.state === 'suspended') audioContext.resume();
      return audioContext;
    } catch { return null; }
  }

  function setVolume(value) { masterVolume = Math.max(0, Math.min(1, Number(value) || 0)); if (droneGain && audioContext) droneGain.gain.setTargetAtTime(masterVolume * (.012 + threat * .03), audioContext.currentTime, .35); }

  function tone(frequency, duration, type = 'sine', volume = .03) {
    const context = getContext(); if (!context) return;
    try {
      const osc = context.createOscillator(), gain = context.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, context.currentTime);
      gain.gain.setValueAtTime(Math.max(.0001, volume * masterVolume), context.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + duration);
      osc.connect(gain); gain.connect(context.destination);
      osc.start(); osc.stop(context.currentTime + duration);
    } catch { /* Audio is optional where the browser restricts WebAudio. */ }
  }

  function setThreat(level) {
    threat = Math.max(0, Math.min(1, Number(level) || 0));
    if (!isEnabled()) { if (droneGain && audioContext) droneGain.gain.setTargetAtTime(.0001, audioContext.currentTime, .25); return; }
    const context = getContext(); if (!context) return;
    try {
      if (!droneA) {
        droneA = context.createOscillator(); droneB = context.createOscillator(); droneGain = context.createGain();
        droneA.type = 'sine'; droneB.type = 'triangle';
        droneA.frequency.value = 48; droneB.frequency.value = 72;
        droneGain.gain.value = .0001;
        droneA.connect(droneGain); droneB.connect(droneGain); droneGain.connect(context.destination);
        droneA.start(); droneB.start();
      }
      droneB.frequency.setTargetAtTime(68 + threat * 42, context.currentTime, .4);
      droneGain.gain.setTargetAtTime((.007 + threat * .035) * masterVolume, context.currentTime, .45);
    } catch { /* The game remains playable without ambient audio. */ }
  }

  return { tone, setVolume, setThreat };
}
