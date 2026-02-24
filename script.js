// =======================================================
// Save the Date — Troquel (cavidad clara) + Purpurina (se va al rascar)
// + Partículas que saltan + 3D tilt (sin oscurecer)
// =======================================================

// ======= CONFIG =======
const HORA = "12:00";

// Textos intro
const TEXT_STEP1 = "Pulsa aquí, somos Cris, Elián y Jose.";
const TEXT_STEP2 = "Tenemos que compartir contigo una cosa…";

// Textura real (usa tu imagen)
const GLITTER_IMAGE_URL = "assets/glitter_tile_gold.jpg";

// Scratch feel
const BRUSH = 38;
const ERASE_ALPHA = 0.90;
const STAMP_STEP = 0.34;
const ROUGHNESS = 0.62;

// Troquel / profundidad
const WALL_THICKNESS_PX = 18;     // pared interior (aprox)
const RIM_THICKNESS = 3.0;        // reborde fino exterior
const WALL_MAX_DARK = 0.16;       // limite de sombra (no oscuro)
const CAVITY_EDGE_SHADE = 0.10;   // sombreado suave interior (no oscuro)
const CAVITY_HIGHLIGHT = 0.20;    // luz interior (mantiene claro)

// Glitter shading (no oscuro)
const PIT_EDGE_DARKEN = 0.10;     // muy suave
const PIT_LIGHT = 0.30;

// Procedural fallback (si la imagen no carga)
const GLITTER_TILE_SIZE = 360;
const GLITTER_CHUNKS = 3100;
const GLITTER_MICRO = 420;
const GLITTER_SHADOW = 0.18;

// Brillos
const SHINE_PERIOD_MS = 860;
const SHINE_TWINKLES = 28;
const SHINE_BLING_EVERY_MS = 1500;

// Partículas
const EMIT_RATE = 9;
const MAX_PARTICLES = 220;
const GRAVITY = 980;
const PARTICLE_DRAG = 0.985;

// Completar
const FINISH_REMAIN_RATIO = 0.08;
const COVERAGE_CHECK_MS = 220;

// Popup
const POPUP_DELAY_MS = 3000;

// 3D
const LIGHT_SMOOTH = 0.12;
const PARALLAX = 18;
// ======================

// DOM
const intro = document.getElementById("intro");
const flash = document.getElementById("flash");
const introMsg1 = document.getElementById("introMsg1");
const introMsg2 = document.getElementById("introMsg2");
const introTap = document.getElementById("introTap");
const type1 = document.getElementById("type1");
const type2 = document.getElementById("type2");
const caret1 = document.getElementById("caret1");
const caret2 = document.getElementById("caret2");

const stage = document.getElementById("heartStage");
const hint = document.getElementById("hint");
const resetBtn = document.getElementById("resetBtn");
const musicBtn = document.getElementById("musicBtn");
const musicStatus = document.getElementById("musicStatus");

const baseCanvas = document.getElementById("base");
const glitterCanvas = document.getElementById("glitter");
const shineCanvas = document.getElementById("shine");
const particlesCanvas = document.getElementById("particles");
const bevelCanvas = document.getElementById("bevel");
const outlineCanvas = document.getElementById("outline");

const baseCtx = baseCanvas.getContext("2d");
const glitterCtx = glitterCanvas.getContext("2d");
const shineCtx = shineCanvas.getContext("2d");
const particlesCtx = particlesCanvas.getContext("2d");
const bevelCtx = bevelCanvas.getContext("2d");
const outlineCtx = outlineCanvas.getContext("2d");

const popup = document.getElementById("popup");
const bgm = document.getElementById("bgm");
const whoosh = document.getElementById("whoosh");

document.getElementById("hora").textContent = HORA;

// Offscreen: máscara “purpurina restante” (en device px)
const maskCanvas = document.createElement("canvas");
const maskCtx = maskCanvas.getContext("2d");

// Offscreen: coverage
const covCanvas = document.createElement("canvas");
const covCtx = covCanvas.getContext("2d", { willReadFrequently: true });

// Paths
let hpOuter = null;
let hpInner = null;

// Texture
let glitterImg = null;
let glitterTile = null;

// Scratch
let drawing = false;
let last = null;
let activePointerId = null;
let touchActive = false;
let rafPending = false;
let pendingPoint = null;

// Completion
let fullAlphaSum = 0;
let lastCoverageCheck = 0;
let celebrated = false;
let popupTimer = null;
let popupShown = false;
let outlineOn = false;

// Shine
let shineTwinkles = [];
let shineLastBling = 0;

// Brush stamp
let brushStamp = null;
let brushStampSize = 0;

// Particles
let particles = [];

// 3D light
let lightTarget = { x: -0.6, y: -0.45 };
let light = { x: -0.6, y: -0.45 };
let lastBevelL = { x: 999, y: 999 };
let lastTs = 0;
let dpr = 1;

// Intro step
let introStep = 0;
let askedMotionPermission = false;

// ---------- Helpers ----------
function setStatus(msg) {
  if (!musicStatus) return;
  if (!msg) {
    musicStatus.classList.remove("show");
    musicStatus.textContent = "";
    return;
  }
  musicStatus.textContent = msg;
  musicStatus.classList.add("show");
  setTimeout(() => {
    musicStatus.classList.remove("show");
    musicStatus.textContent = "";
  }, 4500);
}

function updateMusicBtn() {
  if (!bgm || !musicBtn) return;
  musicBtn.textContent = bgm.paused ? "🎵 Música" : "🔊 Música";
}

function fadeVolume(to = 0.85, ms = 650) {
  const from = bgm.volume ?? 0;
  const start = performance.now();
  function step(t) {
    const k = Math.min(1, (t - start) / ms);
    bgm.volume = from + (to - from) * k;
    if (k < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

async function startMusicFromGesture() {
  if (!bgm) return;
  if (!bgm.paused && bgm.currentTime > 0) return;

  bgm.volume = 0.0;
  try { bgm.load(); } catch {}

  try {
    await bgm.play();
    fadeVolume(0.85, 650);
  } catch {
    setStatus("El navegador bloqueó el audio. Revisa: sitio no silenciado / permiso de sonido.");
  }
  updateMusicBtn();
}

async function playWhoosh() {
  if (!whoosh) return;
  try {
    whoosh.currentTime = 0;
    whoosh.volume = 0.9;
    await whoosh.play();
  } catch {}
}

function showPopup() {
  if (!popup || popupShown) return;
  popupShown = true;
  popup.classList.add("on");
  popup.addEventListener("click", hidePopup, { once: true });
  setTimeout(hidePopup, 6000);
}

function hidePopup() {
  if (!popup) return;
  popup.classList.remove("on");
}

function typewriter(el, caretEl, text, speed = 26) {
  if (!el) return Promise.resolve();
  el.textContent = "";
  if (caretEl) caretEl.style.display = "inline-block";

  return new Promise((resolve) => {
    let i = 0;
    const tick = () => {
      el.textContent = text.slice(0, i);
      i++;
      if (i <= text.length) setTimeout(tick, speed);
      else setTimeout(() => {
        if (caretEl) caretEl.style.display = "none";
        resolve();
      }, 650);
    };
    tick();
  });
}

function lerp(a, b, t) { return a + (b - a) * t; }
function getRect() { return stage.getBoundingClientRect(); }

function setCtxToCss(ctx2d) {
  ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function setCtxToDevice(ctx2d) {
  ctx2d.setTransform(1, 0, 0, 1, 0, 0);
}

// ---------- Heart paths ----------
function buildHeartPath(w, h, scale = 1) {
  const cx = w * 0.5;
  const cy = h * 0.55;
  const size = Math.min(w, h) * 0.58 * scale;

  const p = new Path2D();
  p.moveTo(cx, cy + size * 0.35);
  p.bezierCurveTo(cx + size, cy - size * 0.2, cx + size * 0.75, cy - size * 1.05, cx, cy - size * 0.55);
  p.bezierCurveTo(cx - size * 0.75, cy - size * 1.05, cx - size, cy - size * 0.2, cx, cy + size * 0.35);
  p.closePath();
  return p;
}

function fitAllCanvases() {
  const r = getRect();
  dpr = Math.max(1, window.devicePixelRatio || 1);

  const w = Math.round(r.width * dpr);
  const h = Math.round(r.height * dpr);

  for (const c of [baseCanvas, glitterCanvas, shineCanvas, particlesCanvas, bevelCanvas, outlineCanvas, maskCanvas]) {
    c.width = w;
    c.height = h;
  }

  for (const ctx2d of [baseCtx, glitterCtx, shineCtx, particlesCtx, bevelCtx, outlineCtx, maskCtx]) {
    setCtxToCss(ctx2d);
  }

  hpOuter = buildHeartPath(r.width, r.height, 1);

  // Inner path: deja pared visible SIEMPRE
  const m = Math.min(r.width, r.height);
  const wall = Math.min(WALL_THICKNESS_PX, Math.max(12, m * 0.06));
  // escala aproximada para “meter” el corazón
  const innerScale = Math.max(0.86, 1 - (wall / (m * 0.95)));
  hpInner = buildHeartPath(r.width, r.height, innerScale);
}

// ---------- Glitter texture ----------
function preloadGlitterImage() {
  glitterImg = new Image();
  glitterImg.src = GLITTER_IMAGE_URL;
  glitterImg.onload = () => { /* ok */ };
  glitterImg.onerror = () => { glitterImg = null; };
}

function makeGoldGlitterTile(size = GLITTER_TILE_SIZE) {
  const t = document.createElement("canvas");
  t.width = t.height = size;
  const g = t.getContext("2d");

  g.fillStyle = "#b78612";
  g.fillRect(0, 0, size, size);

  for (let i = 0; i < GLITTER_CHUNKS; i++) {
    const r = 0.7 + Math.random() * 3.0;
    const x = Math.random() * size;
    const y = Math.random() * size;

    const pick = Math.random();
    const base = pick > 0.92 ? [255,245,220] : pick > 0.62 ? [245,205,110] : [210,160,55];
    const a = 0.10 + Math.random() * 0.40;

    g.fillStyle = `rgba(0,0,0,${GLITTER_SHADOW * a})`;
    g.beginPath();
    g.arc(x + r * 0.32, y + r * 0.38, r * 1.08, 0, Math.PI * 2);
    g.fill();

    g.fillStyle = `rgba(${base[0]},${base[1]},${base[2]},${a})`;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();

    if (Math.random() > 0.58) {
      g.fillStyle = `rgba(255,255,255,${0.06 + Math.random() * 0.22})`;
      g.beginPath();
      g.arc(x - r * 0.25, y - r * 0.25, Math.max(0.4, r * 0.55), 0, Math.PI * 2);
      g.fill();
    }
  }

  for (let i = 0; i < GLITTER_MICRO; i++) {
    const r = 0.35 + Math.random() * 1.25;
    const x = Math.random() * size;
    const y = Math.random() * size;
    g.fillStyle = `rgba(255,255,255,${0.05 + Math.random() * 0.18})`;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }

  return t;
}

function getGlitterSource() {
  if (glitterImg && glitterImg.complete && glitterImg.naturalWidth > 0) return glitterImg;
  if (!glitterTile) glitterTile = makeGoldGlitterTile();
  return glitterTile;
}

// ---------- Mask init / scratch erase ----------
function initMaskFull() {
  const r = getRect();
  const w = r.width;
  const h = r.height;

  maskCtx.clearRect(0, 0, w, h);

  // Importante: máscara SOLO en el interior (hpInner)
  maskCtx.save();
  maskCtx.fillStyle = "rgba(0,0,0,1)";
  maskCtx.fill(hpInner);
  maskCtx.restore();
}

function ensureBrushStamp() {
  const wanted = Math.max(52, BRUSH * 2);
  if (brushStamp && brushStampSize === wanted) return;

  brushStampSize = wanted;
  const b = document.createElement("canvas");
  b.width = b.height = brushStampSize;
  const g = b.getContext("2d");

  const cx = brushStampSize / 2;
  const cy = brushStampSize / 2;
  const rad = brushStampSize * 0.48;

  const rg = g.createRadialGradient(cx, cy, rad * 0.18, cx, cy, rad);
  rg.addColorStop(0.0, "rgba(0,0,0,1)");
  rg.addColorStop(0.60, "rgba(0,0,0,0.88)");
  rg.addColorStop(1.0, "rgba(0,0,0,0)");
  g.fillStyle = rg;
  g.fillRect(0, 0, brushStampSize, brushStampSize);

  const img = g.getImageData(0, 0, brushStampSize, brushStampSize);
  const d = img.data;

  for (let y = 0; y < brushStampSize; y++) {
    for (let x = 0; x < brushStampSize; x++) {
      const aIdx = (y * brushStampSize + x) * 4 + 3;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx*dx + dy*dy) / rad;
      if (dist > 1) continue;

      const edge = Math.max(0, (dist - 0.55) / 0.45);
      const noise = (Math.random() - 0.5) * ROUGHNESS;
      const k = Math.max(0, Math.min(1, 1 - (edge + noise)));
      d[aIdx] = Math.round(d[aIdx] * k);
    }
  }

  g.putImageData(img, 0, 0);
  brushStamp = b;
}

function eraseOnMask(x, y) {
  ensureBrushStamp();

  maskCtx.save();
  maskCtx.clip(hpInner);
  maskCtx.globalCompositeOperation = "destination-out";
  maskCtx.globalAlpha = ERASE_ALPHA;

  const s = brushStampSize;
  maskCtx.drawImage(brushStamp, x - s/2, y - s/2);

  maskCtx.restore();
  maskCtx.globalAlpha = 1;
}

function eraseStrokeOnMask(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.sqrt(dx*dx + dy*dy);
  const step = Math.max(6, BRUSH * STAMP_STEP);
  const n = Math.max(1, Math.floor(dist / step));

  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = a.x + dx * t;
    const y = a.y + dy * t;
    eraseOnMask(x, y);
    emitGlitterParticles(x, y, 1);
  }
}

// ---------- Cavity base (claro, sin oscuro) ----------
function drawBase() {
  const r = getRect();
  const w = r.width;
  const h = r.height;
  const m = Math.min(w, h);

  baseCtx.clearRect(0, 0, w, h);

  // Fondo SOLO dentro del hueco interior
  baseCtx.save();
  baseCtx.clip(hpInner);

  const cx = w * 0.5;
  const cy = h * 0.52;

  // Base crema luminosa
  const g = baseCtx.createRadialGradient(cx, cy, m*0.05, cx, cy, m*0.72);
  g.addColorStop(0.0, "rgba(255,254,252,1)");
  g.addColorStop(0.55, "rgba(250,248,252,1)");
  g.addColorStop(1.0, "rgba(242,236,246,1)");
  baseCtx.fillStyle = g;
  baseCtx.fillRect(0, 0, w, h);

  // Grano papel muy suave
  baseCtx.globalAlpha = 0.06;
  for (let i = 0; i < 850; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const rr = Math.random() * 1.0 + 0.25;
    baseCtx.fillStyle = Math.random() > 0.5 ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.9)";
    baseCtx.beginPath();
    baseCtx.arc(x, y, rr, 0, Math.PI*2);
    baseCtx.fill();
  }
  baseCtx.globalAlpha = 1;

  // Sombra interior MUY suave hacia el borde (sin oscurecer)
  baseCtx.globalCompositeOperation = "multiply";
  const shade = baseCtx.createRadialGradient(cx, cy, m*0.12, cx, cy, m*0.74);
  shade.addColorStop(0.0, "rgba(255,255,255,1)");
  shade.addColorStop(0.70, `rgba(0,0,0,${CAVITY_EDGE_SHADE})`);
  shade.addColorStop(1.0, `rgba(0,0,0,${CAVITY_EDGE_SHADE + 0.04})`);
  baseCtx.fillStyle = shade;
  baseCtx.fillRect(0, 0, w, h);

  // Luz interior (screen) para que nunca quede oscuro
  baseCtx.globalCompositeOperation = "screen";
  const lx = light.x, ly = light.y;
  const gx0 = w * 0.5 - lx * w * 0.70;
  const gy0 = h * 0.5 - ly * h * 0.70;
  const gx1 = w * 0.5 + lx * w * 0.70;
  const gy1 = h * 0.5 + ly * h * 0.70;

  const hi = baseCtx.createLinearGradient(gx0, gy0, gx1, gy1);
  hi.addColorStop(0.0, `rgba(255,255,255,${CAVITY_HIGHLIGHT})`);
  hi.addColorStop(0.55, "rgba(255,255,255,0.08)");
  hi.addColorStop(1.0, "rgba(255,255,255,0)");
  baseCtx.fillStyle = hi;
  baseCtx.fillRect(0, 0, w, h);

  baseCtx.globalCompositeOperation = "source-over";
  baseCtx.restore();
}

// ---------- Bevel / wall + rim (3D) ----------
function drawBevel() {
  if (Math.abs(light.x - lastBevelL.x) + Math.abs(light.y - lastBevelL.y) < 0.03) return;
  lastBevelL = { x: light.x, y: light.y };

  const r = getRect();
  const w = r.width;
  const h = r.height;
  const m = Math.min(w, h);

  bevelCtx.clearRect(0, 0, w, h);

  const lx = light.x, ly = light.y;
  const gx0 = w * 0.5 - lx * w * 0.55;
  const gy0 = h * 0.5 - ly * h * 0.55;
  const gx1 = w * 0.5 + lx * w * 0.55;
  const gy1 = h * 0.5 + ly * h * 0.55;

  // WALL: usamos clip OUTER y pintamos un stroke grande, pero que el hueco interior “recorta”
  bevelCtx.save();
  bevelCtx.clip(hpOuter);

  // “Borra” el interior para que quede pared visible (troquel)
  bevelCtx.save();
  bevelCtx.globalCompositeOperation = "destination-out";
  bevelCtx.fillStyle = "rgba(0,0,0,1)";
  bevelCtx.fill(hpInner);
  bevelCtx.restore();

  // Pared: gradiente claro -> un poco más oscuro (sin negro)
  const wallGrad = bevelCtx.createLinearGradient(gx0, gy0, gx1, gy1);
  wallGrad.addColorStop(0.0, "rgba(255,255,255,0.78)");
  wallGrad.addColorStop(0.45, "rgba(245,238,248,0.70)");
  wallGrad.addColorStop(1.0, `rgba(120,95,145,${WALL_MAX_DARK})`);

  bevelCtx.globalCompositeOperation = "source-over";
  bevelCtx.strokeStyle = wallGrad;
  bevelCtx.lineJoin = "round";
  bevelCtx.lineCap = "round";
  bevelCtx.lineWidth = Math.max(18, m * 0.10);
  bevelCtx.stroke(hpOuter);

  // Sombra interior MUY suave (no oscura)
  bevelCtx.save();
  bevelCtx.clip(hpInner);
  bevelCtx.shadowColor = `rgba(0,0,0,${0.18})`;
  bevelCtx.shadowBlur = Math.max(10, m * 0.06);
  bevelCtx.shadowOffsetX = Math.max(5, m * 0.02) * (0.7 + Math.max(0, lx));
  bevelCtx.shadowOffsetY = Math.max(5, m * 0.02) * (0.7 + Math.max(0, ly));
  bevelCtx.fillStyle = "rgba(0,0,0,0)";
  bevelCtx.fillRect(-w, -h, w*3, h*3);
  bevelCtx.restore();

  bevelCtx.restore();

  // RIM: borde fino brillante arriba (encima)
  bevelCtx.save();
  bevelCtx.shadowColor = "rgba(0,0,0,0.14)";
  bevelCtx.shadowBlur = Math.max(6, m * 0.02);
  bevelCtx.shadowOffsetX = 0;
  bevelCtx.shadowOffsetY = Math.max(2, m * 0.01);

  const rimGrad = bevelCtx.createLinearGradient(gx0, gy0, gx1, gy1);
  rimGrad.addColorStop(0.0, "rgba(255,255,255,0.85)");
  rimGrad.addColorStop(0.55, "rgba(255,245,235,0.45)");
  rimGrad.addColorStop(1.0, "rgba(0,0,0,0.10)");

  bevelCtx.lineWidth = RIM_THICKNESS;
  bevelCtx.strokeStyle = rimGrad;
  bevelCtx.stroke(hpOuter);

  bevelCtx.restore();
}

// ---------- Glitter render (solo dentro del hueco interior) ----------
function drawGlitter(ts) {
  const r = getRect();
  const w = r.width;
  const h = r.height;
  const m = Math.min(w, h);

  glitterCtx.clearRect(0, 0, w, h);

  // Purpurina SOLO dentro del hueco interior
  glitterCtx.save();
  glitterCtx.clip(hpInner);

  const src = getGlitterSource();
  const pattern = glitterCtx.createPattern(src, "repeat");

  const t = ts / 1000;
  const ox = (t * 12 + light.x * PARALLAX);
  const oy = (t * 9  + light.y * PARALLAX);

  glitterCtx.save();
  glitterCtx.translate(-ox, -oy);
  glitterCtx.fillStyle = pattern;
  glitterCtx.fillRect(ox, oy, w, h);
  glitterCtx.restore();

  // Profundidad MUY suave (no oscuro)
  glitterCtx.globalCompositeOperation = "multiply";
  const cx = w * 0.5;
  const cy = h * 0.52;
  const vg = glitterCtx.createRadialGradient(cx, cy, m * 0.14, cx, cy, m * 0.72);
  vg.addColorStop(0.0, "rgba(255,255,255,1)");
  vg.addColorStop(0.72, `rgba(0,0,0,${0.18 + PIT_EDGE_DARKEN})`);
  vg.addColorStop(1.0, `rgba(0,0,0,${0.16 + PIT_EDGE_DARKEN})`);
  glitterCtx.fillStyle = vg;
  glitterCtx.fillRect(0, 0, w, h);

  // Luz alineada al tilt (para 3D)
  glitterCtx.globalCompositeOperation = "screen";
  const lx = light.x, ly = light.y;
  const gx0 = w * 0.5 - lx * w * 0.65;
  const gy0 = h * 0.5 - ly * h * 0.65;
  const gx1 = w * 0.5 + lx * w * 0.65;
  const gy1 = h * 0.5 + ly * h * 0.65;

  const lg = glitterCtx.createLinearGradient(gx0, gy0, gx1, gy1);
  lg.addColorStop(0.0, `rgba(255,255,255,${PIT_LIGHT})`);
  lg.addColorStop(0.45, "rgba(255,255,255,0.10)");
  lg.addColorStop(1.0, "rgba(255,255,255,0)");
  glitterCtx.fillStyle = lg;
  glitterCtx.fillRect(0, 0, w, h);

  glitterCtx.globalCompositeOperation = "source-over";
  glitterCtx.restore();

  // Mascara: solo donde queda purpurina (maskCanvas)
  glitterCtx.save();
  setCtxToDevice(glitterCtx);
  glitterCtx.globalCompositeOperation = "destination-in";
  glitterCtx.drawImage(maskCanvas, 0, 0);
  glitterCtx.globalCompositeOperation = "source-over";
  glitterCtx.restore();
  setCtxToCss(glitterCtx);
}

// ---------- Shine (solo donde queda purpurina) ----------
function initShineTwinkles() {
  const r = getRect();
  const w = r.width;
  const h = r.height;

  shineTwinkles = [];
  let attempts = 0;

  while (shineTwinkles.length < SHINE_TWINKLES && attempts < 2600) {
    attempts++;
    const x = Math.random() * w;
    const y = Math.random() * h;
    // solo dentro del hueco interior
    if (!shineCtx.isPointInPath(hpInner, x, y)) continue;

    shineTwinkles.push({
      x, y,
      r: 7 + Math.random() * 12,
      speed: 0.9 + Math.random() * 1.8,
      phase: Math.random() * Math.PI * 2
    });
  }
}

function drawTwinkleOn(ctx2d, x, y, r, alpha) {
  ctx2d.save();
  ctx2d.globalAlpha = alpha;
  ctx2d.lineWidth = Math.max(1, r * 0.33);
  ctx2d.strokeStyle = "rgba(255,255,255,0.98)";

  ctx2d.beginPath();
  ctx2d.moveTo(x - r, y);
  ctx2d.lineTo(x + r, y);
  ctx2d.moveTo(x, y - r);
  ctx2d.lineTo(x, y + r);
  ctx2d.stroke();

  ctx2d.globalAlpha = alpha * 0.65;
  ctx2d.beginPath();
  ctx2d.moveTo(x - r * 0.75, y - r * 0.75);
  ctx2d.lineTo(x + r * 0.75, y + r * 0.75);
  ctx2d.moveTo(x - r * 0.75, y + r * 0.75);
  ctx2d.lineTo(x + r * 0.75, y - r * 0.75);
  ctx2d.stroke();
  ctx2d.restore();
}

function drawShine(ts) {
  const r = getRect();
  const w = r.width;
  const h = r.height;

  shineCtx.clearRect(0, 0, w, h);

  shineCtx.save();
  shineCtx.clip(hpInner);

  const prog = (ts % SHINE_PERIOD_MS) / SHINE_PERIOD_MS;
  const sweepDir = (light.x * 0.35 + 0.65);
  const x0 = -w + (w * 2.6) * ((prog * 0.85) + (sweepDir * 0.15));
  const x1 = x0 + w * 1.15;

  const sweep = shineCtx.createLinearGradient(x0, 0, x1, h);
  sweep.addColorStop(0.0, "rgba(255,255,255,0)");
  sweep.addColorStop(0.48, "rgba(255,255,255,0)");
  sweep.addColorStop(0.53, "rgba(255,255,255,0.95)");
  sweep.addColorStop(0.58, "rgba(255,255,255,0)");
  sweep.addColorStop(1.0, "rgba(255,255,255,0)");

  shineCtx.globalAlpha = 0.70;
  shineCtx.fillStyle = sweep;
  shineCtx.fillRect(0, 0, w, h);

  const tsec = ts / 1000;
  for (const t of shineTwinkles) {
    const a = Math.max(0, Math.sin(tsec * t.speed + t.phase));
    const alpha = 0.10 + Math.pow(a, 3) * 0.62;
    drawTwinkleOn(shineCtx, t.x, t.y, t.r, alpha);
  }

  if (ts - shineLastBling > SHINE_BLING_EVERY_MS) {
    shineLastBling = ts;

    const bx = w * (0.25 + Math.random() * 0.50);
    const by = h * (0.28 + Math.random() * 0.48);
    const br = Math.min(w, h) * 0.18;

    shineCtx.globalAlpha = 0.92;
    const bl = shineCtx.createRadialGradient(bx, by, 0, bx, by, br);
    bl.addColorStop(0, "rgba(255,255,255,1)");
    bl.addColorStop(1, "rgba(255,255,255,0)");
    shineCtx.fillStyle = bl;
    shineCtx.beginPath();
    shineCtx.arc(bx, by, br, 0, Math.PI * 2);
    shineCtx.fill();

    for (let i = 0; i < 3; i++) {
      drawTwinkleOn(
        shineCtx,
        bx + (Math.random()-0.5) * 70,
        by + (Math.random()-0.5) * 70,
        18 + Math.random() * 10,
        0.9
      );
    }
  }

  shineCtx.restore();

  // Mascara por “lo que queda”
  shineCtx.save();
  setCtxToDevice(shineCtx);
  shineCtx.globalCompositeOperation = "destination-in";
  shineCtx.drawImage(maskCanvas, 0, 0);
  shineCtx.globalCompositeOperation = "source-over";
  shineCtx.restore();
  setCtxToCss(shineCtx);
}

// ---------- Particles “glitter jumps” ----------
function emitGlitterParticles(x, y, strength = 1) {
  if (particles.length > MAX_PARTICLES) return;

  const count = Math.max(1, Math.floor(EMIT_RATE * strength));
  for (let i = 0; i < count; i++) {
    if (particles.length >= MAX_PARTICLES) break;

    const ang = (-Math.PI/2) + (Math.random() - 0.5) * 1.05;
    const sp = 260 + Math.random()*420;
    const vx = Math.cos(ang) * sp + (Math.random()-0.5)*120;
    const vy = Math.sin(ang) * sp - (Math.random()*240);

    const size = 2.2 + Math.random()*4.0;
    const ttl = 0.55 + Math.random()*0.55;
    const rot = Math.random()*Math.PI*2;
    const vr = (Math.random()-0.5) * 12;

    const goldPick = Math.random();
    const c = goldPick > 0.85 ? [255,245,220] : goldPick > 0.5 ? [245,205,110] : [210,160,55];

    particles.push({ x, y, vx, vy, size, rot, vr, t: 0, ttl, c });
  }
}

function stepParticles(dt) {
  if (!particles.length) return;

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.t += dt;
    if (p.t >= p.ttl) {
      particles.splice(i, 1);
      continue;
    }

    p.vx *= PARTICLE_DRAG;
    p.vy *= PARTICLE_DRAG;
    p.vy += GRAVITY * dt;

    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.vr * dt;
  }
}

function drawParticles() {
  const r = getRect();
  const w = r.width;
  const h = r.height;

  particlesCtx.clearRect(0, 0, w, h);

  for (const p of particles) {
    const life = 1 - (p.t / p.ttl);
    const alpha = Math.max(0, Math.min(1, life));

    particlesCtx.save();
    particlesCtx.globalAlpha = 0.75 * alpha;
    particlesCtx.translate(p.x, p.y);
    particlesCtx.rotate(p.rot);

    particlesCtx.fillStyle = `rgba(${p.c[0]},${p.c[1]},${p.c[2]},${0.85})`;
    particlesCtx.fillRect(-p.size, -p.size*0.55, p.size*2, p.size*1.1);

    particlesCtx.globalAlpha = 0.25 * alpha;
    particlesCtx.fillStyle = "rgba(255,255,255,1)";
    particlesCtx.fillRect(-p.size*0.5, -p.size*0.45, p.size, p.size*0.35);

    particlesCtx.restore();
  }
}

// ---------- Outline final ----------
function drawOutline() {
  const r = getRect();
  const w = r.width;
  const h = r.height;

  outlineCtx.clearRect(0, 0, w, h);

  const grad = outlineCtx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, "#f6e6b6");
  grad.addColorStop(0.5, "#e8c97a");
  grad.addColorStop(1, "#caa24d");

  outlineCtx.save();
  outlineCtx.strokeStyle = grad;
  outlineCtx.lineWidth = 10;
  outlineCtx.lineJoin = "round";
  outlineCtx.lineCap = "round";
  outlineCtx.shadowColor = "rgba(255,255,255,0.85)";
  outlineCtx.shadowBlur = 10;
  outlineCtx.stroke(hpOuter);
  outlineCtx.restore();

  outlineCanvas.classList.add("on");
  outlineOn = true;
}

// ---------- Coverage detection ----------
function computeRemainingRatio() {
  const S = 72;
  covCanvas.width = S;
  covCanvas.height = S;
  covCtx.setTransform(1, 0, 0, 1, 0, 0);
  covCtx.clearRect(0, 0, S, S);
  covCtx.drawImage(maskCanvas, 0, 0, S, S);

  const img = covCtx.getImageData(0, 0, S, S).data;
  let sum = 0;
  for (let i = 3; i < img.length; i += 4) sum += img[i];

  if (fullAlphaSum <= 0) return 1;
  return sum / fullAlphaSum;
}

function maybeFinish(ts) {
  if (celebrated) return;
  if (ts - lastCoverageCheck < COVERAGE_CHECK_MS) return;
  lastCoverageCheck = ts;

  const ratio = computeRemainingRatio();
  if (ratio <= FINISH_REMAIN_RATIO) {
    celebrated = true;

    if (!outlineOn) drawOutline();

    clearTimeout(popupTimer);
    popupTimer = setTimeout(showPopup, POPUP_DELAY_MS);
  }
}

// ---------- Input ----------
function posFromClient(clientX, clientY) {
  const r = glitterCanvas.getBoundingClientRect();
  return { x: clientX - r.left, y: clientY - r.top };
}

function startAt(p) {
  drawing = true;
  last = p;
  if (hint) hint.style.opacity = "0";
  eraseOnMask(p.x, p.y);
  emitGlitterParticles(p.x, p.y, 1.4);
  maybeFinish(performance.now());
}

function scheduleMove(p) {
  pendingPoint = p;
  if (rafPending) return;

  rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    if (!drawing || !last || !pendingPoint) return;

    eraseStrokeOnMask(last, pendingPoint);
    last = pendingPoint;
    pendingPoint = null;
    maybeFinish(performance.now());
  });
}

function endDraw() {
  drawing = false;
  last = null;
  pendingPoint = null;
  rafPending = false;
}

function onPointerDown(e) {
  if (touchActive) return;
  if (activePointerId !== null) return;
  activePointerId = e.pointerId;
  try { glitterCanvas.setPointerCapture(activePointerId); } catch {}
  startAt(posFromClient(e.clientX, e.clientY));
}

function onPointerMove(e) {
  if (touchActive) return;
  if (!drawing || e.pointerId !== activePointerId) return;
  scheduleMove(posFromClient(e.clientX, e.clientY));
}

function onPointerUp(e) {
  if (touchActive) return;
  if (e.pointerId !== activePointerId) return;
  try { glitterCanvas.releasePointerCapture(activePointerId); } catch {}
  activePointerId = null;
  endDraw();
}

function onTouchStart(e) {
  touchActive = true;
  e.preventDefault();
  const t = e.touches[0];
  if (!t) return;
  startAt(posFromClient(t.clientX, t.clientY));
}

function onTouchMove(e) {
  if (!touchActive || !drawing) return;
  e.preventDefault();
  const t = e.touches[0];
  if (!t) return;
  scheduleMove(posFromClient(t.clientX, t.clientY));
}

function onTouchEnd(e) {
  e.preventDefault();
  touchActive = false;
  endDraw();
}

// ---------- 3D (DeviceOrientation + Mouse) ----------
async function requestMotionPermissionIfNeeded() {
  if (askedMotionPermission) return;
  askedMotionPermission = true;

  const Doe = window.DeviceOrientationEvent;
  if (Doe && typeof Doe.requestPermission === "function") {
    try {
      const res = await Doe.requestPermission();
      if (res !== "granted") setStatus("Sin permiso de movimiento: el 3D irá con el ratón.");
    } catch {
      setStatus("Permiso de movimiento no disponible: el 3D irá con el ratón.");
    }
  }
}

function installOrientationListener() {
  window.addEventListener("deviceorientation", (e) => {
    const g = (e.gamma ?? 0) / 45;
    const b = (e.beta ?? 0) / 45;

    const x = Math.max(-1, Math.min(1, g));
    const y = Math.max(-1, Math.min(1, b));

    lightTarget = { x: x * 0.9, y: -y * 0.9 };
  }, { passive: true });
}

function installMouseLight() {
  stage.addEventListener("mousemove", (e) => {
    const r = stage.getBoundingClientRect();
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
    const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
    lightTarget = { x: nx * 0.9, y: ny * 0.9 };
  });
  stage.addEventListener("mouseleave", () => {
    lightTarget = { x: -0.6, y: -0.45 };
  });
}

// ---------- Reset ----------
function resetAll() {
  touchActive = false;
  activePointerId = null;
  drawing = false;
  last = null;
  pendingPoint = null;
  rafPending = false;

  celebrated = false;
  outlineOn = false;
  outlineCanvas.classList.remove("on");

  clearTimeout(popupTimer);
  popupShown = false;
  hidePopup();

  if (hint) {
    hint.style.opacity = "1";
    hint.textContent = "Rasca la purpurina para descubrir la hora";
  }

  particles = [];

  fitAllCanvases();
  initMaskFull();

  // Baseline alpha sum
  const S = 72;
  covCanvas.width = S;
  covCanvas.height = S;
  covCtx.clearRect(0, 0, S, S);
  covCtx.drawImage(maskCanvas, 0, 0, S, S);
  const base = covCtx.getImageData(0, 0, S, S).data;
  let sum = 0;
  for (let i = 3; i < base.length; i += 4) sum += base[i];
  fullAlphaSum = Math.max(1, sum);

  drawBase();
  initShineTwinkles();
  shineLastBling = 0;
  lastBevelL = { x: 999, y: 999 };

  updateMusicBtn();
  setStatus("");
}

// ---------- Intro ----------
async function toStep0Initial() {
  introMsg1.classList.add("show");
  await typewriter(type1, caret1, TEXT_STEP1, 22);
}

async function toStep1() {
  await startMusicFromGesture();
  await requestMotionPermissionIfNeeded();

  introMsg1.classList.remove("show");
  introMsg2.classList.add("show");
  introTap.classList.add("show");

  await typewriter(type2, caret2, TEXT_STEP2, 22);
  introStep = 1;
}

async function toStep2() {
  intro.classList.add("step2");

  if (flash) {
    flash.classList.remove("on");
    void flash.offsetWidth;
    flash.classList.add("on");
  }

  await playWhoosh();

  intro.classList.add("intro-dismiss");
  setTimeout(() => { intro.style.display = "none"; }, 520);
}

function onIntroTap(e) {
  e.preventDefault();
  if (introStep === 0) toStep1();
  else toStep2();
}

// ---------- Loop ----------
function loop(ts) {
  const r = getRect();
  if (!r.width || !r.height) {
    requestAnimationFrame(loop);
    return;
  }

  light.x = lerp(light.x, lightTarget.x, LIGHT_SMOOTH);
  light.y = lerp(light.y, lightTarget.y, LIGHT_SMOOTH);

  // Troquel y cavidad: redraw con luz
  drawBevel();
  drawBase();

  // Capas
  drawGlitter(ts);
  drawShine(ts);

  const dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0.016;
  lastTs = ts;
  stepParticles(dt);
  drawParticles();

  requestAnimationFrame(loop);
}

// ---------- Setup ----------
function setup() {
  preloadGlitterImage();
  installOrientationListener();
  installMouseLight();

  intro.addEventListener("click", onIntroTap);
  intro.addEventListener("touchend", onIntroTap, { passive: false });
  intro.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") onIntroTap(e);
  });

  glitterCanvas.addEventListener("pointerdown", onPointerDown);
  glitterCanvas.addEventListener("pointermove", onPointerMove);
  glitterCanvas.addEventListener("pointerup", onPointerUp);
  glitterCanvas.addEventListener("pointercancel", onPointerUp);

  glitterCanvas.addEventListener("touchstart", onTouchStart, { passive: false });
  glitterCanvas.addEventListener("touchmove", onTouchMove, { passive: false });
  glitterCanvas.addEventListener("touchend", onTouchEnd, { passive: false });
  glitterCanvas.addEventListener("touchcancel", onTouchEnd, { passive: false });

  resetBtn.addEventListener("click", resetAll);
  window.addEventListener("resize", resetAll);

  musicBtn.addEventListener("click", async () => {
    if (!bgm) return;
    if (bgm.paused) await startMusicFromGesture();
    else { bgm.pause(); updateMusicBtn(); }
  });

  resetAll();
  toStep0Initial();
  updateMusicBtn();

  requestAnimationFrame(loop);
}

setup();