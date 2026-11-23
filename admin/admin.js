/* Arda Ekinci — admin panel
 * Everything is stored in the GitHub repo. Changes are staged in the browser
 * and written as a single commit when "Yayınla" is pressed.
 */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s = "") => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const clone = o => JSON.parse(JSON.stringify(o));

  const DEFAULT_CFG = { owner: "ardaekinci1942-alt", repo: "Arda-Ekinci", branch: "" };
  const MAIN_MAX = 2400, MAIN_Q = 0.86, THUMB_MAX = 1000, THUMB_Q = 0.8, PORTRAIT_MAX = 1400;
  const DEFAULT_SITE = { name: "Arda Ekinci", tagline: "", about: "", location: "", email: "", instagram: "", twitter: "", youtube: "", linkedin: "", portrait: "" };

  const store = {
    get(k) { try { return localStorage.getItem(k) ?? sessionStorage.getItem(k); } catch { return null; } },
    set(k, v, persist = true) { try { (persist ? localStorage : sessionStorage).setItem(k, v); } catch {} },
    del(k) { try { localStorage.removeItem(k); sessionStorage.removeItem(k); } catch {} }
  };

  let cfg = { ...DEFAULT_CFG, ...JSON.parse(store.get("ae_cfg") || "{}") };
  let token = store.get("ae_token");

  const S = {
    site: clone(DEFAULT_SITE),
    photos: [],
    origSite: "",
    origPhotos: [],
    staged: new Map(),   // path -> { blob, url }
    deletes: new Set(),  // remote paths to remove
    preview: new Map(),  // path -> object URL (survives publish until reload)
    busy: false
  };

  /* ================= GitHub API ================= */
  async function gh(path, opts = {}) {
    const res = await fetch(`https://api.github.com${path}`, {
      method: opts.method || "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: opts.raw ? "application/vnd.github.raw+json" : "application/vnd.github+json",
        ...(opts.body ? { "Content-Type": "application/json" } : {})
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      cache: "no-store"
    });
    if (!res.ok) {
      let msg = res.statusText;
      try { msg = (await res.json()).message || msg; } catch {}
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    if (res.status === 204) return null;
    return opts.raw ? res.text() : res.json();
  }
  const R = () => `/repos/${cfg.owner}/${cfg.repo}`;

  async function readJSON(path, fallback) {
    try {
      const txt = await gh(`${R()}/contents/${path}?ref=${encodeURIComponent(cfg.branch)}`, { raw: true });
      return JSON.parse(txt);
    } catch (e) {
      if (e.status === 404) return fallback;
      throw e;
    }
  }

  async function commit(message, files, deletes) {
    const b = encodeURIComponent(cfg.branch);
    const ref = await gh(`${R()}/git/ref/heads/${b}`);
    const base = await gh(`${R()}/git/commits/${ref.object.sha}`);
    const tree = [];
    const binaries = files.filter(f => f.blob);
    let done = 0, next = 0;
    progress(0.02, `Fotoğraflar gönderiliyor… 0 / ${binaries.length}`);
    const worker = async () => {
      while (next < binaries.length) {
        const f = binaries[next++];
        const blob = await gh(`${R()}/git/blobs`, { method: "POST", body: { content: await toB64(f.blob), encoding: "base64" } });
        tree.push({ path: f.path, mode: "100644", type: "blob", sha: blob.sha });
        progress(++done / (binaries.length + 2), `Fotoğraflar gönderiliyor… ${done} / ${binaries.length}`);
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    files.filter(f => f.text != null).forEach(f => tree.push({ path: f.path, mode: "100644", type: "blob", content: f.text }));
    deletes.forEach(p => tree.push({ path: p, mode: "100644", type: "blob", sha: null }));
    const newTree = await gh(`${R()}/git/trees`, { method: "POST", body: { base_tree: base.tree.sha, tree } });
    progress((binaries.length + 1) / (binaries.length + 2), "Kaydediliyor…");
    const c = await gh(`${R()}/git/commits`, { method: "POST", body: { message, tree: newTree.sha, parents: [ref.object.sha] } });
    await gh(`${R()}/git/refs/heads/${b}`, { method: "PATCH", body: { sha: c.sha } });
    progress(1, "Tamam");
  }

  /* ================= UI helpers ================= */
  function toast(msg, type = "") {
    const t = document.createElement("div");
    t.className = `toast ${type}`;
    t.textContent = msg;
    $("#toasts").appendChild(t);
    setTimeout(() => t.remove(), type === "err" ? 7000 : 4000);
  }
  function progress(frac, text) {
    const box = $("#procBox");
    if (frac == null) { box.hidden = true; return; }
    box.hidden = false;
    $("#procBar").style.width = `${Math.round(frac * 100)}%`;
    $("#procText").textContent = text || "";
  }
  const imgURL = path => {
    if (!path) return "";
    if (S.staged.has(path)) return S.staged.get(path).url;
    if (S.preview.has(path)) return S.preview.get(path);
    return `../${path}`;
  };
  const rawURL = path => `https://raw.githubusercontent.com/${cfg.owner}/${cfg.repo}/${cfg.branch}/${path}`;
  window.__aeImgErr = img => {
    if (img.dataset.fb) return;
    img.dataset.fb = 1;
    img.src = rawURL(img.dataset.path);
  };
  const imgTag = (path, alt = "") =>
    `<img src="${esc(imgURL(path))}" data-path="${esc(path)}" alt="${esc(alt)}" loading="lazy" onerror="__aeImgErr(this)">`;

  /* ================= boot / auth ================= */
  async function boot() {
    if (!token) return showLogin();
    try {
      const repo = await gh(R());
      if (!cfg.branch) cfg.branch = repo.default_branch;
      await loadData();
      showApp();
    } catch (e) {
      if (e.status === 401) { store.del("ae_token"); token = null; showLogin("Anahtarın geçersiz ya da süresi dolmuş. Yeniden giriş yap."); }
      else if (e.status === 404) showLogin(`“${cfg.owner}/${cfg.repo}” reposuna erişilemedi. Anahtarın bu repoya izni olduğundan emin ol.`);
      else showLogin(`Bağlantı hatası: ${e.message}`);
    } finally {
      $("#boot").hidden = true;
    }
  }
  function showLogin(err) {
    $("#appView").hidden = true;
    $("#loginView").hidden = false;
    $("#boot").hidden = true;
    const el = $("#loginError");
    el.hidden = !err;
    el.textContent = err || "";
  }
  function showApp() {
    $("#loginView").hidden = true;
    $("#appView").hidden = false;
    renderAll();
  }
  $("#loginForm").addEventListener("submit", async e => {
    e.preventDefault();
    const btn = e.submitter || $("#loginForm button");
    btn.disabled = true;
    token = $("#tokenInput").value.replace(/\s+/g, "");
    store.del("ae_token");
    store.set("ae_token", token, $("#remember").checked);
    $("#boot").hidden = false;
    await boot();
    btn.disabled = false;
  });
  $("#logoutBtn").addEventListener("click", () => {
    if (dirtyCount() && !confirm("Yayınlanmamış değişiklikler kaybolacak. Çıkılsın mı?")) return;
    store.del("ae_token");
    location.reload();
  });

  async function loadData() {
    const [site, data] = await Promise.all([readJSON("data/site.json", DEFAULT_SITE), readJSON("data/photos.json", { photos: [] })]);
    S.site = { ...DEFAULT_SITE, ...site };
    S.photos = data.photos || [];
    S.origSite = JSON.stringify(S.site);
    S.origPhotos = clone(S.photos);
    S.staged.forEach(f => URL.revokeObjectURL(f.url));
    S.staged.clear();
    S.deletes.clear();
  }

  /* ================= tabs ================= */
  $("#tabs").addEventListener("click", e => {
    const b = e.target.closest("button");
    if (!b) return;
    $$("#tabs button").forEach(x => x.classList.toggle("active", x === b));
    $$(".tab").forEach(p => (p.hidden = p.dataset.panel !== b.dataset.tab));
  });

  /* ================= render ================= */
  function renderAll() {
    renderGrid();
    renderProfile();
    renderSettings();
    updateBar();
  }

  function renderGrid() {
    const g = $("#grid");
    $("#photoTotal").textContent = S.photos.length;
    $("#gridEmpty").hidden = S.photos.length > 0;
    g.innerHTML = S.photos
      .map((p, i) => `
      <div class="card" draggable="true" data-id="${esc(p.id)}">
        <div class="thumb" data-act="edit">
          ${imgTag(p.thumb || p.src, p.title)}
          ${S.staged.has(p.src) ? '<span class="badge">Yeni</span>' : ""}
          <button class="star${p.featured ? " on" : ""}" data-act="star" title="Kapakta göster">★</button>
        </div>
        <div class="meta">
          <span class="handle" title="Sürükleyerek sırala">⋮⋮</span>
          <div><b>${esc(p.title || "Başlıksız")}</b><small>${esc([[p.place, p.country].filter(Boolean).join(", "), p.category].filter(Boolean).join(" · ") || "Konum / kategori yok")}</small></div>
          <span class="arrows">
            <button data-act="up" title="Öne al" ${i === 0 ? "disabled" : ""}>←</button>
            <button data-act="down" title="Arkaya al" ${i === S.photos.length - 1 ? "disabled" : ""}>→</button>
          </span>
        </div>
      </div>`)
      .join("");
    const cats = [...new Set(S.photos.map(p => p.category).filter(Boolean))];
    $("#catList").innerHTML = cats.map(c => `<option value="${esc(c)}">`).join("");
    const countries = [...new Set(S.photos.map(p => p.country).filter(Boolean))];
    $("#countryList").innerHTML = countries.map(c => `<option value="${esc(c)}">`).join("");
  }

  function renderProfile() {
    const f = $("#profileForm");
    Object.keys(DEFAULT_SITE).forEach(k => { if (f.elements[k]) f.elements[k].value = S.site[k] || ""; });
    $("#portraitPrev").innerHTML = S.site.portrait ? imgTag(S.site.portrait, "Portre") : "<span>Portre yok</span>";
    $("#portraitRemove").hidden = !S.site.portrait;
  }

  function renderSettings() {
    const f = $("#settingsForm");
    ["owner", "repo", "branch"].forEach(k => (f.elements[k].value = cfg[k]));
  }

  /* ================= change tracking ================= */
  function dirtyCount() {
    let n = 0;
    const orig = new Map(S.origPhotos.map(p => [p.id, JSON.stringify(p)]));
    const cur = new Set();
    S.photos.forEach(p => {
      cur.add(p.id);
      if (!orig.has(p.id) || orig.get(p.id) !== JSON.stringify(p)) n++;
    });
    orig.forEach((_, id) => { if (!cur.has(id)) n++; });
    const a = S.origPhotos.map(p => p.id).filter(id => cur.has(id)).join();
    const b = S.photos.map(p => p.id).filter(id => orig.has(id)).join();
    if (a !== b) n++;
    if (JSON.stringify(S.site) !== S.origSite) n++;
    return n;
  }
  function updateBar() {
    const n = dirtyCount();
    $("#publishBar").hidden = n === 0;
    $("#changeCount").textContent = n;
  }
  addEventListener("beforeunload", e => {
    if (dirtyCount()) { e.preventDefault(); e.returnValue = ""; }
  });

  function removePath(path) {
    if (!path) return;
    if (S.staged.has(path)) {
      URL.revokeObjectURL(S.staged.get(path).url);
      S.staged.delete(path);
    } else {
      S.deletes.add(path);
    }
  }

  /* ================= image processing ================= */
  // Decode with an <img> element: lighter on iPhone memory than a full-size bitmap,
  // and it honours EXIF orientation.
  function decode(file) {
    return new Promise((res, rej) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      const done = ok => { URL.revokeObjectURL(url); ok ? res(img) : rej(new Error("decode")); };
      img.onload = () => done(true);
      img.onerror = () => done(false);
      img.src = url;
    });
  }
  async function resize(src, max, q) {
    const sw = src.naturalWidth || src.width, sh = src.naturalHeight || src.height;
    const s = Math.min(1, max / Math.max(sw, sh));
    const w = Math.round(sw * s), h = Math.round(sh * s);
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(src, 0, 0, w, h);
    const blob = await new Promise(r => c.toBlob(r, "image/jpeg", q));
    return { blob, w, h, canvas: c };
  }
  const freeCanvas = c => { if (c) { c.width = 0; c.height = 0; } };
  const tick = () => new Promise(r => setTimeout(r, 30));
  const toB64 = blob => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1]);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const niceTitle = name => name.replace(/\.[^.]+$/, "").replace(/^(IMG|DSC|DSCF|PXL|P)[_-]?\d+.*$/i, "").replace(/[_-]+/g, " ").trim();

  /* ---------- photo metadata (EXIF) ---------- */
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
    } catch {}
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
      if (i0[0x8769]) {
        const ex = ifd(t + u32(i0[0x8769] + 8));
        const d = ex[0x9003] || ex[0x9004];
        if (d) res.taken = toDate(d);
      }
      if (!res.taken && i0[0x0132]) res.taken = toDate(i0[0x0132]);
      if (i0[0x8825]) {
        const g = ifd(t + u32(i0[0x8825] + 8));
        if (g[2] && g[4]) {
          const dms = a => a[0] + a[1] / 60 + a[2] / 3600;
          let lat = dms(rats(g[2])), lon = dms(rats(g[4]));
          if (g[1] && ascii(g[1]) === "S") lat = -lat;
          if (g[3] && ascii(g[3]) === "W") lon = -lon;
          if (isFinite(lat) && isFinite(lon) && (lat || lon)) res.gps = [lat, lon];
        }
      }
    } catch {}
    return res;
  }
  // Only the city / country names are saved, never the exact coordinates.
  const geoCache = new Map();
  let regionNames = null;
  try { regionNames = new Intl.DisplayNames(["tr"], { type: "region" }); } catch {}
  async function placeOf([lat, lon]) {
    const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
    if (!geoCache.has(key)) {
      geoCache.set(key, (async () => {
        try {
          const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=tr`);
          const j = await r.json();
          let country = j.countryName || "";
          if (j.countryCode && regionNames) { try { country = regionNames.of(j.countryCode) || country; } catch {} }
          let place = j.city || j.locality || j.principalSubdivision || "";
          if (place === country) place = "";
          return { place, country };
        } catch {
          return { place: "", country: "" };
        }
      })());
    }
    return geoCache.get(key);
  }

  function stage(path, blob) {
    S.staged.set(path, { blob, url: URL.createObjectURL(blob) });
  }

  async function addFiles(files) {
    files = [...files].filter(f => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
    if (!files.length) return;
    let ok = 0, noGps = 0;
    $("#drop").scrollIntoView({ behavior: "smooth", block: "start" });
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      progress(i / files.length, `Fotoğraflar hazırlanıyor… ${i + 1} / ${files.length}`);
      await tick();
      try {
        const meta = await readExif(f);
        const geo = meta.gps ? await placeOf(meta.gps) : { place: "", country: "" };
        if (!meta.gps) noGps++;
        let img = await decode(f);
        const main = await resize(img, MAIN_MAX, MAIN_Q);
        img.src = "";
        img = null;
        const thumb = await resize(main.canvas, THUMB_MAX, THUMB_Q);
        freeCanvas(main.canvas);
        freeCanvas(thumb.canvas);
        const id = uid();
        const p = { id, src: `photos/${id}.jpg`, thumb: `photos/thumbs/${id}.jpg`, w: main.w, h: main.h, title: niceTitle(f.name), caption: "", category: "", place: geo.place, country: geo.country, taken: meta.taken || "", featured: false, date: new Date().toISOString().slice(0, 10) };
        stage(p.src, main.blob);
        stage(p.thumb, thumb.blob);
        S.photos.unshift(p);
        ok++;
        renderGrid();
        updateBar();
      } catch {
        toast(`“${f.name}” açılamadı. iPhone HEIC ise: Ayarlar → Kamera → Formatlar → “En Uyumlu”.`, "err");
      }
    }
    progress(null);
    renderGrid();
    updateBar();
    if (ok) toast(`${ok} fotoğraf eklendi. Kalıcı olması için “Yayınla”ya bas.`, "ok");
    if (noGps) toast(`${noGps} fotoğrafta konum bilgisi bulunamadı. Fotoğrafa dokunup konumu elle yazabilirsin.`);
  }

  /* ================= dropzone ================= */
  const drop = $("#drop");
  $("#fileInput").addEventListener("change", e => { addFiles(e.target.files); e.target.value = ""; });
  ["dragenter", "dragover"].forEach(ev => drop.addEventListener(ev, e => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); drop.classList.add("over"); } }));
  ["dragleave", "drop"].forEach(ev => drop.addEventListener(ev, () => drop.classList.remove("over")));
  drop.addEventListener("drop", e => { e.preventDefault(); e.stopPropagation(); addFiles(e.dataTransfer.files); });
  addEventListener("dragover", e => { if (e.dataTransfer.types.includes("Files")) e.preventDefault(); });
  addEventListener("drop", e => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); addFiles(e.dataTransfer.files); } });

  /* ================= grid actions ================= */
  const find = id => S.photos.findIndex(p => p.id === id);
  $("#grid").addEventListener("click", e => {
    const a = e.target.closest("[data-act]");
    if (!a) return;
    const card = a.closest(".card");
    const i = find(card.dataset.id);
    const p = S.photos[i];
    switch (a.dataset.act) {
      case "star": e.stopPropagation(); p.featured = !p.featured; break;
      case "up": if (i > 0) [S.photos[i - 1], S.photos[i]] = [S.photos[i], S.photos[i - 1]]; break;
      case "down": if (i < S.photos.length - 1) [S.photos[i + 1], S.photos[i]] = [S.photos[i], S.photos[i + 1]]; break;
      case "edit": return openEdit(p);
    }
    renderGrid();
    updateBar();
  });

  let dragId = null;
  const grid = $("#grid");
  grid.addEventListener("dragstart", e => {
    const c = e.target.closest(".card");
    if (!c) return;
    dragId = c.dataset.id;
    c.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", dragId);
  });
  grid.addEventListener("dragover", e => {
    if (!dragId) return;
    e.preventDefault();
    $$(".drop-before", grid).forEach(x => x.classList.remove("drop-before"));
    const c = e.target.closest(".card");
    if (c && c.dataset.id !== dragId) c.classList.add("drop-before");
  });
  grid.addEventListener("drop", e => {
    if (!dragId) return;
    e.preventDefault();
    e.stopPropagation();
    const c = e.target.closest(".card");
    if (c && c.dataset.id !== dragId) {
      const [item] = S.photos.splice(find(dragId), 1);
      S.photos.splice(find(c.dataset.id), 0, item);
    }
    dragId = null;
    renderGrid();
    updateBar();
  });
  grid.addEventListener("dragend", () => {
    dragId = null;
    $$(".dragging, .drop-before", grid).forEach(x => x.classList.remove("dragging", "drop-before"));
  });

  /* ================= edit modal ================= */
  const modal = $("#editModal");
  let editing = null;
  function openEdit(p) {
    editing = p;
    const f = $("#editForm");
    $("#editImg").src = imgURL(p.src);
    $("#editImg").dataset.path = p.src;
    delete $("#editImg").dataset.fb;
    $("#editImg").onerror = function () { __aeImgErr(this); };
    f.elements.title.value = p.title || "";
    f.elements.category.value = p.category || "";
    f.elements.caption.value = p.caption || "";
    f.elements.place.value = p.place || "";
    f.elements.country.value = p.country || "";
    f.elements.taken.value = p.taken || "";
    f.elements.featured.checked = !!p.featured;
    modal.showModal();
  }
  modal.addEventListener("close", () => {
    const f = $("#editForm");
    const p = editing;
    if (!p) return;
    if (modal.returnValue === "save") {
      p.title = f.elements.title.value.trim();
      p.category = f.elements.category.value.trim();
      p.caption = f.elements.caption.value.trim();
      p.place = f.elements.place.value.trim();
      p.country = f.elements.country.value.trim();
      p.taken = f.elements.taken.value;
      p.featured = f.elements.featured.checked;
    } else if (modal.returnValue === "delete") {
      if (confirm("Bu fotoğraf silinsin mi?")) {
        removePath(p.src);
        removePath(p.thumb);
        S.photos.splice(find(p.id), 1);
      }
    }
    editing = null;
    modal.returnValue = "";
    renderGrid();
    updateBar();
  });
  modal.addEventListener("click", e => { if (e.target === modal) modal.close("cancel"); });

  /* ================= profile ================= */
  $("#profileForm").addEventListener("input", e => {
    const el = e.target;
    if (el.name in DEFAULT_SITE) {
      S.site[el.name] = el.value;
      updateBar();
    }
  });
  $("#profileForm").addEventListener("submit", e => e.preventDefault());
  $("#portraitInput").addEventListener("change", async e => {
    const f = e.target.files[0];
    e.target.value = "";
    if (!f) return;
    try {
      const bmp = await decode(f);
      const { blob } = await resize(bmp, PORTRAIT_MAX, MAIN_Q);
      removePath(S.site.portrait);
      const path = `images/portrait-${uid()}.jpg`;
      await stage(path, blob);
      S.site.portrait = path;
      renderProfile();
      updateBar();
    } catch {
      toast("Bu görsel açılamadı.", "err");
    }
  });
  $("#portraitRemove").addEventListener("click", () => {
    removePath(S.site.portrait);
    S.site.portrait = "";
    renderProfile();
    updateBar();
  });

  /* ================= settings ================= */
  $("#settingsForm").addEventListener("submit", e => {
    e.preventDefault();
    const f = e.target.elements;
    cfg = { owner: f.owner.value.trim(), repo: f.repo.value.trim(), branch: f.branch.value.trim() };
    store.set("ae_cfg", JSON.stringify(cfg));
    location.reload();
  });

  /* ================= publish / discard ================= */
  $("#discardBtn").addEventListener("click", async () => {
    if (!confirm("Tüm yayınlanmamış değişiklikler geri alınsın mı?")) return;
    $("#boot").hidden = false;
    try { await loadData(); renderAll(); } catch (e) { toast(`Yüklenemedi: ${e.message}`, "err"); }
    $("#boot").hidden = true;
  });

  $("#publishBtn").addEventListener("click", async () => {
    if (S.busy) return;
    S.busy = true;
    const btn = $("#publishBtn");
    btn.disabled = true;
    btn.textContent = "Yayınlanıyor…";
    $$("#tabs button")[0].click();
    try {
      const origIds = new Set(S.origPhotos.map(p => p.id));
      const curIds = new Set(S.photos.map(p => p.id));
      const added = S.photos.filter(p => !origIds.has(p.id)).length;
      const removed = S.origPhotos.filter(p => !curIds.has(p.id)).length;
      const bits = [];
      if (added) bits.push(`${added} fotoğraf eklendi`);
      if (removed) bits.push(`${removed} fotoğraf silindi`);
      if (JSON.stringify(S.site) !== S.origSite) bits.push("profil güncellendi");
      const msg = `Site: ${bits.join(", ") || "düzenlemeler"}`;

      const files = [...S.staged].map(([path, f]) => ({ path, blob: f.blob }));
      files.push({ path: "data/photos.json", text: JSON.stringify({ photos: S.photos }, null, 2) + "\n" });
      files.push({ path: "data/site.json", text: JSON.stringify(S.site, null, 2) + "\n" });
      await commit(msg, files, [...S.deletes]);

      S.staged.forEach((f, path) => S.preview.set(path, f.url));
      S.staged.clear();
      S.deletes.clear();
      S.origPhotos = clone(S.photos);
      S.origSite = JSON.stringify(S.site);
      renderGrid();
      updateBar();
      toast("Yayınlandı! Fotoğraflar 1–2 dakika içinde sitede görünür. Görmezsen sayfayı yenile.", "ok");
    } catch (e) {
      if (e.status === 403 || e.status === 404) toast("Yazma izni yok. Anahtarında “Contents: Read and write” izni açık olmalı.", "err");
      else toast(`Yayınlanamadı: ${e.message}`, "err");
    } finally {
      progress(null);
      S.busy = false;
      btn.disabled = false;
      btn.textContent = "Yayınla";
    }
  });

  boot();
})();
