/* Arda Ekinci — kabuk: açılış, menü, imleç, yönlendirme, sayfa geçişleri */
(function () {
  "use strict";
  const AE = window.AE;
  const { $, $$, esc, sleep, reduced, finePointer, hasGsap } = AE;

  if (hasGsap()) {
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.config({ ignoreMobileResize: true });
  } else {
    document.documentElement.classList.add("no-gsap");
  }
  try { history.scrollRestoration = "manual"; } catch (e) {}

  const viewEl = $("#view");
  const topEl = $("#top");
  const OVER = { ani: 1, hikaye: 1 };
  let base = null;       // { key, name, args, scope }
  let overlay = null;    // { name, args }
  let routing = false, again = false, closing = false;
  let navIntent = "";
  const scrollMem = new Map();

  /* ================= yönlendirme ================= */
  function parse(hash) {
    let raw = String(hash == null ? location.hash : hash).replace(/^#\/?/, "").split("?")[0];
    const parts = raw.split("/").filter(Boolean).map(p => { try { return decodeURIComponent(p); } catch (e) { return p; } });
    return { name: parts[0] || "", args: parts.slice(1), key: parts.map(p => encodeURIComponent(p)).join("/") };
  }
  AE.parse = parse;

  function baseFor(r) {
    if (r.name === "hikaye" && r.args.length >= 2 && AE.coll(r.args[0], r.args[1])) return parse(`#/${r.args[0]}/${encodeURIComponent(r.args[1])}`);
    if (r.name === "hikaye") return parse("#/");
    return parse("#/anilar");
  }

  async function route() {
    if (routing) { again = true; return; }
    routing = true;
    try {
      do { again = false; await handle(parse()); } while (again);
    } catch (e) { console.error(e); }
    routing = false;
  }

  async function handle(r) {
    closing = false;
    if (menuOpen) setMenu(false);
    const intended = navIntent && parse(navIntent).key === r.key;
    navIntent = "";
    if (OVER[r.name]) {
      if (!base) await renderBase(baseFor(r), { initial: true, push: true });
      if (intended && !overlay) { try { history.replaceState({ aeBack: 1 }, ""); } catch (e) {} }
      openOverlay(r);
      return;
    }
    if (overlay) closeOverlayUI();
    if (base && base.key === r.key) return;
    await renderBase(r, { initial: !base, push: intended });
  }

  function openOverlay(r) {
    const prev = overlay;
    overlay = r;
    try {
      if (r.name === "ani") {
        if (prev && prev.name === "hikaye") AE.stories.hide(true);
        AE.viewer.open(r.args[0], parseInt(r.args[1] || "0", 10) || 0);
      } else {
        if (prev && prev.name === "ani") AE.viewer.hide(true);
        AE.stories.open(r.args[0], r.args[1]);
      }
    } catch (e) {
      console.error(e);
      overlay = null;
      AE.toast("Bu içerik açılamadı");
    }
  }
  function closeOverlayUI() {
    if (!overlay) return;
    try { if (overlay.name === "ani") AE.viewer.hide(); else AE.stories.hide(); } catch (e) { console.error(e); }
    overlay = null;
  }
  AE.closeOverlay = () => {
    if (!overlay || closing) return;
    closing = true;
    if (history.state && history.state.aeBack) {
      history.back();
      setTimeout(() => { if (closing && overlay) { closing = false; closeOverlayUI(); } }, 700);
    } else {
      try { history.replaceState(null, "", `#/${base ? base.key : ""}`); } catch (e) {}
      closeOverlayUI();
      closing = false;
    }
  };
  AE.replaceHash = h => {
    try { history.replaceState(history.state, "", h); } catch (e) { location.replace(h); return; }
    route();
  };
  AE.setHashSilently = h => { try { history.replaceState(history.state, "", h); } catch (e) {} };
  AE.overlayOpen = () => !!overlay;

  /* ================= sayfa çizimi ================= */
  const strip = html => String(html || "").replace(/<[^>]+>/g, "");
  async function renderBase(r, o = {}) {
    let name = AE.views[r.name] ? r.name : "404";
    if (r.name === "404") name = "404";
    const restoreY = o.push || o.initial ? 0 : (scrollMem.get(r.key) || 0);
    if (base) scrollMem.set(base.key, window.scrollY);
    const animate = !o.initial && !reduced() && hasGsap();
    let view = AE.views[name];
    if (animate) await curtainIn(view.title ? view.title(r.args) : "");
    if (base) { try { base.scope.destroy(); } catch (e) { console.error(e); } }
    viewEl.innerHTML = "";
    window.scrollTo(0, 0);
    AE.navList = null;
    const scope = AE.scope(viewEl);
    let out;
    try { out = view.render(r.args, scope); }
    catch (e) { console.error(e); name = "404"; view = AE.views["404"]; out = view.render([], scope); }
    viewEl.appendChild(out.el);
    base = { key: r.key, name, args: r.args, scope };
    AE.current = base;
    $$("[data-nav]").forEach(a => a.classList.toggle("on", a.dataset.nav === name || (a.dataset.nav === "koleksiyonlar" && ["album", "ulke", "yil"].includes(name))));
    const t = strip(view.title ? view.title(r.args) : "");
    document.title = name === "" ? AE.data.site.name : `${t} — ${AE.data.site.name}`;
    try { out.setup && out.setup(scope); } catch (e) { console.error(e); }
    scope.reveal(viewEl);
    updateClocks();
    if (hasGsap()) { try { ScrollTrigger.refresh(); } catch (e) {} }
    if (restoreY) requestAnimationFrame(() => window.scrollTo(0, restoreY));
    topEl.classList.remove("away");
    document.body.classList.remove("bar-up");
    if (animate) await curtainOut();
  }

  /* ================= perde geçişi ================= */
  const curtain = $("#curtain"), ctitle = $("#curtainTitle");
  const tween = (target, vars) => new Promise(res => {
    const done = () => res();
    gsap.to(target, Object.assign({}, vars, { onComplete: done, onInterrupt: done }));
    setTimeout(done, ((vars.duration || 0) + (vars.delay || 0)) * 1000 + 500);
  });
  async function curtainIn(title) {
    ctitle.innerHTML = title || "";
    gsap.set(curtain, { yPercent: 101 });
    gsap.fromTo(ctitle, { yPercent: 70, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.8, delay: 0.22, ease: "power3.out" });
    await tween(curtain, { yPercent: 0, duration: 0.7, ease: "power4.inOut" });
  }
  async function curtainOut() {
    gsap.to(ctitle, { yPercent: -50, opacity: 0, duration: 0.45, ease: "power2.in" });
    await tween(curtain, { yPercent: -101, duration: 0.85, ease: "power4.inOut", delay: 0.18 });
    gsap.set(curtain, { yPercent: 101 });
  }

  /* ================= üst çubuk ================= */
  let lastY = 0, menuOpen = false;
  function onScroll() {
    const y = window.scrollY;
    topEl.classList.toggle("solid", y > 30);
    if (menuOpen || y <= 140 || y < lastY - 4) topEl.classList.remove("away");
    else if (y > lastY + 4) topEl.classList.add("away");
    document.body.classList.toggle("bar-up", topEl.classList.contains("away"));
    lastY = y;
  }

  /* ================= menü ================= */
  function buildMenu() {
    const D = AE.data, s = D.site;
    const hero = (D.photos.find(x => x.post.featured) || D.photos[0] || {}).ph;
    const latest = (D.photos[0] || {}).ph;
    const coll = (D.highlights[0] || {}).coverPhoto;
    const portrait = s.portrait || s.avatar || ((D.photos[1] || D.photos[0] || {}).ph || {}).src || "";
    const items = [
      ["#/", "Ana sayfa", "", hero && hero.thumb],
      ["#/anilar", "Anılar", D.posts.length || "", latest && latest.thumb],
      ["#/koleksiyonlar", "Koleksiyonlar", (D.albums.length + D.countries.length + D.years.length) || "", coll && coll.thumb],
      ["#/hakkimda", "Hakkımda", "", portrait]
    ];
    $("#menuLinks").innerHTML = items.map(([h, t, n, img], i) =>
      `<a href="${h}" data-img="${esc(img || "")}"><span class="n">0${i + 1}</span><span class="mk"><span>${t}</span></span>${n ? `<sup>${n}</sup>` : ""}</a>`).join("");
    const soc = AE.socials(s);
    $("#menuFoot").innerHTML =
      `<div>${s.email ? `<a href="mailto:${esc(s.email)}">${esc(s.email)}</a>` : esc(s.name)}</div>` +
      (soc.length ? `<div class="socials">${soc.map(x => `<a href="${esc(x.url)}" target="_blank" rel="noopener">${x.label}</a>`).join("")}</div>` : "") +
      `<div><i class="live-dot"></i>${esc(s.location || "Türkiye")} · <span data-clock>${AE.clock()}</span></div>`;
    $$("[data-sitename]").forEach(n => { n.textContent = s.name; });
  }
  function setMenu(open) {
    if (open === menuOpen) return;
    menuOpen = open;
    const m = $("#menu");
    m.classList.toggle("open", open);
    m.setAttribute("aria-hidden", String(!open));
    document.body.classList.toggle("menu-open", open);
    $("#menuBtn").setAttribute("aria-expanded", String(open));
    AE.lock(open);
    if (open) topEl.classList.remove("away");
    if (!open) $("#menuPreview").classList.remove("on");
  }
  AE.setMenu = setMenu;
  function menuPreview() {
    const pv = $("#menuPreview"), m = $("#menu");
    m.addEventListener("pointermove", e => {
      if (e.pointerType !== "mouse") return;
      pv.style.left = `${e.clientX + 150}px`;
      pv.style.top = `${e.clientY}px`;
    });
    m.addEventListener("pointerover", e => {
      const a = e.target.closest && e.target.closest(".menu-links a");
      if (!a || !a.dataset.img || !finePointer()) { pv.classList.remove("on"); return; }
      if (pv.dataset.src !== a.dataset.img) { pv.dataset.src = a.dataset.img; pv.innerHTML = `<img src="${esc(a.dataset.img)}" alt="">`; }
      pv.classList.add("on");
    });
    m.addEventListener("pointerleave", () => pv.classList.remove("on"));
  }

  /* ================= imleç ================= */
  function initCursor() {
    if (!finePointer() || reduced()) return;
    const ring = $(".cur-ring"), label = $("span", ring);
    if (!ring) return;
    let x = -100, y = -100, rx = -100, ry = -100, on = false;
    addEventListener("pointermove", e => {
      if (e.pointerType !== "mouse") return;
      x = e.clientX; y = e.clientY;
      if (!on) { on = true; rx = x; ry = y; document.documentElement.classList.add("has-cursor"); }
    }, { passive: true });
    document.documentElement.addEventListener("mouseleave", () => document.documentElement.classList.add("cur-hide"));
    document.documentElement.addEventListener("mouseenter", () => document.documentElement.classList.remove("cur-hide"));
    const loop = () => {
      rx += (x - rx) * 0.18; ry += (y - ry) * 0.18;
      ring.style.transform = `translate3d(${rx.toFixed(1)}px, ${ry.toFixed(1)}px, 0)`;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    document.addEventListener("pointerover", e => {
      const t = e.target && e.target.closest ? e.target.closest("[data-cur], a, button, .globe canvas") : null;
      const lab = t && t.dataset && t.dataset.cur ? t.dataset.cur : "";
      ring.classList.toggle("label", !!lab);
      ring.classList.toggle("hover", !!t && !lab);
      label.textContent = lab;
    });
  }

  /* ================= saatler ================= */
  function updateClocks() { const c = AE.clock(); $$("[data-clock]").forEach(n => { n.textContent = c; }); }

  /* ================= açılış animasyonu ================= */
  function introCounter(intro) {
    const num = $(".intro-count span", intro), bar = $(".intro-bar", intro);
    const o = { v: 0 };
    return new Promise(res => {
      gsap.to(o, {
        v: 100, duration: 2.0, ease: "power2.inOut",
        onUpdate: () => { num.textContent = Math.round(o.v); bar.style.transform = `scaleX(${o.v / 100})`; },
        onComplete: res
      });
      setTimeout(res, 2800);
    });
  }

  async function runIntro(intro, D, counterDone) {
    try { sessionStorage.setItem("ae_intro", "1"); } catch (e) {}
    let skip = false;
    const onSkip = () => { skip = true; };
    intro.addEventListener("pointerdown", onSkip);
    addEventListener("keydown", onSkip);
    const frame = $(".intro-frame", intro);
    const lines = $$(".intro-name .line", intro);
    const parts = D.site.name.split(/\s+/);
    const last = parts.length > 1 ? parts.pop() : "";
    const first = parts.join(" ");
    lines[0].innerHTML = AE.chars(first);
    $("em", lines[1]).innerHTML = AE.chars(last, first.length);
    const chars = $$(".intro-name .ch", intro);
    gsap.set(chars, { yPercent: 115 });
    gsap.to(chars, { yPercent: 0, duration: 1.1, stagger: 0.045, ease: "expo.out" });
    gsap.to(frame, { clipPath: "inset(0% 0% 0% 0%)", duration: 1.1, ease: "expo.inOut", delay: 0.15 });

    // fotoğraf montajı
    const urls = [];
    D.photos.filter(x => x.post.featured).concat(D.photos).forEach(x => { if (urls.length < 10 && !urls.includes(x.ph.thumb)) urls.push(x.ph.thumb); });
    let k = 0;
    const montage = setInterval(() => {
      const imgs = $$("img.mt.ok", frame);
      if (!imgs.length) return;
      k = (k + 1) % imgs.length;
      imgs.forEach((im, i) => im.classList.toggle("on", i === k));
    }, 150);
    urls.forEach(u => frame.insertAdjacentHTML("beforeend", `<img class="mt" src="${esc(u)}" alt="">`));

    const heroImg = AE.heroFirstImg;
    const heroReady = new Promise(res => {
      if (!heroImg || (heroImg.complete && heroImg.naturalWidth)) return res();
      heroImg.addEventListener("load", () => res(), { once: true });
      heroImg.addEventListener("error", () => res(), { once: true });
      setTimeout(res, 4500);
    });
    const waitSkip = new Promise(res => { const t = setInterval(() => { if (skip) { clearInterval(t); res(); } }, 60); setTimeout(() => { clearInterval(t); res(); }, 6000); });
    await Promise.race([Promise.all([counterDone, heroReady, sleep(1500)]), waitSkip]);
    clearInterval(montage);
    const ts = skip ? 1.8 : 1;

    // son kare: kapak fotoğrafı
    const heroSrc = heroImg && heroImg.naturalWidth ? (heroImg.currentSrc || heroImg.src) : "";
    if (heroSrc) {
      frame.insertAdjacentHTML("beforeend", `<img class="mt on" src="${esc(heroSrc)}" alt="" style="z-index:3">`);
      $$("img.mt", frame).forEach(im => { if (im.src.indexOf(heroSrc) === -1) im.classList.remove("on"); });
      $(".intro-mono", frame) && ($(".intro-mono", frame).style.opacity = "0");
    }

    const hf = $(".hero-frame");
    const target = hf ? hf.getBoundingClientRect() : { left: 0, top: 0, width: innerWidth, height: innerHeight };
    const cs = hf ? getComputedStyle(hf) : null;
    const radius = cs ? `${cs.borderTopLeftRadius} ${cs.borderTopRightRadius} ${cs.borderBottomRightRadius} ${cs.borderBottomLeftRadius}` : "0px 0px 0px 0px";
    const fr = frame.getBoundingClientRect();
    frame.style.transform = "none";
    frame.style.aspectRatio = "auto";
    gsap.set(frame, { left: fr.left, top: fr.top, width: fr.width, height: fr.height, borderRadius: "999px 999px 24px 24px" });

    const tl = gsap.timeline({ defaults: { ease: "expo.inOut" } });
    tl.timeScale(ts);
    tl.to(chars, { yPercent: -115, duration: 0.8, stagger: 0.02, ease: "power3.in" }, 0)
      .to($$(".intro-count, .intro-label, .intro-skip, .intro-bar", intro), { opacity: 0, duration: 0.5, ease: "power2.out" }, 0)
      .to(frame, { left: target.left, top: target.top, width: target.width, height: target.height, borderRadius: radius, duration: 1.1 }, 0.2)
      .to(intro, { backgroundColor: "rgba(11,10,9,0)", duration: 0.7, ease: "power2.out" }, 0.6);
    await Promise.race([tl.then ? tl.then() : sleep(2000), sleep(2600)]);
    AE.introPending = false;
    if (AE.heroGo) AE.heroGo();
    gsap.from(topEl, { yPercent: -100, opacity: 0, duration: 0.9, ease: "expo.out", clearProps: "transform,opacity" });
    await Promise.race([new Promise(res => gsap.to(frame, { opacity: 0, duration: 0.4, delay: 0.15, onComplete: res })), sleep(1000)]);
    removeEventListener("keydown", onSkip);
  }

  /* ================= başlangıç ================= */
  async function start() {
    const intro = $("#intro");
    let play = !!intro && !document.documentElement.classList.contains("no-intro") && hasGsap();
    AE.introPending = play;
    const counter = play ? introCounter(intro) : null;

    let D;
    try { D = await AE.loadData(); } catch (e) { console.error(e); D = AE.build({}, null, null); }
    AE.applyAccent(D.site.theme.accent);
    if (play && !D.site.theme.intro) { play = false; AE.introPending = false; }

    buildMenu();
    menuPreview();
    initCursor();
    $("#menuBtn").addEventListener("click", () => setMenu(!menuOpen));
    addEventListener("keydown", e => { if (e.key === "Escape" && menuOpen) setMenu(false); });
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("hashchange", route);
    setInterval(updateClocks, 20000);

    document.addEventListener("click", e => {
      const a = e.target && e.target.closest ? e.target.closest("a") : null;
      if (!a) return;
      const href = a.getAttribute("href") || "";
      if (href === "#top" || a.hasAttribute("data-top")) {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: reduced() ? "auto" : "smooth" });
        return;
      }
      if (!href.startsWith("#/") && href !== "#") return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      if (menuOpen) setMenu(false);
      const t = parse(href), c = parse();
      if (t.key === c.key) {
        e.preventDefault();
        if (!OVER[t.name]) window.scrollTo({ top: 0, behavior: reduced() ? "auto" : "smooth" });
        return;
      }
      navIntent = href;
    }, true);

    if (!location.hash || location.hash === "#") { try { history.replaceState(null, "", "#/"); } catch (e) {} }
    await route();

    if (play) {
      try { await runIntro(intro, D, counter); }
      catch (e) { console.error(e); }
    }
    if (intro && intro.parentNode) intro.remove();
    AE.introPending = false;
    if (AE.heroGo) AE.heroGo();
    if (hasGsap()) {
      try { await document.fonts.ready; } catch (e) {}
      try { ScrollTrigger.refresh(); } catch (e) {}
    }
  }

  /* ================= 404 ================= */
  AE.views["404"] = {
    title: () => "Bulunamadı",
    render() {
      return { el: AE.el(`<section class="nf"><div><p class="eyebrow plain">Hata 404</p><h1>Kayıp <em style="font-style:italic;color:var(--accent)">kare</em></h1><p>Aradığın sayfa burada değil. Belki başka bir anıdadır.</p><a class="btn solid" href="#/">Ana sayfaya dön <span class="arr">→</span></a></div></section>`) };
    }
  };

  const boot = () => start().catch(e => {
    console.error(e);
    const i = $("#intro");
    if (i) i.remove();
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
