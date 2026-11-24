/* Arda Ekinci — çekirdek: yardımcılar, veri, ortak bileşenler */
(function () {
  "use strict";
  const AE = (window.AE = window.AE || {});
  AE.views = AE.views || {};

  /* ================= DOM & genel yardımcılar ================= */
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = (s = "") => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const el = html => {
    const t = document.createElement("template");
    t.innerHTML = String(html).trim();
    return t.content.firstElementChild;
  };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const mq = q => { try { return matchMedia(q).matches; } catch (e) { return false; } };
  const reduced = () => mq("(prefers-reduced-motion: reduce)");
  const finePointer = () => mq("(hover: hover) and (pointer: fine)");
  const hasGsap = () => !!(window.gsap && window.ScrollTrigger);
  const pad2 = n => String(n).padStart(2, "0");
  Object.assign(AE, { $, $$, esc, el, clamp, sleep, mq, reduced, finePointer, hasGsap, pad2 });

  /* ================= tarih ================= */
  const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  const MONTHS_S = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
  function parseDate(d) {
    const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(d || "");
    if (!m) return null;
    const p = { y: +m[1], m: +m[2], d: m[3] ? +m[3] : 0 };
    return p.m >= 1 && p.m <= 12 ? p : null;
  }
  function fmtDate(d, short) {
    const p = parseDate(d);
    if (!p) return "";
    const mn = (short ? MONTHS_S : MONTHS)[p.m - 1];
    return p.d ? `${p.d} ${mn} ${p.y}` : `${mn} ${p.y}`;
  }
  function fmtRange(a, b) {
    const pa = parseDate(a), pb = parseDate(b);
    if (!pa && !pb) return "";
    if (!pa) return fmtDate(b);
    if (!pb || a === b) return fmtDate(a);
    if (pa.y === pb.y && pa.m === pb.m) return pa.d && pb.d && pa.d !== pb.d ? `${pa.d}–${pb.d} ${MONTHS[pa.m - 1]} ${pa.y}` : `${MONTHS[pa.m - 1]} ${pa.y}`;
    if (pa.y === pb.y) return `${MONTHS_S[pa.m - 1]} – ${MONTHS_S[pb.m - 1]} ${pa.y}`;
    return `${MONTHS_S[pa.m - 1]} ${pa.y} – ${MONTHS_S[pb.m - 1]} ${pb.y}`;
  }
  Object.assign(AE, { MONTHS, MONTHS_S, parseDate, fmtDate, fmtRange });

  /* ================= metin ================= */
  const TRMAP = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u" };
  const slug = s => String(s || "").toLocaleLowerCase("tr").replace(/[çğıöşüâîû]/g, c => TRMAP[c])
    .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const norm = s => slug(s).replace(/-/g, "");
  const JUNK_TITLE = /^(?:[0-9a-f]{8}(?:[\s_-]?[0-9a-f]{4}){3}[\s_-]?[0-9a-f]{12}|(?:img|dsc|dscf|pxl|p|image|photo|foto)[\s_-]*\d+.*|\d{6,}.*)$/i;
  const cleanTitle = t => { t = String(t || "").trim(); return JUNK_TITLE.test(t) ? "" : t; };
  const PLACE_PRE = /^(gemeente|municipality of|comune di|città di|ville de|stadt|landeshauptstadt|city of|distrito de|municipio de)\s+/i;
  const PLACE_SUF = /\s+(başkent bölgesi|bölgesi|ili|büyükşehir belediyesi|belediyesi|metropolitan municipality|capital region|region|province|municipality)$/i;
  const cleanPlace = p => String(p || "").trim().replace(PLACE_PRE, "").replace(PLACE_SUF, "").trim();
  const firstName = name => String(name || "").trim().split(/\s+/)[0] || "";
  const initials = name => String(name || "").trim().split(/\s+/).map(w => w[0] || "").join("").slice(0, 2).toLocaleUpperCase("tr");
  // Türkçe ayrılma eki: Fransa'dan, Türkiye'den, Paris'ten
  const abl = w => {
    const s = String(w || ""), low = s.toLocaleLowerCase("tr");
    const v = low.match(/[aeıioöuü]/g);
    const back = "aıou".includes(v ? v[v.length - 1] : "a");
    return `${s}'${/[çfhkpsşt]$/.test(low) ? "t" : "d"}${back ? "a" : "e"}n`;
  };
  Object.assign(AE, { slug, norm, cleanTitle, cleanPlace, firstName, initials, abl });

  /* ================= ülkeler ================= */
  const NUM = "AF004AL008DZ012AS016AD020AO024AI660AQ010AG028AR032AM051AW533AU036AT040AZ031BS044BH048BD050BB052BY112BE056BZ084BJ204BM060BT064BO068BA070BW072BV074BR076IO086BN096BG100BF854BI108KH116CM120CA124CV132KY136CF140TD148CL152CN156CX162CC166CO170KM174CG178CD180CK184CR188CI384HR191CU192CY196CZ203DK208DJ262DM212DO214EC218EG818SV222GQ226ER232EE233ET231FK238FO234FJ242FI246FR250GF254PF258TF260GA266GM270GE268DE276GH288GI292GR300GL304GD308GP312GU316GT320GN324GW624GY328HT332HM334VA336HN340HK344HU348IS352IN356ID360IR364IQ368IE372IL376IT380JM388JP392JO400KZ398KE404KI296KP408KR410KW414KG417LA418LV428LB422LS426LR430LY434LI438LT440LU442MO446MG450MW454MY458MV462ML466MT470MH584MQ474MR478MU480YT175MX484FM583MD498MC492MN496MS500MA504MZ508MM104NA516NR520NP524NL528NC540NZ554NI558NE562NG566NU570NF574MP580MK807NO578OM512PK586PW585PS275PA591PG598PY600PE604PH608PN612PL616PT620PR630QA634RE638RO642RU643RW646SH654KN659LC662PM666VC670WS882SM674ST678SA682SN686SC690SL694SG702SK703SI705SB090SO706ZA710GS239ES724LK144SD729SR740SJ744SZ748SE752CH756SY760TW158TJ762TZ834TH764TL626TG768TK772TO776TT780TN788TR792TM795TC796TV798UG800UA804AE784GB826US840UM581UY858UZ860VU548VE862VN704VG092VI850WF876EH732YE887ZM894ZW716AX248BQ535CW531GG831IM833JE832ME499BL652MF663RS688SX534SS728XK983";
  const CC2NUM = {};
  for (let i = 0; i < NUM.length; i += 5) CC2NUM[NUM.slice(i, i + 2)] = NUM.slice(i + 2, i + 5);
  // Haritada görünmeyecek kadar küçük ülkeler için yaklaşık merkezler [enlem, boylam]
  const SMALL = {
    VA: [41.9, 12.45], AD: [42.5, 1.52], MC: [43.73, 7.42], SM: [43.94, 12.46], LI: [47.14, 9.52], MT: [35.9, 14.51], GI: [36.14, -5.35],
    FO: [62.01, -6.77], AX: [60.1, 19.94], GG: [49.46, -2.54], JE: [49.19, -2.11], IM: [54.15, -4.48], XK: [42.66, 21.17], HK: [22.32, 114.17],
    MO: [22.2, 113.54], SG: [1.35, 103.82], BH: [26.23, 50.59], MV: [4.18, 73.51], MU: [-20.16, 57.5], SC: [-4.62, 55.45], CV: [14.93, -23.51],
    BB: [13.1, -59.62], AG: [17.12, -61.85], DM: [15.3, -61.39], GD: [12.06, -61.75], KN: [17.3, -62.72], LC: [14.01, -60.99], VC: [13.16, -61.22],
    AW: [12.52, -70.03], CW: [12.11, -68.93], SX: [18.03, -63.05], BM: [32.29, -64.78], KY: [19.29, -81.38], TC: [21.46, -71.14], VG: [18.43, -64.62],
    VI: [18.34, -64.93], GP: [16.0, -61.73], MQ: [14.6, -61.07], RE: [-20.88, 55.45], PF: [-17.53, -149.57], GU: [13.47, 144.75], MP: [15.18, 145.75],
    PW: [7.5, 134.62], FM: [6.92, 158.16], MH: [7.09, 171.38], KI: [1.45, 173.0], NR: [-0.55, 166.92], TV: [-8.52, 179.2], TO: [-21.14, -175.2],
    WS: [-13.83, -171.76], CK: [-21.21, -159.78], KM: [-11.7, 43.26], ST: [0.34, 6.73], YT: [-12.78, 45.23], BL: [17.9, -62.85], MF: [18.07, -63.08],
    AI: [18.22, -63.05], MS: [16.79, -62.21], PM: [46.78, -56.18], GF: [4.92, -52.31], BQ: [12.15, -68.27]
  };
  const ALIASES = { turkiye: "TR", turkey: "TR", hollanda: "NL", ingiltere: "GB", birlesikkrallik: "GB", iskocya: "GB", galler: "GB", abd: "US", amerika: "US", amerikabirlesikdevletleri: "US", rusya: "RU", cekya: "CZ", cekcumhuriyeti: "CZ", kktc: "CY", kibris: "CY", vatikan: "VA", bae: "AE", dubai: "AE", guneykore: "KR", kuzeykore: "KP", kosova: "XK", bosnahersek: "BA", kuzeymakedonya: "MK", makedonya: "MK" };
  let dnTR = null, dnEN = null;
  try { dnTR = new Intl.DisplayNames(["tr"], { type: "region" }); dnEN = new Intl.DisplayNames(["en"], { type: "region" }); } catch (e) {}
  const ccName = cc => {
    if (!cc) return "";
    try { const n = dnTR && dnTR.of(cc); return n && n !== cc ? n : cc; } catch (e) { return cc; }
  };
  let nameMap = null;
  function ccFromName(name) {
    if (!name) return "";
    if (!nameMap) {
      nameMap = Object.assign({}, ALIASES);
      Object.keys(CC2NUM).forEach(cc => {
        [dnTR, dnEN].forEach(dn => {
          try { const n = dn && dn.of(cc); if (n && n !== cc) { const k = norm(n); if (!nameMap[k]) nameMap[k] = cc; } } catch (e) {}
        });
      });
    }
    return nameMap[norm(name)] || "";
  }
  const flag = cc => /^[A-Z]{2}$/.test(cc || "") && cc !== "XK" ? String.fromCodePoint(...[...cc].map(c => 127397 + c.charCodeAt(0))) : "";
  Object.assign(AE, { CC2NUM, SMALL, ccName, ccFromName, flag });

  /* ================= ikonlar ================= */
  const I = (p, extra = "") => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${p}</svg>`;
  AE.icon = {
    arrowR: I('<path d="M5 12h14M13 6l6 6-6 6"/>'),
    arrowL: I('<path d="M19 12H5M11 6l-6 6 6 6"/>'),
    chevR: I('<path d="M9 6l6 6-6 6"/>'),
    chevL: I('<path d="M15 6l-6 6 6 6"/>'),
    close: I('<path d="M6 6l12 12M18 6L6 18"/>'),
    share: I('<path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>'),
    link: I('<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>'),
    pin: I('<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>'),
    cal: I('<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
    album: I('<rect x="3" y="7" width="14" height="14" rx="2.5"/><path d="M7 3h11.5A2.5 2.5 0 0 1 21 5.5V17"/>'),
    grid: I('<rect x="4" y="4" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1"/>'),
    feed: I('<rect x="4" y="3.5" width="16" height="11" rx="2"/><path d="M4 18.5h16M4 21h10"/>'),
    clock: I('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
    multi: I('<rect x="7.5" y="7.5" width="13" height="13" rx="2" fill="rgba(0,0,0,.25)"/><path d="M16.5 4.5h-10a2 2 0 0 0-2 2v10"/>', 'stroke="#fff"'),
    pinned: I('<path d="M9 4h6l-1 6 3 3H7l3-3-1-6z"/><path d="M12 13v7"/>', 'stroke="#fff"'),
    play: I('<path d="M8 5.5v13l11-6.5z" fill="currentColor"/>'),
    pause: I('<path d="M8 5v14M16 5v14" stroke-width="3"/>'),
    search: I('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>'),
    note: I('<path d="M5 4h14v12l-4 4H5z"/><path d="M15 20v-4h4M8.5 9h7M8.5 12.5h5"/>'),
    mail: I('<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M4 7l8 6 8-6"/>'),
    globe: I('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.8 3 2.8 15 0 18M12 3c-2.8 3-2.8 15 0 18"/>'),
    download: I('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'),
    instagram: I('<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".6" fill="currentColor"/>'),
    x: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.3-8.3L2 3h6.4l4.4 5.8L17.8 3Zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5Z"/></svg>',
    youtube: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12a31 31 0 0 0 .5 4.8 3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8ZM9.7 15.1V8.9l5.8 3.1-5.8 3.1Z"/></svg>',
    tiktok: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.6 3c.4 2.3 1.8 3.8 4.1 4v3.1c-1.5.1-2.9-.4-4.1-1.2v6.4c0 3.9-3.6 6.6-7.3 5.6-4.4-1.2-5-7.4-.6-9.1.9-.3 1.8-.4 2.7-.3v3.3c-.4-.1-.9-.1-1.3 0-1.6.4-2 2.6-.6 3.5 1.5.9 3.6 0 3.6-2.1V3h3.5Z"/></svg>',
    linkedin: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.5h4V21H3V9.5Zm6.5 0h3.8v1.6h.1c.5-1 1.8-2 3.8-2 4 0 4.8 2.6 4.8 6V21h-4v-5.1c0-1.2 0-2.8-1.7-2.8s-2 1.3-2 2.7V21h-4V9.5Z"/></svg>',
    github: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.3-3.4-1.3-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.4 1.1 2.9.8.1-.7.4-1.1.6-1.3-2.2-.3-4.6-1.1-4.6-5a3.9 3.9 0 0 1 1-2.7c-.1-.3-.5-1.3.1-2.7 0 0 .9-.3 2.8 1a9.6 9.6 0 0 1 5 0c1.9-1.3 2.8-1 2.8-1 .6 1.4.2 2.4.1 2.7a3.9 3.9 0 0 1 1 2.7c0 3.9-2.4 4.7-4.6 5 .4.3.7.9.7 1.9V21c0 .3.2.6.7.5A10 10 0 0 0 12 2Z"/></svg>',
    spotify: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.6 14.4a.6.6 0 0 1-.9.2c-2.4-1.5-5.4-1.8-9-1a.6.6 0 1 1-.3-1.2c3.9-.9 7.3-.5 10 1.1.3.2.4.6.2.9Zm1.2-2.7a.8.8 0 0 1-1.1.3c-2.7-1.7-6.9-2.2-10.2-1.2a.8.8 0 1 1-.4-1.5c3.7-1.1 8.4-.6 11.5 1.4.4.2.5.7.2 1Zm.1-2.8C14.7 9 9.4 8.8 6.4 9.7a.9.9 0 1 1-.5-1.8c3.5-1 9.3-.8 13 1.4a.9.9 0 0 1-1 1.6Z"/></svg>'
  };

  /* ================= sosyal bağlantılar ================= */
  const safeURL = u => { u = String(u || "").trim(); return /^https?:\/\//i.test(u) ? u : ""; };
  const handle = v => String(v || "").trim().replace(/^@/, "").replace(/\s+/g, "");
  const SOCIAL = {
    instagram: { label: "Instagram", url: v => safeURL(v) || `https://instagram.com/${encodeURIComponent(handle(v))}` },
    x: { label: "X", url: v => safeURL(v) || `https://x.com/${encodeURIComponent(handle(v))}` },
    youtube: { label: "YouTube", url: v => safeURL(v) || (/\s/.test(v.trim()) ? `https://www.youtube.com/results?search_query=${encodeURIComponent(v.trim())}` : `https://www.youtube.com/@${encodeURIComponent(handle(v))}`) },
    tiktok: { label: "TikTok", url: v => safeURL(v) || `https://www.tiktok.com/@${encodeURIComponent(handle(v))}` },
    linkedin: { label: "LinkedIn", url: v => safeURL(v) || `https://www.linkedin.com/in/${encodeURIComponent(handle(v))}` },
    github: { label: "GitHub", url: v => safeURL(v) || `https://github.com/${encodeURIComponent(handle(v))}` },
    spotify: { label: "Spotify", url: v => safeURL(v) || `https://open.spotify.com/search/${encodeURIComponent(v.trim())}` },
    website: { label: "Web", url: v => safeURL(v) || (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(v.trim()) ? `https://${v.trim()}` : "") }
  };
  AE.socials = site => Object.keys(SOCIAL).filter(k => site.socials[k]).map(k => ({
    key: k, label: SOCIAL[k].label, url: SOCIAL[k].url(String(site.socials[k])), icon: AE.icon[k] || AE.icon.globe
  })).filter(s => s.url);
  AE.safeURL = safeURL;

  /* ================= veri ================= */
  const DEFAULT_BIO = "Gezdiğim yerler, tanıdığım insanlar ve unutmak istemediğim *anlar.* Hepsi burada, bir arada.";
  const DEFAULT_WORDS = ["yolculuklar", "insanlar", "gündelik anlar", "şehirler", "hatıralar"];
  const DEFAULT_MARQUEE = ["Anılar", "Yolculuklar", "İnsanlar", "Şehirler", "Gündelik", "Hayat"];
  const SECTIONS = ["latest", "tunnel", "otd", "stories", "stats", "globe", "notes", "play", "about", "contact"];

  function normSite(s) {
    s = s && typeof s === "object" ? s : {};
    const socials = Object.assign({}, s.socials && typeof s.socials === "object" ? s.socials : {});
    [["instagram", "instagram"], ["twitter", "x"], ["youtube", "youtube"], ["linkedin", "linkedin"]].forEach(([a, b]) => {
      if (s[a] && !socials[b]) socials[b] = s[a];
    });
    const theme = Object.assign({}, s.theme && typeof s.theme === "object" ? s.theme : {});
    const sections = Object.assign({}, theme.sections || {});
    SECTIONS.forEach(k => { if (typeof sections[k] !== "boolean") sections[k] = true; });
    const list = v => (Array.isArray(v) ? v : String(v || "").split(",")).map(x => String(x).trim()).filter(Boolean);
    const cv = Object.assign({}, s.cv && typeof s.cv === "object" ? s.cv : {});
    const arr = v => (Array.isArray(v) ? v.filter(x => x && typeof x === "object") : []);
    const about = String(s.about || "");
    return {
      name: String(s.name || "Arda Ekinci").trim() || "Arda Ekinci",
      handle: String(s.handle || "").trim().replace(/^@/, ""),
      tagline: String(s.tagline || "").trim(),
      bio: String(s.bio || "").trim() || DEFAULT_BIO,
      about,
      now: String(s.now || "").trim(),
      location: String(s.location || "").trim(),
      timezone: String(s.timezone || "Europe/Istanbul"),
      email: String(s.email || "").trim(),
      socials,
      avatar: String(s.avatar || ""),
      portrait: String(s.portrait || ""),
      face: String(s.face || ""),
      facts: arr(s.facts).filter(f => f.k || f.v),
      words: list(s.words).length ? list(s.words) : DEFAULT_WORDS,
      cv: {
        experience: arr(cv.experience), education: arr(cv.education), projects: arr(cv.projects),
        languages: arr(cv.languages), skills: list(cv.skills), pdf: String(cv.pdf || "")
      },
      theme: {
        accent: /^#[0-9a-f]{6}$/i.test(theme.accent || "") ? theme.accent : "#e8b67a",
        intro: theme.intro !== false,
        marquee: list(theme.marquee).length ? list(theme.marquee) : DEFAULT_MARQUEE,
        sections
      }
    };
  }

  function legacyToPost(ph, i) {
    return {
      id: ph.id || `l${i}`, type: "photo",
      photos: [{ src: ph.src, thumb: ph.thumb, w: ph.w, h: ph.h }],
      title: ph.title || "", caption: ph.caption || "", place: ph.place || "", country: ph.country || "",
      taken: ph.taken || "", created: ph.date || "", featured: !!ph.featured,
      album: ph.category ? `c-${slug(ph.category)}` : "", _cat: ph.category || ""
    };
  }

  function normPost(p, i) {
    if (!p || typeof p !== "object") return null;
    const type = p.type === "note" ? "note" : "photo";
    const photos = (Array.isArray(p.photos) ? p.photos : []).filter(x => x && x.src).map(x => ({
      src: String(x.src), thumb: String(x.thumb || x.src), sm: String(x.sm || ""), w: +x.w || 1200, h: +x.h || 900, c: x.c || ""
    }));
    if (type === "photo" && !photos.length) return null;
    if (type === "note" && !String(p.text || "").trim()) return null;
    let cc = String(p.cc || "").toUpperCase();
    if (!/^[A-Z]{2}$/.test(cc)) cc = ccFromName(p.country);
    const country = String(p.country || "").trim() || (cc ? ccName(cc) : "");
    const created = String(p.created || "");
    const date = /^\d{4}-\d{2}/.test(p.taken || "") ? String(p.taken).slice(0, 10) : "";
    const sort = date || created.slice(0, 10);
    const geo = Array.isArray(p.geo) && p.geo.length === 2 && isFinite(p.geo[0]) && isFinite(p.geo[1]) ? [+p.geo[0], +p.geo[1]] : null;
    return {
      id: String(p.id || `p${i}`), type, photos,
      text: String(p.text || ""), mood: String(p.mood || ""),
      title: cleanTitle(p.title), caption: String(p.caption || "").trim(),
      place: cleanPlace(p.place), country, cc, geo,
      date, sort, created, album: String(p.album || ""),
      featured: !!p.featured, pinned: !!p.pinned, hidden: !!p.hidden
    };
  }

  const byDateDesc = (a, b) => (b.sort || "").localeCompare(a.sort || "") || (b.created || "").localeCompare(a.created || "") || (a.id < b.id ? 1 : -1);

  function build(siteRaw, doc, legacy) {
    const site = normSite(siteRaw);
    let raw = doc && Array.isArray(doc.posts) ? doc.posts.slice() : [];
    let albumsRaw = doc && Array.isArray(doc.albums) ? doc.albums.slice() : [];
    if (legacy && Array.isArray(legacy.photos)) {
      const have = new Set(raw.map(p => p && p.id));
      const cats = new Map();
      legacy.photos.forEach((ph, i) => {
        if (!ph || have.has(ph.id)) return;
        const p = legacyToPost(ph, i);
        if (p._cat && !cats.has(p.album)) cats.set(p.album, p._cat);
        raw.push(p);
      });
      cats.forEach((title, id) => { if (!albumsRaw.some(a => a && a.id === id)) albumsRaw.push({ id, title }); });
    }
    const all = raw.map(normPost).filter(Boolean);
    const seen = new Set();
    const posts = all.filter(p => !p.hidden && !seen.has(p.id) && seen.add(p.id)).sort(byDateDesc);
    const byId = new Map(posts.map(p => [p.id, p]));

    const photos = [];
    posts.forEach(p => p.photos.forEach((ph, i) => photos.push({ post: p, i, ph })));

    // albümler
    const albums = albumsRaw.filter(a => a && a.id && a.title).map(a => {
      const ps = posts.filter(p => p.album === a.id);
      return { kind: "album", key: String(a.id), title: String(a.title), desc: String(a.desc || ""), cover: a.cover || "", posts: ps };
    }).filter(a => a.posts.length);

    // ülkeler
    const cmap = new Map();
    posts.forEach(p => {
      if (!p.cc && !p.country) return;
      const key = p.cc ? p.cc.toLowerCase() : slug(p.country);
      if (!key) return;
      if (!cmap.has(key)) cmap.set(key, { kind: "ulke", key, cc: p.cc, title: p.cc ? ccName(p.cc) : p.country, posts: [] });
      cmap.get(key).posts.push(p);
    });
    const countries = [...cmap.values()];

    // yıllar
    const ymap = new Map();
    posts.forEach(p => {
      const y = (p.date || "").slice(0, 4);
      if (!/^\d{4}$/.test(y)) return;
      if (!ymap.has(y)) ymap.set(y, { kind: "yil", key: y, title: y, posts: [] });
      ymap.get(y).posts.push(p);
    });
    const years = [...ymap.values()].sort((a, b) => b.key.localeCompare(a.key));

    const decorate = c => {
      const ph = [];
      c.posts.forEach(p => p.photos.forEach((x, i) => ph.push({ post: p, i, ph: x })));
      c.photos = ph;
      const dates = c.posts.map(p => p.date).filter(Boolean).sort();
      c.first = dates[0] || ""; c.last = dates[dates.length - 1] || "";
      const pl = new Map();
      c.posts.forEach(p => { if (p.place) pl.set(p.place, (pl.get(p.place) || 0) + 1); });
      c.places = [...pl.entries()].sort((a, b) => b[1] - a[1]).map(x => x[0]);
      const coverPh = c.cover && ph.find(x => x.ph.src === c.cover);
      const feat = ph.find(x => x.post.featured);
      c.coverPhoto = (coverPh || feat || ph[0] || {}).ph || null;
      c.label = c.kind === "album" ? "Albüm" : c.kind === "ulke" ? "Ülke" : "Yıl";
      c.flag = c.kind === "ulke" ? flag(c.cc) : "";
      c.hash = `#/${c.kind}/${encodeURIComponent(c.key)}`;
      return c;
    };
    albums.forEach(decorate); countries.forEach(decorate); years.forEach(decorate);
    countries.sort((a, b) => b.photos.length - a.photos.length || (b.last || "").localeCompare(a.last || ""));

    // yerler (küre için)
    const pmap = new Map();
    posts.forEach(p => {
      if (!p.cc && !p.country) return;
      const k = `${slug(p.place)}|${p.cc || slug(p.country)}`;
      if (!pmap.has(k)) pmap.set(k, { place: p.place, country: p.country, cc: p.cc, geos: [], count: 0, key: p.cc ? p.cc.toLowerCase() : slug(p.country) });
      const o = pmap.get(k);
      o.count += Math.max(1, p.photos.length);
      if (p.geo) o.geos.push(p.geo);
    });
    const places = [...pmap.values()].map(o => {
      o.geo = o.geos.length ? [o.geos.reduce((s, g) => s + g[0], 0) / o.geos.length, o.geos.reduce((s, g) => s + g[1], 0) / o.geos.length] : null;
      delete o.geos;
      return o;
    });
    const cities = new Set(posts.filter(p => p.place).map(p => `${norm(p.place)}|${p.cc}`)).size;

    const highlights = [...albums, ...countries.slice().sort((a, b) => (b.last || "").localeCompare(a.last || ""))];
    const notes = posts.filter(p => p.type === "note");

    AE.data = { site, posts, byId, photos, albums, countries, years, places, cities, highlights, notes, all };
    return AE.data;
  }

  async function getJSON(url) {
    try {
      const r = await fetch(`${url}?v=${Date.now()}`, { cache: "no-store" });
      if (!r.ok) return null;
      return await r.json();
    } catch (e) { return null; }
  }
  AE.loadData = async function () {
    const [site, doc] = await Promise.all([getJSON("data/site.json"), getJSON("data/posts.json")]);
    const legacy = doc ? null : await getJSON("data/photos.json");
    return build(site, doc, legacy);
  };
  AE.build = build;
  AE.normSite = normSite;

  AE.coll = (kind, key) => {
    const D = AE.data;
    const list = kind === "album" ? D.albums : kind === "ulke" ? D.countries : kind === "yil" ? D.years : [];
    return list.find(c => c.key === key) || null;
  };
  AE.collOrder = () => [...AE.data.albums, ...AE.data.countries, ...AE.data.years];

  /* ================= görsel ================= */
  AE.img = (src, o = {}) => src
    ? `<img src="${esc(src)}" alt="${esc(o.alt || "")}" class="f ${o.cls || ""}" ${o.eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"${o.attrs ? " " + o.attrs : ""}>`
    : "";
  document.addEventListener("load", e => { const t = e.target; if (t && t.tagName === "IMG") t.classList.add("ok"); }, true);
  document.addEventListener("error", e => { const t = e.target; if (t && t.tagName === "IMG") t.classList.add("ok", "err"); }, true);
  AE.preload = src => new Promise(res => {
    if (!src) return res(false);
    const im = new Image();
    let done = false;
    const fin = ok => { if (!done) { done = true; res(ok); } };
    im.onload = () => fin(true);
    im.onerror = () => fin(false);
    im.src = src;
    if (im.decode) im.decode().then(() => fin(true)).catch(() => {});
  });
  AE.ratio = ph => clamp((ph.w || 4) / (ph.h || 3), 0.3, 4);
  // Üç boy: sm (720), thumb (1000), src (2400) — tarayıcı ekrana uygun olanı seçer
  AE.srcset = ph => {
    if (!ph) return "";
    const L = Math.max(ph.w, ph.h) || 1;
    const wAt = s => Math.round(ph.w * Math.min(1, s / L));
    const seen = new Set(), c = [];
    const add = (u, w) => { if (u && !seen.has(w)) { seen.add(w); c.push(`${esc(u)} ${w}w`); } };
    add(ph.sm, wAt(720));
    if (ph.thumb !== ph.src) add(ph.thumb, wAt(1000));
    add(ph.src, ph.w);
    return c.length > 1 ? `srcset="${c.join(", ")}"` : "";
  };
  AE.pic = (ph, sizes, o = {}) => AE.img(ph.sm || ph.thumb, Object.assign({}, o, { attrs: `${AE.srcset(ph)} sizes="${sizes}"${o.attrs ? " " + o.attrs : ""}` }));
  const scripts = new Map();
  AE.loadScript = src => {
    if (!scripts.has(src)) {
      scripts.set(src, new Promise((res, rej) => {
        const s = document.createElement("script");
        s.src = src; s.async = true;
        s.onload = () => res(true);
        s.onerror = () => { scripts.delete(src); rej(new Error("script " + src)); };
        document.head.appendChild(s);
      }));
    }
    return scripts.get(src);
  };
  AE.faceSrc = () => (AE.data && (AE.data.site.face || AE.data.site.avatar)) || "";

  /* ================= kapsam (view yaşam döngüsü) ================= */
  AE.scope = function (root) {
    const fns = [];
    let ctx = null;
    try { ctx = window.gsap ? gsap.context(() => {}, root) : null; } catch (e) { ctx = null; }
    const revealIO = "IntersectionObserver" in window ? new IntersectionObserver(ents => {
      ents.forEach(en => {
        if (!en.isIntersecting) return;
        en.target.classList.add("in");
        revealIO.unobserve(en.target);
        if (AE.fx && en.target.classList.contains("eyebrow")) AE.fx.scramble(en.target);
      });
    }, { rootMargin: "0px 0px -7% 0px", threshold: 0.08 }) : null;
    fns.push(() => revealIO && revealIO.disconnect());
    const S = {
      root,
      anim(fn) { if (ctx) ctx.add(fn); else if (window.gsap) fn(); },
      on(t, ev, fn, o) { t.addEventListener(ev, fn, o); fns.push(() => t.removeEventListener(ev, fn, o)); },
      every(fn, ms) { const id = setInterval(fn, ms); fns.push(() => clearInterval(id)); return id; },
      later(fn, ms) { const id = setTimeout(fn, ms); fns.push(() => clearTimeout(id)); return id; },
      io(cb, opts) { const o = new IntersectionObserver(cb, opts); fns.push(() => o.disconnect()); return o; },
      add(fn) { fns.push(fn); },
      reveal(scopeEl) {
        const sel = ".rv, .rv-mask, .split, .tile, .post, .jt, .skills, .langs, .cvl li, .tl-year, .eyebrow";
        const targets = scopeEl.matches && scopeEl.matches(sel) ? [scopeEl] : [];
        targets.push(...$$(sel, scopeEl));
        targets.forEach(t => { if (t.classList.contains("in")) return; if (revealIO && !reduced()) revealIO.observe(t); else t.classList.add("in"); });
      },
      destroy() {
        fns.splice(0).reverse().forEach(f => { try { f(); } catch (e) {} });
        try { ctx && ctx.revert(); } catch (e) {}
      }
    };
    return S;
  };

  /* ================= kelime bölme (yazı animasyonu) ================= */
  AE.split = function (node, startDelay = 0) {
    let i = 0;
    const walk = n => {
      Array.from(n.childNodes).forEach(c => {
        if (c.nodeType === 3) {
          const f = document.createDocumentFragment();
          c.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) { f.appendChild(document.createTextNode(" ")); return; }
            const w = document.createElement("span");
            w.className = "w";
            const s = document.createElement("span");
            s.textContent = part;
            s.style.setProperty("--i", i++);
            w.appendChild(s);
            f.appendChild(w);
          });
          c.replaceWith(f);
        } else if (c.nodeType === 1 && c.tagName !== "BR") walk(c);
      });
    };
    walk(node);
    if (startDelay) node.style.setProperty("--d", `${startDelay}ms`);
    node.classList.add("split");
    return node;
  };
  // Harf harf (başlıklar için)
  AE.chars = (text, start = 0) => [...String(text)].map((ch, k) => ch === " " ? " " : `<span class="ch" style="--i:${start + k}">${esc(ch)}</span>`).join("");

  /* ================= kaydırmalı galeri (carousel) ================= */
  AE.carousel = function (root, opts = {}) {
    const track = $(".car-track", root);
    const n = track ? track.children.length : 0;
    let idx = 0;
    const api = { get index() { return idx; }, count: n, go() {}, destroy() {}, onChange: null };
    if (!track || n < 2) return api;
    root.insertAdjacentHTML("beforeend",
      `<button class="car-btn p" aria-label="Önceki fotoğraf" disabled>${AE.icon.chevL}</button><button class="car-btn n" aria-label="Sonraki fotoğraf">${AE.icon.chevR}</button>` +
      `<div class="car-dots">${Array.from({ length: Math.min(n, 12) }, (_, i) => `<i class="${i ? "" : "on"}"></i>`).join("")}</div>` +
      (opts.counter ? `<span class="badge car-count">1/${n}</span>` : ""));
    const dots = $$(".car-dots i", root), bp = $(".car-btn.p", root), bn = $(".car-btn.n", root), cnt = $(".car-count", root);
    const update = () => {
      const w = track.clientWidth || 1;
      const i = clamp(Math.round(track.scrollLeft / w), 0, n - 1);
      if (i === idx && bp.dataset.init) return;
      bp.dataset.init = 1;
      idx = i;
      dots.forEach((d, k) => d.classList.toggle("on", k === Math.min(i, dots.length - 1)));
      bp.disabled = i === 0; bn.disabled = i === n - 1;
      if (cnt) cnt.textContent = `${i + 1}/${n}`;
      if (api.onChange) api.onChange(i);
    };
    let raf = 0;
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; update(); }); };
    track.addEventListener("scroll", onScroll, { passive: true });
    const go = (i, instant) => {
      i = clamp(i, 0, n - 1);
      track.scrollTo({ left: i * track.clientWidth, behavior: instant || reduced() ? "auto" : "smooth" });
      if (instant) { idx = -1; update(); }
    };
    bp.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); go(idx - 1); });
    bn.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); go(idx + 1); });
    api.go = go;
    api.destroy = () => track.removeEventListener("scroll", onScroll);
    update();
    return api;
  };

  /* ================= kaydırma kilidi, toast, paylaş ================= */
  let locks = 0;
  AE.lock = on => {
    locks = Math.max(0, locks + (on ? 1 : -1));
    document.documentElement.classList.toggle("lock", locks > 0);
  };
  let toastT = 0;
  AE.toast = msg => {
    const t = $("#toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("on");
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove("on"), 2600);
  };
  AE.siteURL = (hash = "") => `${location.origin}${location.pathname}${hash}`;
  AE.share = async (hash, title) => {
    const url = AE.siteURL(hash);
    if (navigator.share && AE.mq("(hover: none)")) {
      try { await navigator.share({ title: title || document.title, url }); return; } catch (e) { if (e && e.name === "AbortError") return; }
    }
    try { await navigator.clipboard.writeText(url); AE.toast("Bağlantı kopyalandı ✓"); }
    catch (e) {
      const ta = document.createElement("textarea");
      ta.value = url; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); AE.toast("Bağlantı kopyalandı ✓"); } catch (e2) { AE.toast(url); }
      ta.remove();
    }
  };

  /* ================= saat ================= */
  AE.clock = () => {
    try {
      return new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: (AE.data && AE.data.site.timezone) || "Europe/Istanbul" }).format(new Date());
    } catch (e) {
      const d = new Date();
      return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    }
  };

  /* ================= vurgu rengi ================= */
  AE.applyAccent = hex => {
    if (!/^#[0-9a-f]{6}$/i.test(hex || "")) return;
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const root = document.documentElement.style;
    root.setProperty("--accent", hex);
    root.setProperty("--accent-rgb", `${r}, ${g}, ${b}`);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    root.setProperty("--on-accent", lum > 0.6 ? "#1a130b" : "#fff");
    try { localStorage.setItem("ae_accent", hex); } catch (e) {}
  };

  /* ================= ortak parçalar ================= */
  AE.avatarHTML = (cls = "av") => {
    const s = AE.data.site;
    const src = s.avatar || s.portrait;
    return `<span class="${cls}">${src ? AE.img(src, { alt: s.name }) : esc(initials(s.name))}</span>`;
  };
  AE.placeLine = p => [p.place, p.country].filter(Boolean).join(", ");
  AE.faceHTML = (cls = "") => {
    const f = AE.faceSrc();
    return `<span class="face ${cls}">${f ? `<img src="${esc(f)}" alt="" draggable="false">` : `<b>${esc(initials(AE.data.site.name))}</b>`}</span>`;
  };
  AE.footerHTML = () => {
    const s = AE.data.site;
    return `<div class="foot-big" aria-hidden="true"><span>${esc(s.name)}</span></div>
      <footer class="foot">
        <span>© ${new Date().getFullYear()} ${esc(s.name)}</span>
        <button type="button" class="poke" data-poke aria-label="Beni dürt">${AE.faceHTML("poke-face")}<span class="poke-txt">Beni dürt</span><span class="poke-bubble" aria-live="polite"></span></button>
        <span class="foot-meta"><i class="live-dot"></i>${esc(s.location || "Türkiye")} · <span data-clock>${AE.clock()}</span><span data-weather></span><span class="visits" data-visits hidden> · ziyaretçi #<b></b></span></span>
        <span class="foot-links"><a href="#/oyun" data-cur="Oyna">Oyun</a><a href="#top" data-top>Başa dön ↑</a></span>
      </footer>`;
  };
})();
