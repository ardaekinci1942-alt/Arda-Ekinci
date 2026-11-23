/* Arda Ekinci — public site */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s = "") => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const ICONS = {
    instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>',
    twitter: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.3-8.3L2 3h6.4l4.4 5.8L17.8 3Zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5Z"/></svg>',
    youtube: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12a31 31 0 0 0 .5 4.8 3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8ZM9.7 15.1V8.9l5.8 3.1-5.8 3.1Z"/></svg>',
    linkedin: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.5h4V21H3V9.5Zm6.5 0h3.8v1.6h.1c.5-1 1.8-2 3.8-2 4 0 4.8 2.6 4.8 6V21h-4v-5.1c0-1.2 0-2.8-1.7-2.8s-2 1.3-2 2.7V21h-4V9.5Z"/></svg>'
  };

  const SOCIAL_URL = {
    instagram: v => /^https?:/.test(v) ? v : `https://instagram.com/${v.replace(/^@/, "")}`,
    twitter: v => /^https?:/.test(v) ? v : `https://x.com/${v.replace(/^@/, "")}`,
    youtube: v => /^https?:/.test(v) ? v : `https://youtube.com/@${v.replace(/^@/, "")}`,
    linkedin: v => /^https?:/.test(v) ? v : `https://linkedin.com/in/${v}`
  };
  const SOCIAL_LABEL = { instagram: "Instagram", twitter: "X", youtube: "YouTube", linkedin: "LinkedIn" };

  let photos = [];
  let visible = [];
  let current = 0;

  const getJSON = url => fetch(url, { cache: "no-cache" }).then(r => (r.ok ? r.json() : null)).catch(() => null);

  async function init() {
    $("#year").textContent = new Date().getFullYear();
    const [site, data] = await Promise.all([getJSON("data/site.json"), getJSON("data/photos.json")]);
    photos = (data && data.photos) || [];
    renderSite(site || {});
    renderHero();
    renderFilters();
    renderGallery();
    observe();
    navScroll();
  }

  /* ---------- profile ---------- */
  function renderSite(s) {
    const name = (s.name || "Arda Ekinci").trim();
    document.title = name;
    $$("[data-name]").forEach(el => (el.textContent = name));
    const parts = name.split(/\s+/);
    const last = parts.length > 1 ? parts.pop() : "";
    $("[data-name-split]").innerHTML = last ? `${esc(parts.join(" "))} <em>${esc(last)}</em>` : esc(name);
    $("[data-initials]").textContent = name.split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();
    $("[data-tagline]").textContent = s.tagline || "";
    $$("[data-location]").forEach(el => (el.textContent = s.location || "—"));

    const paras = (s.about || "").split(/\n\s*\n/).filter(Boolean);
    $("#about").innerHTML = paras.map(p => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("");

    if (s.portrait) {
      $("#portrait").innerHTML = `<img src="${esc(s.portrait)}" alt="${esc(name)}" loading="lazy">`;
    }

    if (s.email) {
      const m = $("#mailLink");
      m.href = `mailto:${s.email}`;
      m.textContent = s.email;
      m.hidden = false;
    }
    $("#socials").innerHTML = Object.keys(SOCIAL_URL)
      .filter(k => s[k])
      .map(k => `<a href="${esc(SOCIAL_URL[k](s[k].trim()))}" target="_blank" rel="noopener">${ICONS[k]}${SOCIAL_LABEL[k]}</a>`)
      .join("");
    $("#photoCount").textContent = photos.length;
  }

  /* ---------- hero slideshow ---------- */
  function renderHero() {
    let picks = photos.filter(p => p.featured);
    if (!picks.length) picks = photos.filter(p => p.w >= p.h).slice(0, 5);
    if (!picks.length) picks = photos.slice(0, 5);
    if (!picks.length) return;
    const box = $("#heroSlides");
    box.innerHTML = picks.map((p, i) => `<img src="${esc(p.src)}" alt="" ${i ? 'loading="lazy"' : 'fetchpriority="high"'}>`).join("");
    const imgs = $$("img", box);
    let i = 0;
    const show = () => {
      imgs.forEach((im, k) => im.classList.toggle("on", k === i));
    };
    imgs[0].complete ? requestAnimationFrame(show) : imgs[0].addEventListener("load", show, { once: true });
    if (imgs.length > 1) setInterval(() => { i = (i + 1) % imgs.length; show(); }, 6500);
  }

  /* ---------- filters ---------- */
  function renderFilters() {
    const cats = [...new Set(photos.map(p => (p.category || "").trim()).filter(Boolean))];
    if (cats.length < 2) return;
    const box = $("#filters");
    box.innerHTML = ["Tümü", ...cats]
      .map((c, i) => `<button class="chip${i ? "" : " active"}" data-cat="${i ? esc(c) : ""}">${esc(c)}</button>`)
      .join("");
    box.addEventListener("click", e => {
      const b = e.target.closest(".chip");
      if (!b) return;
      $$(".chip", box).forEach(x => x.classList.toggle("active", x === b));
      const cat = b.dataset.cat;
      $$(".tile").forEach(t => t.classList.toggle("hide", !!cat && t.dataset.cat !== cat));
    });
  }

  /* ---------- gallery ---------- */
  function renderGallery() {
    const g = $("#gallery");
    if (!photos.length) {
      $("#emptyState").hidden = false;
      return;
    }
    g.innerHTML = photos
      .map((p, i) => {
        const r = p.w && p.h ? (p.w / p.h).toFixed(4) : 1.5;
        return `<figure class="tile" style="--r:${r}" data-i="${i}" data-cat="${esc((p.category || "").trim())}">
          <i></i>
          <img src="${esc(p.thumb || p.src)}" alt="${esc(p.title || "")}" loading="lazy" decoding="async">
          ${p.title || p.category ? `<figcaption>${p.category ? `<small>${esc(p.category)}</small>` : ""}${esc(p.title || "")}</figcaption>` : ""}
        </figure>`;
      })
      .join("");
    g.addEventListener("click", e => {
      const t = e.target.closest(".tile");
      if (t) openLB(+t.dataset.i);
    });
  }

  /* ---------- lightbox ---------- */
  const lb = $("#lightbox");
  const lbImg = $("#lbImg");

  function openLB(i) {
    visible = $$(".tile:not(.hide)").map(t => +t.dataset.i);
    current = Math.max(0, visible.indexOf(i));
    lb.hidden = false;
    document.body.style.overflow = "hidden";
    showLB();
  }
  function closeLB() {
    lb.hidden = true;
    document.body.style.overflow = "";
  }
  function step(d) {
    current = (current + d + visible.length) % visible.length;
    showLB();
  }
  function showLB() {
    const p = photos[visible[current]];
    lbImg.classList.add("loading");
    lbImg.onload = () => lbImg.classList.remove("loading");
    lbImg.src = p.src;
    lbImg.alt = p.title || "";
    $("#lbTitle").textContent = p.title || "";
    $("#lbCaption").textContent = p.caption || "";
    $("#lbCount").textContent = `${current + 1} / ${visible.length}`;
    [1, -1].forEach(d => {
      const n = photos[visible[(current + d + visible.length) % visible.length]];
      if (n) new Image().src = n.src;
    });
  }
  lb.addEventListener("click", e => {
    const a = e.target.closest("[data-lb]");
    if (a) return a.dataset.lb === "close" ? closeLB() : step(a.dataset.lb === "next" ? 1 : -1);
    if (e.target === lb) closeLB();
  });
  document.addEventListener("keydown", e => {
    if (lb.hidden) return;
    if (e.key === "Escape") closeLB();
    if (e.key === "ArrowRight") step(1);
    if (e.key === "ArrowLeft") step(-1);
  });
  let tx = null;
  lb.addEventListener("touchstart", e => (tx = e.touches[0].clientX), { passive: true });
  lb.addEventListener("touchend", e => {
    if (tx === null) return;
    const dx = e.changedTouches[0].clientX - tx;
    if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
    tx = null;
  });

  /* ---------- effects ---------- */
  function observe() {
    const io = new IntersectionObserver(
      ents => ents.forEach(en => {
        if (en.isIntersecting) {
          en.target.classList.add("in");
          io.unobserve(en.target);
        }
      }),
      { rootMargin: "0px 0px -8% 0px" }
    );
    $$(".reveal, .tile").forEach(el => io.observe(el));
  }
  function navScroll() {
    const nav = $("#nav");
    const f = () => nav.classList.toggle("solid", scrollY > 40);
    addEventListener("scroll", f, { passive: true });
    f();
  }

  init();
})();
