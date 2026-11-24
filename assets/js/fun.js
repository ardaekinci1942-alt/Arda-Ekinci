/* Arda Ekinci — tatlı şeyler: beğeniler, kalp patlaması, yüz yağmuru, zar, dürtme, ziyaretçi sayacı */
(function () {
  "use strict";
  const AE = window.AE;
  const { $, $$, esc, reduced } = AE;

  /* ================= hesapsız sayaç (beğeni, ziyaret) ================= */
  // Ücretsiz, anahtarsız sayaç servisi. Ulaşılamazsa sayılar gizlenir, site çalışmaya devam eder.
  const API = "https://abacus.jasoncameron.dev";
  const NS = "ardaekinci-com";
  let down = false;
  const keyOf = s => String(s).toLowerCase().replace(/[^a-z0-9_-]/g, "-").slice(0, 60);
  async function call(op, key) {
    if (down) return null;
    const ctl = "AbortController" in window ? new AbortController() : null;
    const t = setTimeout(() => ctl && ctl.abort(), 6000);
    try {
      const r = await fetch(`${API}/${op}/${NS}/${keyOf(key)}`, ctl ? { signal: ctl.signal, cache: "no-store" } : { cache: "no-store" });
      if (r.status === 404) return 0;
      if (!r.ok) { if (r.status === 429 || r.status >= 500) down = true; return null; }
      const j = await r.json();
      const v = Number(j && (j.value != null ? j.value : j.count));
      return isFinite(v) ? v : null;
    } catch (e) { down = true; return null; }
    finally { clearTimeout(t); }
  }
  AE.counter = { get: k => call("get", k), hit: k => call("hit", k) };
  const fmt = n => Number(n).toLocaleString("tr-TR");

  /* ================= beğeniler ================= */
  const LS = "ae_likes";
  let liked = {};
  try { liked = JSON.parse(localStorage.getItem(LS) || "{}") || {}; } catch (e) { liked = {}; }
  const saveLikes = () => { try { localStorage.setItem(LS, JSON.stringify(liked)); } catch (e) {} };
  const counts = new Map();
  const getCount = id => {
    if (!counts.has(id)) counts.set(id, AE.counter.get(`like-${id}`).then(v => { counts.set(id, v); return v; }));
    const c = counts.get(id);
    return c instanceof Promise ? c : Promise.resolve(c);
  };
  const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.7s-7.6-4.6-9.7-9.4C.9 8 3.2 4.3 7 4.3c2.1 0 3.6 1.1 5 3 1.4-1.9 2.9-3 5-3 3.8 0 6.1 3.7 4.7 7C19.6 16.1 12 20.7 12 20.7z"/></svg>';
  AE.icon.heart = HEART;
  AE.likeBtnHTML = id => `<button type="button" class="like-btn${liked[id] ? " on" : ""}" data-like="${esc(id)}" aria-pressed="${liked[id] ? "true" : "false"}" aria-label="Beğen">${HEART}<span class="lc"></span></button>`;
  function paint(id) {
    $$(`[data-like="${CSS.escape(id)}"]`).forEach(b => {
      b.classList.toggle("on", !!liked[id]);
      b.setAttribute("aria-pressed", liked[id] ? "true" : "false");
    });
    getCount(id).then(v => {
      $$(`[data-like="${CSS.escape(id)}"] .lc`).forEach(s => { s.textContent = v ? fmt(v) : ""; });
    });
  }
  AE.paintLikes = root => {
    const ids = new Set($$("[data-like]", root || document).map(b => b.dataset.like));
    ids.forEach(paint);
  };
  AE.like = async (id, x, y) => {
    AE.heartBurst(x, y, true);
    if (liked[id]) return;
    liked[id] = Date.now();
    saveLikes();
    const prev = counts.get(id);
    if (typeof prev === "number") counts.set(id, prev + 1);
    paint(id);
    const v = await AE.counter.hit(`like-${id}`);
    if (v != null) { counts.set(id, v); paint(id); }
    streak();
  };
  let streakN = 0, streakT = 0;
  function streak() {
    streakN++;
    clearTimeout(streakT);
    streakT = setTimeout(() => { streakN = 0; }, 20000);
    if (streakN === 5) { AE.toast("5 beğeni! Teşekkürler ❤️"); AE.faceRain(); streakN = 0; }
  }

  /* kalp patlaması (+ kalp içinde yüz) */
  AE.heartBurst = (x, y, big) => {
    if (x == null) { x = innerWidth / 2; y = innerHeight / 2; }
    const face = big ? AE.heartFace() : "";
    const parts = Array.from({ length: 9 }, (_, i) => `<i style="--a:${i * 40 + (Math.random() * 16 - 8)}deg;--d:${(60 + Math.random() * 50) | 0}px">♥</i>`).join("");
    const b = AE.el(`<div class="burst${big ? " big" : ""}" style="left:${x}px;top:${y}px" aria-hidden="true">${HEART}${parts}${face ? `<span class="bf">${face}</span>` : ""}</div>`);
    document.body.appendChild(b);
    setTimeout(() => b.remove(), 1500);
  };

  /* çift dokunma: tek dokunuş gecikmeli çalışır, ikinci dokunuş beğenir */
  AE.dbltap = (el, onDouble, onSingle) => {
    let last = 0, lx = 0, ly = 0, timer = 0;
    const h = e => {
      if (e.button) return;
      const now = performance.now(), x = e.clientX, y = e.clientY;
      if (now - last < 330 && Math.abs(x - lx) < 40 && Math.abs(y - ly) < 40) {
        clearTimeout(timer); last = 0;
        e.preventDefault(); e.stopPropagation();
        onDouble(e);
        return;
      }
      last = now; lx = x; ly = y;
      if (onSingle) {
        e.preventDefault();
        clearTimeout(timer);
        timer = setTimeout(() => onSingle(e), 300);
      }
    };
    el.addEventListener("click", h);
    return () => { el.removeEventListener("click", h); clearTimeout(timer); };
  };

  document.addEventListener("click", e => {
    const b = e.target.closest && e.target.closest("[data-like]");
    if (!b) return;
    e.preventDefault();
    const r = b.getBoundingClientRect();
    if (liked[b.dataset.like]) { AE.heartBurst(r.left + r.width / 2, r.top + r.height / 2, false); return; }
    AE.like(b.dataset.like, r.left + r.width / 2, r.top + r.height / 2);
  });

  /* ================= yüz yağmuru ================= */
  let raining = false;
  AE.faceRain = () => {
    if (raining || reduced()) return;
    raining = true;
    const face = !!AE.faceSrc();
    const box = AE.el('<div class="rain" aria-hidden="true"></div>');
    const n = innerWidth < 600 ? 18 : 30;
    for (let i = 0; i < n; i++) {
      const s = (face ? 46 : 30) + Math.random() * 44;
      box.insertAdjacentHTML("beforeend", `<span style="left:${(Math.random() * 100).toFixed(1)}%;width:${s | 0}px;height:${s | 0}px;font-size:${(s * 0.7) | 0}px;animation-duration:${(2.4 + Math.random() * 2.2).toFixed(2)}s;animation-delay:${(Math.random() * 1.2).toFixed(2)}s;--r:${(Math.random() * 720 - 360) | 0}deg">${face ? AE.heartFace() : "❤️"}</span>`);
    }
    document.body.appendChild(box);
    setTimeout(() => { box.remove(); raining = false; }, 6200);
  };
  // “arda” yazınca
  let typed = "";
  addEventListener("keydown", e => {
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (!e.key || e.key.length !== 1) return;
    typed = (typed + e.key.toLocaleLowerCase("tr")).slice(-4);
    if (typed === "arda") { typed = ""; AE.faceRain(); }
  });

  /* ================= dürt ================= */
  const LINES = ["Selam! 👋", "Bir kahve? ☕", "Fotoğraflarıma bakıyorsun 👀", "Bugün nasılsın?", "Hey, gıdıklanıyorum! 😄", "Bir anı daha bak →", "Seni gördüğüme sevindim ✨", "Oyunu denedin mi? 🎮", "Fotoğraflara çift dokun, kalp at ❤️", "Bir yolculuk daha? ✈️", "Hâlâ buradasın 🥹"];
  let pokes = 0, lastLine = -1;
  document.addEventListener("click", e => {
    const b = e.target.closest && e.target.closest("[data-poke]");
    if (!b) return;
    pokes++;
    let i;
    do { i = Math.floor(Math.random() * LINES.length); } while (i === lastLine && LINES.length > 1);
    lastLine = i;
    const bub = $(".poke-bubble", b);
    if (bub) { bub.textContent = pokes === 5 ? "Tamam tamam, al bakalım! 🎉" : LINES[i]; }
    b.classList.remove("poked");
    void b.offsetWidth;
    b.classList.add("poked");
    clearTimeout(b._t);
    b._t = setTimeout(() => b.classList.remove("poked"), 2400);
    if (pokes % 5 === 0) AE.faceRain();
  });

  /* ================= şansına bir anı (zar) ================= */
  AE.randomMemory = () => {
    const ps = AE.data.posts.filter(p => p.type === "photo");
    if (!ps.length) return;
    const pick = ps[Math.floor(Math.random() * ps.length)];
    const go = () => AE.go(`#/ani/${encodeURIComponent(pick.id)}`);
    if (reduced() || ps.length < 3) { go(); return; }
    const pool = ps.slice().sort(() => Math.random() - 0.5).filter(p => p !== pick).slice(0, 13).concat(pick);
    pool.forEach(p => { const im = new Image(); im.src = p.photos[0].sm || p.photos[0].thumb; });
    const ov = AE.el(`<div class="dice-ov" aria-hidden="true"><div class="dice-card"><img alt=""><span class="dice-shine"></span></div><p>Şansına bir anı…</p></div>`);
    document.body.appendChild(ov);
    AE.lock(true);
    const img = $("img", ov), cap = $("p", ov);
    let i = 0, delay = 55;
    const step = () => {
      const p = pool[i];
      img.src = p.photos[0].sm || p.photos[0].thumb;
      ov.firstElementChild.style.transform = `rotate(${(Math.random() * 10 - 5).toFixed(1)}deg) scale(${(0.96 + Math.random() * 0.06).toFixed(3)})`;
      i++;
      if (i < pool.length) { delay *= 1.17; setTimeout(step, delay); return; }
      cap.textContent = AE.placeLine(pick) || "İşte bu!";
      ov.firstElementChild.style.transform = "scale(1.06)";
      setTimeout(() => {
        ov.classList.add("out");
        setTimeout(() => { ov.remove(); AE.lock(false); go(); }, 320);
      }, 650);
    };
    step();
  };
  document.addEventListener("click", e => {
    const b = e.target.closest && e.target.closest("[data-dice]");
    if (b) { e.preventDefault(); AE.randomMemory(); }
  });

  /* ================= ziyaretçi sayacı ================= */
  let visits = null;
  AE.paintVisits = async () => {
    if (visits == null) {
      let first = false;
      try { first = !sessionStorage.getItem("ae_seen"); sessionStorage.setItem("ae_seen", "1"); } catch (e) {}
      visits = (first ? AE.counter.hit("visits") : AE.counter.get("visits")).catch(() => null);
    }
    const v = await visits;
    if (!v) return;
    $$("[data-visits]").forEach(el => { const b = $("b", el); if (b) b.textContent = fmt(v); el.hidden = false; });
  };

  /* ================= oyun ================= */
  AE.openGame = async () => {
    try {
      await AE.loadScript("assets/js/game.js?v=5");
      AE.game.open();
    } catch (e) {
      AE.toast("Oyun yüklenemedi, internetini kontrol et.");
      AE.closeOverlay();
    }
  };
  AE.hideGame = () => { if (AE.game) AE.game.hide(); };
})();
