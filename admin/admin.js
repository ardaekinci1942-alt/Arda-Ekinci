/* Arda Ekinci — yönetim paneli
 * Tüm içerik GitHub reposunda saklanır. Değişiklikler tarayıcıda biriktirilir,
 * “Yayınla”ya basınca tek bir commit olarak gönderilir.
 */
(function () {
  "use strict";
  const AE = window.AE;
  const { $, $$, esc, el, slug, norm, cleanTitle, cleanPlace, ccName, ccFromName, fmtDate } = AE;

  /* ================= ayarlar ================= */
  const DEFAULT_CFG = { owner: "ardaekinci1942-alt", repo: "Arda-Ekinci", branch: "" };
  const MAIN_MAX = 2400, MAIN_Q = 0.86, THUMB_MAX = 1000, THUMB_Q = 0.8;
  const MAX_BATCH = 100;
  const store = {
    get(k) { try { return localStorage.getItem(k) ?? sessionStorage.getItem(k); } catch (e) { return null; } },
    set(k, v, persist = true) { try { (persist ? localStorage : sessionStorage).setItem(k, v); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); sessionStorage.removeItem(k); } catch (e) {} }
  };
  let cfg = Object.assign({}, DEFAULT_CFG, (() => { try { return JSON.parse(store.get("ae_cfg") || "{}"); } catch (e) { return {}; } })());
  let token = store.get("ae_token");

  const S = {
    site: null, posts: [], albums: [], orig: null, legacy: false,
    staged: new Map(), deletes: new Set(), preview: new Map(), blobSha: new Map(),
    base: "", tab: "posts", sel: new Set(), selecting: false, q: "", filter: "all", busy: false
  };

  /* ================= yardımcılar ================= */
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const clone = o => JSON.parse(JSON.stringify(o));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const pad2 = n => String(n).padStart(2, "0");
  const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
  const getPath = (o, p) => p.split(".").reduce((a, k) => (a == null ? a : a[k]), o);
  const setPath = (o, p, v) => {
    const ks = p.split("."), last = ks.pop();
    const t = ks.reduce((a, k) => (a[k] == null || typeof a[k] !== "object" ? (a[k] = {}) : a[k]), o);
    t[last] = v;
  };
  const listVal = v => String(v || "").split(",").map(s => s.trim()).filter(Boolean);
  const round = (v, d) => Math.round(v * 10 ** d) / 10 ** d;
  const sortKey = p => p.taken || (p.created || "").slice(0, 10);
  const sortPosts = arr => arr.slice().sort((a, b) => sortKey(b).localeCompare(sortKey(a)) || (b.created || "").localeCompare(a.created || ""));
  const albumTitle = id => { const a = id && S.albums.find(x => x.id === id); return a ? a.title : ""; };
  const COUNTRIES = Object.keys(AE.CC2NUM).map(cc => ccName(cc)).filter((n, i, a) => n && n.length > 2 && a.indexOf(n) === i).sort((a, b) => a.localeCompare(b, "tr"));

  const ICON = {
    posts: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/></svg>',
    albums: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="7" width="14" height="14" rx="2.5"/><path d="M7 3h11.5A2.5 2.5 0 0 1 21 5.5V17"/></svg>',
    profile: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="8.5" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
    cv: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M8.5 7V5.5A2 2 0 0 1 10.5 3.5h3a2 2 0 0 1 2 2V7M3 12.5h18"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>'
  };
  const TABS = [["posts", "Anılar"], ["albums", "Albümler"], ["profile", "Profil"], ["cv", "CV"], ["settings", "Ayarlar"]];

  /* ================= bildirimler, sayfalar (sheet), ilerleme ================= */
  function toast(msg, type = "", ms) {
    const box = $("#toasts");
    while (box.children.length >= 3) box.firstElementChild.remove();
    const t = el(`<div class="toast ${type}"></div>`);
    t.textContent = msg;
    t.addEventListener("click", () => t.remove());
    box.appendChild(t);
    setTimeout(() => t.remove(), ms || (type === "err" ? 7000 : 3200));
  }
  const prog = {
    show(title) { $("#progTitle").textContent = title; $("#progBar").style.width = "0%"; $("#progText").textContent = ""; $("#progressOv").hidden = false; },
    set(frac, text) { if (frac != null) $("#progBar").style.width = `${Math.round(frac * 100)}%`; if (text != null) $("#progText").textContent = text; },
    hide() { $("#progressOv").hidden = true; }
  };
  const sheets = [];
  function sheet({ title, body = "", foot = "", wide = false, sticky = false, onClose }) {
    const ov = el(`<div class="sheet-ov"><div class="sheet${wide ? " wide" : ""}" role="dialog" aria-modal="true">
      <div class="sheet-h"><h3></h3><button type="button" class="ibtn" data-close aria-label="Kapat">✕</button></div>
      <div class="sheet-b"></div>${foot ? '<div class="sheet-f"></div>' : ""}</div></div>`);
    $(".sheet-h h3", ov).textContent = title;
    const b = $(".sheet-b", ov), f = $(".sheet-f", ov);
    b.innerHTML = body;
    if (f) f.innerHTML = foot;
    $("#sheets").appendChild(ov);
    document.documentElement.style.overflow = "hidden";
    const api = {
      el: ov, body: b, foot: f, closed: false,
      close(result) {
        if (api.closed) return;
        api.closed = true;
        ov.remove();
        sheets.splice(sheets.indexOf(api), 1);
        if (!sheets.length) document.documentElement.style.overflow = "";
        if (onClose) onClose(result);
      }
    };
    ov.addEventListener("click", e => {
      if (e.target.closest("[data-close]")) { api.close(); return; }
      if (e.target === ov && !sticky) api.close();
    });
    sheets.push(api);
    return api;
  }
  addEventListener("keydown", e => { if (e.key === "Escape" && sheets.length) sheets[sheets.length - 1].close(); });

  function ask(title, { value = "", placeholder = "", ok = "Tamam", label = "" } = {}) {
    return new Promise(res => {
      let out = null;
      const sh = sheet({
        title, body: `<label>${esc(label)}<input data-ask value="${esc(value)}" placeholder="${esc(placeholder)}"></label>`,
        foot: `<button type="button" class="btn ghost" data-close>İptal</button><span class="sp"></span><button type="button" class="btn primary" data-ok>${esc(ok)}</button>`,
        onClose: () => res(out)
      });
      const inp = $("[data-ask]", sh.el);
      const done = () => { const v = inp.value.trim(); if (!v) { inp.focus(); return; } out = v; sh.close(); };
      $("[data-ok]", sh.el).addEventListener("click", done);
      inp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); done(); } });
      setTimeout(() => inp.focus(), 60);
    });
  }

  /* ================= görsel adresleri ================= */
  const imgURL = path => !path ? "" : S.staged.has(path) ? S.staged.get(path).url : S.preview.has(path) ? S.preview.get(path) : `../${path}`;
  const rawURL = path => `https://raw.githubusercontent.com/${cfg.owner}/${cfg.repo}/${cfg.branch}/${path}`;
  window.__aeImgErr = img => { if (img.dataset.fb) return; img.dataset.fb = "1"; img.src = rawURL(img.dataset.path); };
  const imgTag = (path, alt = "") => path ? `<img src="${esc(imgURL(path))}" data-path="${esc(path)}" alt="${esc(alt)}" loading="lazy" decoding="async" onerror="__aeImgErr(this)">` : "";
  function stage(path, blob) { S.staged.set(path, { blob, url: URL.createObjectURL(blob) }); S.deletes.delete(path); }
  function removePath(path) {
    if (!path) return;
    if (S.staged.has(path)) { URL.revokeObjectURL(S.staged.get(path).url); S.staged.delete(path); S.blobSha.delete(path); }
    else S.deletes.add(path);
  }

  /* ================= GitHub API ================= */
  const R = () => `/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}`;
  async function gh(path, opts = {}, attempt = 0) {
    let res;
    try {
      res = await fetch(`https://api.github.com${path}`, {
        method: opts.method || "GET",
        headers: Object.assign({ Authorization: `Bearer ${token}`, Accept: opts.raw ? "application/vnd.github.raw+json" : "application/vnd.github+json" }, opts.body ? { "Content-Type": "application/json" } : {}),
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        cache: "no-store"
      });
    } catch (e) {
      if (attempt < 4) { await sleep(1500 * (attempt + 1)); return gh(path, opts, attempt + 1); }
      throw Object.assign(new Error("İnternet bağlantısı kurulamadı."), { status: 0 });
    }
    if (!res.ok) {
      let msg = res.statusText || "Hata";
      try { msg = (await res.clone().json()).message || msg; } catch (e) {}
      const limited = (res.status === 403 || res.status === 429) && (/rate limit|abuse|secondary/i.test(msg) || res.headers.get("retry-after"));
      if (limited && attempt < 12) {
        const wait = Math.min(120, Math.max(5, +(res.headers.get("retry-after") || 0) || 60));
        if (opts.onWait) opts.onWait(wait);
        await sleep(wait * 1000);
        return gh(path, opts, attempt + 1);
      }
      if (res.status >= 500 && attempt < 3) { await sleep(2000 * (attempt + 1)); return gh(path, opts, attempt + 1); }
      throw Object.assign(new Error(msg), { status: res.status });
    }
    if (res.status === 204) return null;
    return opts.raw ? res.text() : res.json();
  }

  /* ================= veri biçimi ================= */
  function fromStored(p) {
    if (!p || typeof p !== "object") return null;
    const type = p.type === "note" ? "note" : "photo";
    const photos = (Array.isArray(p.photos) ? p.photos : []).filter(x => x && x.src).map(x => {
      const o = { src: String(x.src), thumb: String(x.thumb || x.src), w: +x.w || 1200, h: +x.h || 900 };
      if (x.sm) o.sm = String(x.sm);
      if (x.c) o.c = String(x.c);
      return o;
    });
    if (type === "photo" && !photos.length) return null;
    const cc0 = String(p.cc || "").toUpperCase();
    const cc = /^[A-Z]{2}$/.test(cc0) ? cc0 : ccFromName(p.country);
    return {
      id: String(p.id || uid()), type, photos,
      text: type === "note" ? String(p.text || "") : "", mood: type === "note" ? String(p.mood || "") : "",
      title: cleanTitle(p.title), caption: String(p.caption || ""),
      place: cleanPlace(p.place), country: String(p.country || "").trim() || (cc ? ccName(cc) : ""), cc,
      geo: Array.isArray(p.geo) && p.geo.length === 2 && isFinite(p.geo[0]) && isFinite(p.geo[1]) ? [+p.geo[0], +p.geo[1]] : null,
      taken: /^\d{4}-\d{2}-\d{2}$/.test(p.taken || "") ? p.taken : "",
      created: String(p.created || ""), album: String(p.album || ""),
      featured: !!p.featured, pinned: !!p.pinned, hidden: !!p.hidden
    };
  }
  function toStored(p) {
    const o = { id: p.id, type: p.type };
    if (p.type === "photo") o.photos = p.photos.map(x => { const y = { src: x.src, thumb: x.thumb, w: x.w, h: x.h }; if (x.sm) y.sm = x.sm; if (x.c) y.c = x.c; return y; });
    else { o.text = p.text; if (p.mood) o.mood = p.mood; }
    Object.assign(o, { title: p.title || "", caption: p.caption || "", place: p.place || "", country: p.country || "", cc: p.cc || "" });
    if (p.geo) o.geo = [round(p.geo[0], 4), round(p.geo[1], 4)];
    Object.assign(o, { taken: p.taken || "", created: p.created || "", album: p.album || "", featured: !!p.featured, pinned: !!p.pinned, hidden: !!p.hidden });
    return o;
  }
  const SOCIAL_KEYS = [["instagram", "Instagram", "kullanıcı adı"], ["x", "X / Twitter", "kullanıcı adı"], ["youtube", "YouTube", "kanal adı ya da bağlantı"], ["tiktok", "TikTok", "kullanıcı adı"], ["linkedin", "LinkedIn", "kullanıcı adı"], ["github", "GitHub", "kullanıcı adı"], ["spotify", "Spotify", "bağlantı"], ["website", "Web sitesi", "https://…"]];
  function toStoredSite(s) {
    const clean = arr => (Array.isArray(arr) ? arr : []).map(o => {
      const x = {};
      Object.keys(o || {}).forEach(k => { const v = typeof o[k] === "string" ? o[k].trim() : o[k]; if (v !== "" && v != null) x[k] = v; });
      return x;
    }).filter(o => Object.keys(o).length);
    const socials = {};
    SOCIAL_KEYS.forEach(([k]) => { const v = String((s.socials || {})[k] || "").trim(); if (v) socials[k] = v; });
    return {
      name: String(s.name || "").trim() || "Arda Ekinci", handle: String(s.handle || "").trim().replace(/^@/, ""),
      tagline: String(s.tagline || "").trim(), bio: String(s.bio || "").trim(), about: String(s.about || "").trim(), now: String(s.now || "").trim(),
      location: String(s.location || "").trim(), timezone: s.timezone || "Europe/Istanbul", email: String(s.email || "").trim(),
      socials, avatar: s.avatar || "", portrait: s.portrait || "", face: s.face || "", facts: clean(s.facts),
      words: (s.words || []).filter(Boolean),
      cv: {
        experience: clean(s.cv.experience), education: clean(s.cv.education), skills: (s.cv.skills || []).filter(Boolean),
        languages: clean(s.cv.languages), projects: clean(s.cv.projects), pdf: s.cv.pdf || ""
      },
      theme: { accent: s.theme.accent, intro: !!s.theme.intro, marquee: (s.theme.marquee || []).filter(Boolean), sections: Object.assign({}, s.theme.sections) }
    };
  }
  const snapshot = () => ({
    site: JSON.stringify(toStoredSite(S.site)),
    posts: new Map(S.posts.map(p => [p.id, JSON.stringify(toStored(p))])),
    albums: JSON.stringify(S.albums)
  });

  function applyLoaded(siteRaw, doc, legacy, sha) {
    S.site = clone(AE.normSite(siteRaw || {}));
    const posts = (doc && Array.isArray(doc.posts) ? doc.posts : []).map(fromStored).filter(Boolean);
    const albums = (doc && Array.isArray(doc.albums) ? doc.albums : []).filter(a => a && a.id && a.title)
      .map(a => ({ id: String(a.id), title: String(a.title), desc: String(a.desc || ""), cover: String(a.cover || "") }));
    if (legacy && Array.isArray(legacy.photos)) {
      const have = new Set(posts.map(p => p.id));
      legacy.photos.forEach(ph => {
        if (!ph || !ph.src || have.has(ph.id)) return;
        const cat = String(ph.category || "").trim();
        let album = "";
        if (cat) { album = `c-${slug(cat)}`; if (!albums.some(a => a.id === album)) albums.push({ id: album, title: cat, desc: "", cover: "" }); }
        const p = fromStored({ id: ph.id, type: "photo", photos: [{ src: ph.src, thumb: ph.thumb, w: ph.w, h: ph.h }], title: ph.title, caption: ph.caption, place: ph.place, country: ph.country, taken: ph.taken, created: ph.date ? `${ph.date}T12:00:00Z` : "", featured: ph.featured, album });
        if (p) posts.push(p);
      });
    }
    const seen = new Set();
    S.posts = sortPosts(posts.filter(p => !seen.has(p.id) && seen.add(p.id)));
    S.albums = albums;
    S.legacy = !!legacy;
    S.base = sha;
    S.staged.forEach(v => URL.revokeObjectURL(v.url));
    S.staged.clear(); S.deletes.clear(); S.blobSha.clear(); S.sel.clear(); S.selecting = false;
    S.orig = snapshot();
    AE.applyAccent(S.site.theme.accent);
  }

  async function readAt(sha) {
    let names = new Set();
    try {
      const dir = await gh(`${R()}/contents/data?ref=${sha}`);
      if (Array.isArray(dir)) dir.forEach(f => names.add(f.name));
    } catch (e) { if (e.status !== 404) throw e; }
    const read = async p => {
      const txt = await gh(`${R()}/contents/${p}?ref=${sha}`, { raw: true });
      try { return JSON.parse(txt); } catch (e) { throw new Error(`${p} dosyası bozuk görünüyor.`); }
    };
    return {
      site: names.has("site.json") ? await read("data/site.json") : null,
      doc: names.has("posts.json") ? await read("data/posts.json") : null,
      legacy: names.has("photos.json") ? await read("data/photos.json") : null
    };
  }
  async function loadAll() {
    const repo = await gh(R());
    if (!cfg.branch) cfg.branch = repo.default_branch || "main";
    const ref = await gh(`${R()}/git/ref/heads/${encodeURIComponent(cfg.branch)}`);
    const sha = ref.object.sha;
    const d = await readAt(sha);
    applyLoaded(d.site, d.doc, d.legacy, sha);
  }

  /* ================= değişiklik takibi ================= */
  function changes() {
    const o = S.orig;
    if (!o) return { n: 0 };
    let added = 0, removed = 0, edited = 0;
    const cur = new Set();
    S.posts.forEach(p => {
      cur.add(p.id);
      const j = o.posts.get(p.id);
      if (j == null) added++; else if (j !== JSON.stringify(toStored(p))) edited++;
    });
    o.posts.forEach((_, id) => { if (!cur.has(id)) removed++; });
    const site = JSON.stringify(toStoredSite(S.site)) !== o.site;
    const albums = JSON.stringify(S.albums) !== o.albums;
    const files = S.staged.size + S.deletes.size;
    const n = added + removed + edited + (site ? 1 : 0) + (albums ? 1 : 0) + (S.legacy ? 1 : 0) + (!added && !removed && !edited && !site && !albums && !S.legacy && files ? 1 : 0);
    return { n, added, removed, edited, site, albums };
  }
  let barRaf = 0;
  function updateBar() {
    cancelAnimationFrame(barRaf);
    barRaf = requestAnimationFrame(() => {
      const c = changes();
      $("#pub").hidden = c.n === 0;
      $("#pubCount").textContent = c.n;
      $("#pubText").textContent = S.legacy && c.n === 1 ? "değişiklik (veri yeni biçime taşınacak)" : "kaydedilmemiş değişiklik";
    });
  }
  addEventListener("beforeunload", e => { if (S.orig && changes().n) { e.preventDefault(); e.returnValue = ""; } });

  /* ================= görsel işleme ================= */
  function decode(file) {
    return new Promise((res, rej) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => { URL.revokeObjectURL(url); res(img); };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("decode")); };
      img.src = url;
    });
  }
  async function resize(src, max, q) {
    const sw = src.naturalWidth || src.width, sh = src.naturalHeight || src.height;
    if (!sw || !sh) throw new Error("decode");
    const s = Math.min(1, max / Math.max(sw, sh));
    const w = Math.max(1, Math.round(sw * s)), h = Math.max(1, Math.round(sh * s));
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(src, 0, 0, w, h);
    const blob = await new Promise(r => c.toBlob(r, "image/jpeg", q));
    if (!blob) throw new Error("encode");
    return { blob, w, h, canvas: c };
  }
  const freeCanvas = c => { if (c) { c.width = 0; c.height = 0; } };
  function avgColor(canvas) {
    try {
      const t = document.createElement("canvas");
      t.width = 1; t.height = 1;
      const x = t.getContext("2d");
      x.drawImage(canvas, 0, 0, 1, 1);
      const d = x.getImageData(0, 0, 1, 1).data;
      return "#" + [d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, "0")).join("");
    } catch (e) { return ""; }
  }
  const toB64 = blob => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1]);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
  const tick = () => new Promise(r => setTimeout(r, 25));

  /* EXIF: çekim tarihi ve GPS */
  async function readExif(file) {
    try {
      const v = new DataView(await file.slice(0, 512 * 1024).arrayBuffer());
      if (v.getUint16(0) !== 0xffd8) return {};
      let o = 2;
      while (o + 10 < v.byteLength) {
        const m = v.getUint16(o);
        if ((m & 0xff00) !== 0xff00 || m === 0xffda) break;
        if (m === 0xffe1 && v.getUint32(o + 4) === 0x45786966) return parseTiff(v, o + 10);
        o += 2 + v.getUint16(o + 2);
      }
    } catch (e) {}
    return {};
  }
  function parseTiff(v, t) {
    const res = {};
    try {
      const le = v.getUint16(t) === 0x4949;
      const u16 = p => v.getUint16(p, le), u32 = p => v.getUint32(p, le);
      const ifd = p => { const out = {}, n = u16(p); for (let i = 0; i < n; i++) { const e = p + 2 + i * 12; out[u16(e)] = e; } return out; };
      const ascii = e => {
        const c = u32(e + 4), p = c > 4 ? t + u32(e + 8) : e + 8;
        let s = "";
        for (let i = 0; i < c; i++) { const ch = v.getUint8(p + i); if (!ch) break; s += String.fromCharCode(ch); }
        return s.trim();
      };
      const rats = e => { const p = t + u32(e + 8), a = []; for (let i = 0; i < 3; i++) a.push(u32(p + i * 8) / (u32(p + i * 8 + 4) || 1)); return a; };
      const toDate = e => { const m = ascii(e).match(/^(\d{4}):(\d{2}):(\d{2})/); return m && m[1] !== "0000" ? `${m[1]}-${m[2]}-${m[3]}` : ""; };
      const i0 = ifd(t + u32(t + 4));
      if (i0[0x8769]) { const ex = ifd(t + u32(i0[0x8769] + 8)); const d = ex[0x9003] || ex[0x9004]; if (d) res.taken = toDate(d); }
      if (!res.taken && i0[0x0132]) res.taken = toDate(i0[0x0132]);
      if (i0[0x8825]) {
        const g = ifd(t + u32(i0[0x8825] + 8));
        if (g[2] && g[4]) {
          const dms = a => a[0] + a[1] / 60 + a[2] / 3600;
          let lat = dms(rats(g[2])), lon = dms(rats(g[4]));
          if (g[1] && ascii(g[1]) === "S") lat = -lat;
          if (g[3] && ascii(g[3]) === "W") lon = -lon;
          if (isFinite(lat) && isFinite(lon) && (lat || lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) res.gps = [lat, lon];
        }
      }
    } catch (e) {}
    return res;
  }

  /* Konum: koordinat → şehir/ülke, şehir adı → koordinat */
  async function fetchJSON(url, ms = 7000) {
    const ctl = "AbortController" in window ? new AbortController() : null;
    const t = setTimeout(() => ctl && ctl.abort(), ms);
    try { const r = await fetch(url, ctl ? { signal: ctl.signal } : {}); return r.ok ? await r.json() : null; }
    catch (e) { return null; }
    finally { clearTimeout(t); }
  }
  const revCache = new Map();
  async function reverseGeo([lat, lon]) {
    const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
    if (!revCache.has(key)) {
      revCache.set(key, (async () => {
        const j = await fetchJSON(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=tr`);
        const geo = [round(lat, 1), round(lon, 1)];
        if (!j) return { place: "", country: "", cc: "", geo };
        const cc = /^[A-Z]{2}$/.test(j.countryCode || "") ? j.countryCode : "";
        const country = cc ? ccName(cc) : String(j.countryName || "");
        let place = cleanPlace(j.city || j.locality || j.principalSubdivision || "");
        if (place === country) place = "";
        return { place, country, cc: cc || ccFromName(country), geo };
      })());
    }
    return revCache.get(key);
  }
  const fwdCache = new Map();
  async function forwardGeo(place, cc) {
    const key = `${norm(place)}|${cc}`;
    if (!fwdCache.has(key)) {
      fwdCache.set(key, (async () => {
        const j = await fetchJSON(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(place)}&count=10&language=tr&format=json`);
        const list = j && Array.isArray(j.results) ? j.results : [];
        const hit = (cc && list.find(r => r.country_code === cc)) || (!cc && list[0]) || null;
        return hit && isFinite(hit.latitude) && isFinite(hit.longitude) ? [round(hit.latitude, 2), round(hit.longitude, 2)] : null;
      })());
    }
    return fwdCache.get(key);
  }
  function fillGeo(posts) {
    posts.forEach(async p => {
      if (p.geo || !p.place) return;
      const g = await forwardGeo(p.place, p.cc);
      if (g && !p.geo && S.posts.includes(p)) { p.geo = g; updateBar(); }
    });
  }

  async function processImage(file) {
    const meta = await readExif(file);
    const loc = meta.gps ? await reverseGeo(meta.gps) : null;
    let img = await decode(file);
    const main = await resize(img, MAIN_MAX, MAIN_Q);
    img.src = "";
    img = null;
    const thumb = await resize(main.canvas, THUMB_MAX, THUMB_Q);
    const sm = await resize(thumb.canvas, 720, 0.76);
    freeCanvas(sm.canvas);
    const color = avgColor(thumb.canvas);
    freeCanvas(main.canvas); freeCanvas(thumb.canvas);
    return { meta, loc, main: { blob: main.blob, w: main.w, h: main.h }, thumb: { blob: thumb.blob }, sm: { blob: sm.blob }, color };
  }
  async function processSmall(file, max) {
    let img = await decode(file);
    const r = await resize(img, max, 0.86);
    img.src = "";
    freeCanvas(r.canvas);
    return r.blob;
  }
  /* yüz kırpıcı: dairenin içinde sürükle / yakınlaştır */
  function openCropper(file) {
    return new Promise(async res => {
      let img;
      try { img = await decode(file); } catch (e) { toast(`Fotoğraf açılamadı. ${HEIC_HINT}`, "err"); res(null); return; }
      const W = img.naturalWidth, H = img.naturalHeight, url = URL.createObjectURL(file);
      let out = null;
      const sh = sheet({
        title: "Yüzünü ortala", sticky: true,
        body: `<div class="crop-box"><img class="crop-img" src="${url}" alt="" draggable="false"><div class="crop-ring"></div></div>
          <label>Yakınlaştır<input type="range" min="1" max="5" step="0.01" value="1" data-zoom></label>
          <p class="muted">Fotoğrafı sürükleyerek yüzünü dairenin ortasına getir. İki parmakla da yakınlaştırabilirsin.</p>`,
        foot: `<button type="button" class="btn ghost" data-close>İptal</button><span class="sp"></span><button type="button" class="btn primary" data-ok>Kaydet</button>`,
        onClose: () => { URL.revokeObjectURL(url); res(out); }
      });
      const box = $(".crop-box", sh.el), im = $(".crop-img", sh.el), zr = $("[data-zoom]", sh.el);
      let B = box.clientWidth || 300, zoom = 1, tx = 0, ty = 0;
      const base = () => B / Math.min(W, H);
      const apply = () => {
        const s = base() * zoom, iw = W * s, ih = H * s;
        tx = Math.min(0, Math.max(B - iw, tx)); ty = Math.min(0, Math.max(B - ih, ty));
        im.style.width = `${iw}px`; im.style.height = `${ih}px`;
        im.style.transform = `translate(${tx}px, ${ty}px)`;
      };
      const setZoom = z => {
        z = Math.max(1, Math.min(5, z));
        const s0 = base() * zoom, cx = (B / 2 - tx) / s0, cy = (B / 2 - ty) / s0;
        zoom = z;
        const s1 = base() * zoom;
        tx = B / 2 - cx * s1; ty = B / 2 - cy * s1;
        zr.value = String(z);
        apply();
      };
      { const s = base(); tx = (B - W * s) / 2; ty = (B - H * s) / 2 * (H > W ? 0.45 : 1); apply(); }
      zr.addEventListener("input", () => setZoom(+zr.value));
      const pts = new Map();
      let last = null, pinch = 0;
      box.addEventListener("pointerdown", e => { box.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); last = [e.clientX, e.clientY]; pinch = 0; });
      box.addEventListener("pointermove", e => {
        if (!pts.has(e.pointerId)) return;
        pts.set(e.pointerId, [e.clientX, e.clientY]);
        if (pts.size >= 2) {
          const [a, b2] = [...pts.values()];
          const d = Math.hypot(a[0] - b2[0], a[1] - b2[1]);
          if (pinch) setZoom(zoom * d / pinch);
          pinch = d;
          return;
        }
        if (last) { tx += e.clientX - last[0]; ty += e.clientY - last[1]; apply(); }
        last = [e.clientX, e.clientY];
      });
      const up = e => { pts.delete(e.pointerId); pinch = 0; last = pts.size === 1 ? [...pts.values()][0] : null; };
      box.addEventListener("pointerup", up);
      box.addEventListener("pointercancel", up);
      box.addEventListener("wheel", e => { e.preventDefault(); setZoom(zoom * (e.deltaY < 0 ? 1.08 : 0.92)); }, { passive: false });
      $("[data-ok]", sh.el).addEventListener("click", async () => {
        const s = base() * zoom, c = document.createElement("canvas");
        c.width = 512; c.height = 512;
        const x = c.getContext("2d");
        x.fillStyle = "#fff"; x.fillRect(0, 0, 512, 512);
        x.imageSmoothingQuality = "high";
        x.drawImage(img, -tx / s, -ty / s, B / s, B / s, 0, 0, 512, 512);
        out = await new Promise(r => c.toBlob(r, "image/jpeg", 0.9));
        freeCanvas(c);
        sh.close();
      });
    });
  }

  function photoFrom(it) {
    const id = uid();
    const ph = { src: `photos/${id}.jpg`, thumb: `photos/thumbs/${id}.jpg`, sm: `photos/sm/${id}.jpg`, w: it.main.w, h: it.main.h };
    if (it.color) ph.c = it.color;
    stage(ph.src, it.main.blob);
    stage(ph.thumb, it.thumb.blob);
    stage(ph.sm, it.sm.blob);
    return ph;
  }
  const HEIC_HINT = "iPhone fotoğrafı açılamadıysa: Ayarlar → Kamera → Formatlar → “En Uyumlu”.";

  /* ================= sekmeler ================= */
  function buildNav() {
    const html = TABS.map(([k, t]) => `<button type="button" data-tab="${k}" class="${k === S.tab ? "on" : ""}">${ICON[k]}<span>${t}</span></button>`).join("");
    $("#nav").innerHTML = html;
    $("#tabbar").innerHTML = html;
  }
  function setTab(k) {
    S.tab = k;
    $$("[data-tab]").forEach(b => b.classList.toggle("on", b.dataset.tab === k));
    $$(".panel").forEach(p => { p.hidden = p.dataset.panel !== k; });
    $("#mtopTitle").textContent = (TABS.find(t => t[0] === k) || [])[1] || "";
    if (k !== "posts" && S.selecting) setSelecting(false);
    if (k === "albums") renderAlbums();
    window.scrollTo(0, 0);
  }

  /* ================= ANILAR ================= */
  const byUpload = (a, b) => (b.created || "").localeCompare(a.created || "") || sortKey(b).localeCompare(sortKey(a));
  function filtered() {
    const q = norm(S.q);
    return S.posts.slice().sort(byUpload).filter(p => {
      switch (S.filter) {
        case "photo": if (p.type !== "photo") return false; break;
        case "note": if (p.type !== "note") return false; break;
        case "new": if (S.orig.posts.has(p.id)) return false; break;
        case "hidden": if (!p.hidden) return false; break;
        case "pinned": if (!p.pinned) return false; break;
        case "featured": if (!p.featured) return false; break;
        case "noalbum": if (p.album) return false; break;
        case "noplace": if (p.place || p.country) return false; break;
        case "nodate": if (p.taken) return false; break;
        default: break;
      }
      return !q || norm([p.title, p.caption, p.text, p.place, p.country, albumTitle(p.album), p.taken].join(" ")).includes(q);
    });
  }
  function cardHTML(p) {
    const isNew = !S.orig.posts.has(p.id);
    const badges = [isNew ? '<span class="b new">Yeni</span>' : "", p.hidden ? '<span class="b hid">Gizli</span>' : "", p.pinned ? '<span class="b">📌</span>' : "",
      p.featured ? '<span class="b">★</span>' : "", p.photos.length > 1 ? `<span class="b">⧉ ${p.photos.length}</span>` : ""].join("");
    const meta = [p.place || p.country, p.taken ? fmtDate(p.taken, true) : ""].filter(Boolean).join(" · ");
    const cls = `${S.sel.has(p.id) ? " sel" : ""}${p.hidden ? " hidden-post" : ""}`;
    if (p.type === "note") return `<button type="button" class="pc note${cls}" data-id="${esc(p.id)}">${p.mood ? `<span class="mood">${esc(p.mood)}</span>` : ""}<p>${esc(p.text)}</p><span class="badges">${badges}</span><span class="tick">✓</span></button>`;
    return `<button type="button" class="pc${cls}" data-id="${esc(p.id)}">${imgTag(p.photos[0].sm || p.photos[0].thumb)}<span class="badges">${badges}</span>${meta ? `<span class="meta">${esc(meta)}</span>` : ""}<span class="tick">✓</span></button>`;
  }
  function renderPosts() {
    const list = filtered();
    const total = S.posts.length, photos = S.posts.reduce((s, p) => s + p.photos.length, 0), hidden = S.posts.filter(p => p.hidden).length;
    $("#postStats").textContent = `${total} anı · ${photos} fotoğraf${hidden ? ` · ${hidden} gizli` : ""}`;
    $("#pgrid").innerHTML = list.map(cardHTML).join("");
    const e = $("#pEmpty");
    e.hidden = list.length > 0;
    e.textContent = total ? "Bu filtrede anı yok." : "Henüz anı yok. “＋ Fotoğraf” ile ilk anını ekle.";
    renderBulk();
  }
  function setSelecting(on) {
    S.selecting = on;
    if (!on) S.sel.clear();
    $("#pgrid").classList.toggle("selecting", on);
    $("#selectBtn").textContent = on ? "Bitti" : "Seç";
    $$(".pc", $("#pgrid")).forEach(c => c.classList.toggle("sel", S.sel.has(c.dataset.id)));
    renderBulk();
  }
  const selected = () => S.posts.filter(p => S.sel.has(p.id));
  function renderBulk() {
    $("#bulk").hidden = !S.selecting;
    if (!S.selecting) return;
    const ps = selected(), n = ps.length;
    $("#bulkCount").textContent = `${n} seçili`;
    const allHidden = n && ps.every(p => p.hidden), allPinned = n && ps.every(p => p.pinned), allFeat = n && ps.every(p => p.featured);
    const photoPosts = ps.filter(p => p.type === "photo");
    const acts = [
      ["album", "Albüme ekle", n], ["place", "Konum", n], ["date", "Tarih", n],
      ["hide", allHidden ? "Göster" : "Gizle", n], ["pin", allPinned ? "Sabitlemeyi kaldır" : "Sabitle", n],
      ["feat", allFeat ? "Kapaktan çıkar" : "Kapağa ekle ★", photoPosts.length], ["merge", "Birleştir", photoPosts.length >= 2],
      ["split", "Ayır", ps.some(p => p.photos.length > 1)], ["del", "Sil", n]
    ];
    $("#bulkActs").innerHTML = acts.map(([k, t, ok]) => `<button type="button" class="btn${k === "del" ? " danger" : ""}${ok ? "" : " disabled"}" data-bulk="${k}">${t}</button>`).join("");
  }
  function deletePosts(ids) {
    const set = new Set(ids);
    S.posts.filter(p => set.has(p.id)).forEach(p => p.photos.forEach(ph => {
      removePath(ph.src); removePath(ph.thumb); removePath(ph.sm);
      S.albums.forEach(a => { if (a.cover === ph.src) a.cover = ""; });
    }));
    S.posts = S.posts.filter(p => !set.has(p.id));
    ids.forEach(id => S.sel.delete(id));
  }
  function refresh() { renderPosts(); updateBar(); }

  async function bulk(k) {
    const ps = selected();
    if (!ps.length) return;
    if (k === "hide") { const v = !ps.every(p => p.hidden); ps.forEach(p => { p.hidden = v; }); }
    else if (k === "pin") { const v = !ps.every(p => p.pinned); ps.forEach(p => { p.pinned = v; }); }
    else if (k === "feat") { const v = !ps.every(p => p.featured); ps.forEach(p => { if (p.type === "photo") p.featured = v; }); }
    else if (k === "del") {
      if (!confirm(`${ps.length} anı silinsin mi? Fotoğrafları da kalıcı olarak silinecek.`)) return;
      deletePosts(ps.map(p => p.id));
      setSelecting(false);
    } else if (k === "merge") {
      const photo = sortPosts(ps.filter(p => p.type === "photo")).reverse();
      if (photo.length < 2) return;
      if (!confirm(`${photo.length} anı tek bir anıda birleşsin mi? (Kaydırmalı tek gönderi olur)`)) return;
      const target = photo[0];
      photo.slice(1).forEach(p => {
        target.photos.push(...p.photos);
        if (!target.caption && p.caption) target.caption = p.caption;
        if (!target.title && p.title) target.title = p.title;
        if (!target.place && p.place) { target.place = p.place; target.country = p.country; target.cc = p.cc; target.geo = p.geo; }
        target.featured = target.featured || p.featured;
      });
      const drop = new Set(photo.slice(1).map(p => p.id));
      S.posts = S.posts.filter(p => !drop.has(p.id));
      S.sel.clear(); S.sel.add(target.id);
      toast("Anılar birleştirildi.", "ok");
    } else if (k === "split") {
      let made = 0;
      ps.filter(p => p.photos.length > 1).forEach(p => {
        p.photos.slice(1).forEach((ph, i) => {
          const n = clone(p);
          Object.assign(n, { id: uid() + i, photos: [ph], title: "", caption: "", featured: false, pinned: false });
          S.posts.push(n);
          made++;
        });
        p.photos = p.photos.slice(0, 1);
      });
      S.posts = sortPosts(S.posts);
      toast(`${made} yeni anı oluşturuldu.`, "ok");
    } else if (k === "album") { pickAlbum(ps); return; }
    else if (k === "place") { editPlaceBulk(ps); return; }
    else if (k === "date") { editDateBulk(ps); return; }
    refresh();
  }

  function albumOptions(sel) {
    return `<option value="">— Albüm yok —</option>${S.albums.map(a => `<option value="${esc(a.id)}"${a.id === sel ? " selected" : ""}>${esc(a.title)}</option>`).join("")}<option value="__new">＋ Yeni albüm…</option>`;
  }
  async function createAlbum() {
    const t = await ask("Yeni albüm", { label: "Albüm adı", placeholder: "Ör: İtalya 2025", ok: "Oluştur" });
    if (!t) return "";
    const id = `a-${slug(t).slice(0, 40) || "album"}-${uid().slice(-4)}`;
    S.albums.push({ id, title: t, desc: "", cover: "" });
    updateBar();
    return id;
  }
  function bindAlbumSelect(select) {
    let prev = select.value;
    select.addEventListener("change", async () => {
      if (select.value !== "__new") { prev = select.value; return; }
      const id = await createAlbum();
      select.innerHTML = albumOptions(id || prev);
      prev = select.value;
    });
  }
  function pickAlbum(ps) {
    const sh = sheet({
      title: `${ps.length} anı → albüm`,
      body: `<label>Albüm<select data-al>${albumOptions(ps[0].album || "")}</select></label><p class="muted">“Albüm yok” seçersen seçilen anılar albümden çıkarılır.</p>`,
      foot: `<button type="button" class="btn ghost" data-close>İptal</button><span class="sp"></span><button type="button" class="btn primary" data-ok>Uygula</button>`
    });
    const s = $("[data-al]", sh.el);
    bindAlbumSelect(s);
    $("[data-ok]", sh.el).addEventListener("click", () => {
      if (s.value === "__new") return;
      ps.forEach(p => { p.album = s.value; });
      sh.close(); refresh();
      toast(s.value ? `Albüme eklendi: ${albumTitle(s.value)}` : "Albümden çıkarıldı.", "ok");
    });
  }
  function placeFields(place = "", country = "") {
    return `<div class="row2"><label>Şehir / yer<input data-f="place" value="${esc(place)}" placeholder="Ör: Paris"></label>
      <label>Ülke<input data-f="country" list="countryList" value="${esc(country)}" placeholder="Ör: Fransa"></label></div>`;
  }
  function setPlace(p, place, country) {
    place = cleanPlace(place); country = String(country || "").trim();
    const cc = ccFromName(country);
    if (place === p.place && country === p.country) return;
    p.place = place; p.country = cc ? ccName(cc) : country; p.cc = cc; p.geo = null;
  }
  function editPlaceBulk(ps) {
    const sh = sheet({
      title: `${ps.length} anının konumu`, body: placeFields(ps[0].place, ps[0].country),
      foot: `<button type="button" class="btn ghost" data-close>İptal</button><span class="sp"></span><button type="button" class="btn primary" data-ok>Uygula</button>`
    });
    $("[data-ok]", sh.el).addEventListener("click", () => {
      const pl = $('[data-f="place"]', sh.el).value, co = $('[data-f="country"]', sh.el).value;
      ps.forEach(p => setPlace(p, pl, co));
      fillGeo(ps);
      sh.close(); refresh();
    });
  }
  function editDateBulk(ps) {
    const sh = sheet({
      title: `${ps.length} anının tarihi`, body: `<label>Tarih<input type="date" data-f="taken" value="${esc(ps[0].taken || "")}"></label><p class="muted">Boş bırakırsan tarih silinir.</p>`,
      foot: `<button type="button" class="btn ghost" data-close>İptal</button><span class="sp"></span><button type="button" class="btn primary" data-ok>Uygula</button>`
    });
    $("[data-ok]", sh.el).addEventListener("click", () => {
      const v = $('[data-f="taken"]', sh.el).value;
      ps.forEach(p => { p.taken = /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : ""; });
      S.posts = sortPosts(S.posts);
      sh.close(); refresh();
    });
  }

  /* ---------- yeni anı (fotoğraf) ---------- */
  function openComposer(fileList) {
    let files = Array.from(fileList || []).filter(f => /^image\//.test(f.type) || /\.(heic|heif|jpe?g|png|webp|gif|avif)$/i.test(f.name));
    if (!files.length) { toast("Seçtiğin dosyalar fotoğraf değil.", "err"); return; }
    if (files.length > MAX_BATCH) { toast(`Bir seferde en fazla ${MAX_BATCH} fotoğraf ekleyebilirsin; ilk ${MAX_BATCH} tanesi alındı.`, "err"); files = files.slice(0, MAX_BATCH); }
    const C = { items: files.map(f => ({ file: f, st: "wait" })), mode: "sep", stop: false, done: false };
    const sh = sheet({
      title: files.length > 1 ? `${files.length} fotoğraf` : "Yeni anı", wide: true, sticky: true,
      body: `<div class="strip" data-strip></div><p class="muted" data-status>Fotoğraflar hazırlanıyor…</p>
        <div class="radio-row" data-moderow ${files.length > 1 ? "" : "hidden"}>
          <label class="check"><input type="radio" name="cmode" value="sep" checked> Her fotoğraf ayrı bir anı olsun</label>
          <label class="check"><input type="radio" name="cmode" value="one"> Hepsi tek anıda toplansın (kaydırmalı)</label>
        </div>
        <label data-titlerow ${files.length > 1 ? "hidden" : ""}>Başlık<input data-f="title" placeholder="İsteğe bağlı"></label>
        <label>Açıklama<textarea data-f="caption" rows="3" placeholder="Bu anı hakkında birkaç kelime…"></textarea></label>
        ${placeFields()}
        <label>Tarih<input type="date" data-f="taken"></label>
        <p class="muted" style="margin-top:-6px">Konum ve tarih fotoğrafın içinde varsa otomatik alınır. Buraya yazdıkların sadece bilgisi eksik olan fotoğraflara uygulanır.</p>
        <label>Albüm<select data-f="album">${albumOptions("")}</select></label>
        <label class="check"><input type="checkbox" data-f="featured"> ★ Ana sayfa kapağında göster</label>
        <label class="check"><input type="checkbox" data-f="hidden"> Gizli tut (sitede görünmez)</label>`,
      foot: `<button type="button" class="btn ghost" data-close>İptal</button><span class="sp"></span><button type="button" class="btn primary" data-add disabled>Ekle</button>`,
      onClose: () => { C.stop = true; C.items.forEach(it => { if (it.url) URL.revokeObjectURL(it.url); }); }
    });
    const b = sh.el;
    bindAlbumSelect($('[data-f="album"]', b));
    const addBtn = $("[data-add]", b), status = $("[data-status]", b);
    const renderStrip = () => {
      $("[data-strip]", b).innerHTML = C.items.map((it, i) => {
        const info = it.st === "ok" ? [it.loc && (it.loc.place || it.loc.country), it.meta.taken ? fmtDate(it.meta.taken, true) : ""].filter(Boolean).join(" · ") || "Bilgi yok" : it.st === "err" ? "Açılamadı" : "Bekliyor…";
        return `<div class="sp-item${it.st === "err" ? " err" : ""}"><div class="im">${it.url ? `<img src="${it.url}" alt="">` : it.st === "busy" ? '<div class="mini-spin"></div>' : it.st === "err" ? "⚠️" : ""}</div>
          <small>${esc(info)}</small>${C.done && C.items.length > 1 ? `<button type="button" class="x" data-rm="${i}" aria-label="Çıkar">✕</button>` : ""}
          ${C.done && C.mode === "one" && C.items.length > 1 ? `<div class="mv"><button type="button" data-mv="${i}:-1">◀</button><button type="button" data-mv="${i}:1">▶</button></div>` : ""}</div>`;
      }).join("");
    };
    const ok = () => C.items.filter(it => it.st === "ok");
    b.addEventListener("click", e => {
      const rm = e.target.closest("[data-rm]");
      if (rm) { const it = C.items.splice(+rm.dataset.rm, 1)[0]; if (it && it.url) URL.revokeObjectURL(it.url); renderStrip(); addBtn.disabled = !ok().length; return; }
      const mv = e.target.closest("[data-mv]");
      if (mv) {
        const [i, d] = mv.dataset.mv.split(":").map(Number), j = i + d;
        if (j >= 0 && j < C.items.length) { [C.items[i], C.items[j]] = [C.items[j], C.items[i]]; renderStrip(); }
      }
    });
    $$('input[name="cmode"]', b).forEach(r => r.addEventListener("change", () => {
      C.mode = $('input[name="cmode"]:checked', b).value;
      $("[data-titlerow]", b).hidden = C.mode !== "one" && C.items.length > 1;
      renderStrip();
    }));
    renderStrip();

    (async () => {
      for (let i = 0; i < C.items.length && !C.stop; i++) {
        const it = C.items[i];
        it.st = "busy"; renderStrip();
        status.textContent = `Hazırlanıyor ${i + 1} / ${C.items.length}…`;
        await tick();
        try {
          Object.assign(it, await processImage(it.file));
          if (C.stop) return;
          it.url = URL.createObjectURL(it.thumb.blob);
          it.st = "ok";
        } catch (e) { it.st = "err"; }
        renderStrip();
      }
      if (C.stop) return;
      C.done = true;
      const bad = C.items.filter(it => it.st === "err").length;
      status.textContent = bad ? `${bad} fotoğraf açılamadı. ${HEIC_HINT}` : `${ok().length} fotoğraf hazır.`;
      addBtn.disabled = !ok().length;
      renderStrip();
    })();

    addBtn.addEventListener("click", () => {
      const items = ok();
      if (!items.length) return;
      const f = k => $(`[data-f="${k}"]`, b);
      const form = { title: f("title").value.trim(), caption: f("caption").value.trim(), place: f("place").value, country: f("country").value, taken: f("taken").value, album: f("album").value === "__new" ? "" : f("album").value, featured: f("featured").checked, hidden: f("hidden").checked };
      const now = Date.now();
      const base = () => ({ id: uid(), type: "photo", text: "", mood: "", title: "", caption: form.caption, place: "", country: "", cc: "", geo: null, taken: "", created: "", album: form.album, featured: form.featured, pinned: false, hidden: form.hidden });
      const applyLoc = (p, it) => {
        const L = it && it.loc;
        if (L && (L.place || L.country)) { Object.assign(p, { place: L.place, country: L.country, cc: L.cc, geo: L.geo }); return; }
        if (form.place || form.country) setPlace(p, form.place, form.country);
        if (L && L.geo) p.geo = L.geo;
      };
      const created = [];
      if (C.mode === "one" || items.length === 1) {
        const p = base();
        p.title = form.title;
        p.photos = items.map(photoFrom);
        applyLoc(p, items.find(it => it.loc && (it.loc.place || it.loc.country)));
        const dates = items.map(it => it.meta.taken).filter(Boolean).sort();
        p.taken = dates[0] || (/^\d{4}-\d{2}-\d{2}$/.test(form.taken) ? form.taken : "");
        p.created = new Date(now).toISOString();
        created.push(p);
      } else {
        items.forEach((it, i) => {
          const p = base();
          p.photos = [photoFrom(it)];
          applyLoc(p, it);
          p.taken = it.meta.taken || (/^\d{4}-\d{2}-\d{2}$/.test(form.taken) ? form.taken : "");
          p.created = new Date(now - i * 1000).toISOString();
          created.push(p);
        });
      }
      S.posts = sortPosts(S.posts.concat(created));
      fillGeo(created);
      sh.close("added");
      if (S.filter !== "all" && S.filter !== "new" && S.filter !== "photo") { S.filter = "all"; $("#postFilter").value = "all"; }
      refresh();
      toast(`${created.length} anı eklendi. Sitede görünmesi için “Yayınla”ya bas.`, "ok", 5000);
    });
  }

  /* ---------- not ---------- */
  const MOODS = ["", "😊", "😍", "🥹", "😂", "😎", "🤔", "😴", "☕", "🎉", "✈️", "🌧️", "🌙", "❤️", "🔥", "🎵", "📚", "🏃"];
  function openNote(post) {
    const isNew = !post;
    const p = post ? clone(post) : { id: uid(), type: "note", photos: [], text: "", mood: "", title: "", caption: "", place: "", country: "", cc: "", geo: null, taken: todayStr(), created: new Date().toISOString(), album: "", featured: false, pinned: false, hidden: false };
    const sh = sheet({
      title: isNew ? "Yeni not" : "Notu düzenle", sticky: true,
      body: `<label>Ne düşünüyorsun?<textarea data-f="text" rows="6" placeholder="Bugün…">${esc(p.text)}</textarea></label>
        <label>Ruh hali</label><div class="moods">${MOODS.map(m => `<button type="button" data-mood="${m}" class="${m === p.mood ? "on" : ""}">${m || "–"}</button>`).join("")}</div>
        <label>Tarih<input type="date" data-f="taken" value="${esc(p.taken)}"></label>
        <label class="check"><input type="checkbox" data-f="pinned" ${p.pinned ? "checked" : ""}> 📌 En üste sabitle</label>
        <label class="check"><input type="checkbox" data-f="hidden" ${p.hidden ? "checked" : ""}> Gizli tut</label>`,
      foot: `${isNew ? "" : '<button type="button" class="btn danger ghost" data-del>Sil</button>'}<span class="sp"></span><button type="button" class="btn ghost" data-close>İptal</button><button type="button" class="btn primary" data-ok>${isNew ? "Ekle" : "Kaydet"}</button>`
    });
    const b = sh.el;
    $$("[data-mood]", b).forEach(btn => btn.addEventListener("click", () => {
      p.mood = btn.dataset.mood;
      $$("[data-mood]", b).forEach(x => x.classList.toggle("on", x === btn));
    }));
    const del = $("[data-del]", b);
    if (del) del.addEventListener("click", () => { if (!confirm("Bu not silinsin mi?")) return; deletePosts([p.id]); sh.close(); refresh(); });
    $("[data-ok]", b).addEventListener("click", () => {
      const text = $('[data-f="text"]', b).value.trim();
      if (!text) { toast("Not boş olamaz.", "err"); return; }
      p.text = text;
      const d = $('[data-f="taken"]', b).value;
      p.taken = /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : "";
      p.pinned = $('[data-f="pinned"]', b).checked;
      p.hidden = $('[data-f="hidden"]', b).checked;
      if (isNew) S.posts.push(p); else S.posts = S.posts.map(x => (x.id === p.id ? p : x));
      S.posts = sortPosts(S.posts);
      sh.close(); refresh();
      if (isNew) toast("Not eklendi.", "ok");
    });
    setTimeout(() => $('[data-f="text"]', b).focus(), 80);
  }

  /* ---------- anı düzenleme ---------- */
  function openEditor(orig) {
    if (orig.type === "note") return openNote(orig);
    const p = clone(orig);
    const addedPaths = [];
    let saved = false;
    const sh = sheet({
      title: "Anıyı düzenle", wide: true, sticky: true,
      body: `<div class="strip" data-strip></div>
        <label class="btn sm" style="align-self:flex-start">＋ Fotoğraf ekle<input type="file" accept="image/*" multiple hidden data-more></label>
        <p class="muted" data-mstatus hidden></p>
        <label>Başlık<input data-f="title" value="${esc(p.title)}" placeholder="İsteğe bağlı"></label>
        <label>Açıklama<textarea data-f="caption" rows="4" placeholder="Bu anı hakkında…">${esc(p.caption)}</textarea></label>
        ${placeFields(p.place, p.country)}
        <label>Çekim tarihi<input type="date" data-f="taken" value="${esc(p.taken)}"></label>
        <label>Albüm<select data-f="album">${albumOptions(p.album)}</select></label>
        <label class="check"><input type="checkbox" data-f="featured" ${p.featured ? "checked" : ""}> ★ Ana sayfa kapağında göster</label>
        <label class="check"><input type="checkbox" data-f="pinned" ${p.pinned ? "checked" : ""}> 📌 Anılar sayfasında en üste sabitle</label>
        <label class="check"><input type="checkbox" data-f="hidden" ${p.hidden ? "checked" : ""}> Gizli tut (sitede görünmez)</label>
        ${S.orig.posts.has(p.id) ? `<a href="../#/ani/${encodeURIComponent(p.id)}" target="_blank" rel="noopener" class="muted">Sitede aç ↗</a>` : ""}`,
      foot: `<button type="button" class="btn danger ghost" data-del>Sil</button><span class="sp"></span><button type="button" class="btn ghost" data-close>İptal</button><button type="button" class="btn primary" data-ok>Kaydet</button>`,
      onClose: () => { if (!saved) addedPaths.forEach(removePath); }
    });
    const b = sh.el;
    bindAlbumSelect($('[data-f="album"]', b));
    const renderStrip = () => {
      $("[data-strip]", b).innerHTML = p.photos.map((ph, i) => `<div class="sp-item"><div class="im">${imgTag(ph.thumb)}</div>
        <small>${i === 0 ? "Kapak" : `${i + 1}. fotoğraf`}</small><button type="button" class="x" data-rm="${i}" aria-label="Fotoğrafı çıkar">✕</button>
        ${p.photos.length > 1 ? `<div class="mv"><button type="button" data-mv="${i}:-1">◀</button><button type="button" data-mv="${i}:1">▶</button></div>` : ""}</div>`).join("");
    };
    renderStrip();
    b.addEventListener("click", e => {
      const rm = e.target.closest("[data-rm]");
      if (rm) { p.photos.splice(+rm.dataset.rm, 1); renderStrip(); return; }
      const mv = e.target.closest("[data-mv]");
      if (mv) {
        const [i, d] = mv.dataset.mv.split(":").map(Number), j = i + d;
        if (j >= 0 && j < p.photos.length) { [p.photos[i], p.photos[j]] = [p.photos[j], p.photos[i]]; renderStrip(); }
      }
    });
    $("[data-more]", b).addEventListener("change", async e => {
      const files = Array.from(e.target.files || []);
      e.target.value = "";
      const st = $("[data-mstatus]", b);
      st.hidden = false;
      for (let i = 0; i < files.length; i++) {
        st.textContent = `Hazırlanıyor ${i + 1} / ${files.length}…`;
        await tick();
        try {
          const it = await processImage(files[i]);
          if (sh.closed) return;
          const ph = photoFrom(it);
          addedPaths.push(ph.src, ph.thumb);
          p.photos.push(ph);
          if (!p.taken && it.meta.taken) { p.taken = it.meta.taken; $('[data-f="taken"]', b).value = p.taken; }
          renderStrip();
        } catch (err) { toast(`“${files[i].name}” açılamadı. ${HEIC_HINT}`, "err"); }
      }
      st.hidden = true;
    });
    $("[data-del]", b).addEventListener("click", () => {
      if (!confirm("Bu anı ve fotoğrafları silinsin mi?")) return;
      saved = true;
      addedPaths.forEach(removePath);
      deletePosts([orig.id]);
      sh.close(); refresh();
    });
    $("[data-ok]", b).addEventListener("click", () => {
      if (!p.photos.length) {
        if (!confirm("Tüm fotoğrafları çıkardın. Anı tamamen silinsin mi?")) return;
        saved = true;
        addedPaths.forEach(removePath);
        deletePosts([orig.id]);
        sh.close(); refresh();
        return;
      }
      const f = k => $(`[data-f="${k}"]`, b);
      p.title = f("title").value.trim();
      p.caption = f("caption").value.trim();
      setPlace(p, f("place").value, f("country").value);
      const d = f("taken").value;
      p.taken = /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : "";
      p.album = f("album").value === "__new" ? p.album : f("album").value;
      p.featured = f("featured").checked; p.pinned = f("pinned").checked; p.hidden = f("hidden").checked;
      const kept = new Set(p.photos.map(x => x.src));
      orig.photos.forEach(ph => { if (!kept.has(ph.src)) { removePath(ph.src); removePath(ph.thumb); removePath(ph.sm); S.albums.forEach(a => { if (a.cover === ph.src) a.cover = ""; }); } });
      saved = true;
      S.posts = sortPosts(S.posts.map(x => (x.id === p.id ? p : x)));
      fillGeo([p]);
      sh.close(); refresh();
    });
  }

  /* ================= ALBÜMLER ================= */
  function albumCover(a) {
    if (a.cover) return a.cover;
    const p = S.posts.find(x => x.album === a.id && x.type === "photo");
    return p ? p.photos[0].src : "";
  }
  const thumbOf = src => { for (const p of S.posts) for (const ph of p.photos) if (ph.src === src) return ph.thumb; return src; };
  function renderAlbums() {
    const box = $("#alist");
    if (!S.albums.length) { box.innerHTML = `<p class="empty" style="grid-column:1/-1">Henüz albüm yok. Bir gezi, bir yıl ya da bir tema için albüm oluşturabilirsin.</p>`; return; }
    box.innerHTML = S.albums.map((a, i) => {
      const n = S.posts.filter(p => p.album === a.id).length;
      const cov = albumCover(a);
      return `<div class="acard"><div class="acard-img">${cov ? imgTag(thumbOf(cov)) : ""}</div><div class="acard-b"><b>${esc(a.title)}</b><span class="muted">${n} anı</span>
        <div class="acard-acts"><button type="button" class="btn sm" data-aedit="${i}">Düzenle</button><span style="flex:1"></span>
        <button type="button" class="ibtn" data-amv="${i}:-1" aria-label="Öne al">↑</button><button type="button" class="ibtn" data-amv="${i}:1" aria-label="Arkaya al">↓</button></div></div></div>`;
    }).join("");
  }
  function openAlbum(a) {
    const isNew = !a;
    const al = a ? clone(a) : { id: "", title: "", desc: "", cover: "" };
    const members = new Set(S.posts.filter(p => al.id && p.album === al.id).map(p => p.id));
    const sh = sheet({
      title: isNew ? "Yeni albüm" : "Albümü düzenle", wide: true, sticky: true,
      body: `<label>Albüm adı<input data-f="title" value="${esc(al.title)}" placeholder="Ör: İtalya 2025"></label>
        <label>Açıklama<textarea data-f="desc" rows="3" placeholder="İsteğe bağlı">${esc(al.desc)}</textarea></label>
        <div><b style="font-weight:500">Bu albümdeki anılar</b> <span class="muted" data-mcount></span><p class="muted">Dokunarak ekle/çıkar. Kapak için aşağıdan seç.</p></div>
        <div class="pick-grid" data-members></div>
        <div><b style="font-weight:500">Kapak fotoğrafı</b></div>
        <div class="pick-grid" data-covers></div>`,
      foot: `${isNew ? "" : '<button type="button" class="btn danger ghost" data-del>Albümü sil</button>'}<span class="sp"></span><button type="button" class="btn ghost" data-close>İptal</button><button type="button" class="btn primary" data-ok>Kaydet</button>`
    });
    const b = sh.el;
    const photoPosts = S.posts.filter(p => p.type === "photo");
    const render = () => {
      $("[data-mcount]", b).textContent = `(${members.size})`;
      $("[data-members]", b).innerHTML = photoPosts.map(p => `<button type="button" data-mem="${esc(p.id)}" class="${members.has(p.id) ? "on" : ""}">${imgTag(p.photos[0].sm || p.photos[0].thumb)}</button>`).join("") || '<p class="muted">Önce fotoğraf ekle.</p>';
      const covers = photoPosts.filter(p => members.has(p.id)).flatMap(p => p.photos);
      $("[data-covers]", b).innerHTML = covers.map(ph => `<button type="button" data-cov="${esc(ph.src)}" class="${al.cover === ph.src ? "on" : ""}">${imgTag(ph.thumb)}</button>`).join("") || '<p class="muted">Albüme anı ekleyince kapak seçebilirsin.</p>';
    };
    render();
    b.addEventListener("click", e => {
      const m = e.target.closest("[data-mem]");
      if (m) { const id = m.dataset.mem; if (members.has(id)) members.delete(id); else members.add(id); render(); return; }
      const c = e.target.closest("[data-cov]");
      if (c) { al.cover = al.cover === c.dataset.cov ? "" : c.dataset.cov; render(); }
    });
    const del = $("[data-del]", b);
    if (del) del.addEventListener("click", () => {
      if (!confirm("Albüm silinsin mi? İçindeki anılar silinmez, sadece albümden çıkar.")) return;
      S.posts.forEach(p => { if (p.album === al.id) p.album = ""; });
      S.albums = S.albums.filter(x => x.id !== al.id);
      sh.close(); renderAlbums(); refresh();
    });
    $("[data-ok]", b).addEventListener("click", () => {
      const title = $('[data-f="title"]', b).value.trim();
      if (!title) { toast("Albüm adı gerekli.", "err"); return; }
      al.title = title;
      al.desc = $('[data-f="desc"]', b).value.trim();
      if (isNew) { al.id = `a-${slug(title).slice(0, 40) || "album"}-${uid().slice(-4)}`; S.albums.push(al); }
      else S.albums = S.albums.map(x => (x.id === al.id ? al : x));
      S.posts.forEach(p => {
        if (members.has(p.id)) p.album = al.id;
        else if (p.album === al.id) p.album = "";
      });
      if (al.cover && !S.posts.some(p => p.album === al.id && p.photos.some(ph => ph.src === al.cover))) al.cover = "";
      sh.close(); renderAlbums(); refresh();
    });
  }

  /* ================= FORMLAR (profil, CV, ayarlar) ================= */
  const REPS = {
    facts: { path: "facts", label: "Bilgi", add: "Bilgi ekle", fields: [["k", "Başlık", "Ör: Doğum yeri"], ["v", "Değer", "Ör: Edirne"]] },
    exp: { path: "cv.experience", label: "Deneyim", add: "Deneyim ekle", fields: [["title", "Pozisyon / rol", "Ör: Yazılım geliştirici"], ["org", "Kurum / şirket"], ["start", "Başlangıç", "Ör: 2022"], ["end", "Bitiş", "Boşsa: Halen"], ["place", "Yer", "Ör: İstanbul"], ["desc", "Açıklama", "", "ta"]] },
    edu: { path: "cv.education", label: "Eğitim", add: "Eğitim ekle", fields: [["title", "Bölüm / derece", "Ör: Bilgisayar Mühendisliği"], ["org", "Okul"], ["start", "Başlangıç"], ["end", "Bitiş"], ["place", "Yer"], ["desc", "Açıklama", "", "ta"]] },
    lang: { path: "cv.languages", label: "Dil", add: "Dil ekle", fields: [["name", "Dil", "Ör: İngilizce"], ["level", "Seviye", "", "sel"]] },
    proj: { path: "cv.projects", label: "Proje", add: "Proje ekle", image: true, fields: [["title", "Başlık"], ["year", "Yıl"], ["url", "Bağlantı", "https://…"], ["desc", "Açıklama", "", "ta"]] }
  };
  const LEVELS = ["", "Ana dil", "Akıcı", "İleri", "Orta", "Başlangıç"];
  function repHTML(key) {
    const spec = REPS[key];
    const arr = getPath(S.site, spec.path) || [];
    if (!arr.length) return `<p class="muted">Henüz eklenmedi.</p>`;
    return arr.map((row, i) => {
      const fields = spec.fields.map(([f, lab, ph, kind]) => {
        const v = row[f] || "";
        if (kind === "ta") return `<label>${lab}<textarea data-rf="${f}" rows="3" placeholder="${esc(ph || "")}">${esc(v)}</textarea></label>`;
        if (kind === "sel") return `<label>${lab}<select data-rf="${f}">${LEVELS.map(l => `<option value="${esc(l)}"${l === v ? " selected" : ""}>${l || "—"}</option>`).join("")}</select></label>`;
        return `<label>${lab}<input data-rf="${f}" value="${esc(v)}" placeholder="${esc(ph || "")}"></label>`;
      });
      const pairs = [];
      for (let k = 0; k < fields.length; k++) {
        const kind = spec.fields[k][3];
        if (!kind && spec.fields[k + 1] && !spec.fields[k + 1][3]) { pairs.push(`<div class="row2">${fields[k]}${fields[k + 1]}</div>`); k++; }
        else pairs.push(fields[k]);
      }
      const img = spec.image ? `<div class="uploader"><div class="pic rect">${row.image ? imgTag(row.image) : "Görsel"}</div><div class="acts"><label class="btn sm">Görsel seç<input type="file" accept="image/*" hidden data-rimg></label>${row.image ? '<button type="button" class="btn sm ghost danger" data-rimgrm>Kaldır</button>' : ""}</div></div>` : "";
      return `<div class="rep-row" data-rep-row="${key}" data-i="${i}"><div class="rep-head"><span>${spec.label} ${i + 1}</span>
        <button type="button" data-rep-act="up" aria-label="Yukarı">↑</button><button type="button" data-rep-act="down" aria-label="Aşağı">↓</button><button type="button" class="del" data-rep-act="del" aria-label="Sil">✕</button></div>${img}${pairs.join("")}</div>`;
    }).join("");
  }
  const renderRep = key => { const box = $(`[data-rep="${key}"]`); if (box) box.innerHTML = repHTML(key); };
  const field = (k, label, o = {}) => {
    const v = getPath(S.site, k);
    const val = Array.isArray(v) ? v.join(", ") : v == null ? "" : String(v);
    const attrs = `data-k="${k}"${o.list ? " data-list" : ""} placeholder="${esc(o.ph || "")}"`;
    const input = o.ta ? `<textarea ${attrs} rows="${o.rows || 3}">${esc(val)}</textarea>` : `<input ${attrs} value="${esc(val)}"${o.type ? ` type="${o.type}"` : ""}>`;
    return `<label>${label}${input}${o.hint ? `<span class="muted" style="font-size:12px">${o.hint}</span>` : ""}</label>`;
  };
  const uploaderHTML = (key, title, hint, rect) => {
    const v = S.site[key];
    return `<div class="uploader" data-up="${key}"><div class="pic${rect ? " rect" : ""}">${v ? imgTag(v) : "Yok"}</div><div><b style="font-weight:500">${title}</b><p class="muted">${hint}</p>
      <div class="acts" style="margin-top:8px"><label class="btn sm">Yükle<input type="file" accept="image/*" hidden data-upfile="${key}"></label>${v ? `<button type="button" class="btn sm ghost danger" data-uprm="${key}">Kaldır</button>` : ""}</div></div></div>`;
  };
  const TZ = ["Europe/Istanbul", "Europe/London", "Europe/Berlin", "Europe/Paris", "Europe/Amsterdam", "Europe/Vienna", "Europe/Rome", "Europe/Madrid", "America/New_York", "America/Chicago", "America/Los_Angeles", "Asia/Dubai", "Asia/Tokyo", "Australia/Sydney"];

  function renderProfile() {
    const s = S.site;
    const tz = TZ.includes(s.timezone) ? TZ : [s.timezone].concat(TZ);
    $("#profileForm").innerHTML = `
      <div class="card"><h3>Fotoğraflar</h3>
        ${uploaderHTML("avatar", "Profil fotoğrafı", "Anılar sayfasında ve paylaşımlarda yuvarlak görünür.")}
        ${uploaderHTML("portrait", "Portre", "“Hakkımda” sayfasındaki büyük fotoğraf. Boşsa kapak fotoğrafların kullanılır.", true)}
        ${uploaderHTML("face", "Yüzün (oyun & beğeni)", "Yüzünün yakın olduğu bir fotoğraf seç ve dairede ortala. Oyundaki karakter, beğenince fırlayan yüz ve sürprizlerde bu görünür.")}
      </div>
      <div class="card"><h3>Kimlik</h3>
        <div class="row2">${field("name", "İsim")}${field("handle", "Kullanıcı adı", { ph: "ardaekinci" })}</div>
        <div class="row2">${field("location", "Yaşadığın yer", { ph: "İstanbul, Türkiye", hint: "Şehir de yazarsan sitede o şehrin hava durumu görünür." })}
        <label>Saat dilimi<select data-k="timezone">${tz.map(z => `<option${z === s.timezone ? " selected" : ""}>${esc(z)}</option>`).join("")}</select></label></div>
      </div>
      <div class="card"><h3>Yazılar</h3>
        ${field("bio", "Kısa tanıtım", { ta: true, rows: 3, hint: "Ana sayfadaki büyük, kelime kelime aydınlanan cümle. Vurgulamak istediğin kelimeyi *yıldız* içine al." })}
        ${field("tagline", "Slogan", { hint: "Ana sayfada isminin altında görünür." })}
        ${field("about", "Hakkımda (uzun yazı)", { ta: true, rows: 8, hint: "Paragrafları boş bir satırla ayır. İlk paragraf büyük yazılır." })}
        ${field("now", "Şu sıralar", { ta: true, rows: 2, ph: "Ör: Yeni bir işe başladım, bol bol kitap okuyorum." })}
      </div>
      <div class="card"><h3>İletişim & sosyal medya</h3>
        ${field("email", "E-posta", { type: "email", ph: "merhaba@ardaekinci.com" })}
        <div class="row2">${SOCIAL_KEYS.map(([k, l, ph]) => field(`socials.${k}`, l, { ph })).join("")}</div>
      </div>
      <div class="card"><h3>Kısaca <small>Hakkımda sayfasındaki bilgi kutucukları</small></h3>
        <div class="rep" data-rep="facts">${repHTML("facts")}</div>
        <button type="button" class="btn sm" data-rep-add="facts" style="align-self:flex-start">＋ ${REPS.facts.add}</button>
      </div>`;
  }
  function renderCV() {
    const s = S.site;
    const card = (key, title) => `<div class="card"><h3>${title}</h3><div class="rep" data-rep="${key}">${repHTML(key)}</div>
      <button type="button" class="btn sm" data-rep-add="${key}" style="align-self:flex-start">＋ ${REPS[key].add}</button></div>`;
    $("#cvForm").innerHTML = `
      ${card("exp", "Deneyim")}
      ${card("edu", "Eğitim")}
      <div class="card"><h3>Yetenekler</h3>${field("cv.skills", "Virgülle ayırarak yaz", { ta: true, rows: 2, list: true, ph: "Fotoğrafçılık, Python, Liderlik…" })}</div>
      ${card("lang", "Diller")}
      ${card("proj", "Projeler / işlerim")}
      <div class="card"><h3>CV dosyası <small>PDF</small></h3>
        <p class="muted">${s.cv.pdf ? `Yüklü: <a href="${esc(imgURL(s.cv.pdf))}" target="_blank" rel="noopener">${esc(s.cv.pdf.split("/").pop())}</a>` : "Henüz yüklenmedi. Yüklersen Hakkımda sayfasında “CV'yi indir” butonu çıkar."}</p>
        <div class="acts" style="display:flex;gap:6px"><label class="btn sm">PDF yükle<input type="file" accept="application/pdf,.pdf" hidden data-pdf></label>${s.cv.pdf ? '<button type="button" class="btn sm ghost danger" data-pdfrm>Kaldır</button>' : ""}</div>
      </div>`;
  }
  const PRESETS = ["#e8b67a", "#f08a5d", "#ff6b81", "#c38fff", "#6aa9ff", "#5ad1c4", "#9bd16b", "#f4eee6"];
  const SECTIONS = [["otd", "Bugün geçmişte (o güne denk gelen anılar)"], ["latest", "Son eklenenler (yatay kayan bölüm)"], ["tunnel", "3B zaman tüneli"], ["stories", "Hikâyeler (yuvarlak öne çıkanlar)"], ["stats", "Sayılar"], ["globe", "Dünya küresi"], ["notes", "Notlar"], ["play", "Mini oyun daveti"], ["about", "Hakkımda tanıtımı"], ["contact", "İletişim"]];
  function renderSettings() {
    const t = S.site.theme;
    $("#settingsForm").innerHTML = `
      <div class="card"><h3>Vurgu rengi</h3><p class="muted">Sitedeki altın sarısı detayların rengi.</p>
        <div class="swatches">${PRESETS.map(c => `<button type="button" class="sw${c === t.accent ? " on" : ""}" style="background:${c}" data-sw="${c}" aria-label="${c}"></button>`).join("")}
        <input type="color" data-k="theme.accent" value="${esc(t.accent)}" aria-label="Özel renk"></div></div>
      <div class="card"><h3>Ana sayfa</h3>
        <div class="toggles"><label class="check"><input type="checkbox" data-k="theme.intro" ${t.intro ? "checked" : ""}> Açılış animasyonu (ilk girişte)</label>
        ${SECTIONS.map(([k, l]) => `<label class="check"><input type="checkbox" data-k="theme.sections.${k}" ${t.sections[k] ? "checked" : ""}> ${l}</label>`).join("")}</div>
        ${field("words", "Dönen kelimeler", { list: true, hint: "“Hayatımdan …” cümlesinde sırayla döner. Virgülle ayır." })}
        ${field("theme.marquee", "Kayan yazı kelimeleri", { list: true, hint: "Virgülle ayır." })}
      </div>
      <div class="card"><h3>Alan adı (ardaekinci.com)</h3>
        <p class="muted">Alan adını aldıktan sonra GitHub'da <b>Settings → Pages → Custom domain</b> kısmına <code>ardaekinci.com</code> yaz ve kaydet. DNS ayarları README dosyasında yazıyor. Panel ve site aynen çalışmaya devam eder.</p></div>
      <div class="card"><h3>Bağlantı</h3>
        <div class="row2"><label>GitHub kullanıcı adı<input data-cfg="owner" value="${esc(cfg.owner)}"></label><label>Repo<input data-cfg="repo" value="${esc(cfg.repo)}"></label></div>
        <label>Dal (branch)<input data-cfg="branch" value="${esc(cfg.branch)}"></label>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn sm" data-cfgsave>Kaydet ve yeniden yükle</button><button type="button" class="btn sm danger" data-logout>Çıkış yap</button></div>
      </div>
      <div class="card"><h3>Depolama</h3><p class="muted">${S.posts.reduce((s, p) => s + p.photos.length, 0)} fotoğraf, ${S.posts.length} anı. GitHub ücretsiz olarak yaklaşık 1 GB'a kadar rahat çalışır (aşağı yukarı 1000+ fotoğraf).</p></div>`;
  }
  function renderAll() { renderPosts(); renderAlbums(); renderProfile(); renderCV(); renderSettings(); updateBar(); $("#sideRepo").textContent = `${cfg.owner}/${cfg.repo}`; }

  function bindForms() {
    const main = $("#main");
    const onField = e => {
      const t = e.target;
      if (t.dataset.k) {
        let v = t.type === "checkbox" ? t.checked : t.value;
        if (t.hasAttribute("data-list")) v = listVal(v);
        setPath(S.site, t.dataset.k, v);
        if (t.dataset.k === "theme.accent") { AE.applyAccent(v); $$("[data-sw]").forEach(x => x.classList.toggle("on", x.dataset.sw === v)); }
        updateBar();
        return;
      }
      if (t.dataset.rf) {
        const row = t.closest("[data-rep-row]");
        const spec = REPS[row.dataset.repRow];
        const arr = getPath(S.site, spec.path);
        const i = +row.dataset.i;
        if (arr && arr[i]) { arr[i][t.dataset.rf] = t.value; updateBar(); }
      }
    };
    main.addEventListener("input", onField);
    main.addEventListener("change", onField);
    main.addEventListener("click", e => {
      const sw = e.target.closest("[data-sw]");
      if (sw) {
        S.site.theme.accent = sw.dataset.sw;
        AE.applyAccent(sw.dataset.sw);
        $$("[data-sw]").forEach(x => x.classList.toggle("on", x === sw));
        const ci = $('[data-k="theme.accent"]'); if (ci) ci.value = sw.dataset.sw;
        updateBar();
        return;
      }
      const add = e.target.closest("[data-rep-add]");
      if (add) {
        const spec = REPS[add.dataset.repAdd];
        let arr = getPath(S.site, spec.path);
        if (!Array.isArray(arr)) { arr = []; setPath(S.site, spec.path, arr); }
        const o = {}; spec.fields.forEach(([f]) => { o[f] = ""; });
        arr.push(o);
        renderRep(add.dataset.repAdd);
        const rows = $$(`[data-rep-row="${add.dataset.repAdd}"]`);
        const last = rows[rows.length - 1];
        if (last) { const inp = $("input, textarea", last); if (inp) inp.focus(); }
        updateBar();
        return;
      }
      const act = e.target.closest("[data-rep-act]");
      if (act) {
        const row = act.closest("[data-rep-row]"), key = row.dataset.repRow, spec = REPS[key];
        const arr = getPath(S.site, spec.path), i = +row.dataset.i;
        if (act.dataset.repAct === "del") {
          const filled = Object.values(arr[i] || {}).some(v => String(v || "").trim());
          if (filled && !confirm("Bu satır silinsin mi?")) return;
          if (arr[i] && arr[i].image) removePath(arr[i].image);
          arr.splice(i, 1);
        } else {
          const j = i + (act.dataset.repAct === "up" ? -1 : 1);
          if (j < 0 || j >= arr.length) return;
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        renderRep(key); updateBar();
        return;
      }
      const rimgrm = e.target.closest("[data-rimgrm]");
      if (rimgrm) {
        const row = rimgrm.closest("[data-rep-row]"), spec = REPS[row.dataset.repRow];
        const it = getPath(S.site, spec.path)[+row.dataset.i];
        removePath(it.image); it.image = "";
        renderRep(row.dataset.repRow); updateBar();
        return;
      }
      const uprm = e.target.closest("[data-uprm]");
      if (uprm) { const k = uprm.dataset.uprm; removePath(S.site[k]); S.site[k] = ""; renderProfile(); updateBar(); return; }
      if (e.target.closest("[data-pdfrm]")) { removePath(S.site.cv.pdf); S.site.cv.pdf = ""; renderCV(); updateBar(); return; }
      if (e.target.closest("[data-cfgsave]")) {
        const v = k => $(`[data-cfg="${k}"]`).value.trim();
        if (changes().n && !confirm("Yayınlanmamış değişiklikler kaybolacak. Devam edilsin mi?")) return;
        cfg = { owner: v("owner") || DEFAULT_CFG.owner, repo: v("repo") || DEFAULT_CFG.repo, branch: v("branch") };
        store.set("ae_cfg", JSON.stringify(cfg));
        S.orig = null;
        location.reload();
        return;
      }
      if (e.target.closest("[data-logout]")) {
        if (changes().n && !confirm("Yayınlanmamış değişiklikler kaybolacak. Çıkılsın mı?")) return;
        store.del("ae_token");
        S.orig = null;
        location.reload();
      }
    });
    main.addEventListener("change", async e => {
      const t = e.target;
      if (t.dataset.upfile) {
        const key = t.dataset.upfile, file = t.files && t.files[0];
        t.value = "";
        if (!file) return;
        if (key === "face") {
          const blob = await openCropper(file);
          if (!blob) return;
          const path = `images/face-${uid()}.jpg`;
          stage(path, blob);
          removePath(S.site.face);
          S.site.face = path;
          renderProfile(); updateBar();
          toast("Yüzün hazır! Yayınlayınca oyunda ve beğenilerde görünecek 😄", "ok", 5000);
          return;
        }
        try {
          const blob = await processSmall(file, key === "avatar" ? 800 : 1600);
          const path = `images/${key}-${uid()}.jpg`;
          stage(path, blob);
          removePath(S.site[key]);
          S.site[key] = path;
          renderProfile(); updateBar();
        } catch (err) { toast(`Görsel açılamadı. ${HEIC_HINT}`, "err"); }
        return;
      }
      if (t.hasAttribute("data-rimg")) {
        const row = t.closest("[data-rep-row]"), spec = REPS[row.dataset.repRow];
        const it = getPath(S.site, spec.path)[+row.dataset.i];
        const file = t.files && t.files[0];
        t.value = "";
        if (!file || !it) return;
        try {
          const blob = await processSmall(file, 1600);
          const path = `images/proje-${uid()}.jpg`;
          stage(path, blob);
          if (it.image) removePath(it.image);
          it.image = path;
          renderRep(row.dataset.repRow); updateBar();
        } catch (err) { toast("Görsel açılamadı.", "err"); }
        return;
      }
      if (t.hasAttribute("data-pdf")) {
        const file = t.files && t.files[0];
        t.value = "";
        if (!file) return;
        if (!/pdf$/i.test(file.type) && !/\.pdf$/i.test(file.name)) { toast("Lütfen PDF dosyası seç.", "err"); return; }
        if (file.size > 15 * 1024 * 1024) { toast("PDF en fazla 15 MB olabilir.", "err"); return; }
        const path = `files/cv-${uid()}.pdf`;
        stage(path, file);
        removePath(S.site.cv.pdf);
        S.site.cv.pdf = path;
        renderCV(); updateBar();
      }
    });
  }

  /* ================= YAYINLAMA ================= */
  function commitMessage(c) {
    const bits = [];
    if (c.added) bits.push(`${c.added} anı eklendi`);
    if (c.removed) bits.push(`${c.removed} anı silindi`);
    if (c.edited) bits.push(`${c.edited} anı düzenlendi`);
    if (c.albums) bits.push("albümler güncellendi");
    if (c.site) bits.push("profil/ayarlar güncellendi");
    if (S.legacy) bits.push("veri yeni biçime taşındı");
    return `Site: ${bits.join(", ") || "düzenlemeler"}`;
  }
  function mergeRemote(remote) {
    const ours = new Map(S.posts.map(p => [p.id, toStored(p)]));
    const origIds = new Set(S.orig.posts.keys());
    const rposts = remote.doc && Array.isArray(remote.doc.posts) ? remote.doc.posts : [];
    const out = [], seen = new Set();
    rposts.forEach(rp => {
      if (!rp || !rp.id || seen.has(rp.id)) return;
      seen.add(rp.id);
      if (origIds.has(rp.id) && !ours.has(rp.id)) return;
      if (ours.has(rp.id)) {
        const mine = ours.get(rp.id);
        out.push(S.orig.posts.get(rp.id) !== JSON.stringify(mine) ? mine : rp);
      } else out.push(rp);
    });
    ours.forEach((p, id) => { if (!seen.has(id) && !origIds.has(id)) out.push(p); });
    const albumsChanged = JSON.stringify(S.albums) !== S.orig.albums;
    const albums = albumsChanged ? S.albums : (remote.doc && Array.isArray(remote.doc.albums) ? remote.doc.albums : S.albums);
    const siteChanged = JSON.stringify(toStoredSite(S.site)) !== S.orig.site;
    const site = siteChanged || !remote.site ? toStoredSite(S.site) : remote.site;
    return { posts: out, albums, site };
  }

  async function doPublish(attempt = 0) {
    const ch = changes();
    const br = encodeURIComponent(cfg.branch);
    prog.set(0.02, "Hazırlanıyor…");
    const ref = await gh(`${R()}/git/ref/heads/${br}`);
    const head = ref.object.sha;
    let data = { posts: S.posts.map(toStored), albums: S.albums, site: toStoredSite(S.site) };
    if (head !== S.base) {
      prog.set(0.04, "Başka bir yerden yapılan değişiklikler birleştiriliyor…");
      const remote = await readAt(head);
      data = mergeRemote(remote);
    }
    const headCommit = await gh(`${R()}/git/commits/${head}`);
    let dels = [...S.deletes];
    if (S.legacy) dels.push("data/photos.json");
    if (dels.length) {
      try {
        const tree = await gh(`${R()}/git/trees/${headCommit.tree.sha}?recursive=1`);
        if (tree && !tree.truncated && Array.isArray(tree.tree)) { const have = new Set(tree.tree.map(x => x.path)); dels = dels.filter(d => have.has(d)); }
      } catch (e) {}
    }
    const files = [...S.staged].map(([path, v]) => ({ path, blob: v.blob }));
    const entries = [];
    let next = 0, done = 0;
    const total = files.length;
    const onWait = s => prog.set(null, `GitHub kısa bir mola istedi, ${s} saniye bekleniyor… (${done} / ${total})`);
    const worker = async () => {
      while (next < files.length) {
        const f = files[next++];
        let sha = S.blobSha.get(f.path);
        if (!sha) {
          const b64 = await toB64(f.blob);
          sha = (await gh(`${R()}/git/blobs`, { method: "POST", body: { content: b64, encoding: "base64" }, onWait })).sha;
          S.blobSha.set(f.path, sha);
        }
        entries.push({ path: f.path, mode: "100644", type: "blob", sha });
        done++;
        prog.set(0.05 + 0.85 * (done / Math.max(1, total)), `Dosyalar gönderiliyor… ${done} / ${total}`);
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    const postsDoc = { version: 2, albums: data.albums, posts: data.posts };
    entries.push({ path: "data/posts.json", mode: "100644", type: "blob", content: JSON.stringify(postsDoc, null, 2) + "\n" });
    entries.push({ path: "data/site.json", mode: "100644", type: "blob", content: JSON.stringify(data.site, null, 2) + "\n" });
    dels.forEach(d => entries.push({ path: d, mode: "100644", type: "blob", sha: null }));
    prog.set(0.93, "Kaydediliyor…");
    const tree = await gh(`${R()}/git/trees`, { method: "POST", body: { base_tree: headCommit.tree.sha, tree: entries } });
    const commit = await gh(`${R()}/git/commits`, { method: "POST", body: { message: commitMessage(ch), tree: tree.sha, parents: [head] } });
    try {
      await gh(`${R()}/git/refs/heads/${br}`, { method: "PATCH", body: { sha: commit.sha } });
    } catch (e) {
      if ((e.status === 422 || e.status === 409) && attempt < 2) return doPublish(attempt + 1);
      throw e;
    }
    const wasMerged = head !== S.base;
    S.staged.forEach((v, k) => S.preview.set(k, v.url));
    S.staged.clear(); S.deletes.clear(); S.blobSha.clear();
    S.legacy = false;
    S.base = commit.sha;
    if (wasMerged) {
      S.posts = sortPosts(data.posts.map(fromStored).filter(Boolean));
      S.albums = data.albums.map(a => ({ id: String(a.id), title: String(a.title), desc: String(a.desc || ""), cover: String(a.cover || "") }));
      S.site = clone(AE.normSite(data.site));
    }
    S.orig = snapshot();
    renderAll();
    prog.set(1, "Tamam");
  }
  async function publish() {
    if (S.busy) return;
    if (sheets.length) { toast("Önce açık pencereyi kaydet ya da kapat.", "err"); return; }
    S.busy = true;
    prog.show("Yayınlanıyor…");
    try {
      await doPublish();
      toast("Yayınlandı! Değişiklikler 1–2 dakika içinde sitede görünür.", "ok", 6000);
    } catch (e) {
      console.error(e);
      if (e.status === 401) toast("Anahtarının süresi dolmuş ya da geçersiz. Çıkış yapıp yeni anahtarla gir.", "err", 9000);
      else if (e.status === 403 || e.status === 404) toast("Yazma izni yok. Anahtarında “Contents: Read and write” izni açık olmalı.", "err", 9000);
      else toast(`Yayınlanamadı: ${e.message}. Değişikliklerin duruyor, tekrar dene.`, "err", 9000);
    } finally {
      prog.hide();
      S.busy = false;
      updateBar();
    }
  }

  /* ================= giriş & başlangıç ================= */
  function showLogin(err) {
    $("#appView").hidden = true;
    $("#loginView").hidden = false;
    $("#boot").hidden = true;
    const e = $("#loginError");
    e.hidden = !err;
    e.textContent = err || "";
  }
  async function boot() {
    if (!token) return showLogin();
    $("#boot").hidden = false;
    try {
      await loadAll();
      $("#loginView").hidden = true;
      $("#appView").hidden = false;
      renderAll();
      setTab(S.tab);
    } catch (e) {
      console.error(e);
      if (e.status === 401) { store.del("ae_token"); token = null; showLogin("Anahtar geçersiz ya da süresi dolmuş. Yeni bir anahtarla gir."); }
      else if (e.status === 404) showLogin(`“${cfg.owner}/${cfg.repo}” reposuna ulaşılamadı. Anahtarın bu repoya erişimi olduğundan emin ol.`);
      else showLogin(`Bağlantı hatası: ${e.message}`);
    } finally {
      $("#boot").hidden = true;
    }
  }

  function bindApp() {
    buildNav();
    const dl = document.createElement("datalist");
    dl.id = "countryList";
    dl.innerHTML = COUNTRIES.map(c => `<option value="${esc(c)}">`).join("");
    document.body.appendChild(dl);

    $("#loginForm").addEventListener("submit", async e => {
      e.preventDefault();
      token = $("#tokenInput").value.replace(/\s+/g, "");
      if (!token) return;
      store.del("ae_token");
      store.set("ae_token", token, $("#remember").checked);
      await boot();
    });
    document.addEventListener("click", e => {
      const tb = e.target.closest("[data-tab]");
      if (tb) setTab(tb.dataset.tab);
    });
    $("#fileInput").addEventListener("change", e => { const f = e.target.files; if (f && f.length) openComposer(f); e.target.value = ""; });
    $("#noteBtn").addEventListener("click", () => openNote(null));
    $("#selectBtn").addEventListener("click", () => setSelecting(!S.selecting));
    $("#bulkDone").addEventListener("click", () => setSelecting(false));
    $("#bulkAll").addEventListener("click", () => {
      const ids = filtered().map(p => p.id);
      const all = ids.every(id => S.sel.has(id));
      ids.forEach(id => (all ? S.sel.delete(id) : S.sel.add(id)));
      $$(".pc", $("#pgrid")).forEach(c => c.classList.toggle("sel", S.sel.has(c.dataset.id)));
      renderBulk();
    });
    $("#bulkActs").addEventListener("click", e => { const b = e.target.closest("[data-bulk]"); if (b && !b.classList.contains("disabled")) bulk(b.dataset.bulk); });
    let qt = 0;
    $("#postSearch").addEventListener("input", e => { clearTimeout(qt); qt = setTimeout(() => { S.q = e.target.value.trim(); renderPosts(); }, 180); });
    $("#postFilter").addEventListener("change", e => { S.filter = e.target.value; renderPosts(); });

    // ızgara: dokun = düzenle / seç, uzun bas = seçim modu
    const grid = $("#pgrid");
    let lpT = 0, lpFired = false, sx = 0, sy = 0;
    grid.addEventListener("pointerdown", e => {
      const c = e.target.closest(".pc");
      if (!c) return;
      lpFired = false; sx = e.clientX; sy = e.clientY;
      clearTimeout(lpT);
      lpT = setTimeout(() => {
        lpFired = true;
        if (!S.selecting) setSelecting(true);
        S.sel.add(c.dataset.id);
        c.classList.add("sel");
        renderBulk();
        if (navigator.vibrate) try { navigator.vibrate(15); } catch (err) {}
      }, 480);
    });
    grid.addEventListener("pointermove", e => { if (Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > 10) clearTimeout(lpT); });
    ["pointerup", "pointercancel", "pointerleave"].forEach(ev => grid.addEventListener(ev, () => clearTimeout(lpT)));
    grid.addEventListener("contextmenu", e => { if (e.target.closest(".pc")) e.preventDefault(); });
    grid.addEventListener("click", e => {
      const c = e.target.closest(".pc");
      if (!c) return;
      if (lpFired) { lpFired = false; return; }
      const id = c.dataset.id;
      if (S.selecting) {
        if (S.sel.has(id)) S.sel.delete(id); else S.sel.add(id);
        c.classList.toggle("sel", S.sel.has(id));
        renderBulk();
        return;
      }
      const p = S.posts.find(x => x.id === id);
      if (p) openEditor(p);
    });

    // sürükle-bırak
    const drop = $("#drop");
    const hasFiles = e => e.dataTransfer && Array.from(e.dataTransfer.types || []).includes("Files");
    addEventListener("dragover", e => { if (hasFiles(e)) { e.preventDefault(); drop.classList.add("over"); } });
    addEventListener("dragleave", e => { if (!e.relatedTarget) drop.classList.remove("over"); });
    addEventListener("drop", e => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      drop.classList.remove("over");
      if ($("#appView").hidden || sheets.length) return;
      if (S.tab !== "posts") setTab("posts");
      openComposer(e.dataTransfer.files);
    });

    $("#alist").addEventListener("click", e => {
      const ed = e.target.closest("[data-aedit]");
      if (ed) { openAlbum(S.albums[+ed.dataset.aedit]); return; }
      const mv = e.target.closest("[data-amv]");
      if (mv) {
        const [i, d] = mv.dataset.amv.split(":").map(Number), j = i + d;
        if (j >= 0 && j < S.albums.length) { [S.albums[i], S.albums[j]] = [S.albums[j], S.albums[i]]; renderAlbums(); updateBar(); }
      }
    });
    $("#newAlbumBtn").addEventListener("click", () => openAlbum(null));
    bindForms();
    $("#publishBtn").addEventListener("click", publish);
    $("#discardBtn").addEventListener("click", async () => {
      if (!confirm("Yayınlanmamış tüm değişiklikler geri alınsın mı?")) return;
      $("#boot").hidden = false;
      try { await loadAll(); renderAll(); toast("Değişiklikler geri alındı."); }
      catch (e) { toast(`Yüklenemedi: ${e.message}`, "err"); }
      $("#boot").hidden = true;
    });
  }

  bindApp();
  boot();
})();
