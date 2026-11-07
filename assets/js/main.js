(() => {
  "use strict";

  const root = document.documentElement;
  const config = window.GARAGE78_CONFIG || {};
  const themeButton = document.querySelector(".theme-toggle");
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const menuButton = document.querySelector(".menu-toggle");
  const nav = document.querySelector(".nav");
  const bookingForm = document.querySelector("#booking-form");
  const formResult = document.querySelector("#form-result");
  const formSummary = document.querySelector("#form-summary");
  const copyButton = document.querySelector("#copy-request");
  const copyFeedback = document.querySelector("#copy-feedback");
  const formHint = document.querySelector("#form-hint");
  const consentText = document.querySelector("#consent-text");
  const phoneInput = bookingForm?.querySelector('input[name="phone"]');
  const submitButton = bookingForm?.querySelector('button[type="submit"]');
  const formStartedAt = Date.now();
  let preparedRequest = "";
  let requestInProgress = false;

  const asHttpsUrl = (value) => {
    try {
      const url = new URL(String(value || ""), window.location.href);
      return url.protocol === "https:" ? url.href : "";
    } catch {
      return "";
    }
  };

  const formEndpoint = asHttpsUrl(config.formEndpoint);
  const privacyUrl = asHttpsUrl(config.privacyUrl);
  const formIsConfigured = Boolean(formEndpoint && privacyUrl);

  // Optional business details are injected from site-config.js, never invented here.
  const headerPhone = document.querySelector("#header-phone");
  const footerPhone = document.querySelector("#footer-phone");
  const footerEmail = document.querySelector("#footer-email");
  const footerAddress = document.querySelector("#footer-address");
  const footerHours = document.querySelector("#footer-hours");
  const footerMap = document.querySelector("#footer-map");

  const phoneDigits = String(config.phone || "").replace(/\D/g, "");
  const displayPhone = String(config.displayPhone || config.phone || "").trim();
  if (phoneDigits.length >= 10) {
    if (headerPhone) {
      headerPhone.href = "tel:+" + phoneDigits;
      headerPhone.textContent = displayPhone || "Позвонить";
      headerPhone.setAttribute("aria-label", "Позвонить: " + (displayPhone || phoneDigits));
    }
    if (footerPhone) {
      footerPhone.href = "tel:+" + phoneDigits;
      footerPhone.textContent = displayPhone || "Позвонить";
      footerPhone.hidden = false;
    }
  }

  const email = String(config.email || "").trim();
  if (footerEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    footerEmail.href = "mailto:" + email;
    footerEmail.textContent = email;
    footerEmail.hidden = false;
  }

  const address = String(config.address || "").trim();
  if (footerAddress && address) footerAddress.textContent = address;

  const hours = String(config.workingHours || "").trim();
  if (footerHours && hours) {
    footerHours.textContent = hours;
    footerHours.hidden = false;
  }

  const mapUrl = asHttpsUrl(config.mapUrl);
  if (footerMap && mapUrl) {
    footerMap.href = mapUrl;
    footerMap.hidden = false;
  }

  // Theme: use the saved choice first, then the operating system preference.
  const getPreferredTheme = () => {
    try {
      const saved = localStorage.getItem("garage78-theme");
      if (saved === "light" || saved === "dark") return saved;
    } catch (_) {
      // Storage may be unavailable in private browsing or restricted contexts.
    }
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  };

  const applyTheme = (theme) => {
    root.dataset.theme = theme;
    if (themeMeta) themeMeta.setAttribute("content", theme === "dark" ? "#171d19" : "#f3f2ec");
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

  // Mobile navigation, including Escape and outside-click handling.
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

  // Russian phone mask. Input is formatted locally until the user submits.
  phoneInput?.addEventListener("input", () => {
    let digits = phoneInput.value.replace(/\D/g, "");
    if (!digits) {
      phoneInput.value = "";
      phoneInput.setCustomValidity("");
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
    phoneInput.setCustomValidity("");
  });

  const getFormData = () => {
    const data = new FormData(bookingForm);
    return {
      name: String(data.get("name") || "").trim(),
      phone: String(data.get("phone") || "").trim(),
      service: String(data.get("service") || "").trim(),
      message: String(data.get("message") || "").trim(),
      website: String(data.get("website") || "").trim(),
      consent: Boolean(data.get("consent"))
    };
  };

  const buildRequest = (data) => [
    "Заявка в " + (config.businessName || "GARAGE 78"),
    "",
    "Имя: " + data.name,
    "Телефон: " + data.phone,
    "Услуга: " + data.service,
    "Автомобиль / описание: " + (data.message || "Не указано")
  ].join("\n");

  if (formIsConfigured && consentText) {
    consentText.textContent = "Даю согласие на обработку персональных данных *";
    const policyLink = document.querySelector("#privacy-link");
    if (policyLink) {
      policyLink.href = privacyUrl;
      policyLink.hidden = false;
    }
    if (formHint) formHint.textContent = "Заявка будет передана администратору сервиса. Поля со звёздочкой обязательны.";
    if (submitButton) submitButton.innerHTML = 'Отправить заявку <span aria-hidden="true">↗</span>';
    document.querySelector(".booking-assurance b")?.replaceChildren(document.createTextNode("Заявка передаётся защищённо"));
    const assuranceText = document.querySelector(".booking-assurance > span:last-child");
    if (assuranceText) {
      assuranceText.innerHTML = "<b>Без публикации ваших данных</b><br>Контактная информация направляется только в настроенный канал приёма заявок.";
    }
  } else if (config.formEndpoint && formHint) {
    formHint.textContent = "Приём заявок не активирован: настройте HTTPS endpoint и ссылку на опубликованную политику конфиденциальности.";
  }

  const showFormResult = (title, message, allowCopy) => {
    const resultTitle = formResult?.querySelector("b");
    if (resultTitle) resultTitle.textContent = title;
    if (formSummary) formSummary.textContent = message;
    if (copyButton) copyButton.hidden = !allowCopy;
    if (copyFeedback) copyFeedback.textContent = "";
    if (formResult) {
      formResult.hidden = false;
      formResult.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  };

  bookingForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (requestInProgress) return;

    if (!bookingForm.checkValidity()) {
      bookingForm.reportValidity();
      return;
    }

    const data = getFormData();
    const digits = data.phone.replace(/\D/g, "");
    if (digits.length !== 11 || digits[0] !== "7") {
      phoneInput?.setCustomValidity("Введите российский номер в формате +7 (___) ___-__-__.");
      phoneInput?.reportValidity();
      return;
    }

    preparedRequest = buildRequest(data);

    if (!formIsConfigured) {
      showFormResult(
        "Сообщение подготовлено",
        "Это демонстрационный режим: данные не отправлены и не покинули ваш браузер. Скопируйте текст заявки и передайте его администратору вручную.",
        true
      );
      return;
    }

    requestInProgress = true;
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.setAttribute("aria-busy", "true");
      submitButton.dataset.originalText = submitButton.textContent.trim();
      submitButton.textContent = "Отправляем…";
    }

    try {
      const response = await fetch(formEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, startedAt: formStartedAt })
      });
      let result = {};
      try { result = await response.json(); } catch (_) {}
      if (!response.ok || result.ok !== true) {
        throw new Error(result.error || "Не удалось отправить заявку.");
      }

      preparedRequest = "";
      bookingForm.reset();
      showFormResult("Заявка отправлена", "Спасибо! Заявка доставлена администратору. С вами свяжутся по указанному номеру.", false);
    } catch (error) {
      showFormResult(
        "Не удалось отправить заявку",
        (error instanceof Error ? error.message : "Сервис временно недоступен.") +
          " Данные не были сохранены на сайте. Скопируйте подготовленный текст и передайте его администратору другим способом.",
        true
      );
    } finally {
      requestInProgress = false;
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.removeAttribute("aria-busy");
        submitButton.innerHTML = formIsConfigured
          ? 'Отправить заявку <span aria-hidden="true">↗</span>'
          : 'Подготовить заявку <span aria-hidden="true">↗</span>';
      }
    }
  });

  const fallbackCopy = (text) => {
    const temporary = document.createElement("textarea");
    temporary.value = text;
    temporary.setAttribute("readonly", "");
    temporary.style.position = "fixed";
    temporary.style.opacity = "0";
    temporary.style.pointerEvents = "none";
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
        if (copyFeedback) copyFeedback.textContent = "Заявка скопирована в буфер обмена.";
      } else if (fallbackCopy(preparedRequest)) {
        if (copyFeedback) copyFeedback.textContent = "Заявка скопирована в буфер обмена.";
      } else if (copyFeedback) {
        copyFeedback.textContent = "Не удалось скопировать автоматически. Выделите текст вручную.";
      }
    } catch (_) {
      if (copyFeedback) {
        copyFeedback.textContent = fallbackCopy(preparedRequest)
          ? "Заявка скопирована в буфер обмена."
          : "Не удалось скопировать автоматически. Выделите текст вручную.";
      }
    }
  });

  // Progressive reveal. Content stays visible if IntersectionObserver is unsupported.
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
          link.classList.toggle("is-active", link.getAttribute("href") === "#" + entry.target.id);
        });
      });
    }, { rootMargin: "-30% 0px -60% 0px" });
    sections.forEach((section) => sectionObserver.observe(section));
  }

  // FAQ: keep one answer open at a time.
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
