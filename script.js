const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

// Scale: C#, F, G#, C (across 4 octaves)
const baseNotes = [
  138.59, // C#3
  174.61, // F3
  207.65, // G#3
  261.63, // C4
];

const scale = baseNotes
  .concat(baseNotes.map((freq) => freq * 2))
  .concat(baseNotes.map((freq) => freq * 4))
  .concat(baseNotes.map((freq) => freq * 8));

// global lowpass filter
const lowpass = audioCtx.createBiquadFilter();
lowpass.type = "lowpass";
lowpass.frequency.value = 7000; // dip around 7kHz
lowpass.Q.value = 1.0;

// master gain
const masterGain = audioCtx.createGain();
masterGain.gain.value = 0.0; // starts at 0, will fade in
masterGain.connect(lowpass);
lowpass.connect(audioCtx.destination);

// Ambient reverb via randomized delay chains
function createAmbientDelayChain() {
  const delay = audioCtx.createDelay();
  delay.delayTime.value = Math.random() * 0.3 + 0.1; // 0.1 - 0.4s
  const feedback = audioCtx.createGain();
  feedback.gain.value = Math.random() * 0.2 + 0.3; // 0.3 - 0.5
  delay.connect(feedback);
  feedback.connect(delay);
  delay.connect(masterGain);
  return delay;
}

const delay1 = createAmbientDelayChain();
const delay2 = createAmbientDelayChain();
const delay3 = createAmbientDelayChain();

// wave choices
const waveTypes = ["sine", "triangle", "sawtooth"];

// play note function
function playNote(freq, duration) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  const velocity = Math.random() * 0.05 + 0.01; // velocity between 0.01 and 0.05

  // Weighted choice: mostly sine, occasional triangle/sawtooth
  const randomWave = Math.random();
  if (randomWave < 0.7) {
    osc.type = "sine";
  } else if (randomWave < 0.9) {
    osc.type = "triangle";
  } else {
    osc.type = "sawtooth";
  }

  osc.frequency.value = freq;

  gain.gain.setValueAtTime(0.001, audioCtx.currentTime);
  gain.gain.linearRampToValueAtTime(velocity, audioCtx.currentTime + 0.1);
  gain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + duration);

  osc.connect(gain);
  gain.connect(delay1);
  gain.connect(delay2);
  gain.connect(delay3);

  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

// Mouse interaction block
let lastTriggerTime = 0;
const triggerBlockTime = 0.25; // Minimum 0.25s between notes

window.addEventListener("mousemove", (e) => {
  if (audioCtx.state === "suspended") {
    return;
  }

  const x = e.clientX;
  const y = e.clientY;
  const width = window.innerWidth;
  const height = window.innerHeight;

  const index = Math.floor((x / width) * scale.length);
  const frequency = scale[index];

  const rhythmSpeed = (y / height) * 0.5 + 0.05; // 0.05s - 0.55s rhythm
  const now = audioCtx.currentTime;

  if (now - lastTriggerTime >= triggerBlockTime) {
    playNote(frequency, 3);
    lastTriggerTime = now;
  }
});

// AUDIO START

const overlay = document.getElementById("start-overlay");

function startInitialAmbient() {
  // Fade in master gain
  masterGain.gain.setValueAtTime(0.0, audioCtx.currentTime);
  masterGain.gain.linearRampToValueAtTime(0.7, audioCtx.currentTime + 10);
}

function startAfterUnlock() {
  startInitialAmbient();

  overlay.style.opacity = "0";
  setTimeout(() => {
    overlay.style.display = "none";
  }, 1000);
}

window.addEventListener("load", () => {
  if (audioCtx.state === "suspended") {
    overlay.style.display = "flex";
  } else {
    startAfterUnlock();
  }
});

overlay.addEventListener("click", async () => {
  await audioCtx.resume();
  startAfterUnlock();
});

// Background Color Reactive Animation
const analyser = audioCtx.createAnalyser();
analyser.fftSize = 256;
const dataArray = new Uint8Array(analyser.frequencyBinCount);
masterGain.connect(analyser);

function updateBackgroundColor() {
  analyser.getByteFrequencyData(dataArray);
  const average =
    dataArray.reduce((sum, val) => sum + val, 0) / dataArray.length;
  const intensity = Math.min(255, Math.floor(average * 3));

  let r = 255;
  let g = 255 - Math.min(intensity, 255);
  let b = Math.min(intensity, 255);

  if (intensity > 200) {
    r = Math.min(255, (intensity - 150) * 1.2);
    g = Math.max(0, g - (intensity - 200) * 0.5);
  }

  document.body.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;

  requestAnimationFrame(updateBackgroundColor);
}

updateBackgroundColor();
