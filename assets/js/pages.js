/* Arda Ekinci — Anılar, Koleksiyonlar, koleksiyon detayı, Hakkımda */
(function () {
  "use strict";
  const AE = window.AE;
  const { $, $$, esc, reduced, hasGsap } = AE;
  const ss = {
    get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }
  };
  const countryHash = p => (p.cc || p.country) ? `#/ulke/${encodeURIComponent(p.cc ? p.cc.toLowerCase() : AE.slug(p.country))}` : "";
  AE.countryHash = countryHash;
  const albumTitle = p => { const a = p.album && AE.data.albums.find(x => x.key === p.album); return a ? a.title : ""; };

  /* ---------- ortak kartlar ---------- */
  AE.tileHTML = p => {
    const href = `#/ani/${encodeURIComponent(p.id)}`;
    if (p.type === "note") {
      return `<a class="tile note" href="${href}" data-cur="Oku">${p.mood ? `<span class="mood">${esc(p.mood)}</span>` : ""}<p>${esc(p.text)}</p></a>`;
    }
    const ph = p.photos[0];
    const ic = (p.pinned ? AE.icon.pinned : "") + (p.photos.length > 1 ? AE.icon.multi : "");
    const where = p.place || p.country || p.title;
    return `<a class="tile" href="${href}" data-cur="Aç"${ph.c ? ` style="background:${esc(ph.c)}"` : ""}>${AE.pic(ph, "(max-width: 640px) 34vw, (max-width: 1100px) 30vw, 360px", { alt: AE.placeLine(p) || p.title })}` +
      `${ic ? `<span class="ic">${ic}</span>` : ""}<span class="ov">${where ? `<b>${esc(where)}</b>` : ""}<small>${esc(AE.fmtDate(p.date, true))}</small></span></a>`;
  };

  AE.postHTML = p => {
    const where = AE.placeLine(p);
    const ch = countryHash(p);
    const head = `<header class="post-head">${AE.avatarHTML()}<div><b>${esc(AE.data.site.name)}</b>${where ? (ch ? `<a class="pl" href="${ch}">${esc(where)}</a>` : `<span class="pl">${esc(where)}</span>`) : ""}</div><time>${esc(AE.fmtDate(p.date, true))}</time></header>`;
    let media;
    if (p.type === "note") media = AE.noteCardHTML(p, "div");
    else {
      const r = AE.clamp(AE.ratio(p.photos[0]), 0.8, 1.6).toFixed(3);
      media = `<div class="car" style="aspect-ratio:${r}"><div class="car-track">${p.photos.map((ph, i) =>
        `<figure><a href="#/ani/${encodeURIComponent(p.id)}/${i}" data-cur="Aç" style="display:block;height:100%">${AE.pic(ph, "(max-width: 640px) 100vw, 620px", { alt: where })}</a></figure>`).join("")}</div></div>`;
    }
    const cap = p.type === "note" ? "" : (p.title || p.caption) ? `<p class="post-cap">${p.title ? `<b>${esc(p.title)}</b>` : ""}${esc(p.caption)}</p>` : "";
    return `<article class="post" data-id="${esc(p.id)}">${head}${media}
      <div class="post-actions">${AE.likeBtnHTML(p.id)}<button type="button" data-share="#/ani/${encodeURIComponent(p.id)}" data-title="${esc(p.title || where || "Bir anı")}">${AE.icon.share}Paylaş</button>
      <a href="#/ani/${encodeURIComponent(p.id)}">${AE.icon.link}Aç</a>${p.photos.length > 1 ? `<span class="count">${p.photos.length} fotoğraf</span>` : ""}</div>${cap}</article>`;
  };

  function timelineHTML(list) {
    const years = new Map();
    list.forEach(p => {
      const y = (p.date || "").slice(0, 4) || "Tarihsiz";
      const m = +(p.date || "").slice(5, 7) || 0;
      if (!years.has(y)) years.set(y, new Map());
      const ms = years.get(y);
      if (!ms.has(m)) ms.set(m, []);
      ms.get(m).push(p);
    });
    if (years.has("Tarihsiz")) { const t = years.get("Tarihsiz"); years.delete("Tarihsiz"); years.set("Tarihsiz", t); }
    return `<div class="tl">${[...years].map(([y, ms]) => {
      const n = [...ms.values()].reduce((s, a) => s + a.length, 0);
      return `<section class="tl-year"><h3 class="tl-y${/^\d{4}$/.test(y) ? "" : " txt"}">${esc(y)}<small>${n} anı</small></h3><div>${[...ms].map(([m, ps]) =>
        `<div class="tl-month"><h4>${m ? AE.MONTHS[m - 1] : "Tarihsiz"}</h4><div class="tl-grid">${ps.map(AE.tileHTML).join("")}</div></div>`).join("")}</div></section>`;
    }).join("")}</div>`;
  }

  // ortak: paylaş butonları ve FLIP için tıklanan görsel
  AE.bindCommon = (root, scope) => {
    scope.on(root, "click", e => {
      const b = e.target.closest && e.target.closest("[data-share]");
      if (b) { e.preventDefault(); AE.share(b.dataset.share, b.dataset.title); }
    });
    scope.on(root, "pointerdown", e => {
      const t = e.target.closest && e.target.closest(".tile, .jt, .lcard, .post .car a, .vw-more a");
      const img = t && $("img", t);
      AE.flipFrom = img ? { img, t: Date.now() } : null;
    }, { passive: true });
  };

  /* ================= ANILAR ================= */
  AE.views.anilar = {
    title: () => "<em>Anılar</em>",
    render(args, scope) {
      const D = AE.data, s = D.site;
      const hl = D.highlights[0];
      const root = AE.el(`<div>
        <section class="mem">
          <header class="profile">
            <a class="profile-av" href="${hl ? `#/hikaye/${hl.kind}/${encodeURIComponent(hl.key)}` : "#/hakkimda"}" data-cur="${hl ? "İzle" : "Aç"}" aria-label="Hikâyeleri izle">
              <span class="story-ring"><span>${s.avatar || s.portrait ? AE.img(s.avatar || s.portrait, { alt: s.name }) : esc(AE.initials(s.name))}</span></span></a>
            <div class="profile-info">
              <h1>${esc(s.name)}</h1>${s.handle ? `<p class="handle">@${esc(s.handle)}</p>` : ""}
              <div class="profile-stats"><span><b>${D.posts.length}</b>anı</span><span><b>${D.photos.length}</b>fotoğraf</span>${D.countries.length ? `<span><b>${D.countries.length}</b>ülke</span>` : ""}${D.years.length ? `<span><b>${D.years.length}</b>yıl</span>` : ""}</div>
              <p class="bio">${esc(s.bio.replace(/\*/g, ""))}</p>${s.location ? `<p class="loc">${esc(s.location)}</p>` : ""}
            </div>
          </header>
          ${D.highlights.length ? `<div class="stories">${D.highlights.map(AE.storyItemHTML).join("")}</div>` : ""}
          <div class="mem-bar">
            <div class="seg" role="tablist" aria-label="Görünüm">
              <button type="button" data-mode="grid" aria-label="Izgara">${AE.icon.grid}<span>Izgara</span></button>
              <button type="button" data-mode="feed" aria-label="Akış">${AE.icon.feed}<span>Akış</span></button>
              <button type="button" data-mode="time" aria-label="Zaman tüneli">${AE.icon.clock}<span>Zaman</span></button>
            </div>
            ${D.notes.length ? `<div class="chips"><button type="button" class="chip on" data-type="all">Tümü</button><button type="button" class="chip" data-type="photo">Fotoğraf</button><button type="button" class="chip" data-type="note">Not</button></div>` : ""}
            <label class="search">${AE.icon.search}<input type="search" placeholder="Şehir, ülke, not ara…" aria-label="Anılarda ara" autocomplete="off"></label>
          </div>
          <div class="mem-body"></div>
          <div class="mem-sentinel" style="height:2px"></div>
        </section>
        ${AE.footerHTML()}
      </div>`);
      return { el: root, setup: () => setupMem(root, scope) };
    }
  };

  function setupMem(root, scope) {
    const D = AE.data;
    const st = { mode: ["grid", "feed", "time"].includes(ss.get("ae_mode")) ? ss.get("ae_mode") : "grid", type: "all", q: "" };
    const body = $(".mem-body", root), sentinel = $(".mem-sentinel", root), bar = $(".mem-bar", root);
    let list = [], shown = 0;
    AE.bindCommon(root, scope);
    AE.footParallax(root, scope);

    const filtered = () => {
      const q = AE.norm(st.q);
      let l = D.posts.filter(p => (st.type === "all" || p.type === st.type) &&
        (!q || AE.norm([p.title, p.caption, p.text, p.place, p.country, albumTitle(p), p.date].join(" ")).includes(q)));
      if (st.mode !== "time") l = l.slice().sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
      return l;
    };
    const setButtons = () => {
      $$(".seg button", root).forEach(b => b.classList.toggle("on", b.dataset.mode === st.mode));
      $$(".chips .chip", root).forEach(b => b.classList.toggle("on", b.dataset.type === st.type));
    };
    function more() {
      if (st.mode === "time" || shown >= list.length) return false;
      const chunk = st.mode === "grid" ? 30 : 6;
      const slice = list.slice(shown, shown + chunk);
      shown += slice.length;
      const box = body.firstElementChild;
      const tpl = document.createElement("template");
      tpl.innerHTML = slice.map(st.mode === "grid" ? AE.tileHTML : AE.postHTML).join("");
      const nodes = Array.from(tpl.content.children);
      box.appendChild(tpl.content);
      nodes.forEach(n => {
        scope.reveal(n);
        const car = $(".car", n);
        if (car) AE.carousel(car);
        if (n.classList.contains("post")) {
          const id = n.dataset.id, media = car || $(".note-card", n);
          if (media) scope.add(AE.dbltap(media, e => AE.like(id, e.clientX, e.clientY), e => {
            if (e.target.closest("button")) return;
            const a = e.target.closest("a[href]");
            AE.go(a ? a.getAttribute("href") : `#/ani/${encodeURIComponent(id)}`);
          }));
          AE.paintLikes(n);
        }
      });
      return true;
    }
    const fill = () => {
      let guard = 0;
      while (guard++ < 20 && shown < list.length && sentinel.getBoundingClientRect().top < window.innerHeight + 900) {
        if (!more()) break;
      }
    };
    function reset() {
      list = filtered();
      shown = 0;
      AE.navList = list.map(p => p.id);
      setButtons();
      if (!list.length) {
        body.innerHTML = `<div class="mem-empty"><b>${st.q ? "Sonuç yok" : "Henüz anı yok"}</b>${st.q ? `“${esc(st.q)}” için bir şey bulamadım.` : "İlk fotoğraflar yolda."}</div>`;
        return;
      }
      if (st.mode === "time") {
        body.innerHTML = timelineHTML(list);
        scope.reveal(body);
        return;
      }
      body.innerHTML = `<div class="${st.mode === "grid" ? "grid" : "feed"}"></div>`;
      more();
      requestAnimationFrame(fill);
    }
    const toBar = () => {
      const y = bar.getBoundingClientRect().top + window.scrollY - (document.body.classList.contains("bar-up") ? 0 : parseInt(getComputedStyle(document.documentElement).getPropertyValue("--top-h"), 10) || 70);
      if (window.scrollY > y) window.scrollTo(0, y);
    };
    $$(".seg button", root).forEach(b => scope.on(b, "click", () => {
      if (st.mode === b.dataset.mode) return;
      st.mode = b.dataset.mode; ss.set("ae_mode", st.mode);
      reset(); toBar();
    }));
    $$(".chips .chip", root).forEach(b => scope.on(b, "click", () => {
      if (st.type === b.dataset.type) return;
      st.type = b.dataset.type; reset(); toBar();
    }));
    const input = $(".search input", root);
    let qt = 0;
    scope.on(input, "input", () => { clearTimeout(qt); qt = setTimeout(() => { st.q = input.value.trim(); reset(); }, 220); });
    scope.add(() => clearTimeout(qt));
    if ("IntersectionObserver" in window) {
      scope.io(ents => { if (ents.some(e => e.isIntersecting)) { more(); requestAnimationFrame(fill); } }, { rootMargin: "900px 0px" }).observe(sentinel);
    } else scope.on(window, "scroll", fill, { passive: true });
    reset();
  }

  /* ================= KOLEKSİYONLAR ================= */
  AE.collCardHTML = c => {
    const ph = c.photos.map(x => x.ph);
    const front = c.coverPhoto || ph[0];
    const others = ph.filter(x => x !== front);
    const st = (x, cls) => x ? AE.img(x.sm || x.thumb, { cls, alt: "" }) : `<span class="st ${cls}"></span>`;
    return `<a class="ccard rv" href="${c.hash}" data-cur="Aç">
      <div class="ccard-stack">${st(others[1], "s3")}${st(others[0], "s2")}${st(front, "s1")}</div>
      <div class="ccard-meta"><h3>${c.flag ? c.flag + " " : ""}${esc(c.title)}</h3><p>${c.photos.length} fotoğraf${c.first ? " · " + esc(AE.fmtRange(c.first, c.last)) : ""}</p></div></a>`;
  };

  AE.views.koleksiyonlar = {
    title: () => "Koleksiyon<em>lar</em>",
    render(args, scope) {
      const D = AE.data;
      const sec = (title, list, sub) => list.length ? `<section class="coll-sec"><h2>${title}<small>${list.length} ${sub}</small></h2><div class="coll-grid">${list.map(AE.collCardHTML).join("")}</div></section>` : "";
      const empty = !D.albums.length && !D.countries.length && !D.years.length;
      const root = AE.el(`<div>
        <header class="page-head"><p class="eyebrow">Koleksiyonlar</p><h1 data-split>Albümler, <em>ülkeler</em>, yıllar.</h1>
        <p class="sub rv">Her şey kendi rafında. Bir koleksiyon seç, ister galeri olarak gez ister hikâye gibi izle.</p></header>
        ${sec("Albümler", D.albums, "albüm")}
        ${sec("Ülkeler", D.countries, "ülke")}
        ${sec("Yıllar", D.years, "yıl")}
        ${empty ? `<div class="empty-hero"><b>Henüz koleksiyon yok.</b>Fotoğraflar eklendikçe burası kendiliğinden dolacak.</div>` : ""}
        ${AE.footerHTML()}
      </div>`);
      return { el: root, setup: () => { $$("[data-split]", root).forEach(h => AE.split(h)); AE.footParallax(root, scope); } };
    }
  };

  /* ================= KOLEKSİYON DETAYI ================= */
  ["album", "ulke", "yil"].forEach(kind => {
    AE.views[kind] = {
      title: args => { const c = AE.coll(kind, args[0]); return c ? `${esc(c.title)}` : "Bulunamadı"; },
      render(args, scope) {
        const c = AE.coll(kind, args[0]);
        if (!c) return AE.views["404"].render([], scope);
        const photos = c.photos.slice().reverse();
        const cover = c.coverPhoto;
        const order = AE.collOrder();
        const idx = order.indexOf(c);
        const next = order.length > 1 ? order[(idx + 1) % order.length] : null;
        const meta = [`${c.photos.length} fotoğraf`, AE.fmtRange(c.first, c.last), c.places.slice(0, 4).join(", ")].filter(Boolean).join(" · ");
        const root = AE.el(`<div>
          <header class="cdet-hero">
            <div class="cdet-bg">${cover ? `<img src="${esc(cover.thumb)}" ${AE.srcset(cover)} sizes="100vw" alt="" fetchpriority="high" class="f">` : ""}</div>
            <div class="cdet-title">
              <p class="eyebrow">${c.label}</p>
              <h1 data-split>${c.flag ? `<span class="fl">${c.flag}</span> ` : ""}${esc(c.title)}</h1>
              <p class="meta rv">${esc(meta)}</p>
              <div class="cdet-actions rv">
                <a class="btn solid" href="#/hikaye/${kind}/${encodeURIComponent(c.key)}">${AE.icon.play} Hikâye olarak izle</a>
                <button type="button" class="btn" data-share="${c.hash}" data-title="${esc(c.title)}">${AE.icon.share} Paylaş</button>
              </div>
            </div>
          </header>
          ${c.desc ? `<p class="cdet-desc rv">${esc(c.desc)}</p>` : ""}
          ${c.places.length > 1 ? `<div class="cdet-places rv"><button type="button" class="chip on" data-place="">Tümü</button>${c.places.map(pl => `<button type="button" class="chip" data-place="${esc(pl)}">${esc(pl)}</button>`).join("")}</div>` : ""}
          <div class="jgrid">${photos.map(x => `<a class="jt" href="#/ani/${encodeURIComponent(x.post.id)}/${x.i}" style="--ar:${AE.ratio(x.ph).toFixed(3)}" data-place="${esc(x.post.place)}" data-cur="Aç"><i></i>${AE.pic(x.ph, "(max-width: 640px) 50vw, 30vw", { alt: AE.placeLine(x.post) })}<figcaption>${esc([x.post.place, AE.fmtDate(x.post.date, true)].filter(Boolean).join(" · "))}</figcaption></a>`).join("")}</div>
          ${next && next !== c ? `<a class="cdet-next" href="${next.hash}" data-cur="Sıradaki">${next.coverPhoto ? AE.img(next.coverPhoto.thumb, { alt: "" }) : ""}<div><span>Sıradaki ${next.label.toLocaleLowerCase("tr")}</span><h3>${next.flag ? next.flag + " " : ""}${esc(next.title)}</h3></div></a>` : ""}
          ${AE.footerHTML()}
        </div>`);
        return {
          el: root,
          setup: () => {
            const ids = [];
            photos.forEach(x => { if (!ids.includes(x.post.id)) ids.push(x.post.id); });
            AE.navList = ids;
            $$("[data-split]", root).forEach(h => AE.split(h));
            AE.bindCommon(root, scope);
            AE.footParallax(root, scope);
            $$(".cdet-places .chip", root).forEach(b => scope.on(b, "click", () => {
              $$(".cdet-places .chip", root).forEach(x => x.classList.toggle("on", x === b));
              $$(".jt", root).forEach(t => { t.style.display = !b.dataset.place || t.dataset.place === b.dataset.place ? "" : "none"; });
            }));
            if (hasGsap() && !reduced()) {
              scope.anim(() => {
                const bg = $(".cdet-bg img", root);
                if (bg) gsap.fromTo(bg, { yPercent: 0, scale: 1.08 }, { yPercent: -12, scale: 1, ease: "none", scrollTrigger: { trigger: $(".cdet-hero", root), start: "top top", end: "bottom top", scrub: true } });
                const nx = $(".cdet-next img", root);
                if (nx) gsap.fromTo(nx, { yPercent: -10 }, { yPercent: 10, ease: "none", scrollTrigger: { trigger: nx.parentNode, start: "top bottom", end: "bottom top", scrub: true } });
              });
            }
          }
        };
      }
    };
  });

  /* ================= HAKKIMDA ================= */
  const LEVEL = { "ana dil": 100, "anadil": 100, "akıcı": 92, "ileri": 85, "iyi": 72, "orta": 58, "başlangıç": 30, "temel": 30 };
  const levelPct = l => { const n = parseInt(l, 10); if (n > 0 && n <= 100) return n; return LEVEL[String(l || "").toLocaleLowerCase("tr").trim()] || 60; };
  const when = e => { const a = String(e.start || "").trim(), b = String(e.end || "").trim(); return a || b ? `${a || "?"} — ${b || "Halen"}` : ""; };
  const cvList = items => `<ul class="cvl">${items.map(e => `<li><span class="when">${esc(when(e))}</span><h3>${esc(e.title || "")}</h3>${e.org || e.place ? `<div class="org">${esc(e.org || "")}${e.place ? ` <span>· ${esc(e.place)}</span>` : ""}</div>` : ""}${e.desc ? `<p>${esc(e.desc)}</p>` : ""}</li>`).join("")}</ul>`;
  const block = (label, inner) => `<section class="ab-body"><div class="ab-label"><p class="eyebrow">${label}</p></div><div>${inner}</div></section>`;

  AE.views.hakkimda = {
    title: () => "Hak<em>kımda</em>",
    render(args, scope) {
      const D = AE.data, s = D.site, cv = s.cv;
      const pic = s.portrait || s.avatar || ((D.photos.find(x => x.post.featured) || D.photos[0] || {}).ph || {}).src || "";
      let paras = String(s.about || "").split(/\n\s*\n/).map(t => t.trim()).filter(Boolean);
      if (!paras.length) paras = [s.bio.replace(/\*/g, "")];
      const facts = s.facts.slice();
      if (s.location && !facts.some(f => /yaşa|konum|şehir/i.test(f.k || ""))) facts.unshift({ k: "Yaşadığım yer", v: s.location });
      if (D.countries.length) facts.push({ k: "Gezdiğim ülkeler", v: String(D.countries.length) });
      if (D.posts.length) facts.push({ k: "Bu sitedeki anılar", v: String(D.posts.length) });
      const parts = [
        block("Hikâyem", `<div class="ab-text">${paras.map((p, i) => `<p class="${i ? "" : "lead"} rv">${esc(p).replace(/\n/g, "<br>")}</p>`).join("")}</div>`),
        s.now ? block("Şu sıralar", `<div class="now rv"><p class="eyebrow plain"><i class="live-dot"></i>Şimdi</p><p>${esc(s.now)}</p></div>`) : "",
        facts.length ? block("Kısaca", `<dl class="facts-grid rv">${facts.map(f => `<div><dt>${esc(f.k)}</dt><dd>${esc(f.v)}</dd></div>`).join("")}</dl>`) : "",
        cv.experience.length ? block("Deneyim", cvList(cv.experience)) : "",
        cv.education.length ? block("Eğitim", cvList(cv.education)) : "",
        cv.skills.length ? block("Yetenekler", `<div class="skills">${cv.skills.map((k, i) => `<span class="skill" style="--i:${i}">${esc(k)}</span>`).join("")}</div>`) : "",
        cv.languages.length ? block("Diller", `<div class="langs">${cv.languages.filter(l => l.name).map(l => `<div class="lang"><b>${esc(l.name)}</b><span>${esc(l.level || "")}</span><i style="--v:${levelPct(l.level)}%"></i></div>`).join("")}</div>`) : "",
        cv.projects.length ? block("Projeler", `<div class="projects">${cv.projects.filter(p => p.title).map(p => {
          const u = AE.safeURL(p.url);
          const tag = u ? "a" : "div";
          return `<${tag} class="proj rv" ${u ? `href="${esc(u)}" target="_blank" rel="noopener" data-cur="Git"` : ""}>${p.image ? `<div class="proj-img">${AE.img(p.image, { alt: p.title })}</div>` : ""}<div class="proj-b"><h3>${esc(p.title)}${p.year ? `<small>${esc(p.year)}</small>` : ""}</h3>${p.desc ? `<p>${esc(p.desc)}</p>` : ""}${u ? `<span class="go">Projeye git ↗</span>` : ""}</div></${tag}>`;
        }).join("")}</div>`) : "",
        cv.pdf ? block("Özgeçmiş", `<a class="btn solid rv" href="${esc(cv.pdf)}" target="_blank" rel="noopener" download>${AE.icon.download} CV'yi indir (PDF)</a>`) : ""
      ].join("");
      const root = AE.el(`<div>
        <header class="ab-hero">
          <h1 data-split>Merhaba,<br>ben <em>${esc(AE.firstName(s.name))}</em>.</h1>
          <div class="ab-portrait rv-mask">${pic ? AE.img(pic, { alt: s.name }) : `<div class="mono-ph">${esc(AE.initials(s.name))}</div>`}</div>
        </header>
        ${parts}
        <div style="height:clamp(40px,6vw,90px)"></div>
        ${AE.contactHTML(D)}
        ${AE.footerHTML()}
      </div>`);
      return {
        el: root,
        setup: () => {
          $$("[data-split]", root).forEach(h => AE.split(h));
          AE.magnets(root, scope);
          AE.footParallax(root, scope);
          if (hasGsap() && !reduced()) {
            scope.anim(() => {
              const img = $(".ab-portrait img", root);
              if (img) gsap.fromTo(img, { yPercent: -6 }, { yPercent: 6, ease: "none", scrollTrigger: { trigger: img.parentNode, start: "top bottom", end: "bottom top", scrub: true } });
            });
          }
        }
      };
    }
  };
})();
