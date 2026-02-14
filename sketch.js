let cam;
window.particles = [];

window.showHelp = true;
window.showVideo = true;

const CAM_W = 640;
const CAM_H = 480;

// sample stride
const SAMPLE_STEP = 6;

// background model (EMA)
let bgLuma = null;
let bgReady = false;

// UI
let sensSlider, sensVal;

// motion state
let motionEnergy = 0;
let motionCx = CAM_W / 2;
let motionCy = CAM_H / 2;

let prevCx = CAM_W / 2;
let prevCy = CAM_H / 2;
let centroidSpeed = 0;

// auto gain
let gain = 1.0;

// recording
let recorder = null;
let recordedChunks = [];
window.isRecording = false;

// audio
let audioCtx = null;

// Separate buses
let soundBus = null; // tick + whoosh
let micBus = null; // microphone
let masterBus = null;

let audioDest = null;

window.soundEnabled = true;
window.micEnabled = false;

let micStream = null;
let micSource = null;

// synth tick
let tickOsc = null;
let tickGain = null;
let tickFilter = null;

// whoosh noise
let whooshSource = null;
let whooshGain = null;
let whooshFilter = null;

let lastTickTime = 0;

// ---------------- Utility ----------------
function clamp(x, a, b) {
  return Math.max(a, Math.min(b, x));
}
function clamp01(x) {
  return clamp(x, 0, 1);
}

// ---------------- p5 ----------------
function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);

  // MOBILE-FRIENDLY: request environment camera when possible
  const constraints = {
    video: {
      facingMode: { ideal: "environment" }, // phone back camera
      width: { ideal: CAM_W },
      height: { ideal: CAM_H },
    },
    audio: false,
  };

  cam = createCapture(constraints, () => {
    // camera ready callback
    setTimeout(() => calibrateBackground(), 700);
  });

  cam.size(CAM_W, CAM_H);
  cam.hide();

  sensSlider = document.getElementById("sens");
  sensVal = document.getElementById("sensVal");
  sensSlider.addEventListener(
    "input",
    () => (sensVal.textContent = sensSlider.value)
  );

  bgLuma = new Float32Array(CAM_W * CAM_H);

  // expose functions
  window.calibrateBackground = calibrateBackground;
  window.toggleRecording = toggleRecording;
  window.toggleSound = toggleSound;
  window.toggleMic = toggleMic;
  window.unlockAudio = unlockAudio;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function keyPressed() {
  if (key === "h" || key === "H") window.showHelp = !window.showHelp;
  if (key === "v" || key === "V") window.showVideo = !window.showVideo;
  if (key === "r" || key === "R") window.particles = [];
  if (key === "c" || key === "C") calibrateBackground();
  if (key === "p" || key === "P") toggleRecording();
  if (key === "s" || key === "S") toggleSound();
  if (key === "m" || key === "M") toggleMic();
}

function draw() {
  background(0);

  const cover = coverRect(CAM_W, CAM_H, width, height);

  if (window.showVideo) {
    push();
    translate(cover.x, cover.y);
    scale(cover.s);
    tint(255, 205);
    image(cam, 0, 0);
    pop();
  } else {
    drawSoftBackground();
  }

  const slider = int(sensSlider.value);
  const motion = computeMotion(slider);

  motionEnergy = lerp(motionEnergy, motion.energy, 0.12);
  motionCx = lerp(motionCx, motion.cx, 0.22);
  motionCy = lerp(motionCy, motion.cy, 0.22);

  const dx = motionCx - prevCx;
  const dy = motionCy - prevCy;
  const d = Math.sqrt(dx * dx + dy * dy);
  centroidSpeed = lerp(centroidSpeed, d, 0.25);
  prevCx = motionCx;
  prevCy = motionCy;

  updateMotionSound(motionEnergy, centroidSpeed);

  // spawn particles
  const spawnCount = floor(map(motionEnergy, 0, 1, 0, 22));
  for (let i = 0; i < spawnCount; i++) {
    const jx = random(-22, 22);
    const jy = random(-22, 22);
    const sx = cover.x + (motionCx + jx) * cover.s;
    const sy = cover.y + (motionCy + jy) * cover.s;
    window.particles.push(new Particle(sx, sy, motionEnergy));
  }
  if (window.particles.length > 1400)
    window.particles.splice(0, window.particles.length - 1400);

  drawParticles();

  const cxScreen = cover.x + motionCx * cover.s;
  const cyScreen = cover.y + motionCy * cover.s;
  drawRevealPattern(motionEnergy, cxScreen, cyScreen);

  drawHUD(motionEnergy, motion.activePercent);

  document.getElementById("ui").style.display = window.showHelp
    ? "block"
    : "none";
}

// ---------------- Motion ----------------
function calibrateBackground() {
  cam.loadPixels();
  if (cam.pixels.length === 0) return;

  for (let y = 0; y < CAM_H; y++) {
    for (let x = 0; x < CAM_W; x++) {
      const i = 4 * (y * CAM_W + x);
      const r = cam.pixels[i],
        g = cam.pixels[i + 1],
        b = cam.pixels[i + 2];
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      bgLuma[y * CAM_W + x] = l;
    }
  }

  bgReady = true;
  gain = 1.0;
  console.log("Calibrated background ✅");
}

function computeMotion(sliderValue) {
  if (!bgReady)
    return { energy: 0, cx: CAM_W / 2, cy: CAM_H / 2, activePercent: 0 };

  cam.loadPixels();
  if (cam.pixels.length === 0)
    return { energy: 0, cx: CAM_W / 2, cy: CAM_H / 2, activePercent: 0 };

  // Higher slider => less sensitive
  const thr = map(sliderValue, 10, 80, 10, 35);

  const NOISE_FLOOR = 4;
  const EMA_BG = 0.02;

  let active = 0;
  let samples = 0;
  let cxSum = 0;
  let cySum = 0;

  for (let y = 0; y < CAM_H; y += SAMPLE_STEP) {
    for (let x = 0; x < CAM_W; x += SAMPLE_STEP) {
      const idx = y * CAM_W + x;
      const i = 4 * idx;

      const r = cam.pixels[i],
        g = cam.pixels[i + 1],
        b = cam.pixels[i + 2];
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;

      const bg = bgLuma[idx];
      const diff = Math.abs(l - bg);

      // adapt background slowly
      bgLuma[idx] = bg + (l - bg) * EMA_BG;

      samples++;

      if (diff > thr && diff > NOISE_FLOOR) {
        active++;
        cxSum += x;
        cySum += y;
      }
    }
  }

  const activePercent = samples > 0 ? active / samples : 0;

  // auto gain to keep motion stable across devices
  const target = activePercent * gain;
  if (target < 0.06) gain *= 1.01;
  if (target > 0.2) gain *= 0.985;
  gain = clamp(gain, 0.5, 6.0);

  let energy = (activePercent * gain - 0.01) / 0.16;
  energy = clamp01(energy);

  let cx = CAM_W / 2;
  let cy = CAM_H / 2;
  if (active > 8) {
    cx = cxSum / active;
    cy = cySum / active;
  }

  return { energy, cx, cy, activePercent };
}

// ---------------- Visual helpers ----------------
function coverRect(srcW, srcH, dstW, dstH) {
  const s = max(dstW / srcW, dstH / srcH);
  const x = (dstW - srcW * s) / 2;
  const y = (dstH - srcH * s) / 2;
  return { x, y, s };
}

function drawSoftBackground() {
  noStroke();
  for (let i = 0; i < height; i += 6) {
    const a = map(i, 0, height, 40, 0);
    fill(30, a);
    rect(0, i, width, 6);
  }
}

function drawParticles() {
  for (let p of window.particles) p.update();

  noStroke();
  for (let p of window.particles) {
    fill(120, 220, 255, p.alpha * 0.35);
    circle(p.x, p.y, p.size * 2.6);
  }
  for (let p of window.particles) {
    fill(220, 250, 255, p.alpha);
    circle(p.x, p.y, p.size);
  }

  window.particles = window.particles.filter((p) => p.life > 0);
}

function drawRevealPattern(t, cx, cy) {
  const a = 30 + 180 * t;
  if (a < 35) return;

  push();
  noFill();
  stroke(0, 200, 255, a);
  strokeWeight(2);

  const base = min(width, height) * 0.08;
  const pulse = (sin(frameCount * 0.05) * 0.5 + 0.5) * 70 * t;

  for (let i = 0; i < 8; i++) {
    const r = base + i * 22 + pulse;
    ellipse(cx, cy, r, r);
  }
  pop();
}

function drawHUD(t, activePct) {
  fill(255, 220);
  noStroke();
  textSize(14);
  textAlign(LEFT, BOTTOM);

  const pct = (t * 100).toFixed(0);
  const ap = (activePct * 100).toFixed(2);

  text(
    `Motion: ${pct}% • ActivePx: ${ap}% • Particles: ${window.particles.length}`,
    16,
    height - 14
  );

  if (window.isRecording) {
    fill(255, 80, 80);
    text("REC ●", width - 80, height - 14);
  }
}

// ---------------- Particle ----------------
class Particle {
  constructor(x, y, energy) {
    this.x = x;
    this.y = y;
    const speed = random(0.4, 2.2) + energy * 2.7;
    const angle = random(TWO_PI);
    this.vx = cos(angle) * speed;
    this.vy = sin(angle) * speed;
    this.size = random(2.0, 4.5);
    this.life = random(70, 140);
    this.alpha = 220;
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vx *= 0.98;
    this.vy *= 0.98;
    this.vy -= 0.006;
    this.life -= 1;
    this.alpha = map(this.life, 0, 140, 0, 220);
    if (this.x < 0) this.x += width;
    if (this.x > width) this.x -= width;
    if (this.y < 0) this.y += height;
    if (this.y > height) this.y -= height;
  }
}

// ===================== AUDIO =====================
function unlockAudio() {
  ensureAudio();
  if (audioCtx && audioCtx.state !== "running") audioCtx.resume();
}

function toggleSound() {
  window.soundEnabled = !window.soundEnabled;
  ensureAudio();
  if (!audioCtx) return;

  // only controls sound bus (NOT mic)
  soundBus.gain.setTargetAtTime(
    window.soundEnabled ? 0.22 : 0.0,
    audioCtx.currentTime,
    0.03
  );
}

async function toggleMic() {
  ensureAudio();
  if (!audioCtx) return;
  if (audioCtx.state !== "running") await audioCtx.resume();

  if (!window.micEnabled) {
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micSource = audioCtx.createMediaStreamSource(micStream);

      // record mic always through micBus (independent from Sound toggle)
      micSource.connect(micBus);

      window.micEnabled = true;
    } catch (e) {
      window.micEnabled = false;
      alert(
        "Mic permission denied. Allow Microphone in site settings and try again."
      );
    }
  } else {
    if (micStream) micStream.getTracks().forEach((t) => t.stop());
    micStream = null;
    micSource = null;
    window.micEnabled = false;
  }
}

function ensureAudio() {
  if (audioCtx) return;

  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  // master -> speakers
  masterBus = audioCtx.createGain();
  masterBus.gain.value = 1.0;
  masterBus.connect(audioCtx.destination);

  // destination -> recording
  audioDest = audioCtx.createMediaStreamDestination();

  // buses
  soundBus = audioCtx.createGain();
  soundBus.gain.value = window.soundEnabled ? 0.22 : 0.0;

  micBus = audioCtx.createGain();
  micBus.gain.value = 1.0;

  // route both to speakers + recording
  soundBus.connect(masterBus);
  micBus.connect(masterBus);

  soundBus.connect(audioDest);
  micBus.connect(audioDest);

  // tick synth
  tickOsc = audioCtx.createOscillator();
  tickOsc.type = "triangle";

  tickFilter = audioCtx.createBiquadFilter();
  tickFilter.type = "lowpass";
  tickFilter.frequency.value = 1400;

  tickGain = audioCtx.createGain();
  tickGain.gain.value = 0.0;

  tickOsc.connect(tickFilter);
  tickFilter.connect(tickGain);
  tickGain.connect(soundBus);
  tickOsc.start();

  // whoosh noise (bandpass)
  whooshFilter = audioCtx.createBiquadFilter();
  whooshFilter.type = "bandpass";
  whooshFilter.frequency.value = 700;
  whooshFilter.Q.value = 2.0;

  whooshGain = audioCtx.createGain();
  whooshGain.gain.value = 0.0;

  const bufferSize = audioCtx.sampleRate * 1.0;
  const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.25;

  whooshSource = audioCtx.createBufferSource();
  whooshSource.buffer = noiseBuffer;
  whooshSource.loop = true;

  whooshSource.connect(whooshFilter);
  whooshFilter.connect(whooshGain);
  whooshGain.connect(soundBus);
  whooshSource.start();

  lastTickTime = audioCtx.currentTime;
}

function updateMotionSound(energy, speed) {
  if (!audioCtx) return;
  if (!window.soundEnabled) return;

  const t = audioCtx.currentTime;
  const e = clamp01(energy);

  // RULE:
  // motion energy => tick interval (sonar)
  // centroid speed => pitch (movement speed changes pitch)
  const interval = lerp(0.65, 0.09, e);

  const sp = clamp(speed, 0, 60);
  const pitch = 160 + e * 260 + sp * 6.8; // faster movement => higher pitch
  const cutoff = 600 + e * 2600;
  const tickVol = 0.008 + e * 0.18;

  tickOsc.frequency.setTargetAtTime(pitch, t, 0.02);
  tickFilter.frequency.setTargetAtTime(cutoff, t, 0.03);

  if (t - lastTickTime >= interval) {
    lastTickTime = t;
    tickGain.gain.cancelScheduledValues(t);
    tickGain.gain.setValueAtTime(0.0001, t);
    tickGain.gain.linearRampToValueAtTime(tickVol, t + 0.008);
    tickGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  }

  // Whoosh only when energy is strong
  const whooshTarget = e > 0.22 ? (e - 0.22) * 0.22 : 0.0;
  const whooshFreq = 420 + e * 2000;
  whooshFilter.frequency.setTargetAtTime(whooshFreq, t, 0.05);
  whooshGain.gain.setTargetAtTime(whooshTarget, t, 0.08);
}

// ===================== RECORDING =====================
async function toggleRecording() {
  ensureAudio();
  if (audioCtx.state !== "running") await audioCtx.resume();

  if (!window.isRecording) {
    const canvasStream = document.querySelector("canvas").captureStream(30);

    const combined = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...audioDest.stream.getAudioTracks(),
    ]);

    // Best for phones: webm (mp4 often not supported in MediaRecorder)
    let mime = "video/webm;codecs=vp8,opus";
    if (!MediaRecorder.isTypeSupported(mime)) mime = "video/webm";

    recordedChunks = [];
    recorder = new MediaRecorder(combined, { mimeType: mime });

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) recordedChunks.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(recordedChunks, { type: recorder.mimeType });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `FS_recording_${Date.now()}.webm`;
      a.click();

      setTimeout(() => URL.revokeObjectURL(url), 1500);
    };

    recorder.start(250);
    window.isRecording = true;
  } else {
    recorder.stop();
    window.isRecording = false;
  }
}
