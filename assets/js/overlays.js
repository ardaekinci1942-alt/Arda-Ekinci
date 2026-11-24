/* Arda Ekinci — anı görüntüleyici ve hikâye izleyici */
(function () {
  "use strict";
  const AE = window.AE;
  const { $, $$, esc, reduced } = AE;

  /* ================= ANI GÖRÜNTÜLEYİCİ ================= */
  AE.viewer = (function () {
    let root = null, cur = null, car = null, onKey = null;

    const list = () => {
      const nl = AE.navList || [];
      return cur && nl.includes(cur.id) ? nl : AE.data.posts.map(p => p.id);
    };

    function build() {
      root = AE.el(`<div class="viewer" role="dialog" aria-modal="true" aria-label="Anı">
        <div class="vw-bg"></div>
        <button type="button" class="icon-btn vw-close" aria-label="Kapat">${AE.icon.close}</button>
        <button type="button" class="icon-btn vw-nav p" aria-label="Önceki anı">${AE.icon.chevL}</button>
        <button type="button" class="icon-btn vw-nav n" aria-label="Sonraki anı">${AE.icon.chevR}</button>
        <div class="vw-box"><div class="vw-media"></div><aside class="vw-side"></aside></div>
      </div>`);
      document.body.appendChild(root);
      AE.lock(true);
      $(".vw-close", root).addEventListener("click", () => AE.closeOverlay());
      AE.dbltap($(".vw-media", root), e => { if (cur && !e.target.closest("button")) AE.like(cur.id, e.clientX, e.clientY); });
      $(".vw-bg", root).addEventListener("click", () => AE.closeOverlay());
      $(".vw-nav.p", root).addEventListener("click", () => step(-1));
      $(".vw-nav.n", root).addEventListener("click", () => step(1));
      root.addEventListener("click", e => {
        const s = e.target.closest("[data-share]");
        if (s) { e.preventDefault(); AE.share(s.dataset.share, s.dataset.title); return; }
        const st = e.target.closest("[data-vw-step]");
        if (st) { e.preventDefault(); step(+st.dataset.vwStep); return; }
        const pl = e.target.closest("[data-vw-post]");
        if (pl) {
          e.preventDefault();
          const p = AE.data.byId.get(pl.dataset.vwPost);
          if (p) { AE.setHashSilently(`#/ani/${encodeURIComponent(p.id)}`); render(p, 0, true); }
        }
      });
      onKey = e => {
        if (!root) return;
        if (e.key === "Escape") { e.preventDefault(); AE.closeOverlay(); }
        else if (e.key === "ArrowRight") { e.preventDefault(); if (car && car.count > 1 && car.index < car.count - 1) car.go(car.index + 1); else step(1); }
        else if (e.key === "ArrowLeft") { e.preventDefault(); if (car && car.count > 1 && car.index > 0) car.go(car.index - 1); else step(-1); }
      };
      addEventListener("keydown", onKey);
      requestAnimationFrame(() => requestAnimationFrame(() => root && root.classList.add("on")));
    }

    function render(post, idx, animate) {
      cur = post;
      const D = AE.data;
      const media = $(".vw-media", root), side = $(".vw-side", root);
      if (car) { car.destroy(); car = null; }
      if (post.type === "note") {
        media.innerHTML = `<div class="vw-note"><div>${post.mood ? `<span class="mood">${esc(post.mood)}</span>` : ""}<p>${esc(post.text)}</p></div></div>`;
      } else {
        media.innerHTML = `<div class="car"><div class="car-track">${post.photos.map(ph =>
          `<figure>${AE.img(ph.src, { alt: AE.placeLine(post) || post.title, attrs: `${AE.srcset(ph)} sizes="(max-width: 899px) 100vw, 72vw"`, eager: true })}</figure>`).join("")}</div></div>`;
        car = AE.carousel($(".car", media), { counter: true });
        if (idx > 0 && idx < post.photos.length) car.go(idx, true);
      }
      if (animate && media.animate && !reduced()) media.animate([{ opacity: 0, transform: "scale(.985)" }, { opacity: 1, transform: "none" }], { duration: 380, easing: "cubic-bezier(.16,1,.3,1)" });

      const where = AE.placeLine(post);
      const ch = AE.countryHash(post);
      const album = post.album && D.albums.find(a => a.key === post.album);
      const others = D.posts.filter(p => p !== post && p.type === "photo");
      let more = post.place ? others.filter(p => p.place === post.place) : [];
      if (more.length < 3 && post.country) more = more.concat(others.filter(p => p.country === post.country && !more.includes(p)));
      let moreLabel = post.place && more.some(p => p.place === post.place) ? "Aynı yerden" : post.country && more.length ? `${AE.abl(post.country)} diğerleri` : "";
      if (!more.length) { more = others.slice(0, 6); moreLabel = "Diğer anılar"; }
      more = more.slice(0, 6);
      side.innerHTML = `
        <div class="vw-side-head">${AE.avatarHTML()}<div><b>${esc(D.site.name)}</b>${where ? (ch ? `<a href="${ch}">${esc(where)}</a>` : `<span style="font-size:12px;color:var(--muted)">${esc(where)}</span>`) : ""}</div></div>
        <div class="vw-side-body">
          ${post.title ? `<h2>${esc(post.title)}</h2>` : ""}
          ${post.caption ? `<p class="cap">${esc(post.caption)}</p>` : ""}
          <div class="vw-meta">
            ${post.date ? `<div>${AE.icon.cal}<span>${esc(AE.fmtDate(post.date))}</span></div>` : ""}
            ${where ? `<div>${AE.icon.pin}${ch ? `<a href="${ch}">${esc(where)}</a>` : `<span>${esc(where)}</span>`}</div>` : ""}
            ${album ? `<div>${AE.icon.album}<a href="${album.hash}">${esc(album.title)}</a></div>` : ""}
            ${post.photos.length > 1 ? `<div>${AE.icon.grid}<span>${post.photos.length} fotoğraf</span></div>` : ""}
          </div>
          ${more.length ? `<div class="vw-more"><h4>${esc(moreLabel)}</h4><div>${more.map(p =>
            `<a href="#/ani/${encodeURIComponent(p.id)}" data-vw-post="${esc(p.id)}" aria-label="${esc(AE.placeLine(p))}">${AE.img(p.photos[0].sm || p.photos[0].thumb, { alt: "" })}</a>`).join("")}</div></div>` : ""}
        </div>
        <div class="vw-actions">
          ${AE.likeBtnHTML(post.id)}
          <button type="button" class="btn" data-share="#/ani/${encodeURIComponent(post.id)}" data-title="${esc(post.title || where || "Bir anı")}">${AE.icon.share} Paylaş</button>
          <button type="button" class="icon-btn" data-vw-step="-1" aria-label="Önceki anı">${AE.icon.chevL}</button>
          <button type="button" class="icon-btn" data-vw-step="1" aria-label="Sonraki anı">${AE.icon.chevR}</button>
        </div>`;
      $(".vw-side-body", side).scrollTop = 0;
      AE.paintLikes(side);
      const l = list(), i = l.indexOf(post.id);
      const prevOk = i > 0, nextOk = i >= 0 && i < l.length - 1;
      $(".vw-nav.p", root).disabled = !prevOk; $(".vw-nav.n", root).disabled = !nextOk;
      $$('[data-vw-step="-1"]', root).forEach(b => { b.disabled = !prevOk; });
      $$('[data-vw-step="1"]', root).forEach(b => { b.disabled = !nextOk; });
      [l[i - 1], l[i + 1]].forEach(id => { const p = id && D.byId.get(id); if (p && p.photos[0]) AE.preload(p.photos[0].thumb); });
      document.title = `${post.title || where || "Anı"} — ${D.site.name}`;
    }

    function step(d) {
      if (!cur) return;
      const l = list(), i = l.indexOf(cur.id);
      const nid = l[i + d];
      const p = nid && AE.data.byId.get(nid);
      if (!p) return;
      AE.setHashSilently(`#/ani/${encodeURIComponent(p.id)}`);
      render(p, 0, true);
    }

    function flip() {
      const f = AE.flipFrom;
      AE.flipFrom = null;
      if (!f || Date.now() - f.t > 2000 || !f.img || !f.img.isConnected || reduced() || !cur || cur.type === "note") return;
      const from = f.img.getBoundingClientRect();
      const media = $(".vw-media", root);
      const mr = media.getBoundingClientRect();
      if (!from.width || !mr.width || !document.body.animate) return;
      const ph = cur.photos[car ? car.index : 0] || cur.photos[0];
      const ar = (ph.w || 4) / (ph.h || 3);
      let tw = mr.width, th = tw / ar;
      if (th > mr.height) { th = mr.height; tw = th * ar; }
      const tx = mr.left + (mr.width - tw) / 2, ty = mr.top + (mr.height - th) / 2;
      const g = document.createElement("img");
      g.className = "vw-ghost";
      g.src = f.img.currentSrc || f.img.src;
      g.alt = "";
      Object.assign(g.style, { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px` });
      document.body.appendChild(g);
      media.style.opacity = "0";
      let finished = false;
      const done = () => {
        if (finished) return;
        finished = true;
        media.style.transition = "opacity .3s ease";
        media.style.opacity = "";
        setTimeout(() => { g.remove(); media.style.transition = ""; }, 320);
      };
      try {
        const a = g.animate([
          { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px`, borderRadius: "8px" },
          { left: `${tx}px`, top: `${ty}px`, width: `${tw}px`, height: `${th}px`, borderRadius: "2px" }
        ], { duration: 560, easing: "cubic-bezier(.16,1,.3,1)", fill: "forwards" });
        a.onfinish = done;
      } catch (e) { done(); }
      setTimeout(done, 1000);
    }

    function open(id, idx) {
      const p = AE.data.byId.get(id);
      if (!p) {
        AE.toast("Bu anı bulunamadı");
        setTimeout(() => AE.closeOverlay(), 0);
        return;
      }
      const fresh = !root;
      if (fresh) build();
      render(p, idx || 0, !fresh);
      if (fresh) flip();
    }

    function hide(instant) {
      if (!root) return;
      const r = root;
      root = null; cur = null;
      if (car) car.destroy();
      car = null;
      removeEventListener("keydown", onKey);
      AE.lock(false);
      if (AE.current) {
        const v = AE.views[AE.current.name];
        const t = v && v.title ? String(v.title(AE.current.args)).replace(/<[^>]+>/g, "") : "";
        document.title = AE.current.name ? `${t} — ${AE.data.site.name}` : AE.data.site.name;
      }
      $$(".vw-ghost").forEach(g => g.remove());
      if (instant) { r.remove(); return; }
      r.classList.remove("on");
      setTimeout(() => r.remove(), 460);
    }

    return { open, hide, isOpen: () => !!root };
  })();

  /* ================= HİKÂYE İZLEYİCİ ================= */
  AE.stories = (function () {
    let root = null, items = [], idx = 0, coll = null, onKey = null, onVis = null;
    let holdT = 0, held = false, manualPause = false, pid = null, sx = 0, sy = 0, token = 0;
    const DUR = 5;

    function setPaused(p) {
      if (!root) return;
      root.classList.toggle("paused", p);
      const b = $('[data-act="pause"]', root);
      if (b) { b.innerHTML = p ? AE.icon.play : AE.icon.pause; b.setAttribute("aria-label", p ? "Devam et" : "Duraklat"); }
    }

    function build() {
      root = AE.el(`<div class="sto" role="dialog" aria-modal="true" aria-label="Hikâye">
        <div class="sto-bg"></div>
        <button type="button" class="icon-btn sto-nav p" aria-label="Önceki">${AE.icon.chevL}</button>
        <button type="button" class="icon-btn sto-nav n" aria-label="Sonraki">${AE.icon.chevR}</button>
        <button type="button" class="icon-btn sto-close-d" aria-label="Kapat">${AE.icon.close}</button>
        <div class="sto-frame">
          <div class="sto-media"><img alt="" draggable="false"></div>
          <div class="sto-top">
            <div class="sto-bars"></div>
            <div class="sto-head"><span class="av"></span><div style="line-height:1.25"><b></b><br><time></time></div><span class="sp"></span>
              <button type="button" data-act="pause" aria-label="Duraklat">${AE.icon.pause}</button>
              <button type="button" data-act="close" aria-label="Kapat">${AE.icon.close}</button></div>
          </div>
          <div class="sto-tap l"></div><div class="sto-tap r"></div>
          <div class="sto-foot"><p></p><span class="sto-acts"><button type="button" class="like-btn" data-like="" aria-label="Beğen">${AE.icon.heart}<span class="lc"></span></button><a href="#/">Anıyı aç</a></span></div>
        </div>
      </div>`);
      document.body.appendChild(root);
      AE.lock(true);
      const frame = $(".sto-frame", root);
      $(".sto-nav.p", root).addEventListener("click", prev);
      $(".sto-nav.n", root).addEventListener("click", next);
      $(".sto-close-d", root).addEventListener("click", () => AE.closeOverlay());
      $('[data-act="close"]', root).addEventListener("click", () => AE.closeOverlay());
      $('[data-act="pause"]', root).addEventListener("click", () => { manualPause = !root.classList.contains("paused"); setPaused(manualPause); });
      $(".sto-foot a", root).addEventListener("click", e => {
        e.preventDefault();
        const x = items[idx];
        if (x) AE.replaceHash(`#/ani/${encodeURIComponent(x.post.id)}/${x.i}`);
      });
      root.addEventListener("click", e => { if (e.target === root || e.target.classList.contains("sto-bg")) AE.closeOverlay(); });
      root.addEventListener("animationend", e => { if (e.animationName === "bar") next(); });

      frame.addEventListener("pointerdown", e => {
        if (e.target.closest("button, a")) return;
        pid = e.pointerId; sx = e.clientX; sy = e.clientY; held = false;
        frame.style.transition = "none";
        clearTimeout(holdT);
        holdT = setTimeout(() => { held = true; setPaused(true); }, 230);
      });
      frame.addEventListener("pointermove", e => {
        if (e.pointerId !== pid) return;
        const dy = e.clientY - sy;
        if (dy > 8) { clearTimeout(holdT); frame.style.transform = `translateY(${dy * 0.6}px) scale(${1 - Math.min(dy, 400) / 2200})`; }
      });
      const end = e => {
        if (e.pointerId !== pid) return;
        pid = null;
        clearTimeout(holdT);
        frame.style.transition = "";
        frame.style.transform = "";
        const dy = e.clientY - sy, dx = e.clientX - sx;
        if (e.type === "pointercancel") { if (held) { held = false; setPaused(manualPause); } return; }
        if (dy > 100) { AE.closeOverlay(); return; }
        if (held) { held = false; setPaused(manualPause); return; }
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) { if (dx < 0) nextColl(); else prevColl(); return; }
        const r = frame.getBoundingClientRect();
        if (e.clientX - r.left < r.width * 0.32) prev(); else next();
      };
      frame.addEventListener("pointerup", end);
      frame.addEventListener("pointercancel", end);
      frame.addEventListener("contextmenu", e => e.preventDefault());

      onKey = e => {
        if (!root) return;
        if (e.key === "Escape") { e.preventDefault(); AE.closeOverlay(); }
        else if (e.key === "ArrowRight") { e.preventDefault(); next(); }
        else if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
        else if (e.key === " ") { e.preventDefault(); manualPause = !manualPause; setPaused(manualPause); }
      };
      addEventListener("keydown", onKey);
      onVis = () => { if (!root) return; if (document.hidden) setPaused(true); else setPaused(manualPause); };
      document.addEventListener("visibilitychange", onVis);
      requestAnimationFrame(() => requestAnimationFrame(() => root && root.classList.add("on")));
    }

    function show(i) {
      if (!root || !items.length) return;
      idx = AE.clamp(i, 0, items.length - 1);
      const x = items[idx];
      const my = ++token;
      root.classList.add("wait");
      const bars = $$(".sto-bars span", root);
      bars.forEach((s, k) => { s.classList.toggle("done", k < idx); s.classList.remove("cur"); });
      const curBar = bars[idx];
      if (curBar) { void curBar.offsetWidth; curBar.classList.add("cur"); }
      const img = $(".sto-media img", root);
      img.classList.remove("kb");
      img.style.opacity = "0";
      img.classList.toggle("cover", x.ph.h > x.ph.w * 1.25);
      const ready = () => {
        if (my !== token || !root) return;
        img.style.opacity = "1";
        void img.offsetWidth;
        img.classList.add("kb");
        root.classList.remove("wait");
      };
      img.onload = ready;
      img.onerror = ready;
      const abs = new URL(x.ph.src, location.href).href;
      if (img.src === abs && img.complete) ready(); else img.src = x.ph.src;
      setTimeout(() => { if (my === token && root && root.classList.contains("wait")) ready(); }, 6000);
      $(".sto-bg", root).style.backgroundImage = `url("${String(x.ph.sm || x.ph.thumb).replace(/"/g, "%22")}")`;
      const p = x.post;
      const where = AE.placeLine(p);
      $(".sto-foot p", root).innerHTML = `${esc(p.title || where || "")}${p.date ? `<small>${esc(AE.fmtDate(p.date))}</small>` : ""}`;
      const lb = $(".sto-foot .like-btn", root);
      if (lb) { lb.dataset.like = p.id; AE.paintLikes(root); }
      $("time", root).textContent = AE.fmtDate(p.date, true);
      const nx = items[idx + 1];
      if (nx) AE.preload(nx.ph.src);
    }

    function next() { if (idx < items.length - 1) show(idx + 1); else nextColl(); }
    function prev() { if (idx > 0) show(idx - 1); else prevColl(); }
    function nextColl() {
      const hl = AE.data.highlights, i = hl.indexOf(coll), n = hl[i + 1];
      if (n) AE.replaceHash(`#/hikaye/${n.kind}/${encodeURIComponent(n.key)}`);
      else AE.closeOverlay();
    }
    function prevColl() {
      const hl = AE.data.highlights, i = hl.indexOf(coll), p = i > 0 ? hl[i - 1] : null;
      if (p) AE.replaceHash(`#/hikaye/${p.kind}/${encodeURIComponent(p.key)}`);
      else show(0);
    }

    function open(kind, key) {
      const c = AE.coll(kind, key);
      if (!c || !c.photos.length) {
        AE.toast("Bu hikâye bulunamadı");
        setTimeout(() => AE.closeOverlay(), 0);
        return;
      }
      const fresh = !root;
      if (fresh) build();
      else if (!reduced()) $(".sto-frame", root).animate([{ opacity: 0.2, transform: "translateX(40px) scale(.97)" }, { opacity: 1, transform: "none" }], { duration: 420, easing: "cubic-bezier(.16,1,.3,1)" });
      coll = c;
      items = c.photos.slice().reverse().slice(0, 80);
      root.style.setProperty("--dur", `${DUR}s`);
      $(".sto-bars", root).innerHTML = items.map(() => "<span><i></i></span>").join("");
      $(".sto-head .av", root).innerHTML = c.coverPhoto ? AE.img(c.coverPhoto.sm || c.coverPhoto.thumb, { alt: "" }) : "";
      $(".sto-head b", root).textContent = `${c.flag ? c.flag + " " : ""}${c.title}`;
      manualPause = false;
      setPaused(false);
      show(0);
    }

    function hide(instant) {
      if (!root) return;
      const r = root;
      root = null; coll = null; items = []; token++;
      clearTimeout(holdT);
      removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVis);
      AE.lock(false);
      if (instant) { r.remove(); return; }
      r.classList.remove("on");
      setTimeout(() => r.remove(), 380);
    }

    return { open, hide, isOpen: () => !!root };
  })();
})();
