(() => {
  "use strict";

  const root = document.documentElement;
  const themeButton = document.querySelector(".theme-toggle");
  const menuButton = document.querySelector(".menu-toggle");
  const nav = document.querySelector(".nav");
  const bookingForm = document.querySelector("#booking-form");
  const formResult = document.querySelector("#form-result");
  const formSummary = document.querySelector("#form-summary");
  const copyButton = document.querySelector("#copy-request");
  const copyFeedback = document.querySelector("#copy-feedback");
  const phoneInput = bookingForm?.querySelector('input[name="phone"]');
  let preparedRequest = "";

  // Theme: respect a saved preference, otherwise use the operating system setting.
  const getPreferredTheme = () => {
    try {
      const saved = localStorage.getItem("garage78-theme");
      if (saved === "light" || saved === "dark") return saved;
    } catch (_) {}
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  };

  const applyTheme = (theme) => {
    root.dataset.theme = theme;
    if (themeButton) {
      const nextAction = theme === "dark" ? "Включить светлую тему" : "Включить тёмную тему";
      themeButton.setAttribute("aria-label", nextAction);
      themeButton.setAttribute("title", nextAction);
    }
  };

  applyTheme(getPreferredTheme());

  themeButton?.addEventListener("click", () => {
    const nextTheme = root.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
    try {
      localStorage.setItem("garage78-theme", nextTheme);
    } catch (_) {
      // The theme still works for this page view when storage is unavailable.
    }
  });

  // Mobile navigation.
  const closeMenu = () => {
    nav?.classList.remove("is-open");
    menuButton?.setAttribute("aria-expanded", "false");
    menuButton?.setAttribute("aria-label", "Открыть меню");
  };

  menuButton?.addEventListener("click", () => {
    const isOpen = menuButton.getAttribute("aria-expanded") === "true";
    menuButton.setAttribute("aria-expanded", String(!isOpen));
    menuButton.setAttribute("aria-label", isOpen ? "Открыть меню" : "Закрыть меню");
    nav?.classList.toggle("is-open", !isOpen);
  });

  nav?.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });
  document.addEventListener("click", (event) => {
    if (nav?.classList.contains("is-open") &&
        !nav.contains(event.target) &&
        !menuButton?.contains(event.target)) closeMenu();
  });

  // Selecting a service card pre-fills the booking form.
  document.querySelectorAll("[data-service]").forEach((button) => {
    button.addEventListener("click", () => {
      const serviceSelect = bookingForm?.elements.namedItem("service");
      if (!serviceSelect) return;
      const requestedService = button.dataset.service;
      const matchingOption = Array.from(serviceSelect.options).find(
        (option) => option.value === requestedService || option.textContent.trim() === requestedService
      );
      if (matchingOption) serviceSelect.value = matchingOption.value || matchingOption.textContent.trim();
      document.querySelector("#booking")?.scrollIntoView({ behavior: "smooth", block: "start" });
      window.setTimeout(() => bookingForm?.elements.namedItem("name")?.focus({ preventScroll: true }), 450);
    });
  });

  // A simple Russian phone mask. It formats input locally and sends nothing.
  phoneInput?.addEventListener("input", () => {
    let digits = phoneInput.value.replace(/\D/g, "");
    if (!digits) {
      phoneInput.value = "";
      return;
    }
    if (digits[0] === "8") digits = "7" + digits.slice(1);
    else if (digits[0] !== "7") digits = "7" + digits;
    digits = digits.slice(0, 11);
    const local = digits.slice(1);
    let formatted = "+7";
    if (local.length) formatted += " (" + local.slice(0, 3);
    if (local.length >= 3) formatted += ")";
    if (local.length > 3) formatted += " " + local.slice(3, 6);
    if (local.length > 6) formatted += "-" + local.slice(6, 8);
    if (local.length > 8) formatted += "-" + local.slice(8, 10);
    phoneInput.value = formatted;
  });

  const buildRequest = (form) => {
    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    const phone = String(data.get("phone") || "").trim();
    const service = String(data.get("service") || "").trim();
    const message = String(data.get("message") || "").trim();
    return [
      "Заявка в GARAGE 78",
      "",
      "Имя: " + name,
      "Телефон: " + phone,
      "Услуга: " + service,
      "Автомобиль / описание: " + (message || "Не указано")
    ].join("\n");
  };

  bookingForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!bookingForm.checkValidity()) {
      bookingForm.reportValidity();
      return;
    }

    const digits = (phoneInput?.value || "").replace(/\D/g, "");
    if (digits.length !== 11 || digits[0] !== "7") {
      phoneInput?.setCustomValidity("Введите российский номер в формате +7 (___) ___-__-__.");
      phoneInput?.reportValidity();
      phoneInput?.addEventListener("input", () => phoneInput.setCustomValidity(""), { once: true });
      return;
    }

    preparedRequest = buildRequest(bookingForm);
    formSummary.textContent = "Проверьте текст ниже. Скопируйте его и отправьте администратору удобным способом.";
    formResult.hidden = false;
    copyFeedback.textContent = "";
    formResult.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  const fallbackCopy = (text) => {
    const temporary = document.createElement("textarea");
    temporary.value = text;
    temporary.setAttribute("readonly", "");
    temporary.style.position = "fixed";
    temporary.style.opacity = "0";
    document.body.appendChild(temporary);
    temporary.select();
    let copied = false;
    try { copied = document.execCommand("copy"); } catch (_) {}
    temporary.remove();
    return copied;
  };

  copyButton?.addEventListener("click", async () => {
    if (!preparedRequest) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(preparedRequest);
        copyFeedback.textContent = "Заявка скопирована в буфер обмена.";
      } else if (fallbackCopy(preparedRequest)) {
        copyFeedback.textContent = "Заявка скопирована в буфер обмена.";
      } else {
        copyFeedback.textContent = "Не удалось скопировать автоматически. Выделите текст вручную.";
      }
    } catch (_) {
      copyFeedback.textContent = fallbackCopy(preparedRequest)
        ? "Заявка скопирована в буфер обмена."
        : "Не удалось скопировать автоматически. Выделите текст вручную.";
    }
  });

  // Progressive reveal; content remains visible if IntersectionObserver is unavailable.
  const revealItems = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -35px 0px" });
    revealItems.forEach((item) => revealObserver.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add("is-visible"));
  }

  // Keep the active navigation item in sync with the visible section.
  const navLinks = Array.from(document.querySelectorAll(".nav a"));
  const sections = navLinks
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);

  if ("IntersectionObserver" in window && sections.length) {
    const sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        navLinks.forEach((link) => {
          const active = link.getAttribute("href") === "#" + entry.target.id;
          link.classList.toggle("is-active", active);
        });
      });
    }, { rootMargin: "-30% 0px -60% 0px" });
    sections.forEach((section) => sectionObserver.observe(section));
  }

  // FAQ: keep one answer open at a time for a tidy reading flow.
  document.querySelectorAll(".faq-item").forEach((item) => {
    item.addEventListener("toggle", () => {
      if (!item.open) return;
      document.querySelectorAll(".faq-item").forEach((other) => {
        if (other !== item) other.open = false;
      });
    });
  });

  const backToTop = document.querySelector(".back-to-top");
  const updateBackToTop = () => {
    backToTop?.classList.toggle("is-visible", window.scrollY > 650);
  };
  window.addEventListener("scroll", updateBackToTop, { passive: true });
  updateBackToTop();
  backToTop?.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

  const year = document.querySelector("#year");
  if (year) year.textContent = String(new Date().getFullYear());
})();
