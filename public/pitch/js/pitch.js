// TriPoint Innovations — Hunter Radar Pitch Deck viewer

(function () {
  const TOTAL_SLIDES = 15;

  // Used for alt text / accessibility — mirrors the deck's own section labels.
  const SLIDE_TITLES = {
    1: "Title — Hunter Radar: The Hunter Safety Device and App",
    2: "The Problem",
    3: "Our Solution",
    4: "Market Opportunity",
    5: "Business Model",
    6: "Competition",
    7: "Traction",
    8: "Go-to-Market Strategy",
    9: "The Team",
    10: "Financials — Path to Profitability",
    11: "Vision",
    12: "The Ask",
    13: "Thank You / Q&A",
    14: "Financials — Path to Profitability (detail)",
    15: "Our Solution (appendix)",
  };

  const el = (id) => document.getElementById(id);
  const slideImage = el("pitch-slide-image");
  const counterCurrent = el("pitch-counter-current");
  const counterTotal = el("pitch-counter-total");
  const btnPrev = el("btn-prev");
  const btnNext = el("btn-next");
  const btnFullscreen = el("btn-fullscreen");
  const filmstrip = el("pitch-filmstrip");
  const stage = el("pitch-stage");

  let current = 1;

  counterTotal.textContent = TOTAL_SLIDES;

  // Preload every slide image up front — they're small (a few hundred KB
  // total) and this makes filmstrip jumps feel instant.
  const preloaded = {};
  function preload(n) {
    if (preloaded[n]) return;
    const img = new Image();
    img.src = `/pitch/images/slide-${n}.jpg`;
    preloaded[n] = img;
  }
  for (let i = 1; i <= TOTAL_SLIDES; i++) preload(i);

  function buildFilmstrip() {
    for (let i = 1; i <= TOTAL_SLIDES; i++) {
      const thumb = document.createElement("img");
      thumb.src = `/pitch/images/thumb-${i}.jpg`;
      thumb.alt = `Slide ${i}: ${SLIDE_TITLES[i] || ""}`;
      thumb.dataset.slide = i;
      thumb.addEventListener("click", () => goTo(i));
      filmstrip.appendChild(thumb);
    }
  }

  function goTo(n) {
    current = Math.min(Math.max(n, 1), TOTAL_SLIDES);
    slideImage.src = `/pitch/images/slide-${current}.jpg`;
    slideImage.alt = `Slide ${current}: ${SLIDE_TITLES[current] || ""}`;
    counterCurrent.textContent = current;

    btnPrev.disabled = current === 1;
    btnNext.disabled = current === TOTAL_SLIDES;

    filmstrip.querySelectorAll("img").forEach((thumb) => {
      const isActive = Number(thumb.dataset.slide) === current;
      thumb.classList.toggle("is-active", isActive);
      if (isActive) thumb.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    });
  }

  btnPrev.addEventListener("click", () => goTo(current - 1));
  btnNext.addEventListener("click", () => goTo(current + 1));

  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") goTo(current - 1);
    if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); goTo(current + 1); }
    if (e.key === "Home") goTo(1);
    if (e.key === "End") goTo(TOTAL_SLIDES);
  });

  // Touch swipe support
  let touchStartX = null;
  stage.addEventListener("touchstart", (e) => { touchStartX = e.touches[0].clientX; }, { passive: true });
  stage.addEventListener("touchend", (e) => {
    if (touchStartX === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(delta) > 40) {
      if (delta < 0) goTo(current + 1);
      else goTo(current - 1);
    }
    touchStartX = null;
  }, { passive: true });

  // Fullscreen
  btnFullscreen.addEventListener("click", () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
      btnFullscreen.textContent = "Exit Fullscreen";
    } else {
      document.exitFullscreen?.();
      btnFullscreen.textContent = "Fullscreen";
    }
  });
  document.addEventListener("fullscreenchange", () => {
    btnFullscreen.textContent = document.fullscreenElement ? "Exit Fullscreen" : "Fullscreen";
  });

  buildFilmstrip();
  goTo(1);
})();
