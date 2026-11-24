/* Uçan Arda — tek dokunuşla uçma oyunu (özgün tasarım: neon kuleler, gezilen şehirlerin tabelaları; ekrandaki tek yüz Arda'nınki) */
(function () {
  "use strict";
  const AE = window.AE;
  const { $, esc } = AE;
  const STEP = 1 / 120;
  const BEST_KEY = "ae_game_best";

  let root = null, cv = null, ctx = null, raf = 0, onKey = null, onVis = null, ro = null;
  let W = 0, H = 0, dpr = 1, S = 1, GY = 0;
  let state = "ready", t = 0, last = 0, acc = 0, shake = 0, deadAt = 0;
  let bird, towers, hearts, parts, floats, score, best, speed, nextX;
  let face = null, sprite = null, signs = [], stars = [], towerN = 0;

  const rnd = (a, b) => a + Math.random() * (b - a);
  const getBest = () => { try { return +localStorage.getItem(BEST_KEY) || 0; } catch (e) { return 0; } };
  const setBest = v => { try { localStorage.setItem(BEST_KEY, String(v)); } catch (e) {} };
  let ACC = "#e8b67a", ACC_RGB = "232, 182, 122";
  const accent = () => ACC;
  const accentRGB = () => ACC_RGB;
  const readAccent = () => {
    const cs = getComputedStyle(document.documentElement);
    ACC = (cs.getPropertyValue("--accent") || "").trim() || ACC;
    ACC_RGB = (cs.getPropertyValue("--accent-rgb") || "").trim() || ACC_RGB;
  };

  function loadImg(src) {
    return new Promise(res => {
      if (!src) return res(null);
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => res(null);
      im.src = src;
    });
  }

  // şeffaf kafa görselinin etrafına ince beyaz kenar (çıkartma görünümü), bir kez hazırlanır
  function sticker(img) {
    const k = 320 / Math.max(img.width, img.height);
    const w = Math.round(img.width * k), h = Math.round(img.height * k), p = 8;
    const c = document.createElement("canvas");
    c.width = w + p * 2; c.height = h + p * 2;
    const x = c.getContext("2d");
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; x.drawImage(img, p + Math.cos(a) * 5, p + Math.sin(a) * 5, w, h); }
    x.globalCompositeOperation = "source-in";
    x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height);
    x.globalCompositeOperation = "source-over";
    x.drawImage(img, p, p, w, h);
    return c;
  }

  function measure() {
    const b = root.getBoundingClientRect();
    const oW = W, oH = H;
    W = Math.max(280, b.width); H = Math.max(320, b.height);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    S = Math.max(0.62, Math.min(1.35, H / 820));
    GY = H - Math.max(56, H * 0.12);
    if (oW && bird) {
      const kx = W / oW, ky = H / oH;
      bird.x = Math.max(90, W * 0.3); bird.y *= ky;
      towers.forEach(tw => { tw.x *= kx; tw.gy *= ky; tw.gap *= ky; });
      hearts.forEach(h => { h.x *= kx; h.y *= ky; });
    }
    stars = Array.from({ length: Math.round((W * H) / 9000) }, () => ({ x: Math.random() * W, y: Math.random() * GY * 0.8, r: Math.random() * 1.3 + 0.3, p: Math.random() * 6.28 }));
  }

  function reset() {
    score = 0; best = getBest(); t = 0; acc = 0; shake = 0;
    speed = 235 * S;
    bird = { x: Math.max(90, W * 0.3), y: H * 0.45, vy: 0, r: Math.max(18, 27 * S), rot: 0 };
    towers = []; hearts = []; parts = []; floats = [];
    nextX = W + 60;
    hud();
  }
  const gapFor = () => Math.max(150 * S, Math.min(H * 0.27, 230 * S) - score * 2.2 * S);
  const spacing = () => Math.max(250 * S, Math.min(W * 0.5, 420 * S));
  function spawn() {
    const gap = gapFor();
    const top = H * 0.14 + gap / 2, bot = GY - H * 0.06 - gap / 2;
    const prev = towers.length ? towers[towers.length - 1].gy : (top + bot) / 2;
    const gy = Math.max(top, Math.min(bot, prev + rnd(-H * 0.28, H * 0.28)));
    const tw = 84 * S;
    towers.push({ x: nextX, gy, gap, w: tw, passed: false, seed: Math.random() * 1000, name: signs.length ? signs[towerN % signs.length] : "" });
    towerN++;
    if (Math.random() < 0.45) hearts.push({ x: nextX + tw + spacing() / 2 - tw / 2, y: Math.max(top, Math.min(bot, gy + rnd(-gap * 0.25, gap * 0.25))), got: false, p: Math.random() * 6 });
    nextX += spacing();
  }

  function flap() {
    if (state === "ready") { start(); return; }
    if (state !== "play") return;
    bird.vy = -560 * S;
    for (let i = 0; i < 5; i++) parts.push({ x: bird.x - bird.r * 0.6, y: bird.y + rnd(-6, 6), vx: rnd(-160, -60) * S, vy: rnd(-40, 80) * S, life: 0.5, max: 0.5, c: Math.random() < 0.5 ? "#fff" : accent() });
  }
  function start() {
    reset();
    state = "play";
    panel(null);
    flap();
  }
  function die() {
    if (state !== "play") return;
    state = "dead"; deadAt = t; shake = 0.35;
    bird.vy = Math.min(bird.vy, -200 * S);
    for (let i = 0; i < 26; i++) parts.push({ x: bird.x, y: bird.y, vx: rnd(-320, 320) * S, vy: rnd(-380, 200) * S, life: 0.9, max: 0.9, c: i % 3 ? accent() : "#ff3d5a" });
    const rec = score > best;
    if (rec) { best = score; setBest(best); }
    setTimeout(() => { if (root && state === "dead") panel("over", rec); }, 750);
  }

  function update(dt) {
    t += dt;
    for (const p of parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 600 * S * dt; p.life -= dt; }
    parts = parts.filter(p => p.life > 0);
    for (const f of floats) { f.y -= 50 * dt; f.life -= dt; }
    floats = floats.filter(f => f.life > 0);
    if (shake > 0) shake -= dt;
    if (state === "ready") { bird.y = H * 0.45 + Math.sin(t * 3) * 10 * S; bird.rot = Math.sin(t * 3) * 0.08; return; }
    if (state === "paused") return;
    bird.vy = Math.min(bird.vy + 1900 * S * dt, 950 * S);
    bird.y += bird.vy * dt;
    bird.rot = Math.max(-0.45, Math.min(1.1, bird.vy / (900 * S)));
    if (state === "dead") { if (bird.y > GY - bird.r) { bird.y = GY - bird.r; bird.vy = 0; } return; }
    const v = speed * dt;
    towers.forEach(tw => { tw.x -= v; });
    hearts.forEach(h => { h.x -= v; });
    while (nextX < W + 200) spawn();
    nextX -= v;
    towers = towers.filter(tw => tw.x + tw.w > -40);
    hearts = hearts.filter(h => h.x > -40 && !h.got);
    const R = bird.r * 0.8;
    if (bird.y - R < 0 || bird.y + R > GY) return die();
    for (const tw of towers) {
      if (!tw.passed && tw.x + tw.w < bird.x - R) { tw.passed = true; score++; speed = Math.min(390 * S, speed + 5 * S); hud(); }
      if (bird.x + R > tw.x && bird.x - R < tw.x + tw.w) {
        const top = tw.gy - tw.gap / 2, bot = tw.gy + tw.gap / 2;
        const hit = (y0, y1) => {
          const cx = Math.max(tw.x, Math.min(bird.x, tw.x + tw.w)), cy = Math.max(y0, Math.min(bird.y, y1));
          return (bird.x - cx) ** 2 + (bird.y - cy) ** 2 < R * R;
        };
        if (hit(-1e4, top) || hit(bot, 1e4)) return die();
      }
    }
    for (const h of hearts) {
      if (!h.got && Math.hypot(h.x - bird.x, h.y - bird.y) < bird.r + 16 * S) {
        h.got = true; score++; hud();
        floats.push({ x: h.x, y: h.y - 10, txt: "+1 ♥", life: 0.9 });
        for (let i = 0; i < 10; i++) parts.push({ x: h.x, y: h.y, vx: rnd(-200, 200) * S, vy: rnd(-260, 60) * S, life: 0.6, max: 0.6, c: "#ff3d5a" });
      }
    }
  }

  /* ---------- çizim ---------- */
  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function cover(img, x, y, w, h) {
    const ar = img.width / img.height, tr = w / h;
    let sw = img.width, sh = img.height, sx = 0, sy = 0;
    if (ar > tr) { sw = img.height * tr; sx = (img.width - sw) / 2; } else { sh = img.width / tr; sy = (img.height - sh) / 2; }
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  }
  /* neon kuleler: koyu cam gövde, yanıp sönen pencereler, ağızda parlayan kapak; alt gövdede gezilen şehrin adı */
  const hash = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };
  function segment(tw, y0, y1, capBottom) {
    const x = tw.x, w = tw.w, h = y1 - y0, A = accentRGB();
    if (h < 4) return;
    ctx.fillStyle = `rgba(${A}, .08)`;
    rr(x - 9, y0, w + 18, h, 14); ctx.fill();
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, "#261b33"); g.addColorStop(0.5, "#120d1a"); g.addColorStop(1, "#1e1529");
    ctx.fillStyle = g; rr(x, y0, w, h, 9); ctx.fill();
    const label = !capBottom && tw.name && h > 170 * S;
    const cols = 3, cw = w * 0.17, gx = (w - cols * cw) / (cols + 1), rh = 21 * S, wh = 9 * S;
    const pad = 22 * S, salt = tw.seed + (capBottom ? 0 : 97);
    for (let r = 0, yy = capBottom ? y1 - pad - wh : y0 + pad; capBottom ? yy > y0 + 4 : yy + wh < y1 - 4; r++, yy += capBottom ? -rh : rh) {
      for (let c = 0; c < cols; c++) {
        if (label && c === 1) continue;
        const v = hash(salt, r * cols + c);
        if (v < 0.58) continue;
        const a = v > 0.95 ? 0.4 + 0.4 * Math.sin(t * 5 + v * 60) : 0.78;
        ctx.fillStyle = v > 0.87 ? `rgba(255, 92, 140, ${a})` : v > 0.74 ? `rgba(${A}, ${a})` : `rgba(255, 236, 205, ${a * 0.75})`;
        ctx.fillRect(x + gx + c * (cw + gx), yy, cw, wh);
      }
    }
    if (label) {
      ctx.save();
      ctx.translate(x + w / 2, y0 + Math.min(h, GY - y0) / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.font = `700 ${Math.round(12 * S)}px Inter, system-ui, sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = `rgba(${A}, .95)`;
      ctx.fillText(tw.name.toLocaleUpperCase("tr").slice(0, 16), 0, 0);
      ctx.restore();
    }
    ctx.strokeStyle = `rgba(${A}, .62)`; ctx.lineWidth = 1.5;
    rr(x + 0.75, y0 + 0.75, w - 1.5, h - 1.5, 9); ctx.stroke();
    const capH = 12 * S, cy = capBottom ? y1 - capH : y0;
    ctx.fillStyle = `rgba(${A}, .16)`;
    rr(x - 13, cy - 6 * S, w + 26, capH + 12 * S, 12); ctx.fill();
    ctx.fillStyle = `rgba(${A}, .95)`;
    rr(x - 6, cy, w + 12, capH, 6); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.6)";
    ctx.fillRect(x - 1, cy + (capBottom ? capH - 4 * S : 3 * S), w + 2, 1.5);
  }
  function tower(tw) {
    const top = tw.gy - tw.gap / 2, bot = tw.gy + tw.gap / 2;
    segment(tw, -24, top, true);
    segment(tw, bot, GY + 24, false);
  }
  function heart(x, y, s) {
    ctx.save();
    ctx.translate(x, y); ctx.scale(s, s);
    ctx.beginPath();
    ctx.moveTo(0, 6);
    ctx.bezierCurveTo(-14, -4, -8, -16, 0, -8);
    ctx.bezierCurveTo(8, -16, 14, -4, 0, 6);
    ctx.fillStyle = "#ff3d5a"; ctx.fill();
    ctx.restore();
  }
  function drawBird() {
    const b = bird;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.rot);
    const g = ctx.createRadialGradient(0, 0, b.r * 0.6, 0, 0, b.r * 1.9);
    g.addColorStop(0, `rgba(${accentRGB()}, .45)`); g.addColorStop(1, `rgba(${accentRGB()}, 0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, b.r * 1.9, 0, Math.PI * 2); ctx.fill();
    if (sprite) {
      // yalnızca kafa: arka plan yok, ince beyaz çıkartma kenarı
      const hh = b.r * 3.05, ww = hh * sprite.width / sprite.height;
      ctx.drawImage(sprite, -ww / 2, -hh * 0.5, ww, hh);
      ctx.restore();
      return;
    }
    ctx.save();
    ctx.beginPath(); ctx.arc(0, 0, b.r, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
    if (face) cover(face, -b.r, -b.r, b.r * 2, b.r * 2);
    else {
      ctx.fillStyle = "#f3d28f"; ctx.fillRect(-b.r, -b.r, b.r * 2, b.r * 2);
      ctx.fillStyle = "#1a130b";
      ctx.beginPath(); ctx.arc(-b.r * 0.32, -b.r * 0.15, b.r * 0.11, 0, 7); ctx.arc(b.r * 0.32, -b.r * 0.15, b.r * 0.11, 0, 7); ctx.fill();
      ctx.lineWidth = b.r * 0.08; ctx.strokeStyle = "#1a130b";
      ctx.beginPath(); ctx.arc(0, b.r * 0.12, b.r * 0.36, 0.2, Math.PI - 0.2); ctx.stroke();
    }
    ctx.restore();
    ctx.lineWidth = Math.max(2.5, b.r * 0.12); ctx.strokeStyle = "#fff";
    ctx.beginPath(); ctx.arc(0, 0, b.r, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  function draw() {
    const A = accentRGB();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // her karede tuvali tamamen boya: gökyüzü degradesinin alt kısmı yarı saydam, temizlenmezse önceki kareler (yüz izleri) kalır
    ctx.fillStyle = "#07060a"; ctx.fillRect(0, 0, W, H);
    if (shake > 0) ctx.translate(rnd(-6, 6) * shake * 3, rnd(-6, 6) * shake * 3);
    const sky = ctx.createLinearGradient(0, 0, 0, GY);
    sky.addColorStop(0, "#07060a"); sky.addColorStop(0.55, "#170f22"); sky.addColorStop(1, `rgba(${A}, .55)`);
    ctx.fillStyle = sky; ctx.fillRect(-10, -10, W + 20, GY + 10);
    for (const s of stars) { ctx.globalAlpha = 0.35 + 0.35 * Math.sin(t * 2 + s.p); ctx.fillStyle = "#fff"; ctx.fillRect(s.x, s.y, s.r, s.r); }
    ctx.globalAlpha = 1;
    // neon güneş
    const sunR = Math.min(W, H) * 0.2, sx = W * 0.72, sy = GY - sunR * 0.25;
    const sg = ctx.createLinearGradient(0, sy - sunR, 0, sy + sunR);
    sg.addColorStop(0, "#ffd9a0"); sg.addColorStop(1, "#ff4f8b");
    ctx.save(); ctx.beginPath(); ctx.arc(sx, sy, sunR, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = sg; ctx.fillRect(sx - sunR, sy - sunR, sunR * 2, sunR * 2);
    ctx.fillStyle = "#170f22";
    for (let i = 0; i < 7; i++) { const yy = sy + i * sunR * 0.16 - sunR * 0.05; ctx.fillRect(sx - sunR, yy, sunR * 2, 2 + i * 1.6); }
    ctx.restore();
    // neon şehir tabelaları
    ctx.font = `italic 300 ${Math.round(30 * S)}px Fraunces, Georgia, serif`;
    signs.forEach((n, i) => {
      const span = W + 600;
      const x = W + 100 - (((t * speed * 0.22) + i * 380) % span);
      const y = GY * (0.3 + (i % 3) * 0.16);
      ctx.fillStyle = `rgba(${A}, .16)`; ctx.fillText(n, x + 2, y + 2);
      ctx.fillStyle = "rgba(255,240,225,.22)"; ctx.fillText(n, x, y);
    });
    towers.forEach(tower);
    hearts.forEach(h => { if (!h.got) heart(h.x, h.y + Math.sin(t * 4 + h.p) * 5 * S, 1.25 * S); });
    // zemin ızgarası
    ctx.fillStyle = "#0b0a09"; ctx.fillRect(-10, GY, W + 20, H - GY + 10);
    ctx.strokeStyle = `rgba(${A}, .55)`; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, GY); ctx.lineTo(W, GY); ctx.stroke();
    ctx.strokeStyle = `rgba(${A}, .22)`;
    const vx = W / 2, gh = H - GY;
    for (let i = -12; i <= 12; i++) { ctx.beginPath(); ctx.moveTo(vx + i * 40 * S, GY); ctx.lineTo(vx + i * 40 * S * 6, H + 10); ctx.stroke(); }
    const off = (t * speed * 0.004) % 1;
    for (let i = 0; i < 8; i++) { const k = (i + off) / 8; const yy = GY + gh * k * k; ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(W, yy); ctx.stroke(); }
    parts.forEach(p => { ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, 2.6 * S, 0, Math.PI * 2); ctx.fill(); });
    ctx.globalAlpha = 1;
    drawBird();
    ctx.font = `600 ${Math.round(18 * S)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = "center";
    floats.forEach(f => { ctx.globalAlpha = Math.max(0, f.life); ctx.fillStyle = "#fff"; ctx.fillText(f.txt, f.x, f.y); });
    ctx.globalAlpha = 1; ctx.textAlign = "start";
  }

  function frame(now) {
    raf = 0;
    if (!root) return;
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    acc += dt;
    while (acc >= STEP) { update(STEP); acc -= STEP; }
    draw();
    raf = requestAnimationFrame(frame);
  }

  function hud() {
    if (!root) return;
    $(".g-score", root).textContent = score;
    $(".g-best", root).textContent = best ? `En iyi ${best}` : "";
  }
  function panel(kind, rec) {
    if (!root) return;
    $(".g-start", root).hidden = kind !== "start";
    $(".g-over", root).hidden = kind !== "over";
    $(".g-pause", root).hidden = kind !== "pause";
    if (kind === "over") {
      $(".g-final", root).textContent = score;
      $(".g-rec", root).hidden = !rec;
      $(".g-bestv", root).textContent = best;
    }
  }

  async function open() {
    if (root) return;
    const D = AE.data;
    root = AE.el(`<div class="game" role="dialog" aria-modal="true" aria-label="Uçan Arda oyunu">
      <canvas></canvas>
      <div class="g-hud"><b class="g-score" aria-live="polite">0</b><span class="g-best"></span></div>
      <button type="button" class="icon-btn g-close" aria-label="Kapat">${AE.icon.close}</button>
      <div class="g-panel g-start"><div class="g-card">
        ${AE.headHTML("g-face")}
        <p class="eyebrow plain">Mini oyun</p><h2>Uçan <em>Arda</em></h2>
        <p>Dokun, tıkla ya da boşluğa bas: yüksel. Anı kulelerine çarpmadan geç, kalpleri topla.</p>
        <button type="button" class="btn solid" data-g="start">Başla</button></div></div>
      <div class="g-panel g-over" hidden><div class="g-card">
        <p class="eyebrow plain">Oyun bitti</p><h2><span class="g-final">0</span> <em>puan</em></h2>
        <p class="g-rec" hidden>Yeni rekor! 🎉</p><p>En iyi skorun: <b class="g-bestv">0</b></p>
        <div class="g-acts"><button type="button" class="btn solid" data-g="again">Tekrar oyna</button><button type="button" class="btn" data-g="share">${AE.icon.share} Paylaş</button></div></div></div>
      <div class="g-panel g-pause" hidden><div class="g-card"><h2>Ara <em>verdin</em></h2><button type="button" class="btn solid" data-g="resume">Devam et</button></div></div>
    </div>`);
    document.body.appendChild(root);
    AE.lock(true);
    readAccent();
    cv = $("canvas", root);
    ctx = cv.getContext("2d");
    measure();
    reset();
    state = "ready";
    panel("start");
    face = sprite = null;
    loadImg(AE.faceCutSrc()).then(im => {
      if (im) { sprite = sticker(im); return; }
      loadImg(AE.faceSrc()).then(f => { face = f; });
    });
    signs = [];
    D.posts.forEach(p => { const n = p.place || p.country; if (n && !signs.includes(n) && signs.length < 8) signs.push(n); });
    if (!signs.length) signs = ["Anılar", "Yolculuk", "Hayat"];

    root.addEventListener("pointerdown", e => {
      if (e.target.closest("button")) return;
      e.preventDefault();
      if (state === "dead") return;
      if (state === "paused") return;
      flap();
    });
    root.addEventListener("click", e => {
      const b = e.target.closest("[data-g]");
      if (!b) return;
      const k = b.dataset.g;
      if (k === "start" || k === "again") start();
      else if (k === "resume") { state = "play"; last = 0; panel(null); }
      else if (k === "share") AE.share("#/oyun", `Uçan Arda'da ${score} puan yaptım! Sen kaç yapabilirsin?`);
    });
    $(".g-close", root).addEventListener("click", () => AE.closeOverlay());
    onKey = e => {
      if (!root) return;
      if (e.key === "Escape") { e.preventDefault(); AE.closeOverlay(); return; }
      if (e.key === " " || e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
        e.preventDefault();
        if (state === "dead") { if (t - deadAt > 0.8) start(); return; }
        if (state === "paused") { state = "play"; last = 0; panel(null); return; }
        flap();
      } else if ((e.key === "p" || e.key === "P") && state === "play") { state = "paused"; panel("pause"); }
    };
    addEventListener("keydown", onKey);
    onVis = () => { if (document.hidden && state === "play") { state = "paused"; panel("pause"); } };
    document.addEventListener("visibilitychange", onVis);
    ro = "ResizeObserver" in window ? new ResizeObserver(() => { if (root) measure(); }) : null;
    if (ro) ro.observe(root);
    requestAnimationFrame(() => root && root.classList.add("on"));
    last = 0;
    raf = requestAnimationFrame(frame);
  }

  function hide() {
    if (!root) return;
    cancelAnimationFrame(raf); raf = 0;
    removeEventListener("keydown", onKey);
    document.removeEventListener("visibilitychange", onVis);
    if (ro) ro.disconnect();
    const r = root;
    root = null;
    AE.lock(false);
    r.classList.remove("on");
    setTimeout(() => r.remove(), 300);
  }

  AE.game = { open, hide };
})();
