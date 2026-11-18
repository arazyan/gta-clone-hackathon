// Procedural WebAudio: engine RPM, sirens, 3 parody radio stations, UI stingers.
let ctx = null, master = null, radioGain = null, worldGain = null, lowpass = null;
let engineOsc = null, engineGain = null, engineFilter = null;
let sirenOsc = null, sirenGain = null, sirenLfo = null;
let radioTimer = null, radioNodes = [];
let started = false;

export const STATIONS = [
  { name: 'WEST COAST VIBE FM', freq: '98.7', desc: 'G-funk synth & DJ roasts' },
  { name: 'LOS SANTOS MEME RADIO', freq: '101.3', desc: 'Phonk / Eurobeat drift' },
  { name: 'HUSTLE & SUBPRIME TALK', freq: 'AM 690', desc: 'Simeon-approved finance talk' },
];

export function initAudio() {
  if (started) return; started = true;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain(); master.gain.value = 0.55;
  lowpass = ctx.createBiquadFilter(); lowpass.type = 'lowpass'; lowpass.frequency.value = 18000;
  master.connect(lowpass); lowpass.connect(ctx.destination);
  worldGain = ctx.createGain(); worldGain.gain.value = 1; worldGain.connect(master);
  radioGain = ctx.createGain(); radioGain.gain.value = 0.4; radioGain.connect(master);

  // engine
  engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 50;
  engineFilter = ctx.createBiquadFilter(); engineFilter.type = 'lowpass'; engineFilter.frequency.value = 400;
  engineGain = ctx.createGain(); engineGain.gain.value = 0;
  engineOsc.connect(engineFilter); engineFilter.connect(engineGain); engineGain.connect(worldGain);
  engineOsc.start();

  // siren (two-tone via LFO on frequency)
  sirenOsc = ctx.createOscillator(); sirenOsc.type = 'triangle'; sirenOsc.frequency.value = 600;
  sirenLfo = ctx.createOscillator(); sirenLfo.type = 'square'; sirenLfo.frequency.value = 1.6;
  const lfoAmt = ctx.createGain(); lfoAmt.gain.value = 180;
  sirenLfo.connect(lfoAmt); lfoAmt.connect(sirenOsc.frequency);
  sirenGain = ctx.createGain(); sirenGain.gain.value = 0;
  sirenOsc.connect(sirenGain); sirenGain.connect(worldGain);
  sirenOsc.start(); sirenLfo.start();
}
export function resumeAudio() { if (ctx && ctx.state === 'suspended') ctx.resume(); }

export function setWheelOpen(open) {
  if (!ctx) return;
  lowpass.frequency.setTargetAtTime(open ? 500 : 18000, ctx.currentTime, 0.08);
}

// speed 0..1, on = in vehicle
export function updateEngine(speed, on, dt) {
  if (!ctx) return;
  const t = ctx.currentTime;
  engineGain.gain.setTargetAtTime(on ? 0.05 + speed * 0.05 : 0, t, 0.1);
  engineOsc.frequency.setTargetAtTime(42 + speed * 160, t, 0.08);
  engineFilter.frequency.setTargetAtTime(300 + speed * 1600, t, 0.1);
}
export function updateSiren(intensity) {
  if (!ctx) return;
  sirenGain.gain.setTargetAtTime(Math.min(0.06, intensity * 0.06), ctx.currentTime, 0.2);
}

function blip(freq, dur, type = 'square', vol = 0.15, when = 0, dest = null) {
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(dest || worldGain); o.start(t); o.stop(t + dur + 0.02);
  return o;
}
function noise(dur, vol = 0.3, filterFreq = 1000, when = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterFreq;
  const g = ctx.createGain(); g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(worldGain); src.start(t);
}

export const sfx = {
  uiBeep() { blip(880, 0.08, 'square', 0.12); blip(1320, 0.1, 'square', 0.1, 0.07); },
  cheat() { blip(660, 0.09, 'square', 0.16); blip(880, 0.09, 'square', 0.16, 0.09); blip(1100, 0.14, 'square', 0.16, 0.18); },
  gunshot() { noise(0.12, 0.35, 2600); blip(160, 0.06, 'square', 0.12); },
  smg() { noise(0.07, 0.25, 3000); },
  explosion() { noise(0.9, 0.6, 500); blip(55, 0.7, 'sine', 0.5); },
  bigExplosion() { noise(1.6, 0.8, 350); blip(40, 1.2, 'sine', 0.7); },
  horn() { blip(340, 0.35, 'square', 0.14); blip(425, 0.35, 'square', 0.12); },
  crash() { noise(0.3, 0.4, 900); },
  glass() { noise(0.5, 0.4, 6000); },
  spray() { noise(0.5, 0.3, 4500); noise(0.5, 0.3, 4500, 0.6); },
  doorSlam() { noise(0.2, 0.5, 300); },
  wasted() { blip(48, 1.4, 'sine', 0.7); noise(0.4, 0.3, 200, 0.05); },
  busted() { blip(220, 0.5, 'sawtooth', 0.2); blip(180, 0.7, 'sawtooth', 0.2, 0.3); },
  skycam() { blip(90, 0.25, 'sine', 0.4); noise(0.15, 0.2, 3000); },
  pickup() { blip(700, 0.07, 'square', 0.12); blip(1050, 0.1, 'square', 0.12, 0.07); },
  bounce() { blip(120, 0.15, 'sine', 0.3); noise(0.1, 0.15, 600); },
  missionPassed() {
    // G-funk synth whistle swell
    const notes = [660, 880, 990, 1320, 990, 1320, 1760];
    notes.forEach((f, i) => blip(f, 0.3, 'sine', 0.16, i * 0.13));
    blip(110, 1.2, 'sawtooth', 0.08);
  },
  phoneRing() { blip(1200, 0.1, 'sine', 0.1); blip(1500, 0.1, 'sine', 0.1, 0.12); },
  orderDone() { blip(880, 0.1, 'square', 0.14); blip(1175, 0.16, 'square', 0.14, 0.1); },
  trainHorn() { blip(220, 0.9, 'sawtooth', 0.2); blip(277, 0.9, 'sawtooth', 0.18); },
};

// ---------------- radio ----------------
const TALK_ADS = [
  "Simeon here at Premium Deluxe Motorsport! Four hundred percent A P R! If you read the contract, that's racist! Buy a car today, or you hate America!",
  "Cluckin' Bell! Our number nine now with ninety percent more dip! Dip so thick, it counts as a load bearing wall!",
  "Lifeinvader! We sold your data before you even typed it! Privacy is a premium feature! Only ninety nine dollars a month!",
  "Bobcat Security! Our guards are trained to look the other way! Now hiring! Must bring your own flashlight!",
  "iFruit! The phone that explodes... with value! Thermite sold separately!",
  "Pay n Spray! New paint, new you! The police can't arrest a color! Legally distinct from money laundering!",
];
let talkIdx = 0;

export function setRadio(idx) {
  if (!ctx) return;
  stopRadio();
  if (idx < 0) return;
  if (idx === 2) {
    // talk radio via speech synthesis
    const speakNext = () => {
      if (S_radio !== 2) return;
      try {
        const u = new SpeechSynthesisUtterance(TALK_ADS[talkIdx++ % TALK_ADS.length]);
        u.rate = 1.05; u.pitch = 0.9; u.volume = 0.9;
        u.onend = () => { radioTimer = setTimeout(speakNext, 1200); };
        speechSynthesis.cancel(); speechSynthesis.speak(u);
      } catch (e) { /* no speech support */ }
    };
    S_radio = 2; speakNext();
    return;
  }
  S_radio = idx;
  // procedural music loop
  const bpm = idx === 0 ? 92 : 150;
  const beat = 60 / bpm;
  let step = 0;
  const gfunkScale = [0, 3, 5, 7, 10, 12, 15];
  const phonkScale = [0, 0, 3, 0, 5, 3, 7, 10];
  const tick = () => {
    if (S_radio !== idx) return;
    const t = ctx.currentTime;
    if (idx === 0) {
      // G-funk: slow whistle lead + deep bass
      if (step % 4 === 0) blip(55 * Math.pow(2, (step % 16 < 8 ? 0 : 3) / 12), beat * 1.8, 'sine', 0.22, 0, radioGain);
      if (step % 2 === 0) {
        const n = gfunkScale[(step / 2 + Math.floor(step / 16)) % gfunkScale.length];
        const o = blip(440 * Math.pow(2, n / 12), beat * 0.9, 'sine', 0.1, 0, radioGain);
        if (o) { const v = ctx.createOscillator(); v.frequency.value = 6; const vg = ctx.createGain(); vg.gain.value = 12; v.connect(vg); vg.connect(o.frequency); v.start(t); v.stop(t + beat); }
      }
      if (step % 4 === 2) noise(0.08, 0.1, 5000);
    } else {
      // phonk / eurobeat: driving cowbell bass + kick
      const n = phonkScale[step % phonkScale.length];
      blip(110 * Math.pow(2, n / 12), beat * 0.45, 'square', 0.12, 0, radioGain);
      if (step % 2 === 0) blip(50, 0.12, 'sine', 0.35, 0, radioGain);
      if (step % 4 === 2) noise(0.05, 0.12, 7000);
      if (step % 8 === 7) blip(880, beat * 0.4, 'sawtooth', 0.06, 0, radioGain);
    }
    step++;
    radioTimer = setTimeout(tick, beat * 1000 * (idx === 0 ? 1 : 0.5));
  };
  tick();
}
let S_radio = -1;
function stopRadio() {
  S_radio = -1;
  if (radioTimer) { clearTimeout(radioTimer); radioTimer = null; }
  try { speechSynthesis.cancel(); } catch (e) {}
}
export function radioPlaying() { return S_radio; }