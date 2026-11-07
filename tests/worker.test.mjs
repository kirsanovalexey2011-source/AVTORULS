import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../cloudflare/worker.js", import.meta.url), "utf8");
const imported = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
const worker = imported.default;

const origin = "https://kirsanovalexey2011-source.github.io";
const env = {
  ALLOWED_ORIGINS: origin,
  TELEGRAM_BOT_TOKEN: "unit-test-token",
  TELEGRAM_CHAT_ID: "-100123456"
};

function makePayload(overrides = {}) {
  return {
    name: "Тестовый клиент",
    phone: "+7 (999) 123-45-67",
    service: "Диагностика автомобиля",
    message: "Проверка тестовой заявки",
    website: "",
    consent: true,
    startedAt: Date.now() - 3000,
    ...overrides
  };
}

function makeRequest(payload, options = {}) {
  const headers = new Headers({
    "Content-Type": "application/json",
    Origin: options.origin ?? origin
  });
  return new Request("https://worker.test/booking", {
    method: options.method ?? "POST",
    headers,
    body: options.body ?? JSON.stringify(payload)
  });
}

async function withFetchStub(stub, callback) {
  const previous = globalThis.fetch;
  globalThis.fetch = stub;
  try {
    await callback();
  } finally {
    globalThis.fetch = previous;
  }
}

test("rejects requests from origins not on the allowlist", async () => {
  const response = await worker.fetch(makeRequest(makePayload(), { origin: "https://evil.example" }), env);
  assert.equal(response.status, 403);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), null);
});

test("answers CORS preflight without a response body", async () => {
  const response = await worker.fetch(makeRequest({}, { method: "OPTIONS" }), env);
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), origin);
  assert.equal(await response.text(), "");
});

test("requires explicit personal-data consent", async () => {
  const response = await worker.fetch(
    makeRequest(makePayload({ consent: false })),
    env
  );
  assert.equal(response.status, 422);
  assert.equal((await response.json()).ok, false);
});

test("rejects invalid phone numbers without calling Telegram", async () => {
  await withFetchStub(async () => {
    throw new Error("Telegram must not be called for invalid data");
  }, async () => {
    const response = await worker.fetch(
      makeRequest(makePayload({ phone: "+7 (999) 12" })),
      env
    );
    assert.equal(response.status, 422);
    assert.equal((await response.json()).ok, false);
  });
});

test("silently drops honeypot submissions", async () => {
  await withFetchStub(async () => {
    throw new Error("Telegram must not be called for honeypot submissions");
  }, async () => {
    const response = await worker.fetch(
      makeRequest(makePayload({ website: "spam-bot-filled-this" })),
      env
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
  });
});

test("rejects oversized request bodies", async () => {
  const response = await worker.fetch(
    makeRequest({}, { body: JSON.stringify({ ...makePayload(), message: "x".repeat(13000) }) }),
    env
  );
  assert.equal(response.status, 413);
});

test("forwards valid booking data to Telegram and returns success", async () => {
  await withFetchStub(async (url, options) => {
    assert.match(String(url), /api\.telegram\.org\/botunit-test-token\/sendMessage$/);
    const body = JSON.parse(options.body);
    assert.equal(body.chat_id, env.TELEGRAM_CHAT_ID);
    assert.match(body.text, /Тестовый клиент/);
    assert.match(body.text, /\+7 \(999\) 123-45-67/);
    return Response.json({ ok: true }, { status: 200 });
  }, async () => {
    const response = await worker.fetch(makeRequest(makePayload()), env);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
  });
});

test("fails closed when Telegram secrets are missing", async () => {
  const response = await worker.fetch(
    makeRequest(makePayload()),
    { ALLOWED_ORIGINS: origin }
  );
  assert.equal(response.status, 503);
});
