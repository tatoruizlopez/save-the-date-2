// ======= CONFIG =======
const HORA = "12:00";
const BRUSH = 32;
const CELEBRATE_AFTER = 220;

const TEXT_STEP1 = "Pulsa aquí, somos Cris, Elián y Jose.";
const TEXT_STEP2 = "Tenemos que compartir contigo una cosa…";

// SUPER GLITTER (solo para el oro rascable: sutil)
const GLITTER_DUST = 220;
const GLITTER_TWINKLES = 18;
const SPARKLES_ON_SCRATCH = 2;

// SHINNY (más exagerado)
const SHINE_PERIOD_MS = 820;
const SHINE_TWINKLES = 22;
const SHINE_BLING_EVERY_MS = 2200;

// "HUECO" (purpurina realista depositada)
const PIT_TILE_SIZE = 256;
const PIT_GRAIN = 2800;          // grano gordo
const PIT_TWINKLES = 120;        // estrellas que parpadean
const PIT_FPS_MS = 34;           // ~30fps
const PIT_DRIFT = 14;            // movimiento sutil del patrón
const PIT_BLING_EVERY_MS = 1600; // “bling” extra cada X ms

// POPUP tras completar (3s)
const POPUP_DELAY_MS = 7000;
// ======================

// Intro
const intro = document.getElementById("intro");
const flash = document.getElementById("flash");

const introMsg1 = document.getElementById("introMsg1");
const introMsg2 = document.getElementById("introMsg2");
const introTap = document.getElementById("introTap");

const type1 = document.getElementById("type1");
const type2 = document.getElementById("type2");
const caret1 = document.getElementById("caret1");
const caret2 = document.getElementById("caret2");

let introStep = 0;

// Main
const stage = document.getElementById("heartStage");
const reveal = document.getElementById("heartReveal");

// Canvases
const pitCanvas = document.getElementById("pit");
const pitCtx = pitCanvas.getContext("2d");

const bevelCanvas = document.getElementById("bevel");
const bevelCtx = bevelCanvas.getContext("2d");

const canvas = document.getElementById("scratch");
const ctx = canvas.getContext("2d");

const shineCanvas = document.getElementById("shine");
const shineCtx = shineCanvas.getContext("2d");

const outlineCanvas = document.getElementById("outline");
const outlineCtx = outlineCanvas.getContext("2d");

const hint = document.getElementById("hint");
const resetBtn = document.getElementById("resetBtn");
const musicBtn = document.getElementById("musicBtn");
const musicStatus = document.getElementById("musicStatus");

// Popup
const popup = document.getElementById("popup");
let popupTimer = null;
let popupShown = false;

// Audio
const bgm = document.getElementById("bgm");
const whoosh = document.getElementById("whoosh");

document.getElementById("hora").textContent = HORA;

// Scratch state
let hp = null;
let drawing = false;
let last = null;
let scratchUnits = 0;
let celebrated = false;

let activePointerId = null;
let touchActive = false;

let rafPending = false;
let pendingPoint = null;

// Sparkles (DOM)
let sparkleBudget = 0;

// Music state
let statusTimer = null;
let audioStarted = false;

// Shine state
let shineActive = false;
let shineRAF = null;
let shineTwinkles = [];
let lastShineTs = 0;
let lastBlingTs = 0;

// Outline state
let outlineOn = false;

// PIT (glitter deposit) state
let pitActive = false;
let pitRAF = null;
let pitPattern = null;
let pitTile = null;
let pitTwinkles = [];
let lastPitTs = 0;
let lastPitBlingTs = 0;

function setStatus(msg) {
  if (!musicStatus) return;
  clearTimeout(statusTimer);

  if (!msg) {
    musicStatus.classList.remove("show");
    musicStatus.textContent = "";
    return;
  }

  musicStatus.textContent = msg;
  musicStatus.classList.add("show");
  statusTimer = setTimeout(() => {
    musicStatus.classList.remove("show");
    musicStatus.textContent = "";
  }, 4500);
}

function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/* POPUP */
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

/* TYPEWRITER */
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

/* AUDIO */
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
  if (!bgm || audioStarted) return;

  audioStarted = true;
  bgm.volume = 0.0;
  try { bgm.load(); } catch {}

  try {
    await bgm.play();
    fadeVolume(0.85, 650);
  } catch {
    setStatus("El navegador bloqueó el audio. Revisa: sitio no silenciado / permiso de sonido.");
    audioStarted = false;
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

/* SPARKLES (DOM) */
function spawnSparkle(x, y, scale = 1) {
  if (sparkleBudget > 18) return;
  sparkleBudget++;

  const s = document.createElement("span");
  s.textContent = Math.random() > 0.55 ? "✨" : "✦";
  s.style.position = "absolute";
  s.style.left = `${x}px`;
  s.style.top = `${y}px`;
  s.style.transform = `translate(-50%, -50%) scale(${0.8 * scale})`;
  s.style.opacity = "0";
  s.style.pointerEvents = "none";
  s.style.filter = "drop-shadow(0 6px 10px rgba(255,255,255,0.35))";
  s.style.transition = `all ${600 + Math.random()*450}ms ease-out`;

  stage.appendChild(s);

  const dx = (Math.random() - 0.5) * 140;
  const dy = -70 - Math.random() * 120;
  const rot = (Math.random() - 0.5) * 80;

  requestAnimationFrame(() => {
    s.style.opacity = "1";
    s.style.transform = `translate(-50%, -50%) translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(${1.1 * scale})`;
  });

  setTimeout(() => { s.style.opacity = "0"; }, 420);
  setTimeout(() => {
    s.remove();
    sparkleBudget = Math.max(0, sparkleBudget - 1);
  }, 900);
}

function sparkleBurst(centerX, centerY, count = 18) {
  for (let i = 0; i < count; i++) {
    spawnSparkle(centerX + (Math.random()-0.5)*20, centerY + (Math.random()-0.5)*20, 1 + Math.random()*0.5);
  }
}

/* CANVAS SIZING + HEART PATH */
function getRect() { return stage.getBoundingClientRect(); }

function fitCanvasAll() {
  const r = getRect();
  const dpr = window.devicePixelRatio || 1;

  // Scratch
  canvas.width = Math.round(r.width * dpr);
  canvas.height = Math.round(r.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Shine
  shineCanvas.width = Math.round(r.width * dpr);
  shineCanvas.height = Math.round(r.height * dpr);
  shineCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Outline
  outlineCanvas.width = Math.round(r.width * dpr);
  outlineCanvas.height = Math.round(r.height * dpr);
  outlineCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Pit (glitter deposit)
  pitCanvas.width = Math.round(r.width * dpr);
  pitCanvas.height = Math.round(r.height * dpr);
  pitCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Bevel (relief)
  bevelCanvas.width = Math.round(r.width * dpr);
  bevelCanvas.height = Math.round(r.height * dpr);
  bevelCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function buildHeartPath(w, h) {
  const cx = w * 0.5;
  const cy = h * 0.55;
  const size = Math.min(w, h) * 0.58;

  const p = new Path2D();
  p.moveTo(cx, cy + size * 0.35);
  p.bezierCurveTo(cx + size, cy - size * 0.2, cx + size * 0.75, cy - size * 1.05, cx, cy - size * 0.55);
  p.bezierCurveTo(cx - size * 0.75, cy - size * 1.05, cx - size, cy - size * 0.2, cx, cy + size * 0.35);
  p.closePath();
  return p;
}

function rebuildHeart() {
  const r = getRect();
  hp = buildHeartPath(r.width, r.height);
}

function hideReveal() { if (reveal) reveal.style.opacity = "0"; }
function showReveal() { if (reveal) reveal.style.opacity = "1"; }

function drawTwinkleOn(ctx2d, x, y, r, alpha) {
  ctx2d.save();
  ctx2d.globalAlpha = alpha;
  ctx2d.lineWidth = Math.max(1, r * 0.35);
  ctx2d.strokeStyle = "rgba(255,255,255,0.98)";
  ctx2d.beginPath();
  ctx2d.moveTo(x - r, y);
  ctx2d.lineTo(x + r, y);
  ctx2d.moveTo(x, y - r);
  ctx2d.lineTo(x, y + r);
  ctx2d.stroke();

  ctx2d.globalAlpha = alpha * 0.7;
  ctx2d.beginPath();
  ctx2d.moveTo(x - r * 0.75, y - r * 0.75);
  ctx2d.lineTo(x + r * 0.75, y + r * 0.75);
  ctx2d.moveTo(x - r * 0.75, y + r * 0.75);
  ctx2d.lineTo(x + r * 0.75, y - r * 0.75);
  ctx2d.stroke();
  ctx2d.restore();
}

/* ====== PIT (purpurina depositada) ====== */
function makeGoldGlitterTile(size = PIT_TILE_SIZE) {
  const t = document.createElement("canvas");
  t.width = t.height = size;
  const g = t.getContext("2d");

  // Base oro
  g.fillStyle = "#b78612";
  g.fillRect(0, 0, size, size);

  // Grano gordo (muchas partículas)
  for (let i = 0; i < PIT_GRAIN; i++) {
    const r = 0.7 + Math.random() * 2.6;
    const x = Math.random() * size;
    const y = Math.random() * size;

    const pick = Math.random();
    const a = 0.10 + Math.random() * 0.38;

    // Variación de tonos oro
    const rr = pick > 0.90 ? 255 : (210 + Math.random() * 45);
    const gg = pick > 0.90 ? 248 : (165 + Math.random() * 55);
    const bb = pick > 0.90 ? 220 : (45 + Math.random() * 60);

    g.fillStyle = `rgba(${rr},${gg},${bb},${a})`;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }

  // Micro “sparkles”
  for (let i = 0; i < 160; i++) {
    const r = 0.5 + Math.random() * 1.2;
    const x = Math.random() * size;
    const y = Math.random() * size;
    g.fillStyle = `rgba(255,255,255,${0.06 + Math.random() * 0.18})`;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }

  return t;
}

function initPit(w, h) {
  if (!pitTile) pitTile = makeGoldGlitterTile(PIT_TILE_SIZE);
  pitPattern = pitCtx.createPattern(pitTile, "repeat");

  pitTwinkles = [];
  let attempts = 0;

  while (pitTwinkles.length < PIT_TWINKLES && attempts < 5000) {
    attempts++;
    const x = Math.random() * w;
    const y = Math.random() * h;
    if (!pitCtx.isPointInPath(hp, x, y)) continue;

    pitTwinkles.push({
      x, y,
      r: 6 + Math.random() * 12,
      speed: 0.8 + Math.random() * 2.2,
      phase: Math.random() * Math.PI * 2
    });
  }

  lastPitTs = 0;
  lastPitBlingTs = 0;
}

function drawPitFrame(ts) {
  const r = getRect();
  const w = r.width;
  const h = r.height;

  pitCtx.clearRect(0, 0, w, h);

  // Recorte corazón
  pitCtx.save();
  pitCtx.clip(hp);

  // Fondo: patrón con drift suave
  const t = ts / 1000;
  pitCtx.save();
  pitCtx.translate(-(t * PIT_DRIFT) % PIT_TILE_SIZE, -(t * PIT_DRIFT * 0.75) % PIT_TILE_SIZE);
  pitCtx.fillStyle = pitPattern;
  pitCtx.fillRect(-PIT_TILE_SIZE, -PIT_TILE_SIZE, w + PIT_TILE_SIZE * 2, h + PIT_TILE_SIZE * 2);
  pitCtx.restore();

  // Profundidad: oscurecer un poco bordes (vignette)
  const cx = w * 0.50;
  const cy = h * 0.52;
  const rr = Math.min(w, h) * 0.62;
  const vg = pitCtx.createRadialGradient(cx, cy, rr * 0.12, cx, cy, rr);
  vg.addColorStop(0.0, "rgba(255,255,255,0.08)");
  vg.addColorStop(0.7, "rgba(0,0,0,0.10)");
  vg.addColorStop(1.0, "rgba(0,0,0,0.22)");
  pitCtx.fillStyle = vg;
  pitCtx.fillRect(0, 0, w, h);

  // Twinkles parpadeando
  for (const s of pitTwinkles) {
    const a = Math.max(0, Math.sin(t * s.speed + s.phase));
    const alpha = 0.08 + Math.pow(a, 3) * 0.55;
    drawTwinkleOn(pitCtx, s.x, s.y, s.r, alpha);
  }

  // “Bling” extra cada X ms
  if (ts - lastPitBlingTs > PIT_BLING_EVERY_MS) {
    lastPitBlingTs = ts;

    const bx = w * (0.26 + Math.random() * 0.48);
    const by = h * (0.30 + Math.random() * 0.44);
    const br = Math.min(w, h) * (0.12 + Math.random() * 0.10);

    pitCtx.globalAlpha = 0.85;
    const bl = pitCtx.createRadialGradient(bx, by, 0, bx, by, br);
    bl.addColorStop(0, "rgba(255,255,255,1)");
    bl.addColorStop(1, "rgba(255,255,255,0)");
    pitCtx.fillStyle = bl;
    pitCtx.beginPath();
    pitCtx.arc(bx, by, br, 0, Math.PI * 2);
    pitCtx.fill();

    for (let i = 0; i < 2; i++) {
      drawTwinkleOn(pitCtx, bx + (Math.random()-0.5)*60, by + (Math.random()-0.5)*60, 18 + Math.random()*10, 0.9);
    }
    pitCtx.globalAlpha = 1;
  }

  pitCtx.restore();
}

function startPit() {
  if (pitActive) return;
  if (!hp) return;

  const r = getRect();
  initPit(r.width, r.height);

  pitActive = true;

  const loop = (ts) => {
    if (!pitActive) return;

    if (lastPitTs && ts - lastPitTs < PIT_FPS_MS) {
      pitRAF = requestAnimationFrame(loop);
      return;
    }
    lastPitTs = ts;

    drawPitFrame(ts);
    pitRAF = requestAnimationFrame(loop);
  };

  pitRAF = requestAnimationFrame(loop);
}

function stopPit() {
  pitActive = false;
  if (pitRAF) cancelAnimationFrame(pitRAF);
  pitRAF = null;
}

/* ====== BEVEL (relieve del hueco, siempre visible) ====== */
function drawBevel() {
  const r = getRect();
  const w = r.width;
  const h = r.height;
  const m = Math.min(w, h);

  bevelCtx.clearRect(0, 0, w, h);

  // 1) Sombra interior (hueco hacia dentro)
  bevelCtx.save();
  bevelCtx.clip(hp);

  bevelCtx.globalCompositeOperation = "source-over";
  bevelCtx.shadowColor = "rgba(0,0,0,0.42)";
  bevelCtx.shadowBlur = Math.max(10, m * 0.06);
  bevelCtx.shadowOffsetX = Math.max(6, m * 0.028);
  bevelCtx.shadowOffsetY = Math.max(6, m * 0.028);
  bevelCtx.fillStyle = "rgba(0,0,0,0)";
  bevelCtx.fillRect(-w, -h, w * 3, h * 3);

  // 2) Brillo interior (arriba-izquierda)
  bevelCtx.shadowColor = "rgba(255,255,255,0.30)";
  bevelCtx.shadowBlur = Math.max(9, m * 0.05);
  bevelCtx.shadowOffsetX = -Math.max(5, m * 0.022);
  bevelCtx.shadowOffsetY = -Math.max(5, m * 0.022);
  bevelCtx.fillRect(-w, -h, w * 3, h * 3);

  // 3) Línea interior oscura muy fina (profundidad extra)
  bevelCtx.shadowColor = "transparent";
  bevelCtx.globalAlpha = 0.20;
  bevelCtx.strokeStyle = "rgba(0,0,0,0.85)";
  bevelCtx.lineWidth = Math.max(2, m * 0.012);
  bevelCtx.stroke(hp);

  bevelCtx.restore();

  // 4) Borde fino tipo recorte (papel)
  bevelCtx.save();
  bevelCtx.globalAlpha = 1;
  bevelCtx.shadowColor = "rgba(0,0,0,0.16)";
  bevelCtx.shadowBlur = Math.max(5, m * 0.02);
  bevelCtx.shadowOffsetX = 0;
  bevelCtx.shadowOffsetY = Math.max(2, m * 0.01);

  // borde claro
  bevelCtx.lineWidth = Math.max(1.6, m * 0.008);
  bevelCtx.strokeStyle = "rgba(255,255,255,0.55)";
  bevelCtx.stroke(hp);

  // borde un pelín cálido (oro muy suave)
  const grad = bevelCtx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, "rgba(255,255,255,0.20)");
  grad.addColorStop(0.5, "rgba(255,210,120,0.18)");
  grad.addColorStop(1, "rgba(90,50,0,0.14)");
  bevelCtx.strokeStyle = grad;
  bevelCtx.stroke(hp);

  bevelCtx.restore();
}

/* GOLD HEART (capa rascable) */
function drawGoldHeartOverlay() {
  hideReveal();

  const r = getRect();
  const w = r.width;
  const h = r.height;

  ctx.clearRect(0, 0, w, h);

  ctx.save();
  ctx.clip(hp);

  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, cssVar("--gold1", "#f6e6b6"));
  g.addColorStop(0.5, cssVar("--gold2", "#e8c97a"));
  g.addColorStop(1, cssVar("--gold3", "#caa24d"));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Rayas sutiles tipo foil
  ctx.save();
  ctx.globalAlpha = 0.14;
  ctx.translate(w * 0.12, -h * 0.08);
  ctx.rotate(-Math.PI / 8);
  for (let i = -h; i < w + h; i += 16) {
    const grad = ctx.createLinearGradient(i, 0, i + 10, 0);
    grad.addColorStop(0, "rgba(255,255,255,0)");
    grad.addColorStop(0.5, "rgba(255,255,255,0.92)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(i, 0, 10, h * 1.7);
  }
  ctx.restore();

  // Brillitos MUY sutiles en la capa rascable (para que no compita con el glitter del hueco)
  ctx.save();
  ctx.globalAlpha = 0.22;
  for (let i = 0; i < GLITTER_DUST; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const rr = Math.random() * 1.2 + 0.15;
    ctx.beginPath();
    ctx.arc(x, y, rr, 0, Math.PI * 2);
    const bright = Math.random();
    ctx.fillStyle =
      bright > 0.88 ? "rgba(255,255,255,0.85)" :
      bright > 0.55 ? "rgba(255,255,255,0.55)" :
                      "rgba(255,255,255,0.28)";
    ctx.fill();
  }
  ctx.restore();

  for (let i = 0; i < GLITTER_TWINKLES; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const rr = Math.random() * 8 + 6;
    const a = Math.random() * 0.38 + 0.18;
    drawTwinkleOn(ctx, x, y, rr, a);
  }

  ctx.restore();

  showReveal();
}

/* OUTLINE */
function drawOutline() {
  const r = getRect();
  const w = r.width;
  const h = r.height;

  outlineCtx.clearRect(0, 0, w, h);

  const grad = outlineCtx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, cssVar("--gold1", "#f6e6b6"));
  grad.addColorStop(0.5, cssVar("--gold2", "#e8c97a"));
  grad.addColorStop(1, cssVar("--gold3", "#caa24d"));

  outlineCtx.save();
  outlineCtx.strokeStyle = grad;
  outlineCtx.lineWidth = 10;
  outlineCtx.lineJoin = "round";
  outlineCtx.lineCap = "round";
  outlineCtx.shadowColor = "rgba(255,255,255,0.85)";
  outlineCtx.shadowBlur = 10;
  outlineCtx.stroke(hp);
  outlineCtx.restore();

  outlineCanvas.classList.add("on");
  outlineOn = true;
}

/* SHINNY */
function initShineTwinkles(w, h) {
  shineTwinkles = [];
  let attempts = 0;

  while (shineTwinkles.length < SHINE_TWINKLES && attempts < 1600) {
    attempts++;
    const x = Math.random() * w;
    const y = Math.random() * h;
    if (!shineCtx.isPointInPath(hp, x, y)) continue;

    shineTwinkles.push({
      x, y,
      r: 7 + Math.random() * 12,
      speed: 0.9 + Math.random() * 1.4,
      phase: Math.random() * Math.PI * 2
    });
  }
}

function startShine() {
  if (shineActive) return;
  if (!hp) return;

  shineActive = true;
  shineCanvas.classList.remove("off");

  const r = getRect();
  initShineTwinkles(r.width, r.height);

  lastShineTs = 0;
  lastBlingTs = 0;

  const loop = (ts) => {
    if (!shineActive) return;

    if (lastShineTs && ts - lastShineTs < 28) {
      shineRAF = requestAnimationFrame(loop);
      return;
    }
    lastShineTs = ts;

    const w = r.width;
    const h = r.height;

    shineCtx.clearRect(0, 0, w, h);
    shineCtx.save();
    shineCtx.clip(hp);

    const prog = (ts % SHINE_PERIOD_MS) / SHINE_PERIOD_MS;
    const x0 = -w + (w * 2.4) * prog;
    const x1 = x0 + w * 1.05;

    const sweep = shineCtx.createLinearGradient(x0, 0, x1, h);
    sweep.addColorStop(0.0, "rgba(255,255,255,0)");
    sweep.addColorStop(0.46, "rgba(255,255,255,0)");
    sweep.addColorStop(0.52, "rgba(255,255,255,0.92)");
    sweep.addColorStop(0.58, "rgba(255,255,255,0)");
    sweep.addColorStop(1.0, "rgba(255,255,255,0)");

    shineCtx.globalAlpha = 0.78;
    shineCtx.fillStyle = sweep;
    shineCtx.fillRect(0, 0, w, h);

    shineCtx.globalAlpha = 0.22;
    const gx = w * (0.20 + 0.60 * prog);
    const gy = h * 0.32;
    const gr = Math.min(w, h) * 0.32;
    const blob = shineCtx.createRadialGradient(gx, gy, 0, gx, gy, gr);
    blob.addColorStop(0, "rgba(255,255,255,0.95)");
    blob.addColorStop(1, "rgba(255,255,255,0)");
    shineCtx.fillStyle = blob;
    shineCtx.beginPath();
    shineCtx.arc(gx, gy, gr, 0, Math.PI * 2);
    shineCtx.fill();

    for (const t of shineTwinkles) {
      const a = Math.max(0, Math.sin(ts / 1000 * t.speed + t.phase));
      const alpha = 0.12 + Math.pow(a, 3) * 0.65;
      drawTwinkleOn(shineCtx, t.x, t.y, t.r, alpha);
    }

    if (ts - lastBlingTs > SHINE_BLING_EVERY_MS) {
      lastBlingTs = ts;

      shineCtx.globalAlpha = 0.95;
      const bx = w * (0.25 + Math.random() * 0.50);
      const by = h * (0.28 + Math.random() * 0.48);
      const br = Math.min(w, h) * 0.18;
      const bl = shineCtx.createRadialGradient(bx, by, 0, bx, by, br);
      bl.addColorStop(0, "rgba(255,255,255,1)");
      bl.addColorStop(1, "rgba(255,255,255,0)");
      shineCtx.fillStyle = bl;
      shineCtx.beginPath();
      shineCtx.arc(bx, by, br, 0, Math.PI * 2);
      shineCtx.fill();

      for (let i = 0; i < 3; i++) {
        const tx = bx + (Math.random()-0.5) * 70;
        const ty = by + (Math.random()-0.5) * 70;
        drawTwinkleOn(shineCtx, tx, ty, 18 + Math.random()*10, 0.9);
      }
    }

    shineCtx.restore();
    shineRAF = requestAnimationFrame(loop);
  };

  shineRAF = requestAnimationFrame(loop);
}

function stopShine() {
  if (!shineActive) return;
  shineActive = false;
  if (shineRAF) cancelAnimationFrame(shineRAF);
  shineRAF = null;

  shineCanvas.classList.add("off");
  setTimeout(() => {
    const r = getRect();
    shineCtx.clearRect(0, 0, r.width, r.height);
  }, 320);
}

/* SCRATCH */
function posFromClient(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  return { x: clientX - r.left, y: clientY - r.top };
}

function scratchDot(p) {
  ctx.save();
  ctx.clip(hp);
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(p.x, p.y, BRUSH * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  scratchUnits += 10;

  spawnSparkle(p.x, p.y, 0.9);
}

function scratchStroke(a, b) {
  ctx.save();
  ctx.clip(hp);
  ctx.globalCompositeOperation = "destination-out";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = BRUSH;

  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.restore();

  const dx = b.x - a.x;
  const dy = b.y - a.y;
  scratchUnits += Math.sqrt(dx * dx + dy * dy) / 6;

  for (let i = 0; i < SPARKLES_ON_SCRATCH; i++) {
    const t = Math.random();
    spawnSparkle(
      a.x + (b.x - a.x) * t + (Math.random() - 0.5) * 10,
      a.y + (b.y - a.y) * t + (Math.random() - 0.5) * 10,
      0.75 + Math.random() * 0.35
    );
  }
}

function maybeCelebrate() {
  if (scratchUnits > 25) hint.style.opacity = "0";

  if (!celebrated && scratchUnits >= CELEBRATE_AFTER) {
    celebrated = true;
    hint.style.opacity = "0";

    const r = canvas.getBoundingClientRect();
    sparkleBurst(r.width * 0.50, r.height * 0.52, 26);

    if (!outlineOn) drawOutline();

    clearTimeout(popupTimer);
    popupTimer = setTimeout(showPopup, POPUP_DELAY_MS);
  }
}

function scheduleMove(p) {
  pendingPoint = p;
  if (rafPending) return;

  rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    if (!drawing || !last || !pendingPoint) return;

    scratchStroke(last, pendingPoint);
    last = pendingPoint;
    pendingPoint = null;
    maybeCelebrate();
  });
}

function startAt(p) {
  stopShine(); // al empezar a rascar, apagamos el shinny de la capa oro
  drawing = true;
  last = p;
  scratchDot(p);
  maybeCelebrate();
}

function endDraw() {
  drawing = false;
  last = null;
  pendingPoint = null;
  rafPending = false;
}

/* INPUT */
function onPointerDown(e) {
  if (touchActive) return;
  if (activePointerId !== null) return;

  activePointerId = e.pointerId;
  try { canvas.setPointerCapture(activePointerId); } catch {}
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
  try { canvas.releasePointerCapture(activePointerId); } catch {}
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

function resetScratch() {
  touchActive = false;
  activePointerId = null;
  scratchUnits = 0;
  celebrated = false;

  clearTimeout(popupTimer);
  popupShown = false;
  hidePopup();

  outlineOn = false;
  outlineCanvas.classList.remove("on");

  hint.style.opacity = "1";
  hint.textContent = "Rasca el corazón dorado para descubrir la hora";

  fitCanvasAll();
  rebuildHeart();

  // 1) Dibujar el "hueco" (purpurina) y arrancar animación
  const rr = getRect();
  initPit(rr.width, rr.height);
  startPit();

  // 2) Relieve siempre visible
  drawBevel();

  // 3) Capa oro rascable + shinny
  drawGoldHeartOverlay();
  startShine();

  updateMusicBtn();
  setStatus("");
}

/* INTRO FLOW */
async function toStep0Initial() {
  introMsg1.classList.add("show");
  await typewriter(type1, caret1, TEXT_STEP1, 22);
}

async function toStep1() {
  await startMusicFromGesture();

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

  stage.classList.remove("pop");
  void stage.offsetWidth;
  stage.classList.add("pop");
}

function onIntroTap(e) {
  e.preventDefault();
  if (introStep === 0) toStep1();
  else toStep2();
}

/* SETUP */
function setup() {
  requestAnimationFrame(() => resetScratch());

  intro.addEventListener("click", onIntroTap);
  intro.addEventListener("touchend", onIntroTap, { passive: false });
  intro.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") onIntroTap(e);
  });

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);

  canvas.addEventListener("touchstart", onTouchStart, { passive: false });
  canvas.addEventListener("touchmove", onTouchMove, { passive: false });
  canvas.addEventListener("touchend", onTouchEnd, { passive: false });
  canvas.addEventListener("touchcancel", onTouchEnd, { passive: false });

  resetBtn.addEventListener("click", resetScratch);
  window.addEventListener("resize", resetScratch);

  musicBtn.addEventListener("click", async () => {
    if (!bgm) return;
    if (bgm.paused) {
      audioStarted = false;
      await startMusicFromGesture();
    } else {
      bgm.pause();
      updateMusicBtn();
    }
  });

  toStep0Initial();
  updateMusicBtn();
}

setup();