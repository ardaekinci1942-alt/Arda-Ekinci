/* Arda Ekinci — fütüristik efektler: aurora ışığı, harf karıştırma, hologram parıltı, 3B zaman tüneli, hava durumu */
(function () {
  "use strict";
  const AE = window.AE;
  const { $, $$, reduced, finePointer, hasGsap } = AE;
  const fx = (AE.fx = {});

  /* ================= WebGL aurora ================= */
  const VS = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
  const FS = `precision mediump float;
uniform vec2 r;uniform float t;uniform vec2 m;uniform vec3 a;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);
return mix(mix(h(i),h(i+vec2(1.,0.)),u.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),u.x),u.y);}
float fb(vec2 p){float v=0.,s=.5;for(int i=0;i<5;i++){v+=s*n(p);p=p*2.03+vec2(1.7,9.2);s*=.5;}return v;}
void main(){
  vec2 uv=gl_FragCoord.xy/r;float k=r.x/r.y;vec2 p=vec2(uv.x*k,uv.y);
  float tt=t*.04;
  vec2 q=vec2(fb(p*1.4+vec2(tt,0.)),fb(p*1.4+vec2(5.2,-tt)));
  float f=fb(p*1.1+q*1.9+vec2(tt*1.6,-tt*.8));
  float band=smoothstep(.15,.7,f)*smoothstep(.55,.08,abs(uv.y-.62-.14*sin(p.x*1.6+tt*5.)+.1*(q.y-.5)));
  vec3 vio=vec3(.42,.24,.62),tea=vec3(.12,.42,.48);
  vec3 col=mix(vio,a,smoothstep(.35,.75,f));
  col=mix(col,tea,smoothstep(.55,.9,q.x)*.6);
  vec2 mm=vec2(m.x*k,m.y);
  float g=.07/(distance(p,mm)+.16);
  vec3 c=vec3(.043,.039,.035)+col*band*.34+a*g*.16+col*.025;
  c*=mix(.25,1.,smoothstep(1.25,.15,length((uv-vec2(.5,.55))*vec2(1.2,1.))));
  c+=(h(gl_FragCoord.xy+fract(t))-.5)*.025;
  gl_FragColor=vec4(c,1.);
}`;
  fx.aurora = canvas => {
    let gl = null;
    try { gl = canvas.getContext("webgl", { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: "low-power" }); } catch (e) { gl = null; }
    if (!gl) return null;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
    const vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) return null;
    const pr = gl.createProgram();
    gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
    gl.useProgram(pr);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = k => gl.getUniformLocation(pr, k);
    const uR = U("r"), uT = U("t"), uM = U("m"), uA = U("a");
    const rgb = (getComputedStyle(document.documentElement).getPropertyValue("--accent-rgb") || "232,182,122").split(",").map(v => (+v || 0) / 255);
    gl.uniform3f(uA, rgb[0], rgb[1], rgb[2]);
    let w = 2, h = 2, raf = 0, on = false, mx = 0.7, my = 0.4, tx = 0.7, ty = 0.4;
    const t0 = performance.now();
    const scale = Math.min(0.6, 0.9 / (window.devicePixelRatio || 1));
    const resize = () => {
      const b = canvas.getBoundingClientRect();
      w = Math.max(2, Math.round(b.width * scale)); h = Math.max(2, Math.round(b.height * scale));
      canvas.width = w; canvas.height = h;
      gl.viewport(0, 0, w, h);
      draw(performance.now());
    };
    const draw = now => {
      mx += (tx - mx) * 0.05; my += (ty - my) * 0.05;
      gl.uniform2f(uR, w, h);
      gl.uniform1f(uT, ((now - t0) / 1000) % 3000);
      gl.uniform2f(uM, mx, 1 - my);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    const loop = now => { raf = 0; if (!on) return; draw(now); raf = requestAnimationFrame(loop); };
    const ro = "ResizeObserver" in window ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(canvas);
    resize();
    return {
      mouse(x, y) { tx = x; ty = y; },
      start() { if (on || reduced()) return; on = true; raf = requestAnimationFrame(loop); },
      stop() { on = false; cancelAnimationFrame(raf); },
      destroy() { on = false; cancelAnimationFrame(raf); if (ro) ro.disconnect(); const ext = gl.getExtension("WEBGL_lose_context"); if (ext) ext.loseContext(); }
    };
  };

  /* ================= harf karıştırma ================= */
  const GLYPHS = "ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ0123456789#%&*+/<>";
  fx.scramble = el => {
    if (reduced() || el.dataset.scr || el.children.length) return;
    const final = el.textContent;
    if (!final.trim() || final.length > 64) return;
    el.dataset.scr = "1";
    const chars = [...final], n = chars.length, t0 = performance.now(), dur = 700;
    const step = now => {
      const p = Math.min(1, (now - t0) / dur);
      let out = "";
      for (let i = 0; i < n; i++) out += chars[i] === " " || i / n < p * 1.25 - 0.25 ? chars[i] : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      el.textContent = p < 1 ? out : final;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  /* ================= hologram parıltı + eğim ================= */
  fx.holo = (root, scope) => {
    if (!finePointer() || reduced()) return;
    $$(".ccard, .lcard:not(.more), .proj, .otd-card", root).forEach(card => {
      scope.on(card, "pointermove", e => {
        const b = card.getBoundingClientRect();
        const x = (e.clientX - b.left) / b.width, y = (e.clientY - b.top) / b.height;
        card.style.setProperty("--mx", x.toFixed(3));
        card.style.setProperty("--my", y.toFixed(3));
        card.style.setProperty("--rx", `${((0.5 - y) * 10).toFixed(2)}deg`);
        card.style.setProperty("--ry", `${((x - 0.5) * 12).toFixed(2)}deg`);
        card.classList.add("holo-on");
      });
      scope.on(card, "pointerleave", () => {
        card.classList.remove("holo-on");
        card.style.setProperty("--rx", "0deg");
        card.style.setProperty("--ry", "0deg");
      });
    });
  };

  /* ================= 3B zaman tüneli ================= */
  fx.tunnel = (sec, scope) => {
    const stage = $(".tn-stage", sec), scene = $(".tn-scene", sec);
    if (!stage || !scene || !hasGsap() || reduced()) { sec.classList.add("tn-static"); return; }
    const els = $$(".tn-el", scene).map(el => ({ el, z: +el.dataset.z || 0, year: el.dataset.year || "" }));
    if (!els.length) return;
    const yearEl = $(".tn-year", sec), bar = $(".tn-bar i", sec), floor = $(".tn-floor", sec);
    const depth = Math.max(...els.map(d => -d.z)) + 500;
    let cam = -250, target = -250, raf = 0, active = false, lastYear = "";
    const render = () => {
      scene.style.transform = `translate3d(0,0,${cam.toFixed(1)}px)`;
      if (floor) floor.style.backgroundPosition = `0 ${(cam * 0.6).toFixed(0)}px`;
      let year = "";
      for (const d of els) {
        const dist = -(d.z + cam);
        let o = dist < -60 ? 0 : dist < 160 ? (dist + 60) / 220 : 1 - (dist - 1900) / 1300;
        o = Math.max(0, Math.min(1, o));
        if (d.o !== o) { d.o = o; d.el.style.opacity = o.toFixed(3); d.el.style.visibility = o < 0.01 ? "hidden" : "visible"; }
        if (!year && d.year && dist > -40) year = d.year;
      }
      if (year && year !== lastYear && yearEl) { lastYear = year; yearEl.textContent = year; }
      if (bar) bar.style.transform = `scaleX(${Math.max(0, Math.min(1, (cam + 250) / (depth + 250))).toFixed(4)})`;
    };
    const loop = () => {
      raf = 0;
      cam += (target - cam) * 0.12;
      render();
      if (Math.abs(target - cam) > 0.5 || active) raf = requestAnimationFrame(loop);
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };
    render();
    let st = null;
    scope.anim(() => {
      st = ScrollTrigger.create({
        trigger: sec, start: "top top", end: () => "+=" + Math.round(depth * 0.55 + window.innerHeight * 0.3),
        pin: true, anticipatePin: 1, invalidateOnRefresh: true,
        onUpdate: s => { target = -250 + s.progress * (depth + 250); kick(); },
        onToggle: s => { active = s.isActive; if (active) kick(); }
      });
    });
    scope.add(() => cancelAnimationFrame(raf));
    const skip = $(".tn-skip", sec);
    if (skip) scope.on(skip, "click", () => { if (st) window.scrollTo({ top: st.end + 2, behavior: "smooth" }); });
  };

  /* ================= hava durumu ================= */
  const WX = [[0, "☀️"], [2, "🌤️"], [3, "☁️"], [48, "🌫️"], [57, "🌦️"], [67, "🌧️"], [77, "❄️"], [82, "🌧️"], [86, "🌨️"], [99, "⛈️"]];
  const wxIcon = (code, day) => { if (code <= 1 && !day) return "🌙"; for (const [c, e] of WX) if (code <= c) return e; return "🌡️"; };
  async function getJSON(url) {
    const ctl = "AbortController" in window ? new AbortController() : null;
    const t = setTimeout(() => ctl && ctl.abort(), 6000);
    try { const r = await fetch(url, ctl ? { signal: ctl.signal } : {}); return r.ok ? await r.json() : null; }
    catch (e) { return null; } finally { clearTimeout(t); }
  }
  let wxP = null;
  fx.weather = () => {
    if (wxP) return wxP;
    wxP = (async () => {
      try {
        const c = JSON.parse(sessionStorage.getItem("ae_wx") || "null");
        if (c && Date.now() - c.t < 30 * 60e3) return c.v;
      } catch (e) {}
      const D = AE.data, loc = String(D.site.location || "").trim();
      const city = loc.split(",")[0].trim();
      if (!city || AE.ccFromName(city)) return null;
      const pl = D.places.find(p => p.geo && AE.norm(p.place) === AE.norm(city));
      let geo = pl ? pl.geo : null;
      if (!geo) {
        const g = await getJSON(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=tr&format=json`);
        const r = g && g.results && g.results[0];
        if (r) geo = [r.latitude, r.longitude];
      }
      if (!geo) return null;
      const w = await getJSON(`https://api.open-meteo.com/v1/forecast?latitude=${geo[0]}&longitude=${geo[1]}&current=temperature_2m,weather_code,is_day&timezone=auto`);
      const cur = w && w.current;
      if (!cur || !isFinite(cur.temperature_2m)) return null;
      const v = { temp: Math.round(cur.temperature_2m), icon: wxIcon(+cur.weather_code || 0, cur.is_day !== 0) };
      try { sessionStorage.setItem("ae_wx", JSON.stringify({ t: Date.now(), v })); } catch (e) {}
      return v;
    })();
    return wxP;
  };
  fx.paintWeather = root => {
    const els = $$("[data-weather]", root || document);
    if (!els.length) return;
    fx.weather().then(v => { if (v) els.forEach(e => { e.textContent = ` · ${v.temp}° ${v.icon}`; }); });
  };
})();
