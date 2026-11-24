/* Arda Ekinci — ana sayfa */
(function () {
  "use strict";
  const AE = window.AE;
  const { $, $$, esc, reduced, finePointer, hasGsap, mq } = AE;


  function heroSet(D) {
    const list = D.photos.filter(x => x.post.featured && x.i === 0);
    D.photos.forEach(x => { if (list.length < 5 && x.i === 0 && !list.includes(x)) list.push(x); });
    return list.slice(0, 8);
  }

  function statementHTML(text) {
    const out = [];
    let acc = false;
    String(text).split(/(\*)/).forEach(part => {
      if (part === "*") { acc = !acc; return; }
      part.split(/\s+/).filter(Boolean).forEach(w => out.push(`<span class="sw${acc ? " acc" : ""}">${esc(w)}</span>`));
    });
    return out.join(" ");
  }

  const capHTML = x => {
    if (!x) return "";
    const p = x.post;
    const where = p.place ? `<b>${esc(p.place)}</b>${p.country ? ", " + esc(p.country) : ""}` : p.country ? `<b>${esc(p.country)}</b>` : "";
    const when = AE.fmtDate(p.date, true);
    return [where, when].filter(Boolean).join(" · ");
  };

  function heroHTML(D, set) {
    const s = D.site;
    const parts = s.name.split(/\s+/);
    const last = parts.length > 1 ? parts.pop() : "";
    const first = parts.join(" ");
    const years = D.years.map(y => +y.key);
    const since = years.length ? Math.min(...years) : 0;
    const kicker = since ? `Kişisel arşiv · ${since} — ${new Date().getFullYear()}` : "Kişisel arşiv";
    const words = s.words.map((w, i) => `<span class="${i ? "" : "on"}">${esc(w)}</span>`).join("");
    const firstHL = D.highlights[0];
    const frameImgs = set.map((x, i) => `<img src="${esc(x.ph.thumb)}" ${AE.srcset(x.ph)} sizes="(max-width: 899px) 100vw, 460px" alt="${esc(AE.placeLine(x.post))}" class="${i ? "" : "on"}" ${i ? 'loading="lazy"' : 'fetchpriority="high"'} decoding="async">`).join("");
    return `
    <section class="hero" id="hero">
      <canvas class="hero-gl" aria-hidden="true"></canvas>
      <div class="hero-text">
        <p class="eyebrow hero-kicker">${esc(kicker)}</p>
        <h1 class="hero-name" aria-label="${esc(s.name)}"><span class="line">${AE.chars(first)}</span>${last ? `<span class="line"><em>${AE.chars(last, first.length)}</em></span>` : ""}</h1>
        <p class="hero-sub">Hayatımdan <span class="rot">${words}</span>${s.tagline ? `<small>${esc(s.tagline)}</small>` : ""}</p>
        <div class="hero-cta">
          <a class="btn solid" href="#/anilar">Anılara dal <span class="arr">→</span></a>
          ${firstHL ? `<a class="btn" href="#/hikaye/${firstHL.kind}/${encodeURIComponent(firstHL.key)}">${AE.icon.play} Hikâyeleri izle</a>` : `<a class="btn" href="#/hakkimda">Ben kimim?</a>`}
          ${D.photos.length > 2 ? `<button type="button" class="icon-btn dice-btn" data-dice aria-label="Şansına bir anı" data-cur="Zar at" title="Şansına bir anı">🎲</button>` : ""}
        </div>
      </div>
      <div class="hero-frame-wrap">
        <div class="hero-frame">${frameImgs || `<div class="mono-ph">${esc(AE.initials(s.name))}</div>`}</div>
        ${set.length ? `<div class="hud" aria-hidden="true"><i class="c tl"></i><i class="c tr"></i><i class="c bl"></i><i class="c br"></i>
          <span class="hud-rec"><b></b>REC</span><span class="hud-geo">${esc(geoText(set[0]))}</span><span class="hud-n">01 / ${AE.pad2(set.length)}</span><span class="hud-scan"></span></div>` : ""}
        ${set.length ? `<div class="hero-frame-cap${capHTML(set[0]) ? "" : " empty"}">${AE.icon.pin.replace("<svg", '<svg style="width:12px;height:12px;vertical-align:-1px;margin-right:6px;color:var(--accent)"')}<span>${capHTML(set[0])}</span></div>` : ""}
      </div>
      <div class="hero-foot">
        <span><i class="live-dot"></i>${esc(s.location || "Türkiye")} · <span data-clock>${AE.clock()}</span><span data-weather></span></span>
        <span class="scroll">Kaydır <i></i></span>
        <span class="hide-m">${D.posts.length} anı${D.countries.length ? ` · ${D.countries.length} ülke` : ""}</span>
      </div>
    </section>`;
  }

  function marqueeHTML(D) {
    const s = D.site;
    const words = s.theme.marquee;
    const row1 = words.map((w, i) => `<span class="${i % 2 ? "o" : ""}">${esc(w)}</span><span class="s">✦</span>`).join("");
    const places = [];
    D.posts.forEach(p => { const n = p.place || p.country; if (n && !places.includes(n) && places.length < 14) places.push(n); });
    const list2 = places.length >= 3 ? places : s.words;
    const row2 = list2.map((w, i) => `<span class="${i % 2 ? "" : "o"}">${esc(w)}</span><span class="s">•</span>`).join("");
    return `
    <section class="marquee" aria-hidden="true">
      <div class="mq-row"><div class="mq-track">${row1}</div><div class="mq-track">${row1}</div></div>
      <div class="mq-row rev"><div class="mq-track">${row2}</div><div class="mq-track">${row2}</div></div>
    </section>`;
  }

  function latestHTML(D) {
    const list = D.posts.filter(p => p.type === "photo").slice()
      .sort((a, b) => (b.created || "").localeCompare(a.created || "") || (b.date || "").localeCompare(a.date || "")).slice(0, 12);
    if (list.length < 2) return "";
    const cards = list.map((p, i) => {
      const ph = p.photos[0];
      return `<a class="lcard" href="#/ani/${encodeURIComponent(p.id)}" data-cur="Aç">
        <div class="lcard-img">${AE.pic(ph, "(max-width: 899px) 74vw, 26vw", { alt: AE.placeLine(p) })}${p.photos.length > 1 ? `<span class="badge">${AE.icon.multi}${p.photos.length}</span>` : ""}</div>
        <div class="lcard-meta"><b>${esc(p.title || p.place || p.country || "Bir anı")}</b><span>${esc(AE.fmtDate(p.date, true))}</span></div>
        <div class="lcard-n">${AE.pad2(i + 1)} — ${esc(p.country || "")}</div>
      </a>`;
    }).join("");
    return `
    <section class="latest" data-n="${list.length}">
      <div class="latest-pin">
        <div class="latest-head">
          <div><p class="eyebrow">Son eklenenler</p><h2 class="h2" data-split>En yeni <em>anılar</em></h2></div>
          <span class="latest-count"><b>01</b> / ${AE.pad2(list.length)}</span>
        </div>
        <div class="latest-track">${cards}
          <a class="lcard more" href="#/anilar" data-cur="Tümü"><div class="lcard-img"><div><strong>${D.posts.length}</strong><small>anının tamamı →</small></div></div></a>
        </div>
        <div class="latest-progress"><span></span></div>
      </div>
    </section>`;
  }

  AE.storyItemHTML = c => `<a class="story" href="#/hikaye/${c.kind}/${encodeURIComponent(c.key)}" data-cur="İzle">
      <span class="story-ring"><span>${c.coverPhoto ? AE.img(c.coverPhoto.sm || c.coverPhoto.thumb, { alt: c.title }) : ""}</span></span>
      <span class="story-name">${c.flag ? c.flag + " " : ""}${esc(c.title)}</span>
      <span class="story-sub">${c.photos.length} kare</span></a>`;

  function storiesHTML(D) {
    if (!D.highlights.length) return "";
    return `
    <section class="stories-sec">
      <div class="section-head">
        <div><p class="eyebrow">Hikâyeler</p><h2 class="h2" data-split>Öne <em>çıkanlar</em></h2></div>
        <a class="btn" href="#/koleksiyonlar">Tüm koleksiyonlar <span class="arr">→</span></a>
      </div>
      <div class="stories rv">${D.highlights.map(AE.storyItemHTML).join("")}</div>
    </section>`;
  }

  function statsHTML(D) {
    if (!D.posts.length) return "";
    const yrs = D.years.map(y => +y.key);
    const items = [
      [D.posts.length, "anı"],
      [D.photos.length, "fotoğraf"],
      D.countries.length ? [D.countries.length, "ülke"] : null,
      D.cities ? [D.cities, "şehir"] : yrs.length ? [Math.max(...yrs) - Math.min(...yrs) + 1, "yıl"] : null
    ].filter(Boolean);
    return `
    <section class="section">
      <div class="section-head"><div><p class="eyebrow">Sayılarla</p><h2 class="h2" data-split>Şimdiye <em>kadar</em></h2></div></div>
      <div class="stats" style="--n:${items.length}">${items.map(([n, l], i) =>
        `<div class="stat rv" style="--d:${i * 90}ms"><b data-count="${n}"><span>0</span></b><span>${l}</span></div>`).join("")}</div>
    </section>`;
  }

  function worldHTML(D) {
    if (!D.countries.length) return "";
    const list = D.countries.slice(0, 10).map(c => `<li><a href="${c.hash}" data-key="${esc(c.key)}">
      <span class="fl">${c.flag || "•"}</span><span>${esc(c.title)}</span>${c.places.length ? `<small>${esc(c.places.slice(0, 3).join(", "))}</small>` : ""}<em>${c.photos.length}</em></a></li>`).join("");
    return `
    <section class="section world">
      <div class="world-text">
        <p class="eyebrow">Dünyadaki izlerim</p>
        <h2 class="h2" data-split>${D.countries.length} ülke${D.cities ? `, <em>${D.cities} şehir</em>` : ""}</h2>
        <ul class="world-list rv">${list}</ul>
      </div>
      <div class="globe" data-cur="Sürükle"><canvas aria-label="Gezdiğim yerleri gösteren dünya küresi" role="img"></canvas><div class="globe-tip"></div><span class="globe-hint">Sürükle · dokun</span></div>
    </section>`;
  }

  AE.noteCardHTML = (p, tag = "a") => `<${tag} class="note-card rv" ${tag === "a" ? `href="#/ani/${encodeURIComponent(p.id)}"` : ""}>
      ${p.mood ? `<span class="mood">${esc(p.mood)}</span>` : ""}<p>${esc(p.text)}</p><time>${esc(AE.fmtDate(p.date))}</time></${tag}>`;

  function notesHTML(D) {
    if (!D.notes.length) return "";
    return `
    <section class="section">
      <div class="section-head"><div><p class="eyebrow">Not defteri</p><h2 class="h2" data-split>Aklımdan <em>geçenler</em></h2></div>
      <a class="btn" href="#/anilar">Hepsi <span class="arr">→</span></a></div>
      <div class="notes-grid">${D.notes.slice(0, 6).map(p => AE.noteCardHTML(p)).join("")}</div>
    </section>`;
  }

  function teaserHTML(D) {
    const s = D.site;
    const pic = s.portrait || s.avatar || ((D.photos.find(x => x.post.featured) || D.photos[0] || {}).ph || {}).thumb || "";
    const facts = [
      s.location ? ["Yaşadığım yer", s.location] : null,
      D.countries.length ? ["Gezilen ülke", D.countries.length] : null,
      s.cv.languages.length ? ["Diller", s.cv.languages.map(l => l.name).filter(Boolean).slice(0, 3).join(", ")] : null
    ].filter(Boolean);
    const bio = s.bio.replace(/\*/g, "");
    return `
    <section class="section teaser">
      <div class="teaser-img rv-mask">${pic ? AE.img(pic, { alt: s.name }) : `<div class="mono-ph">${esc(AE.initials(s.name))}</div>`}</div>
      <div>
        <p class="eyebrow">Merhaba</p>
        <h2 class="h2" data-split>Ben <em>${esc(AE.firstName(s.name))}</em>.</h2>
        <p class="lead rv">${esc(bio)}</p>
        ${s.now ? `<p class="lead rv" style="margin-top:18px"><span class="mono" style="font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--accent)">Şu sıralar — </span>${esc(s.now)}</p>` : ""}
        ${facts.length ? `<dl class="facts-mini rv">${facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>` : ""}
        <a class="btn rv" href="#/hakkimda">Hakkımda${s.cv.experience.length || s.cv.education.length ? " & CV" : ""} <span class="arr">→</span></a>
      </div>
    </section>`;
  }

  AE.contactHTML = D => {
    const s = D.site;
    const soc = AE.socials(s);
    if (!s.email && !soc.length) return "";
    return `
    <section class="section contact">
      <p class="eyebrow plain">İletişim</p>
      <h2 data-split>Bir merhaba <em>yeter.</em></h2>
      <div class="contact-row rv">
        ${s.email ? `<a class="contact-mail" href="mailto:${esc(s.email)}">${esc(s.email)}</a><a class="magnet" href="mailto:${esc(s.email)}" data-cur="Yaz"><span>Yaz ✦</span></a>` : ""}
      </div>
      ${soc.length ? `<div class="socials-row rv">${soc.map(x => `<a class="soc" href="${esc(x.url)}" target="_blank" rel="noopener">${x.icon}${x.label}</a>`).join("")}</div>` : ""}
    </section>`;
  };

  AE.magnets = (root, scope) => {
    if (!finePointer() || reduced()) return;
    $$(".magnet", root).forEach(m => {
      const inner = m.firstElementChild;
      scope.on(m, "pointermove", e => {
        const r = m.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2;
        m.style.transform = `translate(${x * 0.3}px, ${y * 0.3}px)`;
        if (inner) inner.style.transform = `translate(${x * 0.12}px, ${y * 0.12}px)`;
      });
      scope.on(m, "pointerleave", () => { m.style.transform = ""; if (inner) inner.style.transform = ""; });
    });
  };

  AE.countUp = (root, scope) => {
    const nums = $$("[data-count]", root);
    if (!nums.length) return;
    const run = n => {
      const to = +n.dataset.count, span = n.firstElementChild || n;
      if (reduced()) { span.textContent = to; return; }
      const t0 = performance.now(), dur = 1700;
      const step = t => {
        const p = Math.min(1, (t - t0) / dur);
        span.textContent = Math.round(to * (1 - Math.pow(1 - p, 4)));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    if (!("IntersectionObserver" in window)) { nums.forEach(run); return; }
    const io = scope.io(ents => ents.forEach(en => { if (en.isIntersecting) { io.unobserve(en.target); run(en.target); } }), { threshold: 0.3 });
    nums.forEach(n => io.observe(n));
  };

  AE.footParallax = (root, scope) => {
    const big = $(".foot-big span", root);
    if (!big || !hasGsap() || reduced()) return;
    scope.anim(() => gsap.fromTo(big, { yPercent: 60 }, { yPercent: 12, ease: "none", scrollTrigger: { trigger: big.parentNode, start: "top bottom", end: "bottom bottom", scrub: true } }));
  };

  const geoText = x => {
    const g = x && x.post.geo;
    if (!g) return x && x.post.country ? [x.post.country.toLocaleUpperCase("tr"), AE.fmtDate(x.post.date, true)].filter(Boolean).join(" · ") : "";
    return `${Math.abs(g[0]).toFixed(2)}° ${g[0] >= 0 ? "K" : "G"} · ${Math.abs(g[1]).toFixed(2)}° ${g[1] >= 0 ? "D" : "B"}`;
  };
  const prand = i => { const v = Math.sin(i * 12.9898 + 4.1414) * 43758.5453; return v - Math.floor(v); };

  /* Bugün geçmişte */
  function otdHTML(D) {
    const now = new Date(), y = now.getFullYear();
    const md = `${AE.pad2(now.getMonth() + 1)}-${AE.pad2(now.getDate())}`;
    const full = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
    const dated = D.posts.filter(p => p.type === "photo" && full.test(p.date) && +p.date.slice(0, 4) < y);
    let hits = dated.filter(p => p.date.slice(5) === md), title;
    if (hits.length) {
      const n = y - +hits[0].date.slice(0, 4);
      title = `<em>${n} yıl önce</em> bugün`;
    } else {
      const doy = d => { const a = d.slice(5).split("-").map(Number); return a[0] * 31 + a[1]; };
      const today = (now.getMonth() + 1) * 31 + now.getDate();
      hits = dated.filter(p => Math.abs(doy(p.date) - today) <= 7);
      if (!hits.length) return "";
      title = `Geçmişte <em>bu hafta</em>`;
    }
    hits = hits.slice(0, 3);
    return `
    <section class="section otd">
      <div class="section-head"><div><p class="eyebrow">Bugün geçmişte</p><h2 class="h2" data-split>${title}</h2></div></div>
      <div class="otd-row">${hits.map(p => `<a class="otd-card rv" href="#/ani/${encodeURIComponent(p.id)}" data-cur="Aç">
        <div class="otd-img">${AE.pic(p.photos[0], "(max-width: 640px) 90vw, 30vw", { alt: AE.placeLine(p) })}</div>
        <div class="otd-meta"><b>${esc(p.place || p.country || p.title || "Bir anı")}</b><span>${esc(AE.fmtDate(p.date))} · ${y - +p.date.slice(0, 4)} yıl önce</span></div></a>`).join("")}</div>
    </section>`;
  }

  /* 3B zaman tüneli: geçmişten bugüne fotoğrafların arasından uçuş */
  function tunnelHTML(D) {
    let list = D.photos.filter(x => x.i === 0 && /^[0-9]{4}/.test(x.post.date)).slice().sort((a, b) => a.post.date.localeCompare(b.post.date));
    if (list.length < 5) return "";
    if (list.length > 18) { const k = list.length / 18; list = Array.from({ length: 18 }, (_, i) => list[Math.floor(i * k)]); }
    const GAP = 460;
    let z = 0, lastY = "";
    const items = [];
    list.forEach((x, i) => {
      const yr = x.post.date.slice(0, 4);
      if (yr !== lastY) {
        items.push(`<div class="tn-el tn-yr" data-z="${z}" data-year="${yr}" style="transform:translate3d(-50%,-50%,${z}px)">${yr}</div>`);
        z -= GAP * 0.75; lastY = yr;
      }
      const side = i % 2 ? 1 : -1;
      const xv = side * (13 + prand(i) * 11), yv = (prand(i + 9) - 0.5) * 26, rot = (prand(i + 3) - 0.5) * 9;
      items.push(`<a class="tn-el tn-ph" href="#/ani/${encodeURIComponent(x.post.id)}" data-z="${z}" data-year="${yr}" data-cur="Aç" style="--ar:${AE.ratio(x.ph).toFixed(3)};transform:translate3d(calc(${xv.toFixed(1)}vw - 50%),calc(${yv.toFixed(1)}vh - 50%),${z}px) rotate(${rot.toFixed(1)}deg)">
        ${AE.pic(x.ph, "(max-width: 640px) 46vw, 22vw", { alt: AE.placeLine(x.post) })}<span>${esc([x.post.place || x.post.country, AE.fmtDate(x.post.date, true)].filter(Boolean).join(" · "))}</span></a>`);
      z -= GAP;
    });
    items.push(`<div class="tn-el tn-end" data-z="${z}" style="transform:translate3d(-50%,-50%,${z}px)"><p>…ve <em>bugün.</em></p><a class="btn solid" href="#/anilar">Tüm anılar <span class="arr">→</span></a></div>`);
    return `
    <section class="tunnel">
      <div class="tn-stage">
        <div class="tn-floor" aria-hidden="true"></div>
        <div class="tn-scene">${items.join("")}</div>
        <div class="tn-hud"><p class="eyebrow">Zaman yolculuğu</p><b class="tn-year">${list[0].post.date.slice(0, 4)}</b><div class="tn-bar"><i></i></div><small>Kaydırdıkça geçmişten bugüne uç</small></div>
        <button type="button" class="tn-skip">Atla ↓</button>
      </div>
    </section>`;
  }

  /* Mola: oyun daveti */
  function playHTML(D) {
    return `
    <section class="section play">
      <div class="play-card rv">
        <div class="play-art" aria-hidden="true"><span class="pt pt1"></span><span class="pt pt2"></span><span class="pt pt3"></span>${AE.headHTML("play-face")}<span class="play-heart">♥</span></div>
        <div class="play-text">
          <p class="eyebrow">Mola</p>
          <h2 class="h2" data-split>Benimle bir tur <em>uç.</em></h2>
          <p class="lead">Anı kulelerinin arasından geç, kalpleri topla. Rekorun: <b data-best>0</b></p>
          <a class="btn solid" href="#/oyun" data-cur="Oyna">Oyna ${AE.icon.play}</a>
        </div>
      </div>
    </section>`;
  }

  AE.views[""] = {
    title: () => "Ana <em>sayfa</em>",
    render(args, scope) {
      const D = AE.data;
      const sec = D.site.theme.sections;
      const set = heroSet(D);
      const html = `<div class="home">
        ${heroHTML(D, set)}
        ${marqueeHTML(D)}
        <section class="statement"><p class="eyebrow">Bu site</p><p class="stm">${statementHTML(D.site.bio)}</p></section>
        ${sec.otd ? otdHTML(D) : ""}
        ${sec.latest ? latestHTML(D) : ""}
        ${sec.tunnel ? tunnelHTML(D) : ""}
        ${sec.stories ? storiesHTML(D) : ""}
        ${sec.stats ? statsHTML(D) : ""}
        ${sec.globe ? worldHTML(D) : ""}
        ${sec.notes ? notesHTML(D) : ""}
        ${sec.about ? teaserHTML(D) : ""}
        ${sec.play ? playHTML(D) : ""}
        ${sec.contact ? AE.contactHTML(D) : ""}
        ${D.posts.length ? "" : `<div class="empty-hero"><b>İlk anılar yolda.</b>Yakında burada fotoğraflar, yolculuklar ve hikâyeler olacak.</div>`}
        ${AE.footerHTML()}
      </div>`;
      const el = AE.el(html);
      return { el, setup: () => setup(el, scope, set) };
    }
  };

  function setup(root, scope, set) {
    const D = AE.data;
    const hero = $(".hero", root);
    $$("[data-split]", root).forEach(h => AE.split(h));

    /* --- hero --- */
    AE.heroFirstImg = $(".hero-frame img", hero) || null;
    AE.heroGo = () => hero.classList.add("go");
    scope.add(() => { AE.heroGo = null; AE.heroFirstImg = null; });
    if (!AE.introPending) requestAnimationFrame(() => requestAnimationFrame(() => hero.classList.add("go")));

    const fImgs = $$(".hero-frame img", hero), cap = $(".hero-frame-cap span", hero), hudGeo = $(".hud-geo", hero), hudN = $(".hud-n", hero);
    let hi = 0, heroVisible = true;
    if (fImgs.length > 1) {
      if ("IntersectionObserver" in window) scope.io(([en]) => { heroVisible = en.isIntersecting; }).observe(hero);
      scope.every(() => {
        if (!heroVisible || document.hidden || AE.introPending) return;
        hi = (hi + 1) % fImgs.length;
        fImgs.forEach((im, k) => im.classList.toggle("on", k === hi));
        if (hudGeo) hudGeo.textContent = geoText(set[hi]);
        if (hudN) hudN.textContent = `${AE.pad2(hi + 1)} / ${AE.pad2(set.length)}`;
        if (cap) { const h = capHTML(set[hi]); if (h) cap.innerHTML = h; cap.parentNode.classList.toggle("empty", !h); }
      }, 5200);
    }
    // dönen kelimeler
    const rot = $$(".rot span", hero);
    if (rot.length > 1 && !reduced()) {
      let ri = 0;
      scope.every(() => {
        if (!heroVisible || document.hidden) return;
        const prev = rot[ri];
        ri = (ri + 1) % rot.length;
        prev.classList.remove("on"); prev.classList.add("out");
        rot[ri].classList.remove("out"); rot[ri].classList.add("on");
        setTimeout(() => prev.classList.remove("out"), 950);
      }, 2400);
    }
    // eğim (masaüstü)
    if (finePointer() && !reduced()) {
      const frame = $(".hero-frame", hero), text = $(".hero-name", hero);
      let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
      const tick = () => {
        raf = 0;
        cx += (tx - cx) * 0.08; cy += (ty - cy) * 0.08;
        if (mq("(min-width: 900px)")) {
          frame.style.transform = `rotateY(${(cx * 12).toFixed(2)}deg) rotateX(${(-cy * 9).toFixed(2)}deg)`;
          text.style.translate = `${(cx * -16).toFixed(1)}px ${(cy * -10).toFixed(1)}px`;
        }
        if (Math.abs(tx - cx) > 0.002 || Math.abs(ty - cy) > 0.002) raf = requestAnimationFrame(tick);
      };
      scope.on(hero, "pointermove", e => {
        if (e.pointerType !== "mouse") return;
        const r = hero.getBoundingClientRect();
        tx = (e.clientX - r.left) / r.width - 0.5; ty = (e.clientY - r.top) / r.height - 0.5;
        if (!raf) raf = requestAnimationFrame(tick);
      });
      scope.on(hero, "pointerleave", () => { tx = 0; ty = 0; if (!raf) raf = requestAnimationFrame(tick); });
      scope.add(() => cancelAnimationFrame(raf));
    }

    if (hasGsap() && !reduced()) {
      scope.anim(() => {
        gsap.to($(".hero-frame-wrap", hero), { yPercent: 12, ease: "none", scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true } });
        gsap.to($(".hero-text", hero), { yPercent: -14, opacity: 0.2, ease: "none", scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true } });
      });
    }

    /* --- kayan yazı --- */
    const mqEl = $(".marquee", root);
    if (mqEl && hasGsap() && !reduced()) {
      scope.anim(() => {
        const tws = $$(".mq-row", mqEl).map((row, i) => {
          const tw = gsap.fromTo($$(".mq-track", row), { xPercent: i % 2 ? -100 : 0 }, { xPercent: i % 2 ? 0 : -100, duration: i % 2 ? 46 : 34, ease: "none", repeat: -1 });
          tw.totalTime(tw.duration() * 200);
          return tw;
        });
        let calm = 0;
        const st = ScrollTrigger.create({
          trigger: mqEl, start: "top bottom", end: "bottom top",
          onToggle: self => tws.forEach(t => (self.isActive ? t.resume() : t.pause())),
          onUpdate: self => {
            const dir = self.direction || 1;
            const boost = 1 + Math.min(Math.abs(self.getVelocity()) / 450, 5);
            tws.forEach(t => gsap.to(t, { timeScale: dir * boost, duration: 0.2, overwrite: true }));
            clearTimeout(calm);
            calm = setTimeout(() => tws.forEach(t => gsap.to(t, { timeScale: dir, duration: 1.1, overwrite: true })), 140);
          }
        });
        if (!st.isActive) tws.forEach(t => t.pause());
        scope.add(() => clearTimeout(calm));
      });
    } else if (mqEl && !hasGsap()) document.documentElement.classList.add("no-gsap");

    /* --- aurora ışığı (masaüstü) --- */
    const gl = $(".hero-gl", root);
    if (gl && AE.fx && mq("(min-width: 900px)") && !reduced()) {
      const au = AE.fx.aurora(gl);
      if (au) {
        hero.classList.add("has-gl");
        scope.add(() => au.destroy());
        let vis = true;
        if ("IntersectionObserver" in window) scope.io(([en]) => { vis = en.isIntersecting; if (vis && !document.hidden) au.start(); else au.stop(); }).observe(hero);
        else au.start();
        scope.on(document, "visibilitychange", () => { if (document.hidden) au.stop(); else if (vis) au.start(); });
        scope.on(hero, "pointermove", e => { const b = hero.getBoundingClientRect(); au.mouse((e.clientX - b.left) / b.width, (e.clientY - b.top) / b.height); }, { passive: true });
      }
    }

    /* --- 3B zaman tüneli --- */
    const tn = $(".tunnel", root);
    if (tn && AE.fx) AE.fx.tunnel(tn, scope);
    const best = $("[data-best]", root);
    if (best) { try { best.textContent = localStorage.getItem("ae_game_best") || "0"; } catch (e) {} }

    /* --- açıklama cümlesi (kelime kelime aydınlanır) --- */
    const words = $$(".statement .sw", root);
    if (words.length && hasGsap() && !reduced()) {
      scope.anim(() => ScrollTrigger.create({
        trigger: $(".statement .stm", root), start: "top 80%", end: "bottom 45%", scrub: true,
        onUpdate: self => { const n = Math.round(self.progress * words.length); words.forEach((w, i) => w.classList.toggle("lit", i < n)); }
      }));
    } else words.forEach(w => w.classList.add("lit"));

    /* --- son anılar (yatay) --- */
    const lat = $(".latest", root);
    if (lat) {
      const track = $(".latest-track", lat), countB = $(".latest-count b", lat), bar = $(".latest-progress span", lat);
      const n = +lat.dataset.n || 1;
      const setCount = p => {
        p = Math.min(1, Math.max(0, p || 0));
        countB.textContent = AE.pad2(Math.min(n, Math.max(1, Math.round(p * (n - 1)) + 1)));
        bar.style.transform = `scaleX(${p})`;
      };
      scope.on(track, "scroll", () => {
        if (lat.classList.contains("pinned")) return;
        const max = track.scrollWidth - track.clientWidth;
        setCount(max > 0 ? track.scrollLeft / max : 0);
      }, { passive: true });
      if (hasGsap() && !reduced()) {
        scope.anim(() => {
          const mm = gsap.matchMedia();
          mm.add("(min-width: 900px)", () => {
            lat.classList.add("pinned");
            const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
            const tw = gsap.to(track, {
              x: () => -dist(), ease: "none",
              scrollTrigger: { trigger: lat, start: "top top", end: () => "+=" + dist(), pin: true, scrub: 0.8, invalidateOnRefresh: true, anticipatePin: 1, onUpdate: s => setCount(s.progress) }
            });
            $$(".lcard-img img", track).forEach(img => {
              gsap.fromTo(img, { xPercent: -6 }, { xPercent: 6, ease: "none", scrollTrigger: { trigger: img.parentNode, containerAnimation: tw, start: "left right", end: "right left", scrub: true } });
            });
            return () => { lat.classList.remove("pinned"); };
          });
          scope.add(() => mm.revert());
        });
      }
    }

    /* --- sayılar, küre, mıknatıs --- */
    AE.bindCommon(root, scope);
    AE.countUp(root, scope);
    AE.magnets(root, scope);
    AE.footParallax(root, scope);

    const g = $(".globe", root);
    if (g && AE.globe) {
      let inst = null;
      const init = () => {
        if (inst) return;
        inst = AE.globe(g, { onSelect: key => { location.hash = `#/ulke/${encodeURIComponent(key)}`; } });
        scope.add(() => inst && inst.destroy());
      };
      if ("IntersectionObserver" in window) {
        const io = scope.io(ents => { if (ents.some(e => e.isIntersecting)) { io.disconnect(); init(); } }, { rootMargin: "400px 0px" });
        io.observe(g);
      } else init();
      $$(".world-list a", root).forEach(a => {
        scope.on(a, "pointerenter", () => { if (inst) inst.focus(a.dataset.key); });
        scope.on(a, "focus", () => { if (inst) inst.focus(a.dataset.key); });
      });
    }
  }
})();
