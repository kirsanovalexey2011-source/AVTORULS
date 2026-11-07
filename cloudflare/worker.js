/**
 * GARAGE 78 — Cloudflare Worker endpoint for the booking form.
 *
 * Required Worker secrets / variables:
 *   TELEGRAM_BOT_TOKEN  (secret)
 *   TELEGRAM_CHAT_ID    (secret)
 *   ALLOWED_ORIGINS     (comma-separated exact origins, without trailing slash)
 *
 * Example ALLOWED_ORIGINS:
 *   https://kirsanovalexey2011-source.github.io
 *
 * Deploy separately from GitHub Pages. Never put Telegram credentials in site-config.js.
 */
const ALLOWED_SERVICES = new Set([
  "Диагностика автомобиля",
  "Ремонт подвески",
  "Тормозная система",
  "Техническое обслуживание",
  "Кондиционер и климат",
  "Электрика и электроника",
  "Другое / пока не знаю"
]);

function responseHeaders(origin) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Vary": "Origin",
    "X-Content-Type-Options": "nosniff"
  });
  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");
    headers.set("Access-Control-Max-Age", "86400");
  }
  return headers;
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: responseHeaders(origin)
  });
}

function allowedOrigin(request, env) {
  const origin = request.headers.get("Origin") || "";
  const configured = String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return configured.includes(origin) ? origin : "";
}

function clean(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

export default {
  async fetch(request, env) {
    const origin = allowedOrigin(request, env);
    if (!origin) return json({ ok: false, error: "Origin is not allowed." }, 403);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: responseHeaders(origin) });
    }
    if (request.method !== "POST") return json({ ok: false, error: "Method not allowed." }, 405, origin);

    const contentType = request.headers.get("Content-Type") || "";
    if (!contentType.toLowerCase().includes("application/json")) {
      return json({ ok: false, error: "JSON is required." }, 415, origin);
    }

    let rawBody = "";
    try {
      rawBody = await request.text();
    } catch {
      return json({ ok: false, error: "Unable to read request." }, 400, origin);
    }
    if (new TextEncoder().encode(rawBody).length > 12000) {
      return json({ ok: false, error: "Request is too large." }, 413, origin);
    }

    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return json({ ok: false, error: "Invalid JSON." }, 400, origin);
    }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return json({ ok: false, error: "Invalid request body." }, 400, origin);
    }

    // Honeypot: silently accept automated submissions without forwarding them.
    if (clean(payload.website, 200)) return json({ ok: true }, 200, origin);

    const startedAt = Number(payload.startedAt || 0);
    const elapsed = Date.now() - startedAt;
    if (!Number.isFinite(startedAt) || elapsed < 1800 || elapsed > 172800000) {
      return json({ ok: false, error: "The form session has expired. Please reload the page." }, 400, origin);
    }

    const name = clean(payload.name, 80);
    const phone = clean(payload.phone, 32);
    const service = clean(payload.service, 80);
    const message = clean(payload.message, 1200);
    const phoneDigits = phone.replace(/\D/g, "");

    if (name.length < 2) return json({ ok: false, error: "Please enter your name." }, 422, origin);
    if (phoneDigits.length !== 11 || phoneDigits[0] !== "7") {
      return json({ ok: false, error: "Please enter a valid Russian phone number." }, 422, origin);
    }
    if (!ALLOWED_SERVICES.has(service)) return json({ ok: false, error: "Please select a valid service." }, 422, origin);

    if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
      return json({ ok: false, error: "The notification channel is not configured." }, 503, origin);
    }

    const telegramText = [
      "Новая заявка — GARAGE 78",
      "",
      "Имя: " + name,
      "Телефон: " + phone,
      "Услуга: " + service,
      "Автомобиль / описание: " + (message || "Не указано"),
      "",
      "Получено: " + new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })
    ].join("\n");

    try {
      const telegramResponse = await fetch(
        "https://api.telegram.org/bot" + env.TELEGRAM_BOT_TOKEN + "/sendMessage",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: env.TELEGRAM_CHAT_ID,
            text: telegramText,
            disable_web_page_preview: true
          })
        }
      );

      let telegramResult = {};
      try { telegramResult = await telegramResponse.json(); } catch (_) {}
      if (!telegramResponse.ok || telegramResult.ok !== true) {
        return json({ ok: false, error: "The notification could not be delivered." }, 502, origin);
      }
      return json({ ok: true }, 200, origin);
    } catch {
      return json({ ok: false, error: "The notification service is temporarily unavailable." }, 502, origin);
    }
  }
};
