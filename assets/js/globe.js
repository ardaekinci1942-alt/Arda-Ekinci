/* Arda Ekinci — gezilen yerleri gösteren etkileşimli dünya küresi */
(function () {
  "use strict";
  const AE = window.AE;
  let topoP = null;
  const loadTopo = () => topoP || (topoP = fetch("assets/vendor/countries-110m.json").then(r => (r.ok ? r.json() : null)).catch(() => null));

  function mainCentroid(f) {
    try {
      if (f.geometry && f.geometry.type === "MultiPolygon") {
        let best = null, area = -1;
        f.geometry.coordinates.forEach(c => {
          const g = { type: "Polygon", coordinates: c };
          const a = d3.geoArea(g);
          if (a > area) { area = a; best = g; }
        });
        if (best) return d3.geoCentroid(best);
      }
      return d3.geoCentroid(f);
    } catch (e) { return null; }
  }

  AE.globe = function (wrap, opts = {}) {
    const canvas = wrap.querySelector("canvas");
    const tip = wrap.querySelector(".globe-tip");
    const api = { focus() {}, destroy() {} };
    if (!canvas || !window.d3 || !d3.geoOrthographic || !window.topojson) { wrap.style.display = "none"; return api; }
    const ctx = canvas.getContext("2d");
    const D = AE.data;
    const rgb = (getComputedStyle(document.documentElement).getPropertyValue("--accent-rgb") || "").trim() || "232, 182, 122";
    const still = AE.reduced();
    let dead = false, raf = 0, visible = true, last = 0, w = 0, h = 0, dpr = 1, r = 100;
    let rot = [-28, -38, 0], auto = !still, dragging = false, focusAnim = null, focusKey = "", resumeT = 0;
    let land = null, borders = null, visited = [], pts = [], vis = [], featByKey = new Map();
    const projection = d3.geoOrthographic().clipAngle(90).precision(0.7);
    const path = d3.geoPath(projection, ctx);
    const grat = d3.geoGraticule10();

    function draw(t) {
      if (!w) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      projection.rotate(rot);
      const cx = w / 2, cy = h / 2;
      const glow = ctx.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 1.22);
      glow.addColorStop(0, `rgba(${rgb}, .18)`);
      glow.addColorStop(1, `rgba(${rgb}, 0)`);
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(cx, cy, r * 1.22, 0, Math.PI * 2); ctx.fill();
      const sea = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.05, cx, cy, r);
      sea.addColorStop(0, "#221d19"); sea.addColorStop(1, "#0c0a09");
      ctx.beginPath(); path({ type: "Sphere" }); ctx.fillStyle = sea; ctx.fill();
      ctx.beginPath(); path(grat); ctx.strokeStyle = "rgba(255,244,230,.055)"; ctx.lineWidth = 0.6; ctx.stroke();
      if (land) { ctx.beginPath(); path(land); ctx.fillStyle = "#2e2823"; ctx.fill(); }
      const fk = focusKey && featByKey.get(focusKey);
      visited.forEach(f => {
        ctx.beginPath(); path(f);
        ctx.fillStyle = `rgba(${rgb}, ${f === fk ? 0.85 : 0.48})`; ctx.fill();
        ctx.strokeStyle = `rgba(${rgb}, .95)`; ctx.lineWidth = 0.8; ctx.stroke();
      });
      if (borders) { ctx.beginPath(); path(borders); ctx.strokeStyle = "rgba(11,10,9,.6)"; ctx.lineWidth = 0.5; ctx.stroke(); }
      ctx.beginPath(); path({ type: "Sphere" }); ctx.strokeStyle = `rgba(${rgb}, .38)`; ctx.lineWidth = 1; ctx.stroke();
      const center = [-rot[0], -rot[1]];
      const pulse = still ? 0.5 : ((t || 0) % 2200) / 2200;
      vis = [];
      pts.forEach(p => {
        if (d3.geoDistance(p.ll, center) > Math.PI / 2 - 0.03) return;
        const xy = projection(p.ll);
        if (!xy) return;
        const [x, y] = xy;
        vis.push({ p, x, y });
        const rr = 2.6 + Math.min(4, Math.sqrt(p.count) * 0.9);
        ctx.beginPath(); ctx.arc(x, y, rr + pulse * 12, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${rgb}, ${((1 - pulse) * 0.7).toFixed(3)})`; ctx.lineWidth = 1.2; ctx.stroke();
        ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.fillStyle = "#fff"; ctx.fill();
        ctx.beginPath(); ctx.arc(x, y, rr * 0.55, 0, Math.PI * 2); ctx.fillStyle = `rgb(${rgb})`; ctx.fill();
      });
    }

    function frame(t) {
      raf = 0;
      if (dead) return;
      const dt = last ? Math.min(64, t - last) : 16;
      last = t;
      if (focusAnim) {
        const k = Math.min(1, (t - focusAnim.t0) / focusAnim.dur);
        const e = 1 - Math.pow(1 - k, 3);
        rot = [focusAnim.from[0] + focusAnim.dl * e, focusAnim.from[1] + focusAnim.dp * e, 0];
        if (k >= 1) focusAnim = null;
      } else if (auto && !dragging) rot[0] += dt * 0.005;
      draw(t);
      const moving = !still || focusAnim || dragging;
      if (visible && !document.hidden && moving) raf = requestAnimationFrame(frame);
    }
    const kick = () => { if (!raf && !dead) { last = 0; raf = requestAnimationFrame(frame); } };
    const resumeLater = (ms = 2600) => { clearTimeout(resumeT); resumeT = setTimeout(() => { if (!still) { auto = true; focusKey = ""; kick(); } }, ms); };

    function resize() {
      const rect = wrap.getBoundingClientRect();
      w = Math.max(10, rect.width); h = Math.max(10, rect.height);
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      r = Math.min(w, h) / 2 - 10;
      projection.scale(r).translate([w / 2, h / 2]);
      draw(performance.now());
    }
    const ro = "ResizeObserver" in window ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(wrap); else addEventListener("resize", resize);
    const io = "IntersectionObserver" in window ? new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) kick(); }) : null;
    if (io) io.observe(wrap);
    const onVis = () => { if (!document.hidden) kick(); };
    document.addEventListener("visibilitychange", onVis);

    const nearest = e => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left, y = e.clientY - rect.top;
      let best = null, bd = 20 * 20;
      vis.forEach(v => { const d = (v.x - x) ** 2 + (v.y - y) ** 2; if (d < bd) { bd = d; best = v; } });
      return best;
    };
    const showTip = v => {
      if (!tip) return;
      if (!v) { tip.classList.remove("on"); return; }
      tip.innerHTML = `${AE.esc(v.p.label)}<small>${v.p.sub ? AE.esc(v.p.sub) + " · " : ""}${v.p.count} kare</small>`;
      tip.style.left = `${v.x}px`; tip.style.top = `${v.y}px`;
      tip.classList.add("on");
    };
    let sx = 0, sy = 0, sr = rot, pid = null, moved = false;
    const onDown = e => {
      pid = e.pointerId; sx = e.clientX; sy = e.clientY; sr = rot.slice();
      dragging = true; moved = false; focusAnim = null; auto = false; clearTimeout(resumeT);
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
      kick();
    };
    const onMove = e => {
      if (dragging && e.pointerId === pid) {
        const dx = e.clientX - sx, dy = e.clientY - sy;
        if (Math.abs(dx) + Math.abs(dy) > 5) moved = true;
        const k = 80 / r;
        rot = [sr[0] + dx * k, AE.clamp(sr[1] - dy * k, -70, 70), 0];
        showTip(null);
        kick();
      } else if (e.pointerType === "mouse") {
        const v = nearest(e);
        showTip(v);
        canvas.style.cursor = v ? "pointer" : "";
        if (v) { auto = false; clearTimeout(resumeT); } else if (!focusKey) resumeLater(1200);
      }
    };
    const onUp = e => {
      if (e.pointerId !== pid) return;
      dragging = false; pid = null;
      if (!moved) {
        const v = nearest(e);
        if (v && opts.onSelect) { opts.onSelect(v.p.key); return; }
      }
      resumeLater();
    };
    const onCancel = () => { dragging = false; pid = null; resumeLater(); };
    const onLeave = () => { showTip(null); if (!dragging) resumeLater(1500); };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onCancel);
    canvas.addEventListener("pointerleave", onLeave);

    loadTopo().then(topo => {
      if (dead) return;
      if (!topo || !topo.objects || !topo.objects.countries) { draw(performance.now()); return; }
      const feats = topojson.feature(topo, topo.objects.countries).features;
      land = topojson.feature(topo, topo.objects.land);
      borders = topojson.mesh(topo, topo.objects.countries, (a, b) => a !== b);
      const byNum = new Map(feats.map(f => [String(f.id), f]));
      const featFor = cc => {
        if (!cc) return null;
        if (cc === "XK") return feats.find(f => f.properties && f.properties.name === "Kosovo") || null;
        const n = AE.CC2NUM[cc];
        return n ? byNum.get(n) || null : null;
      };
      const vset = new Set();
      D.countries.forEach(c => {
        const f = featFor(c.cc);
        if (f) { vset.add(f); featByKey.set(c.key, f); }
      });
      D.places.forEach(p => {
        if (p.cc || !p.geo) return;
        const f = feats.find(ff => { try { return d3.geoContains(ff, [p.geo[1], p.geo[0]]); } catch (e) { return false; } });
        if (f) vset.add(f);
      });
      visited = [...vset];
      const centroids = new Map();
      pts = D.places.map(p => {
        let ll = p.geo ? [p.geo[1], p.geo[0]] : null;
        if (!ll && p.cc) {
          if (!centroids.has(p.cc)) {
            const f = featFor(p.cc);
            centroids.set(p.cc, f ? mainCentroid(f) : AE.SMALL[p.cc] ? [AE.SMALL[p.cc][1], AE.SMALL[p.cc][0]] : null);
          }
          ll = centroids.get(p.cc);
        }
        return ll ? { ll, label: p.place || p.country, sub: p.place ? p.country : "", count: p.count, key: p.key } : null;
      }).filter(Boolean);
      if (pts.length) {
        let sxv = 0, syv = 0, lat = 0;
        pts.forEach(p => { sxv += Math.cos(p.ll[0] * Math.PI / 180) * p.count; syv += Math.sin(p.ll[0] * Math.PI / 180) * p.count; lat += p.ll[1] * p.count; });
        const tot = pts.reduce((s, p) => s + p.count, 0) || 1;
        rot = [-Math.atan2(syv, sxv) * 180 / Math.PI, AE.clamp(-(lat / tot) * 0.8, -60, 60), 0];
      }
      resize();
      kick();
    });

    api.focus = key => {
      const p = pts.find(x => x.key === key);
      if (!p) return;
      auto = false; focusKey = key;
      const from = rot.slice();
      const toL = -p.ll[0], toP = AE.clamp(-p.ll[1] * 0.85, -70, 70);
      const dl = ((toL - from[0]) % 360 + 540) % 360 - 180;
      focusAnim = { from, dl, dp: toP - from[1], t0: performance.now(), dur: 900 };
      kick();
      resumeLater(4500);
    };
    api.destroy = () => {
      dead = true;
      cancelAnimationFrame(raf);
      clearTimeout(resumeT);
      if (ro) ro.disconnect(); else removeEventListener("resize", resize);
      if (io) io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
    return api;
  };
})();
