// TriPoint Innovations — shared site behavior
// Mobile nav toggle, scroll-triggered reveals, stat count-up, contact form.

document.addEventListener("DOMContentLoaded", () => {
  initNavToggle();
  initReveals();
  initCountUps();
  initContactForm();
});

function initNavToggle() {
  const header = document.querySelector(".site-header");
  const toggle = document.querySelector(".nav__toggle");
  if (!header || !toggle) return;

  toggle.addEventListener("click", () => {
    const isOpen = header.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });

  // Close menu when a link is tapped
  header.querySelectorAll(".nav__links a").forEach((link) => {
    link.addEventListener("click", () => header.classList.remove("is-open"));
  });
}

function initReveals() {
  const targets = document.querySelectorAll(".reveal");
  if (!targets.length) return;

  if (!("IntersectionObserver" in window)) {
    targets.forEach((el) => el.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
  );

  targets.forEach((el) => observer.observe(el));
}

function initCountUps() {
  const stats = document.querySelectorAll("[data-count-to]");
  if (!stats.length || !("IntersectionObserver" in window)) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        animateCount(entry.target);
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.6 }
  );

  stats.forEach((el) => observer.observe(el));
}

function animateCount(el) {
  const target = el.getAttribute("data-count-to");
  const numericTarget = parseFloat(target);
  if (Number.isNaN(numericTarget)) return; // non-numeric stat, leave as-is

  const suffix = target.replace(/^-?[\d.]+/, "");
  const duration = 900;
  const start = performance.now();

  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = Math.round(numericTarget * eased);
    el.textContent = `${value}${suffix}`;
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function initContactForm() {
  const form = document.querySelector("#contact-form");
  if (!form) return;

  const statusEl = form.querySelector(".form-status");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitBtn = form.querySelector("button[type='submit']");
    const payload = Object.fromEntries(new FormData(form).entries());

    setStatus(statusEl, "Sending...", null);
    if (submitBtn) submitBtn.disabled = true;

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.ok) {
        setStatus(statusEl, "Message sent — we'll be in touch soon.", "success");
        form.reset();
      } else {
        setStatus(statusEl, data.error || "Something went wrong. Please try again.", "error");
      }
    } catch (err) {
      setStatus(statusEl, "Network error. Please try again in a moment.", "error");
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

function setStatus(el, message, state) {
  if (!el) return;
  el.textContent = message;
  if (state) {
    el.setAttribute("data-state", state);
  } else {
    el.removeAttribute("data-state");
  }
}
