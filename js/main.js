/* =========================================================
   PRESTİJ PVC — Etkileşimler
   1) Header / ilerleme / aktif menü   2) Mobil menü
   3) Scroll beliriş animasyonu        4) Sayaçlar
   5) Buton dalga (ripple) efekti      6) Sonsuz kayan şerit
   7) Servis durumu (Türkiye saati)
   ========================================================= */
(function () {
  "use strict";

  const $  = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- 1) HEADER, İLERLEME ÇİZGİSİ, AKTİF MENÜ ---- */
  const header   = $("#header");
  const progress = $("#progress");
  const toTop    = $("#toTop");
  const navLinks = $$(".nav a:not(.btn)");

  function onScroll() {
    const y = window.scrollY;
    header.classList.toggle("is-stuck", y > 40);
    toTop.classList.toggle("is-visible", y > 600);

    const max = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.width = (max > 0 ? (y / max) * 100 : 0) + "%";
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Görünen bölüme göre menüde aktif link
  const sections = navLinks
    .map(a => document.getElementById(a.getAttribute("href").slice(1)))
    .filter(Boolean);

  if ("IntersectionObserver" in window) {
    const spy = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        navLinks.forEach(a =>
          a.classList.toggle("is-active", a.getAttribute("href") === "#" + en.target.id)
        );
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    sections.forEach(s => spy.observe(s));
  }

  toTop.addEventListener("click", () =>
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" })
  );

  /* ---------- 2) MOBİL MENÜ ------------------------------ */
  const navToggle = $("#navToggle");
  const closeNav = () => {
    document.body.classList.remove("nav-open");
    navToggle.setAttribute("aria-expanded", "false");
    navToggle.setAttribute("aria-label", "Menüyü aç");
  };
  navToggle.addEventListener("click", () => {
    const open = document.body.classList.toggle("nav-open");
    navToggle.setAttribute("aria-expanded", String(open));
    navToggle.setAttribute("aria-label", open ? "Menüyü kapat" : "Menüyü aç");
  });
  navLinks.forEach(a => a.addEventListener("click", closeNav));

  /* ---------- 3) SCROLL BELİRİŞ (fade-in + slide-up) ----- */
  function watchReveals() {
    const items = $$(".reveal:not(.is-in)");
    if (!("IntersectionObserver" in window) || reduceMotion) {
      items.forEach(el => el.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        en.target.classList.add("is-in");
        obs.unobserve(en.target);
      });
    }, { threshold: 0.14, rootMargin: "0px 0px -60px 0px" });
    items.forEach(el => io.observe(el));
  }

  /* ---------- 4) SAYAÇLAR -------------------------------- */
  function runCounter(el) {
    const target = parseInt(el.dataset.count, 10);
    const suffix = el.dataset.suffix || "";
    if (reduceMotion) { el.textContent = target.toLocaleString("tr-TR") + suffix; return; }

    const dur = 1500;
    const t0 = performance.now();
    (function tick(now) {
      const p = Math.min((now - t0) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased).toLocaleString("tr-TR") + suffix;
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  }
  const counters = $$("[data-count]");
  if ("IntersectionObserver" in window) {
    const cio = new IntersectionObserver((entries, obs) => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        runCounter(en.target);
        obs.unobserve(en.target);
      });
    }, { threshold: 0.5 });
    counters.forEach(c => cio.observe(c));
  } else {
    counters.forEach(runCounter);
  }

  /* ---------- 5) BUTON DALGA (RIPPLE) -------------------- */
  document.addEventListener("pointerdown", e => {
    const btn = e.target.closest(".btn");
    if (!btn || reduceMotion) return;
    const r = btn.getBoundingClientRect();
    const size = Math.max(r.width, r.height);
    const wave = document.createElement("span");
    wave.className = "ripple";
    wave.style.width = wave.style.height = size + "px";
    wave.style.left = (e.clientX - r.left - size / 2) + "px";
    wave.style.top  = (e.clientY - r.top  - size / 2) + "px";
    btn.appendChild(wave);
    wave.addEventListener("animationend", () => wave.remove());
  });

  /* ---------- 6) SONSUZ KAYAN ŞERİT --------------------- */
  // İçeriği ikiye katlayarak kesintisiz döngü sağlar (%50 kaydırma)
  ["#strip"].forEach(sel => {
    const track = $(sel);
    if (!track) return;
    Array.from(track.children).forEach(child => {
      const copy = child.cloneNode(true);
      copy.setAttribute("aria-hidden", "true");   // ekran okuyucuya tekrar okutma
      $$("[id]", copy).forEach(el => el.removeAttribute("id"));
      track.appendChild(copy);
    });
  });

  /* ---------- 7) SERVİS DURUMU (Türkiye saatine göre) ----
     Açık: Pazartesi–Cumartesi 08:00–21:00. Pazar kapalı.
     Saat, ziyaretçinin cihaz saatinden bağımsız olarak
     Europe/Istanbul saat diliminden okunur.                */
  const durumKutu = $("#servis-durumu");

  const ACILIS = 8 * 60;    // 08:00
  const KAPANIS = 21 * 60;  // 21:00
  const GUNLER = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

  /* Europe/Istanbul'daki gün (0=Pazar) ve dakika değerini döndürür. */
  function turkiyeZamani() {
    const parca = new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Istanbul",
      weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false
    }).formatToParts(new Date());

    const al = tur => (parca.find(p => p.type === tur) || {}).value;
    const gunler = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const gun = gunler[al("weekday")];
    // Bazı motorlar gece yarısını "24" olarak verir; 0'a çeviriyoruz.
    const dakika = (parseInt(al("hour"), 10) % 24) * 60 + parseInt(al("minute"), 10);

    return gun === undefined ? null : { gun, dakika };
  }

  /* Kapalıyken bir sonraki açılışın ne zaman olduğunu yazar. */
  function sonrakiAcilis(gun, dakika) {
    if (gun !== 0 && dakika < ACILIS) return "Bugün 08:00'de açılıyoruz";
    // Bugünün işi bitti (ya da Pazar) — sıradaki açık günü bul.
    let ileri = 1;
    while (((gun + ileri) % 7) === 0) ileri++;   // Pazar'ı atla
    const hedef = (gun + ileri) % 7;
    return (ileri === 1 ? "Yarın" : GUNLER[hedef]) + " 08:00'de açılıyoruz";
  }

  function durumuYaz() {
    if (!durumKutu) return;
    const z = turkiyeZamani();
    if (!z) return;   // saat dilimi okunamadıysa HTML'deki genel bilgi kalsın

    const acik = z.gun !== 0 && z.dakika >= ACILIS && z.dakika < KAPANIS;

    $("[data-durum-baslik]", durumKutu).textContent =
      acik ? "Şu an servis açık" : "Şu an kapalıyız";
    $("[data-durum-alt]", durumKutu).textContent =
      acik ? "Bugün 21:00'e kadar · Yerinde keşif"
           : sonrakiAcilis(z.gun, z.dakika);

    durumKutu.classList.toggle("is-kapali", !acik);
  }

  durumuYaz();
  setInterval(durumuYaz, 60000);   // dakikada bir tazele

  /* ---------- Yıl + beliriş gözlemcisini başlat ---------- */
  $("#year").textContent = new Date().getFullYear();
  watchReveals();
})();
